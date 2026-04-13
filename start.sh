#!/bin/bash

echo "🔩 MetaGross — Supercomputer-level team intelligence"
echo "=================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node.js 20+ first."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Found: $(node -v)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Check npm dependencies
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 Installing dependencies..."
  npm install
fi
echo "✅ Dependencies installed"

# Check .env file
if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
  echo ""
  echo "⚠️  No .env file found. Copying from .env.example..."
  cp .env.example .env
  echo "📝 Edit .env and add your OPENAI_API_KEY or ANTHROPIC_API_KEY for AI features."
  echo "   (Rule-based analysis works without any API key)"
fi

# Show AI status
if grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null || grep -q "OPENAI_API_KEY=sk-" .env.local 2>/dev/null; then
  echo "✅ OpenAI API key configured"
elif grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null || grep -q "ANTHROPIC_API_KEY=sk-" .env.local 2>/dev/null; then
  echo "✅ Anthropic API key configured"
else
  echo "⚠️  No AI API key found — AI features disabled (rule-based analysis still works)"
fi

# Push database schema
echo ""
echo "🗄️  Setting up database..."
npx drizzle-kit push 2>&1 | tail -1
echo "✅ Database ready"

# Ensure data directory exists
mkdir -p data/db

# Seed if database is empty
DB_FILE="data/db/metagross.db"
if [ -f "$DB_FILE" ]; then
  ROW_COUNT=$(node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$DB_FILE');
    try { console.log(db.prepare('SELECT COUNT(*) as c FROM teams').get().c); }
    catch(e) { console.log(0); }
    db.close();
  " 2>/dev/null)
  if [ "$ROW_COUNT" = "0" ]; then
    echo "🌱 Seeding sample data..."
    npx tsx src/lib/db/seed.ts 2>/dev/null && echo "✅ Sample team seeded" || echo "⚠️  Seed skipped"
  fi
fi

PORT=4649

# Allocate more memory for Node (Next.js + LangGraph + @pkmn/dex can be heavy)
export NODE_OPTIONS="--max-old-space-size=4096"

# Kill any existing process on the port
if lsof -ti:$PORT > /dev/null 2>&1; then
  echo "⚠️  Port $PORT is in use, killing existing process..."
  lsof -ti:$PORT | xargs -r kill -9 2>/dev/null
  sleep 1
fi

# Graceful shutdown handler — forwards Ctrl+C to the dev server
trap 'echo ""; echo "👋 Shutting down MetaGross..."; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM

# Restart-on-crash loop
echo ""
echo "🚀 Starting MetaGross on port $PORT..."
echo "   Memory limit: 4GB | Auto-restart on crash: ON"
echo "   Open http://localhost:$PORT in your browser"
echo "   Press Ctrl+C to stop"
echo ""

RESTART_COUNT=0
MAX_RESTARTS=5

while true; do
  npx next dev -p $PORT
  EXIT_CODE=$?

  # Exit code 0 or 130 (Ctrl+C) means intentional shutdown — don't restart
  if [ $EXIT_CODE -eq 0 ] || [ $EXIT_CODE -eq 130 ]; then
    echo ""
    echo "✅ MetaGross stopped cleanly."
    break
  fi

  RESTART_COUNT=$((RESTART_COUNT + 1))
  if [ $RESTART_COUNT -ge $MAX_RESTARTS ]; then
    echo ""
    echo "❌ MetaGross crashed $MAX_RESTARTS times in a row. Stopping."
    echo "   Check the logs above for the error."
    exit 1
  fi

  echo ""
  echo "💥 MetaGross crashed (exit code $EXIT_CODE). Restarting... ($RESTART_COUNT/$MAX_RESTARTS)"
  sleep 2
done

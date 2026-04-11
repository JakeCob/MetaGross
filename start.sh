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

# Seed if database is empty
DB_FILE="metagross.db"
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

# Start dev server
echo ""
echo "🚀 Starting MetaGross on port $PORT..."
echo "   Open http://localhost:$PORT in your browser"
echo ""
npx next dev -p $PORT

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

# Allocate more memory for Node. Next.js + LangGraph + @pkmn/dex +
# embeddings + the memory-extractor LLM all coexist in one process, and
# 4GB was tripping the WSL OOM killer (SIGTERM = exit 143) under long
# team-build conversations. 6GB gives comfortable headroom. Override
# METAGROSS_NODE_MEMORY if you're on a tighter machine.
export NODE_OPTIONS="--max-old-space-size=${METAGROSS_NODE_MEMORY:-6144}"

# Free the port. Used both at startup and inside the restart loop —
# without re-running this between retries, a stale dev server holding
# the port produces 5 EADDRINUSE failures in a row and the loop dies.
free_port() {
  # Kill any RIVAL start.sh instances first. Without this, a previous
  # backgrounded start.sh keeps respawning `next dev` in its restart
  # loop and steals the port back from us between iterations.
  # Skip our own PID + ancestor PIDs so we don't suicide.
  ME=$$
  PARENT=$(ps -o ppid= $ME 2>/dev/null | tr -d ' ' || echo 0)
  pgrep -f "start\.sh" 2>/dev/null | while read -r pid; do
    if [ "$pid" != "$ME" ] && [ "$pid" != "$PARENT" ]; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done

  if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "⚠️  Port $PORT is in use; killing the holding process(es)..."
    # Walk up the parent chain so the npm-exec / sh wrapper can't
    # re-spawn the child after we kill it. We grab PIDs first, then
    # kill -9 the whole set in one pass.
    HOLDER_PIDS=$(lsof -ti:$PORT 2>/dev/null)
    for pid in $HOLDER_PIDS; do
      ppid=$(ps -o ppid= "$pid" 2>/dev/null | tr -d ' ')
      gppid=$(ps -o ppid= "$ppid" 2>/dev/null | tr -d ' ')
      kill -9 "$pid" "$ppid" "$gppid" 2>/dev/null || true
    done
    # Belt and braces — fuser kills processes lsof might miss
    # (different namespaces, etc.). Both project-specific patterns
    # so we don't kill unrelated next-dev servers (e.g. another
    # project on a different port).
    fuser -k "${PORT}/tcp" 2>/dev/null || true
    pkill -9 -f "next dev -p $PORT" 2>/dev/null || true
    pkill -9 -f "MetaGross/node_modules/.bin/next" 2>/dev/null || true
    # Wait up to 5s for the kernel to release the socket. WSL can
    # leave it in TIME_WAIT for a beat.
    for _ in 1 2 3 4 5; do
      if ! lsof -ti:$PORT > /dev/null 2>&1; then return 0; fi
      sleep 1
    done
    if lsof -ti:$PORT > /dev/null 2>&1; then
      echo "❌ Could not free port $PORT. Still held by:"
      lsof -i:$PORT 2>&1 | head -5
      return 1
    fi
  fi
  return 0
}

free_port || exit 1

# Clear stale .next dev cache. HMR holds onto intermediate parse errors
# from mid-save states, so a file that's now syntactically valid can
# still show up as broken in the browser. Blowing the cache on every
# start gives a clean recompile. Pass --keep-cache to skip (rare — only
# when debugging a specific build artefact).
if [ "$1" != "--keep-cache" ] && [ -d ".next" ]; then
  echo "🧹 Clearing .next cache..."
  rm -rf .next
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
  # Bind to 127.0.0.1 (IPv4 loopback) instead of the default ::
  # (IPv6 wildcard). Under WSL2 the v4-loopback socket is stable when
  # other localhost services start/stop on the box; the IPv6 wildcard
  # socket can be invalidated when WSL's vEthernet bridge renegotiates,
  # producing SIGTERM (exit 143) and EADDRINUSE crashes on neighbour
  # state changes. Override with METAGROSS_HOST=0.0.0.0 if you ever
  # need to hit the dev server from another device on the LAN.
  npx next dev -p $PORT -H "${METAGROSS_HOST:-127.0.0.1}"
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
  # If the previous next-dev half-died and is still bound to the port,
  # the next iteration will fail with EADDRINUSE on every retry.
  # Re-run the killer between attempts so the loop can recover.
  free_port || {
    echo "❌ Port $PORT could not be freed between restarts. Aborting."
    exit 1
  }
  sleep 2
done

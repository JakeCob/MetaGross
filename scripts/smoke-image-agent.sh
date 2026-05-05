#!/bin/bash
# Smoke test for the image-input pipeline.
#
# Sends a tiny 1x1 PNG to /api/agent with a question that forces the
# model to acknowledge the image. Streams the SSE response and fails
# with a non-zero exit if:
#   - server isn't reachable
#   - the response stream errors out
#   - no `text` event arrives within 90s (model never answered)
#
# Usage:
#   ./scripts/smoke-image-agent.sh
#   METAGROSS_PORT=4650 ./scripts/smoke-image-agent.sh
#   PROMPT="What color is this?" ./scripts/smoke-image-agent.sh

set -euo pipefail

PORT="${METAGROSS_PORT:-4649}"
HOST="${METAGROSS_HOST:-127.0.0.1}"
URL="http://${HOST}:${PORT}/api/agent"
PROMPT="${PROMPT:-What do you see in this image? Answer in 1 sentence.}"

# Smallest valid PNG (1x1 transparent) — tests the encoding path
# without expecting a specific answer.
TINY_PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

echo "[$(date -Iseconds)] Smoke test -> ${URL}"
echo "[$(date -Iseconds)] Prompt: ${PROMPT}"

# Server reachability — fail fast with a clear message instead of
# burning 90s on an unreachable port.
if ! curl -fsS --max-time 3 "http://${HOST}:${PORT}/api/champions/roster" \
     >/dev/null 2>&1; then
  echo "[$(date -Iseconds)] FAIL Server not reachable at ${HOST}:${PORT}. Run ./start.sh first." >&2
  exit 2
fi

PAYLOAD=$(jq -n \
  --arg msg "$PROMPT" \
  --arg url "data:image/png;base64,$TINY_PNG_B64" \
  '{
    message: $msg,
    contextType: "general",
    persona: "default",
    attachments: [
      { name: "smoke.png", mimeType: "image/png", dataUrl: $url }
    ]
  }')

# Capture the SSE stream and count text events.
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

curl --max-time 90 -fsSN "$URL" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" \
  > "$TMPFILE" 2>&1 || {
    echo "[$(date -Iseconds)] FAIL curl failed:" >&2
    head -20 "$TMPFILE" >&2
    exit 3
  }

TEXT_EVENTS=$(grep -c "^event: text$" "$TMPFILE" || true)
DONE_EVENTS=$(grep -c "^event: done$" "$TMPFILE" || true)
ERROR_EVENTS=$(grep -c "^event: error$" "$TMPFILE" || true)
THREAD_LINE=$(grep "^data:" "$TMPFILE" | grep '"threadId"' | head -1)

echo "[$(date -Iseconds)] Stream summary: text=${TEXT_EVENTS} done=${DONE_EVENTS} error=${ERROR_EVENTS}"

if [ "$ERROR_EVENTS" -gt 0 ]; then
  echo "[$(date -Iseconds)] FAIL Server emitted error event(s):" >&2
  grep -A1 "^event: error" "$TMPFILE" | head -10 >&2
  exit 4
fi

if [ "$TEXT_EVENTS" -eq 0 ]; then
  echo "[$(date -Iseconds)] FAIL No text events. Model did not respond. Last 30 lines:" >&2
  tail -30 "$TMPFILE" >&2
  exit 5
fi

# Snippet of the assistant's reply for human eyeballing.
echo "[$(date -Iseconds)] PASS Model responded. First text chunks:"
grep "^data:" "$TMPFILE" | head -8 | sed 's/^/    /'

if [ -n "$THREAD_LINE" ]; then
  echo "[$(date -Iseconds)] Thread: ${THREAD_LINE}"
fi

echo "[$(date -Iseconds)] PASS Image-input smoke test passed."

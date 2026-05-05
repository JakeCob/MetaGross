#!/bin/bash
# Weekly VGCPastes refresh.
#
# Pings the aggregate endpoint to pull the latest community-curated
# tournament teams from the VGCPastes Google Sheet. Designed for cron:
#
#   crontab -e
#   0 23 * * 0  /root/Programming\ Projects/Personal/MetaGross/scripts/refresh-vgcpastes.sh >> /var/log/metagross-vgcpastes.log 2>&1
#
# Skips silently if the dev server isn't running. Prints the
# aggregation result counts to stdout so cron's mail wrapper (or the
# logfile redirect) records what happened.

set -euo pipefail

PORT="${METAGROSS_PORT:-4649}"
URL="http://localhost:${PORT}/api/meta-teams/aggregate"

echo "[$(date -Iseconds)] VGCPastes refresh starting → ${URL}"

# Server reachability probe — exit cleanly if dev/prod server is down
# so cron doesn't email us a connection-refused error every Sunday.
if ! curl -fsS --max-time 3 "http://localhost:${PORT}/api/champions/roster" \
     >/dev/null 2>&1; then
  echo "[$(date -Iseconds)] MetaGross server not reachable on port ${PORT} — skipping."
  exit 0
fi

RESPONSE=$(curl -fsS --max-time 600 \
  -X POST "${URL}" \
  -H 'Content-Type: application/json' \
  -d '{"source":"vgcpastes"}')

echo "[$(date -Iseconds)] VGCPastes refresh complete:"
# Pretty-print if jq is available; fall back to raw JSON otherwise.
if command -v jq >/dev/null 2>&1; then
  echo "${RESPONSE}" | jq '.vgcpastes // .'
else
  echo "${RESPONSE}"
fi

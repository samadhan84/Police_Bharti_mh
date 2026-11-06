#!/usr/bin/env bash
# Starts the API (:5080) and the web app (:5173) in the background. Logs: /tmp/api.log, /tmp/web.log
# Used by Codespaces automatically; run manually with:  bash scripts/dev.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT:-Development}
export ASPNETCORE_URLS=${ASPNETCORE_URLS:-http://0.0.0.0:5080}
DBHOST=${DB_HOST:-db}
echo "Waiting for MySQL at $DBHOST:3306 ..."
for i in $(seq 1 60); do (echo > /dev/tcp/$DBHOST/3306) 2>/dev/null && break; sleep 2; done
pgrep -f PoliceBharti.Api >/dev/null || (cd "$ROOT/backend/PoliceBharti.Api" && nohup dotnet run > /tmp/api.log 2>&1 &)
pgrep -f "vite" >/dev/null || (cd "$ROOT/frontend" && nohup npm run dev > /tmp/web.log 2>&1 &)
echo "Started. Web app: http://localhost:5173   API health: http://localhost:5080/api/health"
echo "Admin login: register with admin@policebharti.local"

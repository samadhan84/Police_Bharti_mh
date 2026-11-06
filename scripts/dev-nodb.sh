#!/usr/bin/env bash
# Run the whole app WITHOUT MySQL: data in one SQLite file, questions loaded from a CSV.
#   bash scripts/dev-nodb.sh                 -> uses backend/sample-data/questions.csv
#   bash scripts/dev-nodb.sh my-questions.csv
# Delete backend/PoliceBharti.Api/policebharti-test.db to start from scratch.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CSV="$(realpath "${1:-$ROOT/backend/sample-data/questions.csv}")"
export ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5080
export Database__Provider=sqlite Seed__CsvPath="$CSV"
(cd "$ROOT/backend/PoliceBharti.Api" && nohup dotnet run > /tmp/api.log 2>&1 &)
(cd "$ROOT/frontend" && npm install --silent && nohup npm run dev > /tmp/web.log 2>&1 &)
echo "Starting with CSV questions: $CSV"
echo "Web: http://localhost:5173   (admin login: register admin@policebharti.local)"
echo "Logs: /tmp/api.log /tmp/web.log"

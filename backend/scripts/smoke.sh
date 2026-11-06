#!/usr/bin/env bash
# End-to-end API smoke test: register -> full mock -> submit -> analytics.  Usage: smoke.sh [base_url]
set -euo pipefail
B=${1:-http://localhost:5080/api}; E="smoke$RANDOM@x.com"
J='content-type: application/json'
TOKEN=$(curl -sf -XPOST $B/auth/register -H "$J" -d "{\"name\":\"Smoke\",\"email\":\"$E\",\"password\":\"secret1\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
A="Authorization: Bearer $TOKEN"
curl -sf -H "$A" $B/subjects; echo
curl -sf -XPOST $B/attempts -H "$A" -H "$J" -d '{"mode":"full"}' > /tmp/att.json
python3 - <<'PY'
import json
a=json.load(open('/tmp/att.json'))
print("attempt",a['attemptId'],"questions",len(a['questions']),"sec",a['durationSec'])
ans=[{"questionId":q['id'],"selected":0 if i%2==0 else None,"timeSec":40} for i,q in enumerate(a['questions'])]
json.dump({"answers":ans,"timeTakenSec":1800},open('/tmp/sub.json','w')); open('/tmp/aid','w').write(str(a['attemptId']))
PY
curl -sf -XPOST $B/attempts/$(cat /tmp/aid)/submit -H "$A" -H "$J" -d @/tmp/sub.json; echo
curl -sf -H "$A" $B/analytics | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['summary']);print(*d['recommendations'],sep='\n')"
echo "bad login -> $(curl -s -o /dev/null -w '%{http_code}' -XPOST $B/auth/login -H "$J" -d '{"email":"x@x.com","password":"bad"}')"
echo "no token  -> $(curl -s -o /dev/null -w '%{http_code}' $B/analytics)"

#!/usr/bin/env bash
# Admin API smoke test. Needs the API running in Development (admin email = admin@policebharti.local).
set -uo pipefail
B=${1:-http://localhost:5080/api}; J='content-type: application/json'
tok(){ curl -s -XPOST $B/auth/$1 -H "$J" -d "{\"name\":\"$2\",\"email\":\"$3\",\"password\":\"secret1\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"; }
ADMIN=$(tok register Admin admin@policebharti.local); [ -z "$ADMIN" ] && ADMIN=$(tok login Admin admin@policebharti.local)
USER=$(tok register Stu "stu$RANDOM@x.com")
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
echo "student  -> /admin/stats        : $(code -H "Authorization: Bearer $USER" $B/admin/stats) (expect 403)"
echo "no token -> /admin/stats        : $(code $B/admin/stats) (expect 401)"
echo "admin    -> /admin/stats        : $(code -H "Authorization: Bearer $ADMIN" $B/admin/stats) (expect 200)"
curl -s -H "Authorization: Bearer $ADMIN" $B/admin/template.csv -o /tmp/tpl.csv; echo "template rows: $(($(wc -l < /tmp/tpl.csv)-1)) (expect 2)"
imp(){ python3 - "$1" "$2" "$3" <<'PY' | curl -s -XPOST $B/admin/questions/import -H "Authorization: Bearer $ADMIN" -H "$J" -d @- | python3 -c "import sys,json;d=json.load(sys.stdin);print({k:d[k] for k in d if k!='rows'});[print('  row',r['row'],r['status'],r['errors']) for r in d.get('rows',[]) if r['status']!='valid']"
import sys,json
fmt,path,dry=sys.argv[1:4]
print(json.dumps({"format":fmt,"content":open(path,encoding='utf-8').read(),"dryRun":dry=="1"},ensure_ascii=False))
PY
}
echo "-- dry run template";   imp csv /tmp/tpl.csv 1
echo "-- real import";        imp csv /tmp/tpl.csv 0
echo "-- re-import (dups)";   imp csv /tmp/tpl.csv 0
cat > /tmp/bad.json <<'J'
[{"subject":"Arithmetic","topic_en":"Percentage","topic_mr":"टक्केवारी","difficulty":"9","question_en":"Q?","question_mr":"प्र?","en_a":"1","en_b":"1","en_c":"3","en_d":"4","mr_a":"1","mr_b":"2","mr_c":"3","mr_d":"4","correct":"E","explanation_en":"x","explanation_mr":"x"},
 {"subject":"Physics","topic_en":"T","topic_mr":"T","difficulty":"1","question_en":"Q2?","question_mr":"प्र2?","en_a":"1","en_b":"2","en_c":"3","en_d":"4","mr_a":"1","mr_b":"2","mr_c":"3","mr_d":"4","correct":"A","explanation_en":"x","explanation_mr":"x"},
 {"subject":"Physics","subject_mr":"भौतिकशास्त्र","topic_en":"T","topic_mr":"T","difficulty":1,"question_en":"New subject Q?","question_mr":"नवीन विषय?","en_a":"1","en_b":"2","en_c":"3","en_d":"4","mr_a":"१","mr_b":"२","mr_c":"३","mr_d":"४","correct":"b","explanation_en":"x","explanation_mr":"x"}]
J
echo "-- json (2 invalid, 1 valid new subject)"; imp json /tmp/bad.json 0
curl -s -H "Authorization: Bearer $ADMIN" "$B/admin/questions?q=New" | python3 -c "import sys,json;d=json.load(sys.stdin);print('list:',d['total'],d['items'][0]['subject'],d['items'][0]['correct'])"
ID=$(curl -s -H "Authorization: Bearer $ADMIN" "$B/admin/questions?q=New" | python3 -c "import sys,json;print(json.load(sys.stdin)['items'][0]['id'])")
echo "delete new q: $(code -XDELETE -H "Authorization: Bearer $ADMIN" $B/admin/questions/$ID) (expect 204)"

#!/bin/zsh
# Executa SQL no projeto compartilhado via Management API (curl: o urllib toma 403).
set -e
TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' ~/.config/impresilk/supabase.env | cut -d= -f2)
curl -s -X POST "https://api.supabase.com/v1/projects/heveemylixartyijxewh/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'query':sys.stdin.read()}))" < "$1")"

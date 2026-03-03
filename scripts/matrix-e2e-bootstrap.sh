#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MATRIX_HS="${MATRIX_HS:-http://127.0.0.1:8008}"
DCF_BASE_URL="${DCF_BASE_URL:-http://127.0.0.1:3000}"
BOT_LOCALPART="${MATRIX_BOT_LOCALPART:-dcfbot}"
BOT_PASSWORD="${MATRIX_BOT_PASSWORD:-dcfbot123}"
USER_LOCALPART="${MATRIX_USER_LOCALPART:-opsuser}"
USER_PASSWORD="${MATRIX_USER_PASSWORD:-opsuser123}"
AGENT_NAME="${MATRIX_AGENT_NAME:-matrix-auto-agent-$(date +%H%M%S)}"

json_field() {
  local key="$1"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));if(!(\"$key\" in d)){process.exit(2)};process.stdout.write(String(d[\"$key\"]));"
}

urlenc() {
  local value="$1"
  node -e "process.stdout.write(encodeURIComponent(process.argv[1]||''))" "$value"
}

ensure_user() {
  local user="$1"
  local pass="$2"
  local full="@${user}:localhost"

  local login_body
  login_body="$(cat <<JSON
{"type":"m.login.password","user":"${user}","password":"${pass}"}
JSON
)"
  local login_res
  login_res="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" -H 'content-type: application/json' -d "${login_body}")" || true
  if echo "$login_res" | rg -q '"access_token"'; then
    echo "$login_res" | json_field access_token
    return
  fi

  docker exec dcf-matrix-synapse register_new_matrix_user -u "$user" -p "$pass" -c /data/homeserver.yaml "http://localhost:8008" >/dev/null
  login_res="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" -H 'content-type: application/json' -d "${login_body}")"
  if ! echo "$login_res" | rg -q '"access_token"'; then
    echo "[error] login failed for ${full}: ${login_res}"
    exit 1
  fi
  echo "$login_res" | json_field access_token
}

echo "[e2e] ensure matrix users"
BOT_TOKEN="$(ensure_user "$BOT_LOCALPART" "$BOT_PASSWORD")"
USER_TOKEN="$(ensure_user "$USER_LOCALPART" "$USER_PASSWORD")"
BOT_USER_ID="@${BOT_LOCALPART}:localhost"

echo "[e2e] create room"
ROOM_RES="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/createRoom" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"dcf-e2e-room\",\"preset\":\"private_chat\"}")"
ROOM_ID="$(echo "$ROOM_RES" | json_field room_id)"

echo "[e2e] invite and join bot"
curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$ROOM_ID")/invite" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"user_id\":\"${BOT_USER_ID}\"}" >/dev/null
curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/join/$(urlenc "$ROOM_ID")" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{}' >/dev/null

echo "[e2e] send create command via matrix room"
TXN_ID="txn_$(date +%s)"
curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$ROOM_ID")/send/m.room.message/${TXN_ID}" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"msgtype\":\"m.text\",\"body\":\"!create_agent ${AGENT_NAME}\"}" >/dev/null

echo "[e2e] query control plane until instance appears"
LOGIN_RES="$(curl -sS -X POST "${DCF_BASE_URL}/api/control/auth/login" -H 'content-type: application/json' -d '{"username":"admin","password":"admin123"}')"
ADMIN_TOKEN="$(echo "$LOGIN_RES" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(d.data&&d.data.token||'')")"
if [ -z "$ADMIN_TOKEN" ]; then
  echo "[error] cannot login admin to control plane"
  exit 1
fi

FOUND_ID=""
for _ in $(seq 1 30); do
  RES="$(curl -sS "${DCF_BASE_URL}/api/control/instances?name=${AGENT_NAME}" -H "Authorization: Bearer ${ADMIN_TOKEN}")"
  FOUND_ID="$(echo "$RES" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const row=(d.data||[])[0];process.stdout.write(row&&row.id?row.id:'')")"
  if [ -n "$FOUND_ID" ]; then
    break
  fi
  sleep 1
done

if [ -z "$FOUND_ID" ]; then
  echo "[error] instance not created from matrix message, name=${AGENT_NAME}"
  exit 1
fi

echo "[ok] matrix e2e success"
echo "room_id=${ROOM_ID}"
echo "agent_name=${AGENT_NAME}"
echo "instance_id=${FOUND_ID}"

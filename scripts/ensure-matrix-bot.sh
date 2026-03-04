#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MATRIX_HS="${MATRIX_HS:-http://127.0.0.1:8008}"
BOT_LOCALPART="${MATRIX_BOT_LOCALPART:-dcfbot}"
BOT_PASSWORD="${MATRIX_BOT_PASSWORD:-dcfbot123}"
BOT_DISPLAY_NAME="${MATRIX_BOT_DISPLAY_NAME:-数字工厂bot}"

wait_matrix() {
  for _ in $(seq 1 80); do
    if curl -fsS "${MATRIX_HS}/_matrix/client/versions" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! wait_matrix; then
  echo "[warn] matrix homeserver unavailable: ${MATRIX_HS}"
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -q '^dcf-matrix-synapse$'; then
  echo "[warn] synapse container not found, skip bot bootstrap"
  exit 0
fi

docker exec dcf-matrix-synapse register_new_matrix_user \
  --exists-ok --no-admin \
  -u "$BOT_LOCALPART" -p "$BOT_PASSWORD" \
  -c /data/homeserver.yaml "http://localhost:8008" >/dev/null

LOGIN_PAYLOAD="$(cat <<JSON
{"type":"m.login.password","identifier":{"type":"m.id.user","user":"${BOT_LOCALPART}"},"password":"${BOT_PASSWORD}"}
JSON
)"

LOGIN_RES="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" \
  -H 'content-type: application/json' \
  -d "${LOGIN_PAYLOAD}")"

BOT_TOKEN="$(echo "$LOGIN_RES" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d.access_token||''));" 2>/dev/null || true)"
BOT_USER_ID="$(echo "$LOGIN_RES" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d.user_id||''));" 2>/dev/null || true)"

if [ -z "$BOT_TOKEN" ] || [ -z "$BOT_USER_ID" ]; then
  echo "[warn] bot login failed, cannot set display name: $LOGIN_RES"
  exit 0
fi

ENC_USER_ID="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]||''))" "$BOT_USER_ID")"
curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/profile/${ENC_USER_ID}/displayname" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"displayname\":\"${BOT_DISPLAY_NAME}\"}" >/dev/null || true

echo "[ok] matrix bot ready: ${BOT_DISPLAY_NAME} (${BOT_USER_ID})"

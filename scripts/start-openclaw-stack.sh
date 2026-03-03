#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/local/docker-compose.openclaw-matrix.yml"
MATRIX_DATA_DIR="$ROOT_DIR/runtime/matrix/data"
OPENCLAW_CONFIG_DIR="$ROOT_DIR/runtime/openclaw/config"
OPENCLAW_WORKSPACE_DIR="$ROOT_DIR/runtime/openclaw/workspace"

mkdir -p "$MATRIX_DATA_DIR" "$OPENCLAW_CONFIG_DIR" "$OPENCLAW_WORKSPACE_DIR"

if ! docker info >/dev/null 2>&1; then
  echo "[error] docker daemon not available"
  exit 1
fi

if ! docker image inspect openclaw:local >/dev/null 2>&1; then
  if docker image inspect dcf/openclaw:local >/dev/null 2>&1; then
    echo "[start] tag dcf/openclaw:local -> openclaw:local"
    docker tag dcf/openclaw:local openclaw:local
  else
    echo "[error] image openclaw:local not found, and dcf/openclaw:local not found"
    exit 1
  fi
fi

if [ ! -f "$MATRIX_DATA_DIR/homeserver.yaml" ]; then
  echo "[start] generating Synapse config"
  docker run --rm \
    -e SYNAPSE_SERVER_NAME=localhost \
    -e SYNAPSE_REPORT_STATS=no \
    -v "$MATRIX_DATA_DIR:/data" \
    matrixdotorg/synapse:latest generate
fi

echo "[start] starting matrix + openclaw"
docker compose -f "$COMPOSE_FILE" up -d

for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8008/_matrix/client/versions >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

OPENCLAW_OK=0
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:18789/ >/dev/null 2>&1; then
    OPENCLAW_OK=1
    break
  fi
  sleep 1
done

if [ "$OPENCLAW_OK" -ne 1 ]; then
  echo "[error] openclaw gateway not ready on :18789"
  docker logs --tail 80 dcf-openclaw-gateway || true
  exit 1
fi

echo "[ok] stack started"
docker compose -f "$COMPOSE_FILE" ps

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

bash scripts/start-openclaw-stack.sh
bash scripts/stop-dcf-app.sh
bash scripts/start-dcf-app.sh
bash scripts/check-openclaw-stack.sh
bash scripts/check-dcf-app.sh
npm run matrix:e2e

echo "[ok] all checks passed"

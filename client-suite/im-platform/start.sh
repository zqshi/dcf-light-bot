#!/usr/bin/env bash
# DCF IM 平台启动脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  DCF 数字员工协作平台 - IM Platform        ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}首次启动，正在安装依赖...${NC}"
  npm install
fi

# Mode selection
MODE="${1:-dev}"

case "$MODE" in
  dev)
    echo -e "${GREEN}启动开发服务器 (port 5200)...${NC}"
    echo -e ""
    echo -e "  本地访问:  ${BLUE}http://localhost:5200${NC}"
    echo -e "  Demo 模式: 点击登录页「Demo 模式体验」按钮"
    echo -e "  Matrix 模式: 需要 Synapse homeserver (port 8008)"
    echo -e ""
    npx vite --host
    ;;
  build)
    echo -e "${GREEN}构建生产版本...${NC}"
    npx vite build
    echo -e "${GREEN}构建完成，输出目录: dist/${NC}"
    ;;
  preview)
    echo -e "${GREEN}预览生产版本 (port 5200)...${NC}"
    npx vite build
    npx vite preview --host --port 5200
    ;;
  *)
    echo "用法: $0 {dev|build|preview}"
    exit 1
    ;;
esac

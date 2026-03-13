#!/bin/bash

set -e

INSTALL_DIR="/opt/lxcmaster"
DATA_DIR="/var/lib/lxcmaster"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

if [[ $EUID -ne 0 ]]; then
    log_error "此脚本需要 root 权限运行"
    exit 1
fi

log_info "停止服务..."
systemctl stop lxcmaster 2>/dev/null || true

log_info "禁用服务..."
systemctl disable lxcmaster 2>/dev/null || true

log_info "删除服务文件..."
rm -f /etc/systemd/system/lxcmaster.service
systemctl daemon-reload

log_info "删除安装目录..."
rm -rf "$INSTALL_DIR"

log_info "删除数据目录..."
read -p "是否删除数据目录 $DATA_DIR? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$DATA_DIR"
fi

log_info "删除服务用户..."
if id "lxcmaster" &>/dev/null; then
    userdel lxcmaster 2>/dev/null || true
fi

echo ""
log_info "LXCmaster 已卸载完成"

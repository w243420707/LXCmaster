#!/bin/bash

set -e

INSTALL_DIR="/opt/lxcmaster"
DATA_DIR="/var/lib/lxcmaster"
SERVICE_USER="lxcmaster"
DEFAULT_PORT=2026
PORT=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要 root 权限运行"
        exit 1
    fi
}

detect_system() {
    log_step "检测系统信息..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_ID=$(echo "$ID" | tr '[:upper:]' '[:lower:]')
        OS_VERSION_ID="$VERSION_ID"
        OS_PRETTY_NAME="$PRETTY_NAME"
    else
        log_error "无法检测系统版本"
        exit 1
    fi
    
    if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "debian" ]]; then
        log_error "不支持的系统: $OS_ID"
        log_info "此脚本仅支持 Ubuntu 和 Debian"
        exit 1
    fi
    
    log_info "系统: $OS_PRETTY_NAME"
}

detect_arch() {
    log_step "检测系统架构..."
    
    ARCH=$(uname -m)
    
    case "$ARCH" in
        x86_64|amd64)
            ARCH_TYPE="amd64"
            GO_ARCH="amd64"
            NODE_ARCH="x64"
            ;;
        aarch64|arm64)
            ARCH_TYPE="arm64"
            GO_ARCH="arm64"
            NODE_ARCH="arm64"
            ;;
        *)
            log_error "不支持的架构: $ARCH"
            exit 1
            ;;
    esac
    
    log_info "架构: $ARCH ($ARCH_TYPE)"
}

get_port() {
    log_step "配置服务端口..."
    
    if [[ -n "$LXCMASTER_PORT" ]]; then
        PORT=$LXCMASTER_PORT
        log_info "使用环境变量端口: $PORT"
    elif [[ -t 0 ]]; then
        echo -e "${YELLOW}请输入服务监听端口 (直接回车使用默认端口 $DEFAULT_PORT):${NC}"
        read -r PORT_INPUT
        
        if [[ -z "$PORT_INPUT" ]]; then
            PORT=$DEFAULT_PORT
            log_info "使用默认端口: $PORT"
        else
            if [[ "$PORT_INPUT" =~ ^[0-9]+$ ]] && [[ "$PORT_INPUT" -ge 1 ]] && [[ "$PORT_INPUT" -le 65535 ]]; then
                PORT=$PORT_INPUT
                log_info "使用端口: $PORT"
            else
                log_error "无效的端口号，使用默认端口: $DEFAULT_PORT"
                PORT=$DEFAULT_PORT
            fi
        fi
    else
        PORT=$DEFAULT_PORT
        log_info "非交互模式，使用默认端口: $PORT"
    fi
}

install_incus() {
    log_step "检查并安装 Incus..."
    
    if command -v incus &> /dev/null; then
        INCUS_VERSION=$(incus --version 2>/dev/null || echo "unknown")
        log_info "已安装 Incus $INCUS_VERSION"
    else
        log_info "正在安装 Incus..."
        
        apt-get update
        apt-get install -y incus
        
        if command -v incus &> /dev/null; then
            INCUS_VERSION=$(incus --version 2>/dev/null || echo "unknown")
            log_info "Incus $INCUS_VERSION 安装成功"
        else
            log_error "Incus 安装失败"
            exit 1
        fi
    fi
    
    if ! incus storage list 2>/dev/null | grep -q "default"; then
        log_step "初始化 Incus..."
        log_info "正在自动配置 Incus (使用默认配置)..."
        
        cat << 'INCUS_INIT' | incus admin init --preseed
config: {}
networks:
- config:
    ipv4.address: auto
    ipv6.address: auto
  description: ""
  name: incusbr0
  type: ""
  project: default
storage_pools:
- config:
    size: auto
  description: ""
  name: default
  driver: dir
profiles:
- config: {}
  description: ""
  devices:
    eth0:
      name: eth0
      network: incusbr0
      type: nic
    root:
      path: /
      pool: default
      type: disk
  name: default
projects: []
cluster: null
INCUS_INIT
        
        if incus storage list 2>/dev/null | grep -q "default"; then
            log_info "Incus 初始化成功"
        else
            log_warn "Incus 自动初始化失败，请手动运行: incus admin init"
        fi
    else
        log_info "Incus 已初始化"
    fi
}

install_go() {
    log_step "安装 Go 环境..."
    
    if command -v go &> /dev/null; then
        GO_VERSION=$(go version 2>/dev/null | awk '{print $3}' | sed 's/go//')
        log_info "已安装 Go $GO_VERSION"
        return 0
    fi
    
    log_info "正在安装 Go..."
    
    GO_VERSION="1.21.6"
    GO_FILE="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
    GO_URL="https://go.dev/dl/${GO_FILE}"
    GO_MIRROR="https://mirrors.aliyun.com/golang/${GO_FILE}"
    
    log_info "下载 Go $GO_VERSION ($GO_ARCH)..."
    
    cd /tmp
    if wget -q "$GO_MIRROR" -O "$GO_FILE" 2>/dev/null || wget -q "$GO_URL" -O "$GO_FILE"; then
        tar -C /usr/local -xzf "$GO_FILE"
        rm -f "$GO_FILE"
        
        export PATH=$PATH:/usr/local/go/bin
        echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
        
        if ! grep -q '/usr/local/go/bin' /etc/environment 2>/dev/null; then
            sed -i 's|PATH="\(.*\)"|PATH="\1:/usr/local/go/bin"|' /etc/environment 2>/dev/null || true
        fi
        
        log_info "Go $GO_VERSION 安装完成"
    else
        log_error "Go 下载失败，尝试使用包管理器安装..."
        apt-get install -y golang-go
    fi
    
    cd - > /dev/null
}

install_nodejs() {
    log_step "安装 Node.js 环境..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version 2>/dev/null)
        log_info "已安装 Node.js $NODE_VERSION"
        return 0
    fi
    
    log_info "正在安装 Node.js..."
    
    NODE_VERSION="20.11.0"
    NODE_FILE="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_FILE}"
    NODE_MIRROR="https://npmmirror.com/mirrors/node/v${NODE_VERSION}/${NODE_FILE}"
    
    log_info "下载 Node.js $NODE_VERSION ($NODE_ARCH)..."
    
    cd /tmp
    if wget -q "$NODE_MIRROR" -O "$NODE_FILE" 2>/dev/null || wget -q "$NODE_URL" -O "$NODE_FILE"; then
        tar -C /usr/local -xJf "$NODE_FILE"
        rm -f "$NODE_FILE"
        
        NODE_DIR="/usr/local/node-v${NODE_VERSION}-linux-${NODE_ARCH}"
        ln -sf "$NODE_DIR/bin/node" /usr/local/bin/node
        ln -sf "$NODE_DIR/bin/npm" /usr/local/bin/npm
        ln -sf "$NODE_DIR/bin/npx" /usr/local/bin/npx
        
        log_info "Node.js $NODE_VERSION 安装完成"
    else
        log_error "Node.js 下载失败，尝试使用包管理器安装..."
        apt-get install -y nodejs npm
    fi
    
    cd - > /dev/null
}

install_dependencies() {
    log_step "安装系统依赖..."
    
    apt-get update
    apt-get install -y curl wget git ca-certificates
    
    install_go
    install_nodejs
}

create_user() {
    if ! id "$SERVICE_USER" &>/dev/null; then
        log_info "创建服务用户: $SERVICE_USER"
        useradd -r -s /bin/false "$SERVICE_USER"
    fi
}

create_directories() {
    log_step "创建目录结构..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$INSTALL_DIR/frontend"
    log_info "安装目录: $INSTALL_DIR"
    log_info "数据目录: $DATA_DIR"
}

build_backend() {
    log_step "构建后端服务..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/backend"
    
    export GOPROXY=https://goproxy.cn,direct
    export PATH=$PATH:/usr/local/go/bin
    
    go mod download
    CGO_ENABLED=0 go build -ldflags="-s -w" -o "$INSTALL_DIR/lxcmaster" ./cmd/server
    
    log_info "后端构建完成"
    cd - > /dev/null
}

build_frontend() {
    log_step "构建前端界面..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/frontend"
    
    npm install --registry=https://registry.npmmirror.com --silent
    npm run build
    
    if [[ -d "dist" ]]; then
        cp -r dist/* "$INSTALL_DIR/frontend/"
        log_info "前端构建完成"
    else
        log_error "前端构建失败"
        exit 1
    fi
    
    cd - > /dev/null
}

create_config() {
    log_step "创建配置文件..."
    
    mkdir -p "$DATA_DIR"
    
    cat > "$DATA_DIR/config.json" << EOF
{
    "server": {
        "port": $PORT,
        "host": "0.0.0.0",
        "data_dir": "$DATA_DIR"
    },
    "incus": {
        "socket_path": "/var/lib/incus/unix.socket"
    }
}
EOF
    
    log_info "配置文件已创建: $DATA_DIR/config.json"
}

install_service() {
    log_step "安装 systemd 服务..."
    
    cat > /etc/systemd/system/lxcmaster.service << EOF
[Unit]
Description=LXCmaster - Incus Container Management Panel
After=network.target incus.service
Requires=incus.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$INSTALL_DIR
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin"
ExecStart=$INSTALL_DIR/lxcmaster -port $PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable lxcmaster
    log_info "systemd 服务已安装"
}

set_permissions() {
    log_info "设置文件权限..."
    chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
    chmod 755 "$INSTALL_DIR/lxcmaster"
    chmod -R 755 "$INSTALL_DIR/frontend"
}

start_service() {
    log_step "启动服务..."
    systemctl start lxcmaster
    
    sleep 3
    
    if systemctl is-active --quiet lxcmaster; then
        log_info "服务启动成功!"
    else
        log_error "服务启动失败"
        log_info "查看日志: journalctl -u lxcmaster -n 50"
        exit 1
    fi
}

download_images() {
    log_step "下载预设镜像..."
    
    log_info "下载 Alpine 3.18 镜像..."
    if incus image copy images:alpine/3.18 local: --alias alpine/3.18 --auto-update 2>/dev/null; then
        log_info "Alpine 3.18 镜像下载完成"
    else
        log_warn "Alpine 3.18 镜像下载失败，请手动下载: incus image copy images:alpine/3.18 local: --alias alpine/3.18"
    fi
    
    log_info "下载 Debian 11 镜像..."
    if incus image copy images:debian/11 local: --alias debian/11 --auto-update 2>/dev/null; then
        log_info "Debian 11 镜像下载完成"
    else
        log_warn "Debian 11 镜像下载失败，请手动下载: incus image copy images:debian/11 local: --alias debian/11"
    fi
}

print_success() {
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo ""
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}║           LXCmaster 安装完成!                          ║${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}➤ 系统信息:${NC}"
    echo -e "   系统: $OS_PRETTY_NAME"
    echo -e "   架构: $ARCH_TYPE"
    echo -e "   端口: $PORT"
    echo ""
    echo -e "${GREEN}➤ 管理面板访问地址:${NC}"
    echo ""
    echo -e "   ${GREEN}http://$SERVER_IP:$PORT${NC}"
    echo ""
    echo -e "${YELLOW}➤ 预设镜像:${NC}"
    echo -e "   • Alpine 3.18 (轻量推荐)"
    echo -e "   • Debian 11 (稳定)"
    echo ""
    echo -e "${YELLOW}➤ 常用命令:${NC}"
    echo -e "   查看状态: systemctl status lxcmaster"
    echo -e "   查看日志: journalctl -u lxcmaster -f"
    echo -e "   重启服务: systemctl restart lxcmaster"
    echo -e "   停止服务: systemctl stop lxcmaster"
    echo ""
    echo -e "${YELLOW}➤ 配置文件:${NC} $DATA_DIR/config.json"
    echo ""
}

print_banner() {
    echo ""
    echo "========================================"
    echo "   LXCmaster 一键安装脚本"
    echo "   Incus 容器管理面板"
    echo "========================================"
    echo ""
}

main() {
    print_banner
    
    check_root
    detect_system
    detect_arch
    get_port
    install_incus
    install_dependencies
    create_user
    create_directories
    build_backend
    build_frontend
    create_config
    install_service
    set_permissions
    start_service
    download_images
    print_success
}

main "$@"

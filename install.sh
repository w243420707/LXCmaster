#!/bin/bash

set -e

INSTALL_DIR="/opt/lxcmaster"
DATA_DIR="/var/lib/lxcmaster"
SERVICE_USER="lxcmaster"
DEFAULT_PORT=2026
PORT=""
INCUS_SOCKET=""
SOURCE_DIR="/tmp/lxcmaster-src"
USE_PREBUILT=false
SKIP_BUILD=false

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
        OS_CODENAME="${VERSION_CODENAME:-$UBUNTU_CODENAME}"
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
        elif [[ "$PORT_INPUT" =~ ^[0-9]+$ ]] && [[ "$PORT_INPUT" -ge 1 ]] && [[ "$PORT_INPUT" -le 65535 ]]; then
            PORT=$PORT_INPUT
        else
            log_warn "无效的端口号，使用默认端口 $DEFAULT_PORT"
            PORT=$DEFAULT_PORT
        fi
    else
        PORT=$DEFAULT_PORT
        log_info "非交互模式，使用默认端口: $PORT"
    fi
    
    log_info "服务端口: $PORT"
}

detect_incus() {
    log_step "检测 Incus/LXD..."
    
    if command -v incus &>/dev/null; then
        INCUS_SOCKET="/var/lib/incus/unix.socket"
        log_info "检测到 Incus"
    elif command -v lxc &>/dev/null && lxc --version &>/dev/null; then
        if snap list 2>/dev/null | grep -q "^lxd"; then
            INCUS_SOCKET="/var/snap/lxd/common/lxd/unix.socket"
            log_info "检测到 LXD (Snap)"
        else
            INCUS_SOCKET="/var/lib/lxd/unix.socket"
            log_info "检测到 LXD"
        fi
    else
        log_warn "未检测到 Incus 或 LXD，安装完成后需要手动配置"
        INCUS_SOCKET="/var/lib/incus/unix.socket"
    fi
}

install_dependencies() {
    log_step "安装依赖..."
    
    apt-get update
    
    apt-get install -y \
        curl \
        wget \
        git \
        ca-certificates \
        gnupg \
        lsb-release \
        software-properties-common \
        apt-transport-https
    
    log_info "基础依赖安装完成"
}

install_go() {
    if command -v go &>/dev/null && go version &>/dev/null; then
        GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
        log_info "Go 已安装: $GO_VERSION"
        return 0
    fi
    
    log_step "安装 Go..."
    
    GO_VERSION="1.21.6"
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
    GO_URL="https://golang.org/dl/${GO_TARBALL}"
    
    cd /tmp
    if ! wget -q --timeout=30 "$GO_URL" -O "$GO_TARBALL" 2>/dev/null; then
        log_warn "官方源下载失败，尝试国内镜像..."
        GO_URL="https://mirrors.aliyun.com/golang/${GO_TARBALL}"
        wget -q --timeout=60 "$GO_URL" -O "$GO_TARBALL"
    fi
    
    rm -rf /usr/local/go
    tar -C /usr/local -xzf "$GO_TARBALL"
    rm -f "$GO_TARBALL"
    
    export PATH=$PATH:/usr/local/go/bin
    
    if ! command -v go &>/dev/null; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
        echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
    fi
    
    log_info "Go 安装完成: $(go version)"
}

install_nodejs() {
    if command -v node &>/dev/null && node --version &>/dev/null; then
        NODE_VERSION=$(node --version)
        log_info "Node.js 已安装: $NODE_VERSION"
        return 0
    fi
    
    log_step "安装 Node.js..."
    
    if ! command -v npm &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
        apt-get install -y -qq nodejs
    fi
    
    log_info "Node.js 安装完成: $(node --version)"
}

install_incus() {
    local should_install_incus=false
    
    # 检查系统是否支持 Incus
    if [[ "$OS_ID" == "ubuntu" ]]; then
        local ubuntu_version=$(echo "$OS_VERSION_ID" | cut -d. -f1)
        if [[ "$ubuntu_version" -ge "22" ]]; then
            should_install_incus=true
        fi
    elif [[ "$OS_ID" == "debian" ]]; then
        if [[ "$OS_VERSION_ID" == "12" ]]; then
            should_install_incus=true
        fi
    fi
    
    # 如果系统支持 Incus，尝试安装或已安装则继续使用
    if [[ "$should_install_incus" == "true" ]]; then
        if command -v incus &>/dev/null; then
            log_info "Incus 已安装"
            return 0
        fi
        
        log_step "安装 Incus..."
        
        if [[ "$OS_ID" == "ubuntu" ]]; then
            local ubuntu_version=$(echo "$OS_VERSION_ID" | cut -d. -f1)
            
            if [[ "$ubuntu_version" -ge "24" ]]; then
                apt-get install -y incus
            elif [[ "$ubuntu_version" -ge "22" ]]; then
                log_info "添加 Incus PPA..."
                DEBIAN_FRONTEND=noninteractive add-apt-repository ppa:ubuntu-lxc/incus -y
                apt-get update
                apt-get install -y incus
            fi
        elif [[ "$OS_ID" == "debian" ]]; then
            if [[ "$OS_VERSION_ID" == "12" ]]; then
                apt-get install -y incus
            fi
        fi
        
        log_info "Incus 安装完成"
        return 0
    fi
    
    # 旧系统使用 LXD
    if command -v lxc &>/dev/null; then
        log_info "LXD 已安装"
        return 0
    fi
    
    log_step "安装 LXD..."
    
    log_warn "使用 Snap 安装 LXD"
    if ! command -v snap &>/dev/null; then
        apt-get install -y snapd
    fi
    snap install lxd --classic
    
    log_info "LXD 安装完成"
}

init_incus() {
    if command -v incus &>/dev/null; then
        if ! incus info &>/dev/null 2>&1; then
            log_step "初始化 Incus..."
            
            cat <<EOF | incus admin init --preseed
config:
  core.https_address: ''
  core.trust_password: ''
networks:
- config:
    ipv4.address: auto
    ipv6.address: auto
  description: ""
  name: incusbr0
  type: bridge
storage_pools:
- config:
    size: auto
  description: ""
  name: default
  driver: dir
profiles:
- config: {}
  description: Default Incus profile
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
EOF
            log_info "Incus 初始化完成"
        fi
        
        incus image copy images:alpine/3.18 local: --alias alpine/3.18 --auto-update &>/dev/null || true
        incus image copy images:debian/11 local: --alias debian/11 --auto-update &>/dev/null || true
        
    elif command -v lxc &>/dev/null; then
        if ! lxc info &>/dev/null 2>&1; then
            log_step "初始化 LXD..."
            lxd init --auto
            log_info "LXD 初始化完成"
        fi
        
        lxc image copy images:alpine/3.18 local: --alias alpine/3.18 --auto-update &>/dev/null || true
        lxc image copy images:debian/11 local: --alias debian/11 --auto-update &>/dev/null || true
    fi
}

clone_repo() {
    log_step "克隆源码..."
    
    rm -rf "$SOURCE_DIR"
    git clone --depth 1 https://github.com/w243420707/LXCmaster.git "$SOURCE_DIR"
    
    log_info "源码克隆完成: $SOURCE_DIR"
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

# 优化的并行构建函数
build_backend_optimized() {
    log_step "构建后端服务 (优化模式)..."
    
    cd "$SOURCE_DIR/backend"
    
    export GOPROXY=https://goproxy.cn,direct
    export PATH=$PATH:/usr/local/go/bin
    export GO111MODULE=on
    export CGO_ENABLED=0
    
    # 使用缓存加速依赖下载
    if [[ -d "$DATA_DIR/go-mod-cache" ]]; then
        export GOMODCACHE="$DATA_DIR/go-mod-cache"
    fi
    
    # 并行下载依赖
    log_info "下载 Go 依赖..."
    go mod download -x &
    local pid_download=$!
    
    # 等待下载完成
    wait $pid_download
    
    # 优化构建：禁用调试信息，减小体积，加速编译
    log_info "编译后端..."
    go build -ldflags="-s -w -extldflags '-static'" \
        -gcflags="-l=4" \
        -o "$INSTALL_DIR/lxcmaster" \
        ./cmd/server
    
    log_info "后端构建完成"
    cd - > /dev/null
}

# 优化的前端构建
build_frontend_optimized() {
    log_step "构建前端界面 (优化模式)..."
    
    cd "$SOURCE_DIR/frontend"
    
    # 使用 npm ci 替代 npm install（更快更可靠）
    if [[ -f "package-lock.json" ]]; then
        log_info "使用 npm ci 安装依赖..."
        npm ci --registry=https://registry.npmmirror.com --prefer-offline --no-audit --progress=false
    else
        log_info "使用 npm install 安装依赖..."
        npm install --registry=https://registry.npmmirror.com --no-audit --progress=false
    fi
    
    # 使用 Vite 的优化构建
    log_info "构建前端..."
    NODE_ENV=production npm run build
    
    if [[ -d "dist" ]]; then
        # 清理旧文件并复制新文件
        rm -rf "$INSTALL_DIR/frontend"/*
        cp -r dist/* "$INSTALL_DIR/frontend/"
        log_info "前端构建完成"
    else
        log_error "前端构建失败"
        exit 1
    fi
    
    cd - > /dev/null
}

# 并行构建函数
build_parallel() {
    log_step "开始并行构建 (后端+前端)..."
    
    local start_time=$(date +%s)
    
    # 后台构建后端
    (build_backend_optimized) &
    local pid_backend=$!
    
    # 后台构建前端
    (build_frontend_optimized) &
    local pid_frontend=$!
    
    # 等待两个构建完成
    local failed=0
    wait $pid_backend || { log_error "后端构建失败"; failed=1; }
    wait $pid_frontend || { log_error "前端构建失败"; failed=1; }
    
    if [[ $failed -eq 1 ]]; then
        exit 1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_info "并行构建完成，耗时: ${duration}秒"
}

# 使用预编译二进制文件
use_prebuilt_binaries() {
    log_step "使用预编译二进制文件..."
    
    local VERSION="latest"
    local DOWNLOAD_URL="https://github.com/w243420707/LXCmaster/releases/download/${VERSION}"
    
    # 下载后端二进制
    log_info "下载后端二进制..."
    if wget -q --timeout=60 "${DOWNLOAD_URL}/lxcmaster-linux-${ARCH_TYPE}" -O "$INSTALL_DIR/lxcmaster" 2>/dev/null; then
        chmod +x "$INSTALL_DIR/lxcmaster"
        log_info "后端下载完成"
    else
        log_warn "预编译后端下载失败，将本地构建"
        return 1
    fi
    
    # 下载前端静态文件
    log_info "下载前端静态文件..."
    if wget -q --timeout=60 "${DOWNLOAD_URL}/frontend-${ARCH_TYPE}.tar.gz" -O /tmp/frontend.tar.gz 2>/dev/null; then
        rm -rf "$INSTALL_DIR/frontend"/*
        tar -xzf /tmp/frontend.tar.gz -C "$INSTALL_DIR/frontend"
        rm -f /tmp/frontend.tar.gz
        log_info "前端下载完成"
    else
        log_warn "预编译前端下载失败，将本地构建"
        return 1
    fi
    
    return 0
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
        "socket_path": "$INCUS_SOCKET"
    }
}
EOF
    
    log_info "配置文件已创建: $DATA_DIR/config.json"
    log_info "Incus Socket: $INCUS_SOCKET"
}

install_service() {
    log_step "安装 systemd 服务..."
    
    cat > /etc/systemd/system/lxcmaster.service << EOF
[Unit]
Description=LXCmaster - Incus Container Management Panel
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$INSTALL_DIR
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin"
ExecStartPre=/bin/bash -c 'for i in {1..30}; do test -S $INCUS_SOCKET && exit 0; sleep 1; done; exit 1'
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
    
    sleep 2
    
    if systemctl is-active --quiet lxcmaster; then
        log_info "服务启动成功"
    else
        log_error "服务启动失败"
        systemctl status lxcmaster --no-pager
        exit 1
    fi
}

get_public_ip() {
    local ip=""
    
    ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null) || \
    ip=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null) || \
    ip=$(curl -s --max-time 5 https://icanhazip.com 2>/dev/null) || \
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    
    echo "$ip"
}

print_completion() {
    local ip=$(get_public_ip)
    local access_url="http://${ip}:${PORT}"
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  LXCmaster 安装完成!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}访问地址:${NC} ${YELLOW}${access_url}${NC}"
    echo -e "${BLUE}监听端口:${NC} ${PORT}"
    echo ""
    echo -e "${BLUE}安装目录:${NC} ${INSTALL_DIR}"
    echo -e "${BLUE}数据目录:${NC} ${DATA_DIR}"
    echo -e "${BLUE}配置文件:${NC} ${DATA_DIR}/config.json"
    echo ""
    echo -e "${BLUE}服务管理命令:${NC}"
    echo "  systemctl start|stop|restart|status lxcmaster"
    echo ""
    echo -e "${YELLOW}注意: 如果无法访问，请检查防火墙设置${NC}"
    echo -e "${YELLOW}      可能需要开放端口 ${PORT}${NC}"
    echo ""
    echo -e "${GREEN}========================================${NC}"
}

# 快速安装模式（用于更新）
quick_install() {
    log_step "快速安装模式 (仅更新)..."
    
    # 停止服务
    systemctl stop lxcmaster 2>/dev/null || true
    
    # 克隆最新代码
    clone_repo
    
    # 并行构建
    build_parallel
    
    # 设置权限
    set_permissions
    
    # 启动服务
    start_service
    
    log_info "快速更新完成"
}

# 显示帮助
show_help() {
    cat << EOF
LXCmaster 安装脚本

用法: bash install.sh [选项]

选项:
    -h, --help          显示帮助信息
    -q, --quick         快速更新模式（仅重新构建和重启服务）
    -p, --prebuilt      尝试使用预编译二进制文件（更快）
    -s, --skip-build    跳过构建（用于配置更新）
    --port PORT         指定服务端口（默认: 2026）

环境变量:
    LXCMASTER_PORT      指定服务端口

示例:
    bash install.sh                    # 完整安装
    bash install.sh -q                 # 快速更新
    bash install.sh -p                 # 使用预编译二进制
    bash install.sh --port 8080        # 指定端口 8080
EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -q|--quick)
                SKIP_BUILD=false
                USE_PREBUILT=false
                QUICK_MODE=true
                shift
                ;;
            -p|--prebuilt)
                USE_PREBUILT=true
                shift
                ;;
            -s|--skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --port)
                PORT="$2"
                shift 2
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    parse_args "$@"
    
    check_root
    
    # 快速模式
    if [[ "${QUICK_MODE:-false}" == "true" ]]; then
        detect_system
        detect_arch
        detect_incus
        get_port
        quick_install
        print_completion
        exit 0
    fi
    
    detect_system
    detect_arch
    detect_incus
    get_port
    
    install_dependencies
    install_go
    install_nodejs
    install_incus
    
    create_user
    create_directories
    
    # 如果跳过构建，直接配置
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "跳过构建步骤"
    else
        clone_repo
        
        # 尝试使用预编译二进制
        if [[ "$USE_PREBUILT" == "true" ]]; then
            if ! use_prebuilt_binaries; then
                log_info "预编译二进制不可用，使用本地构建"
                build_parallel
            fi
        else
            build_parallel
        fi
    fi
    
    create_config
    install_service
    set_permissions
    init_incus
    start_service
    
    print_completion
}

main "$@"

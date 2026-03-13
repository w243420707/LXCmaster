# LXCmaster - Incus 容器管理面板

一个轻量级的 Web 管理面板，用于管理宿主机上的 Incus 容器/虚拟机。

## 一键安装

```bash
wget -qO install.sh https://raw.githubusercontent.com/w243420707/LXCmaster/main/install.sh && bash install.sh
```

**支持的系统：**
- Ubuntu 20.04+ (使用 Snap 安装 Incus)
- Debian 11+ (使用官方仓库安装 Incus)

安装脚本会自动完成以下操作：
1. 检测系统架构 (amd64/arm64)
2. 安装并初始化 Incus
3. 安装 Go 和 Node.js 环境
4. 编译后端和前端
5. 下载预设镜像 (Alpine 3.18、Debian 11)
6. 配置并启动服务

## 项目概述

- **后端**: Go + Gin (轻量高性能)
- **前端**: React + Vite + TailwindCSS
- **容器技术**: Incus
- **终端**: WebSocket + xterm.js

## 核心功能

- 容器生命周期管理 (创建、删除、启动、停止)
- 资源限制配置 (CPU、内存、磁盘)
- 端口映射管理 (支持 IPv4/IPv6、TCP/UDP、端口范围)
- Web 终端控制台
- Swap 内存支持 (内存不足时使用宿主机 Swap)
- TUN 设备支持 (支持 WARP、WireGuard 等 VPN 工具)
- 预设镜像 (Alpine 3.18、Debian 11，安装时自动下载)

---

## 开发进度记录

### 步骤 1: 项目初始化

创建项目目录结构和 Go 模块文件。

**创建的文件:**
- `backend/go.mod` - Go 模块定义文件

**依赖说明:**
| 依赖 | 用途 |
|------|------|
| gin-gonic/gin | HTTP Web 框架 |
| gorilla/websocket | WebSocket 支持 (终端功能) |
| lxc/incus | Incus 官方 Go SDK |

---

### 步骤 2: 创建后端基础框架

创建 Go 后端的核心文件结构，包括配置管理、路由设置和主入口文件。

**创建的文件:**
| 文件路径 | 说明 |
|----------|------|
| `backend/cmd/server/main.go` | 程序入口文件 |
| `backend/internal/config/config.go` | 配置管理模块 |
| `backend/internal/api/router.go` | HTTP 路由定义 |

**API 路由设计:**
```
GET    /api/containers           - 列出所有容器
POST   /api/containers           - 创建容器
GET    /api/containers/:name     - 获取容器详情
PUT    /api/containers/:name     - 更新容器配置
DELETE /api/containers/:name     - 删除容器
POST   /api/containers/:name/start   - 启动容器
POST   /api/containers/:name/stop    - 停止容器
POST   /api/containers/:name/restart - 重启容器
GET    /api/containers/:name/exec    - 终端连接 (WebSocket)
GET    /api/images               - 列出镜像
GET    /api/networks             - 列出网络
GET    /api/storage              - 列出存储池
```

---

### 步骤 3: 实现 Incus 客户端封装

创建与 Incus 守护进程通信的客户端封装层。

**创建的文件:**
| 文件路径 | 说明 |
|----------|------|
| `backend/internal/incus/client.go` | Incus API 客户端封装 |

**封装的主要方法:**
| 方法 | 功能 |
|------|------|
| `ListInstances()` | 列出所有实例 |
| `GetInstance()` | 获取实例详情 |
| `CreateInstance()` | 创建实例 |
| `DeleteInstance()` | 删除实例 |
| `UpdateInstance()` | 更新实例配置 |
| `StartInstance()` | 启动实例 |
| `StopInstance()` | 停止实例 |
| `RestartInstance()` | 重启实例 |
| `GetInstanceState()` | 获取实例状态 |
| `ExecInstance()` | 在实例中执行命令 |
| `ListImages()` | 列出镜像 |
| `ListNetworks()` | 列出网络 |
| `ListStoragePools()` | 列出存储池 |

---

### 步骤 4: 实现容器生命周期管理 API

创建容器管理的 HTTP handlers，包括创建、删除、启动、停止、重启等操作。

**创建的文件:**
| 文件路径 | 说明 |
|----------|------|
| `backend/internal/api/containers.go` | 容器管理 API handlers |
| `backend/internal/api/images.go` | 镜像管理 API handlers |
| `backend/internal/api/networks.go` | 网络管理 API handlers |
| `backend/internal/api/storage.go` | 存储管理 API handlers |

**容器创建参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 容器名称 |
| image | string | 镜像别名 (预设: alpine/3.18, debian/11) |
| cpu | int64 | CPU 核心数 |
| memory | int64 | 内存限制 (MB) |
| diskMax | int64 | 最大存储限制 (GB)，共享宿主机存储 |
| enableSwap | bool | 启用 Swap 支持 (内存不足时使用宿主机 Swap) |
| enableSSH | bool | 启用 SSH (自动安装并配置) |
| sshPort | int | SSH 宿主机端口 |
| rootPassword | string | Root 密码 (留空自动生成) |
| portMappings | array | 端口映射列表 |
| network | string | 网络名称 |
| storage | string | 存储池名称 |

**预设镜像 (安装时自动下载):**
| 镜像 | 说明 |
|------|------|
| `images:alpine/3.18` | Alpine 3.18 (轻量推荐) |
| `images:debian/11` | Debian 11 (稳定) |

**端口映射参数:**
| 参数 | 说明 |
|------|------|
| ipVersions | IP 版本数组，可选 IPv4、IPv6，可多选 |
| protocols | 协议数组，可选 TCP、UDP，可多选 |
| hostPort | 宿主机端口，支持范围如 `80-100` |
| containerPort | 容器端口，支持范围如 `80-100` |

**Swap 功能说明:**
- 启用后，当宿主机内存不足时，容器内存会被交换到宿主机的 Swap 分区
- 这允许容器使用超过分配限制的内存（通过宿主机 Swap）
- 适合内存紧张但需要运行多个容器的场景

**存储说明:**
- 所有容器共享宿主机存储池
- 创建时设置最大存储限制
- 容器删除后自动释放存储空间

**TUN 设备:**
- 创建容器时自动启用 TUN 设备
- 支持在容器内使用 WARP、WireGuard 等 VPN 工具

---

### 步骤 5: 实现端口映射管理 API

创建端口映射管理功能，支持添加和删除端口转发规则。

**创建的文件:**
| 文件路径 | 说明 |
|----------|------|
| `backend/internal/api/ports.go` | 端口映射 API handlers |

**端口映射 API:**
```
GET    /api/containers/:name/ports      - 列出端口映射
POST   /api/containers/:name/ports      - 添加端口映射
DELETE /api/containers/:name/ports/:port - 删除端口映射
```

**端口映射参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| host_port | int | 宿主机端口 |
| container_port | int | 容器端口 |
| protocol | string | 协议 (tcp/udp) |
| listen_address | string | 监听地址 |

---

### 步骤 6: 实现 WebSocket 终端功能

创建 WebSocket 终端连接，支持在浏览器中直接访问容器控制台。

**创建的文件:**
| 文件路径 | 说明 |
|----------|------|
| `backend/internal/api/terminal.go` | WebSocket 终端 handler |

**终端连接流程:**
1. 前端通过 WebSocket 连接 `/api/containers/:name/exec`
2. 后端调用 Incus API 创建交互式终端
3. 双向转发终端输入输出

---

### 步骤 7: 创建前端 React 项目

创建 React 前端项目，包括路由、组件和页面。

**创建的文件:**
| 文件路径 | 说明 |
|----------|------|
| `frontend/package.json` | NPM 依赖配置 |
| `frontend/vite.config.js` | Vite 构建配置 |
| `frontend/tailwind.config.js` | TailwindCSS 配置 |
| `frontend/postcss.config.js` | PostCSS 配置 |
| `frontend/index.html` | HTML 入口 |
| `frontend/src/main.jsx` | React 入口 |
| `frontend/src/App.jsx` | 路由配置 |
| `frontend/src/index.css` | 全局样式 |
| `frontend/src/components/Layout.jsx` | 布局组件 |
| `frontend/src/components/Console.jsx` | 终端组件 |
| `frontend/src/lib/api.js` | API 封装 |
| `frontend/src/pages/Dashboard.jsx` | 仪表盘页面 |
| `frontend/src/pages/Containers.jsx` | 容器列表页面 |
| `frontend/src/pages/ContainerDetail.jsx` | 容器详情页面 |
| `frontend/src/pages/Images.jsx` | 镜像管理页面 |
| `frontend/src/pages/Settings.jsx` | 设置页面 |

**前端依赖:**
| 依赖 | 用途 |
|------|------|
| react | UI 框架 |
| react-router-dom | 路由管理 |
| xterm | 终端模拟器 |
| xterm-addon-fit | 终端自适应大小 |
| tailwindcss | CSS 框架 |
| vite | 构建工具 |

---

### 步骤 8: 编写一键安装脚本

创建 Shell 脚本，实现一键安装部署。

**创建的文件:**
| 文件路径 | 说明 |
|----------|------|
| `install.sh` | 一键安装脚本 |
| `uninstall.sh` | 卸载脚本 |
| `lxcmaster.service` | systemd 服务配置 |

**安装脚本功能:**
- 自动检测系统 (Ubuntu/Debian)
- 自动检测架构 (amd64/arm64)
- 根据架构下载对应版本的 Go 和 Node.js
- 用户自定义端口 (默认 2026)
- 检查 Incus 是否已安装
- 编译后端和前端
- 创建 systemd 服务
- 自动启动服务

---

## 安装使用

### 前置要求

- Linux 系统 (Ubuntu 20.04+ / Debian 11+)
- 已安装 Incus
- root 权限

### 一键安装

```bash
# 克隆项目
git clone https://github.com/your-repo/LXCmaster.git
cd LXCmaster

# 添加执行权限
chmod +x install.sh

# 执行安装
./install.sh
```

安装过程中会提示输入端口，直接回车使用默认端口 **2026**。

### 手动安装

```bash
# 安装后端依赖
cd backend
go mod download
go build -o lxcmaster ./cmd/server

# 安装前端依赖
cd ../frontend
npm install
npm run build

# 运行 (指定端口)
./lxcmaster -port 2026
```

### 访问面板

安装完成后访问: `http://<服务器IP>:2026`

### 常用命令

```bash
# 查看服务状态
systemctl status lxcmaster

# 查看日志
journalctl -u lxcmaster -f

# 重启服务
systemctl restart lxcmaster

# 停止服务
systemctl stop lxcmaster

# 卸载
./uninstall.sh
```

---

## 项目结构

```
LXCmaster/
├── backend/                      # Go 后端
│   ├── cmd/server/main.go        # 入口文件
│   ├── internal/
│   │   ├── api/                  # API handlers
│   │   │   ├── router.go         # 路由
│   │   │   ├── containers.go     # 容器管理
│   │   │   ├── ports.go          # 端口映射
│   │   │   ├── terminal.go       # 终端
│   │   │   ├── images.go         # 镜像
│   │   │   ├── networks.go       # 网络
│   │   │   └── storage.go        # 存储
│   │   ├── incus/client.go       # Incus 客户端
│   │   └── config/config.go      # 配置
│   └── go.mod
├── frontend/                     # React 前端
│   ├── src/
│   │   ├── components/           # 组件
│   │   ├── pages/                # 页面
│   │   ├── lib/api.js            # API 封装
│   │   └── main.jsx              # 入口
│   └── package.json
├── install.sh                    # 安装脚本
├── uninstall.sh                  # 卸载脚本
├── lxcmaster.service             # systemd 服务
└── README.md
```

---

## 功能特性

- [x] 容器生命周期管理 (创建/删除/启动/停止/重启)
- [x] 资源限制配置 (CPU/内存/磁盘)
- [x] Swap 内存支持
- [x] 端口映射管理
- [x] Web 终端控制台
- [x] 镜像管理
- [x] 网络管理
- [x] 存储管理
- [x] 一键安装脚本

---

## 许可证

MIT License

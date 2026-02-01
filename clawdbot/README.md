# Clawdbot - 7×24 小时持续运行解决方案

基于 Gateway-Client 混合架构的 Telegram Bot，实现零中断、零数据丢失的持续运行。

## 🏗️ 架构

- **Gateway Server** (腾讯云): 处理 Telegram 消息、Claude API 调用、任务调度
- **Node Client** (本地): 执行工具（浏览器、HTTP、命令等）
- **Socket.IO**: 实时双向通信，自动重连
- **SQLite**: 轻量级数据库，实时同步

## 📁 项目结构

```
clawdbot/
├── src/
│   ├── gateway/          # Gateway Server 代码
│   │   ├── index.ts      # 主入口
│   │   └── socket-server.ts  # Socket.IO 服务器
│   ├── client/           # Node Client 代码
│   │   ├── index.ts      # 主入口
│   │   ├── socket-client.ts  # Socket.IO 客户端
│   │   └── tool-executor.ts  # 工具执行器
│   └── common/           # 通用模块
│       ├── logger.ts     # 日志系统
│       └── alerter.ts    # 告警系统
├── data/                 # 数据目录
├── logs/                 # 日志目录
├── Dockerfile.gateway    # Gateway Docker 配置
├── Dockerfile.client     # Client Docker 配置
├── package.json          # 依赖配置
├── tsconfig.json         # TypeScript 配置
└── README.md             # 本文件
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# Gateway Server (腾讯云)
cp .env.gateway.example .env.gateway
nano .env.gateway  # 填写实际配置

# Node Client (本地)
cp .env.client.example .env.client
nano .env.client  # 填写 Gateway URL
```

### 3. 本地开发

```bash
# 启动 Gateway Server
npm run dev:gateway

# 启动 Node Client
npm run dev:client
```

### 4. Docker 部署

#### Gateway Server (腾讯云)

```bash
# 构建镜像
npm run docker:build:gateway

# 启动服务
npm run docker:up:gateway

# 查看日志
npm run docker:logs:gateway
```

#### Node Client (本地)

```bash
# 构建镜像
npm run docker:build:client

# 启动服务
npm run docker:up:client

# 查看日志
npm run docker:logs:client
```

## 📋 环境变量

### Gateway Server

| 变量 | 说明 | 必需 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | ✅ |
| `CLAUDE_API_KEY` | Claude API Key | ✅ |
| `SOCKET_PORT` | Socket.IO 端口 | ✅ |
| `DATABASE_PATH` | 数据库路径 | ✅ |
| `ALERT_TELEGRAM_CHAT_ID` | 告警 Chat ID | ✅ |
| `ALERT_EMAIL` | 告警邮箱 | ❌ |
| `EMAIL_USER` | 邮件用户名 | ❌ |
| `EMAIL_PASSWORD` | 邮件密码 | ❌ |

### Node Client

| 变量 | 说明 | 必需 |
|------|------|------|
| `GATEWAY_URL` | Gateway Server URL | ✅ |
| `ALERT_TELEGRAM_CHAT_ID` | 告警 Chat ID | ✅ |

## 🛠️ 可用工具

- **browser**: 浏览器自动化 (Playwright)
- **http**: HTTP 请求 (Axios)
- **command**: 命令执行
- **python**: Python 脚本执行

## 📊 监控

- **健康检查**: 每 30 秒自动检查
- **Telegram 告警**: 异常时自动通知
- **日志记录**: Winston 结构化日志
- **自动重启**: Docker 守护进程

## 🔧 开发

### 构建

```bash
npm run build
```

### 运行

```bash
# Gateway
npm run start:gateway

# Client
npm run start:client
```

## 📝 技术方案

完整的技术方案文档：`C:\Users\666\.claude\plans\Clawdbot_7x24持续运行技术方案_20260131_125116.md`

## 📄 License

MIT

## 👤 Author

Your Name

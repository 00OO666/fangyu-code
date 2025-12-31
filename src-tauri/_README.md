# src-tauri/ - Rust 后端

> **Tauri 桌面应用后端** | Rust + Tauri 2.9 | 系统级功能和 AI 集成

---

## 概述

src-tauri/ 包含 Fangyu Code 的 Rust 后端代码，负责：
- Claude Code CLI 集成
- MCP 协议实现
- 文件系统操作
- 进程管理
- 系统命令执行
- WebSocket 连接

---

## 目录结构

```
src-tauri/
├── src/
│   ├── main.rs                  # Rust 主入口 ⭐
│   ├── claude_binary.rs         # Claude CLI 集成 (86KB) ⭐
│   ├── claude_mcp.rs            # Claude MCP 协议
│   ├── codex_mcp.rs             # OpenAI Codex MCP
│   ├── gemini_mcp.rs            # Google Gemini MCP
│   ├── commands/                # 26 个命令模块 ⭐
│   │   ├── acemcp.rs            # ACEMCP 配置 (59KB)
│   │   ├── mcp.rs               # MCP 命令 (37KB)
│   │   ├── wsl_utils.rs         # WSL 工具 (73KB)
│   │   ├── simple_git.rs        # Git 集成 (26KB)
│   │   ├── usage.rs             # 使用统计
│   │   ├── storage.rs           # 存储管理
│   │   ├── translator.rs        # 翻译服务
│   │   ├── extensions.rs        # 扩展管理 (41KB)
│   │   ├── prompt_tracker.rs    # 提示追踪 (55KB)
│   │   ├── context_manager.rs   # 上下文管理
│   │   ├── checkpoint_manager.rs # 检查点管理
│   │   ├── background_task_manager.rs # 后台任务
│   │   ├── parallel_agents.rs   # 并行代理
│   │   ├── enhanced_hooks.rs    # 增强 Hook
│   │   └── ... (20+ 更多命令)
│   ├── mcp/                     # MCP 协议实现
│   │   ├── mod.rs               # MCP 模块管理
│   │   ├── registry.rs          # MCP 注册表
│   │   └── validation.rs        # 验证器
│   ├── process/                 # 进程管理
│   │   ├── job_object.rs        # Windows Job Object
│   │   └── registry.rs          # 进程注册表
│   └── utils/                   # Rust 工具函数
├── Cargo.toml                   # Rust 依赖配置
├── tauri.conf.json              # Tauri 应用配置
├── capabilities/                # Tauri 权限配置
└── icons/                       # 应用图标（Fangyu Logo）
```

---

## 核心文件详解

### main.rs - Rust 主入口
**用途**: Tauri 应用的入口点，注册所有命令

**主要功能**:
- 初始化 Tauri 应用
- 注册所有 Tauri 命令
- 配置窗口和菜单
- 设置应用权限

**命令注册示例**:
```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Claude 相关
            start_claude_session,
            stop_claude_session,
            send_claude_message,

            // MCP 相关
            add_mcp_server,
            list_mcp_servers,
            remove_mcp_server,

            // 文件操作
            read_file,
            write_file,
            list_files,

            // Git 操作
            git_status,
            git_commit,
            git_push,

            // 系统命令
            execute_command,

            // ... 100+ 命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### claude_binary.rs - Claude CLI 集成 (86KB)
**用途**: 集成 Claude Code CLI，提供与官方 CLI 的交互

**主要功能**:
1. **启动 Claude 会话**: 启动 Claude Code CLI 进程
2. **流式输入输出**: 处理 CLI 的流式响应
3. **会话管理**: 管理多个 Claude 会话
4. **错误处理**: 捕获和处理 CLI 错误

**主要函数**:
```rust
/// 启动 Claude 会话
#[tauri::command]
pub async fn start_claude_session(
    session_id: String,
    project_path: String
) -> Result<(), String>

/// 发送消息到 Claude
#[tauri::command]
pub async fn send_claude_message(
    session_id: String,
    message: String
) -> Result<String, String>

/// 停止 Claude 会话
#[tauri::command]
pub async fn stop_claude_session(
    session_id: String
) -> Result<(), String>
```

**Claude CLI 路径**:
```rust
// Windows
const CLAUDE_BINARY_PATH: &str = "C:\\Users\\<user>\\.claude\\bin\\claude.exe";

// macOS/Linux
const CLAUDE_BINARY_PATH: &str = "/usr/local/bin/claude";
```

---

### commands/ - 命令模块目录

#### acemcp.rs - ACEMCP 配置 (59KB)
**用途**: ACEMCP 协议的配置和管理

#### mcp.rs - MCP 命令 (37KB)
**用途**: Model Context Protocol 的核心命令

**主要函数**:
```rust
#[tauri::command]
pub async fn add_mcp_server(
    name: String,
    command: String,
    args: Vec<String>
) -> Result<(), String>

#[tauri::command]
pub async fn list_mcp_servers() -> Result<Vec<MCPServer>, String>

#[tauri::command]
pub async fn remove_mcp_server(name: String) -> Result<(), String>

#[tauri::command]
pub async fn call_mcp_tool(
    server: String,
    tool: String,
    args: serde_json::Value
) -> Result<serde_json::Value, String>
```

#### wsl_utils.rs - WSL 工具 (73KB)
**用途**: Windows 子系统 Linux (WSL) 集成

**主要功能**:
- 检测 WSL 安装
- 在 WSL 中执行命令
- WSL 文件路径转换
- WSL 环境配置

#### simple_git.rs - Git 集成 (26KB)
**用途**: Git 操作封装

**主要函数**:
```rust
#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<GitStatus, String>

#[tauri::command]
pub async fn git_commit(
    repo_path: String,
    message: String
) -> Result<String, String>

#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<String, String>
```

#### usage.rs - 使用统计
**用途**: 追踪 Token 使用和成本

#### storage.rs - 存储管理
**用途**: 管理应用存储和缓存

#### translator.rs - 翻译服务
**用途**: 后端翻译 API 调用

---

## Tauri 命令系统

### 命令定义
```rust
#[tauri::command]
pub async fn my_command(
    param1: String,
    param2: i32
) -> Result<ReturnType, String> {
    // 命令逻辑
    Ok(result)
}
```

### 前端调用
```typescript
import { invoke } from '@tauri-apps/api/core'

const result = await invoke('my_command', {
  param1: 'value',
  param2: 42
})
```

---

## MCP 协议实现

### mcp/mod.rs
**用途**: MCP 模块管理

### mcp/registry.rs
**用途**: MCP 服务器注册表

```rust
pub struct MCPRegistry {
    servers: HashMap<String, MCPServer>
}

impl MCPRegistry {
    pub fn add_server(&mut self, server: MCPServer) -> Result<(), Error>
    pub fn remove_server(&mut self, name: &str) -> Result<(), Error>
    pub fn get_server(&self, name: &str) -> Option<&MCPServer>
    pub fn list_servers(&self) -> Vec<&MCPServer>
}
```

### mcp/validation.rs
**用途**: MCP 配置验证

---

## 进程管理

### process/job_object.rs
**用途**: Windows Job Object 管理（进程组管理）

### process/registry.rs
**用途**: 进程注册表，追踪所有子进程

---

## 常见修改场景

### 场景 1: 添加新的 Tauri 命令
**步骤**:
1. 在 `commands/` 下创建新的 `.rs` 文件或在现有文件中添加
2. 定义命令函数并添加 `#[tauri::command]` 注解
3. 在 `main.rs` 的 `invoke_handler` 中注册命令
4. 在前端使用 `invoke('my_command')` 调用

**示例**:
```rust
// commands/my_command.rs
#[tauri::command]
pub async fn my_command(input: String) -> Result<String, String> {
    Ok(format!("Processed: {}", input))
}

// main.rs
.invoke_handler(tauri::generate_handler![
    my_command,  // 添加这一行
    // ... 其他命令
])
```

### 场景 2: 修改 Claude CLI 集成
**文件**: `claude_binary.rs`
**步骤**:
1. 找到 `start_claude_session` 或其他相关函数
2. 修改 Claude CLI 启动参数或处理逻辑
3. 更新错误处理

### 场景 3: 添加新的 MCP 服务器类型
**文件**: `mcp/registry.rs`
**步骤**:
1. 定义新的服务器类型
2. 在 `MCPServer` enum 中添加
3. 实现验证和连接逻辑

### 场景 4: 修改文件操作权限
**文件**: `capabilities/`
**步骤**:
1. 编辑 `default.json` 或创建新的权限文件
2. 定义允许的文件路径和操作
3. 在 `tauri.conf.json` 中引用

---

## Rust 依赖 (Cargo.toml)

### 核心依赖
- `tauri` - Tauri 框架
- `tokio` - 异步运行时
- `serde` / `serde_json` - 序列化
- `sqlx` - 数据库 ORM
- `reqwest` - HTTP 客户端

### 工具依赖
- `env_logger` - 日志
- `chrono` - 日期时间
- `uuid` - UUID 生成
- `sha2` / `md5` - 哈希
- `base64` - Base64 编码
- `zstd` - 压缩

---

## 开发规范

### 错误处理
```rust
// 使用 Result<T, String> 返回值
pub async fn my_function() -> Result<Data, String> {
    let result = risky_operation()
        .map_err(|e| format!("Error: {}", e))?;
    Ok(result)
}
```

### 异步函数
```rust
// 使用 async/await
#[tauri::command]
pub async fn async_command() -> Result<String, String> {
    let data = fetch_data().await?;
    Ok(data)
}
```

### 日志
```rust
use log::{info, warn, error, debug};

info!("Starting operation");
warn!("Warning message");
error!("Error occurred: {}", err);
debug!("Debug info: {:?}", data);
```

---

## 构建和调试

### 开发模式
```bash
npm run tauri:dev
```

### 构建发布版
```bash
npm run tauri:build
```

### Rust 单元测试
```bash
cd src-tauri
cargo test
```

### 查看日志
```bash
# Windows
$env:RUST_LOG="debug"
npm run tauri:dev

# macOS/Linux
RUST_LOG=debug npm run tauri:dev
```

---

**最后更新**: 2025-12-27
**Rust 文件数**: 40+ 模块
**代码行数**: 36,518 行

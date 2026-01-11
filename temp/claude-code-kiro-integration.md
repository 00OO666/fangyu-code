# Claude Code 调用 Kiro API 研究

> 研究日期: 2026-01-11
> 状态: ⚠️ 高风险 - 已导致封号

## ⚠️ 重要警告

**2026-01-11 更新**: 在研究过程中，即使使用 Electron 环境，账号仍然被封禁。这表明 AWS 的检测机制非常严格，可能包括：

1. **请求频率检测** - 短时间内多次 API 调用
2. **行为模式分析** - 非正常的使用模式
3. **会话状态验证** - 缺少完整的会话上下文
4. **遥测数据缺失** - Kiro 会发送遥测数据，我们的脚本没有

**结论**: 直接调用 Kiro API 的风险极高，不建议在生产环境使用。

---

## 1. 核心问题

### 1.1 为什么要在 Claude Code 中调用 Kiro API？

| 场景 | 说明 |
|------|------|
| 免费额度 | Kiro 提供免费的 Claude API 调用额度 |
| 模型选择 | 可以使用 Opus 4.5 等高端模型 |
| 备用方案 | 当 Anthropic API 额度用完时的备选 |

### 1.2 技术挑战

| 挑战 | 说明 | 解决方案 |
|------|------|----------|
| TLS 指纹 | Node.js 指纹会被封号 | Claude Code 本身是 Electron，指纹应该匹配 |
| API 格式 | Anthropic vs AWS JSON-RPC | 需要构建转换代理 |
| 认证方式 | Bearer Token vs API Key | 代理层处理 |

---

## 2. 方案对比

### 方案 A: 本地代理服务器（推荐）

```
Claude Code → ANTHROPIC_BASE_URL → 本地代理 → Kiro API
                                    (Electron)
```

**优点**:
- 完全兼容 Claude Code 的 LLM Gateway 机制
- 可以在 Electron 环境中运行代理
- 格式转换在代理层完成

**缺点**:
- 需要额外运行一个 Electron 进程
- 需要处理流式响应转换

### 方案 B: MCP Server

```
Claude Code → MCP → kiro-api-mcp-server → Kiro API
```

**优点**:
- 原生集成 Claude Code
- 可以作为工具调用

**缺点**:
- MCP Server 通常用 Node.js，TLS 指纹问题
- 不能替代主模型，只能作为辅助工具

### 方案 C: 修改 Claude Code 源码

**不推荐** - 维护成本高，每次更新都要重新修改

---

## 3. 方案 A 详细设计：Electron 代理服务器

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code                             │
│  ANTHROPIC_BASE_URL=http://localhost:3456                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Kiro API Proxy (Electron)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  HTTP Server (localhost:3456)                        │   │
│  │  ├── POST /v1/messages → 转换 → Kiro API            │   │
│  │  └── POST /v1/messages/count_tokens → 估算          │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Electron net 模块 (Chrome TLS 指纹)                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Kiro API (q.us-east-1.amazonaws.com)            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 API 格式转换

#### Anthropic Messages API 请求格式
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 4096,
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true
}
```

#### Kiro API 请求格式
```json
{
  "conversationState": {
    "currentMessage": {
      "userInputMessage": {
        "content": "Hello",
        "modelId": "claude-sonnet-4",
        "origin": "AI_EDITOR"
      }
    },
    "chatTriggerType": "MANUAL"
  }
}
```

### 3.3 模型 ID 映射

| Anthropic 格式 | Kiro 格式 |
|----------------|-----------|
| `claude-opus-4-5-20251101` | `claude-opus-4.5` |
| `claude-sonnet-4-5-20250929` | `claude-sonnet-4.5` |
| `claude-sonnet-4-20250514` | `claude-sonnet-4` |
| `claude-haiku-4-5-20251001` | `claude-haiku-4.5` |
| `claude-3-5-sonnet-*` | `auto` |

### 3.4 响应格式转换

#### Kiro 响应（AWS Event Stream）
```
{content: "Hello"}
{content: " there"}
{content: "!"}
```

#### Anthropic SSE 响应
```
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" there"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}

event: message_stop
data: {"type":"message_stop"}
```

---

## 4. 实现步骤

### 4.1 创建 Electron 代理服务器

```javascript
// kiro-proxy-server.cjs
const { app, net } = require('electron');
const http = require('http');

// 启动 HTTP 服务器监听 Claude Code 请求
// 使用 Electron net 模块转发到 Kiro API
// 转换请求/响应格式
```

### 4.2 配置 Claude Code

```bash
# 设置环境变量
export ANTHROPIC_BASE_URL=http://localhost:3456
export ANTHROPIC_API_KEY=dummy  # 代理会忽略，使用 Kiro Token
```

或在 Claude Code settings.json:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3456",
    "ANTHROPIC_API_KEY": "dummy"
  }
}
```

### 4.3 启动流程

1. 启动 Kiro API Proxy: `npx electron kiro-proxy-server.cjs`
2. 启动 Claude Code: `claude` 或打开 VS Code 扩展
3. Claude Code 的所有请求都会通过代理转发到 Kiro API

---

## 5. 风险评估

| 风险 | 级别 | 说明 |
|------|------|------|
| 封号 | 中 | Electron 指纹应该安全，但仍需谨慎 |
| Token 过期 | 低 | 需要 Kiro 运行以刷新 Token |
| 功能不完整 | 中 | 部分 Claude Code 功能可能不兼容 |
| 响应格式 | 中 | 流式响应转换可能有边界情况 |

---

## 6. 下一步

1. [ ] 实现 Electron 代理服务器
2. [ ] 测试 API 格式转换
3. [ ] 测试流式响应
4. [ ] 测试与 Claude Code 的兼容性
5. [ ] 处理错误情况
6. [ ] 添加日志和调试功能


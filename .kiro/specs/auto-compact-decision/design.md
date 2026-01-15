# Design Document: Auto-Compact 功能修复

## Overview

本设计文档描述如何修复 Fangyu Code 中的 Auto-Compact 功能。核心问题是 Rust 后端的 `/compact` 命令调用方式错误，导致功能无法使用。

## Architecture

### 当前架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React/TypeScript)                                     │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ useBackgroundCompact │  │ useSmartSessionContinue        │   │
│  │ (Auto-Compact Hook)  │  │ (Session Continue Hook)        │   │
│  └──────────┬──────────┘  └──────────────┬──────────────────┘   │
│             │                             │                      │
│             │ emit("compact-session-     │ invoke("create_      │
│             │       request")            │ continued_session")  │
│             ▼                             ▼                      │
└─────────────────────────────────────────────────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Rust/Tauri)                                            │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ context_manager.rs  │  │ session_commands.rs             │   │
│  │ ❌ 事件监听未实现    │  │ ✅ create_continued_session    │   │
│  │ ❌ /compact 调用错误 │  │    已实现                       │   │
│  └──────────┬──────────┘  └──────────────────────────────────┘   │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ Claude CLI          │                                        │
│  │ ✅ 支持 /compact    │                                        │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 修复后架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React/TypeScript)                                     │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ useBackgroundCompact │  │ useSmartSessionContinue        │   │
│  │ (Auto-Compact Hook)  │  │ (Session Continue Hook)        │   │
│  └──────────┬──────────┘  └──────────────┬──────────────────┘   │
│             │                             │                      │
│             │ invoke("execute_compact")   │ invoke("create_      │
│             │                             │ continued_session")  │
│             ▼                             ▼                      │
└─────────────────────────────────────────────────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Rust/Tauri)                                            │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ context_manager.rs  │  │ session_commands.rs             │   │
│  │ ✅ execute_compact  │  │ ✅ create_continued_session    │   │
│  │    Tauri command    │  │    已实现                       │   │
│  └──────────┬──────────┘  └──────────────────────────────────┘   │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ Claude CLI          │                                        │
│  │ claude -p "/compact"│  ← 正确的调用方式                      │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Rust Backend - context_manager.rs

**修改点：**

```rust
// 修复前（错误）
cmd.args(&["/compact"])

// 修复后（正确）
cmd.args(&["-p", "/compact"])
// 或者使用 --print 参数
cmd.args(&["--print", "/compact"])
```

**新增 Tauri Command：**

```rust
#[tauri::command]
pub async fn execute_compact(
    app: tauri::AppHandle,
    session_id: String,
    project_path: String,
) -> Result<CompactResult, String> {
    // 1. 找到 Claude CLI
    // 2. 使用 -p "/compact" 调用
    // 3. 返回压缩结果
}
```

### 2. Frontend - useBackgroundCompact.ts

**修改点：**
- 将 `emit("compact-session-request")` 改为 `invoke("execute_compact")`
- 简化事件监听逻辑

### 3. Session Cleanup

**新增功能：**
- 批量删除会话 API
- 清理名为 "/compact" 的垃圾会话

## Data Models

### CompactResult

```typescript
interface CompactResult {
  success: boolean;
  newSessionId?: string;
  summary?: string;
  tokensBefore: number;
  tokensAfter: number;
  error?: string;
}
```

### CompactRequest

```typescript
interface CompactRequest {
  sessionId: string;
  projectPath: string;
  instructions?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: /compact CLI Invocation

*For any* valid project path and session, calling `execute_compact` should successfully invoke Claude CLI with the `/compact` command and return a valid result (either success with new session ID or a meaningful error).

**Validates: Requirements 1.2, 3.1**

### Property 2: Disabled Feature Logging

*For any* disabled feature (including Auto-Compact when `enabled: false`), the system should not generate ERROR level logs. Only WARN or INFO level logs are acceptable for disabled features.

**Validates: Requirements 3.4**

### Property 3: Garbage Session Cleanup

*For any* session list containing sessions with names matching "/compact" pattern, the cleanup function should remove all such sessions and return the count of deleted sessions.

**Validates: Requirements 3.3**

## Error Handling

### CLI Invocation Errors

| Error Type | Handling |
|------------|----------|
| Claude CLI not found | Return error with installation instructions |
| /compact command failed | Return error with CLI output |
| Timeout (30s) | Abort and return timeout error |
| Permission denied | Return error with path info |

### Graceful Degradation

当 Auto-Compact 失败时：
1. 记录 WARN 级别日志（不是 ERROR）
2. 通知前端失败原因
3. 建议用户使用 Smart Session Continue 作为备选

## Testing Strategy

### Unit Tests

1. **CLI 参数构建测试**：验证 `-p "/compact"` 参数正确构建
2. **配置验证测试**：验证 enabled=false 时不执行压缩
3. **错误处理测试**：验证各种错误情况的处理

### Integration Tests

1. **端到端压缩测试**：在真实环境中测试 /compact 命令
2. **会话清理测试**：验证垃圾会话被正确删除

### Property-Based Tests

1. **日志级别属性测试**：验证禁用功能不产生 ERROR 日志
   - 使用 fast-check 生成随机配置
   - 验证 enabled=false 时日志级别 <= WARN

## Implementation Notes

### Claude CLI /compact 命令行为

根据官方文档：
- `/compact` 会总结当前对话并开始新会话
- `/compact [instructions]` 可以提供自定义压缩指令
- 压缩后的会话会保留关键上下文

### 调用方式

```bash
# 方式 1：使用 -p 参数（推荐）
claude -p "/compact"

# 方式 2：使用 --print 参数
claude --print "/compact"

# 方式 3：带自定义指令
claude -p "/compact Focus on code changes and decisions"
```

### 注意事项

1. `/compact` 是交互式命令，需要在会话上下文中执行
2. 可能需要使用 `--continue` 参数指定要压缩的会话
3. 压缩结果会创建新会话，需要获取新会话 ID

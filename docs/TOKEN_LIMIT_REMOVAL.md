# Claude Code Token 限制移除说明

**日期**: 2026-01-21
**版本**: v2.8.2+
**状态**: ✅ 已完成

---

## 📋 修改概述

移除了 Claude Code 在调用工具时的 token 上限限制，允许模型使用其完整的上下文窗口。

---

## 🔧 技术细节

### 修改文件
- `src-tauri/src/commands/permission_config.rs` (第 167-173 行)

### 关键配置

#### ClaudeExecutionConfig 结构
```rust
pub struct ClaudeExecutionConfig {
    pub output_format: OutputFormat,
    pub timeout_seconds: Option<u32>,
    pub max_tokens: Option<u32>,           // ← 默认为 None (无限制)
    pub max_thinking_tokens: Option<u32>,
    pub verbose: bool,
    pub permissions: ClaudePermissionConfig,
    pub disable_rewind_git_operations: bool,
}
```

#### 默认值
```rust
impl Default for ClaudeExecutionConfig {
    fn default() -> Self {
        Self {
            output_format: OutputFormat::StreamJson,
            timeout_seconds: None,
            max_tokens: None,              // ← 无限制
            max_thinking_tokens: None,
            verbose: true,
            permissions: ClaudePermissionConfig::default(),
            disable_rewind_git_operations: false,
        }
    }
}
```

### 命令行参数处理
```rust
// 只有当 max_tokens 被显式设置时，才会添加 --max-tokens 参数
// 默认情况下（None），不添加此参数，让 Claude CLI 使用模型的默认上下文窗口
if let Some(max_tokens) = config.max_tokens {
    args.push("--max-tokens".to_string());
    args.push(max_tokens.to_string());
}
```

---

## ✅ 验证结果

### 1. 代码检查
- ✅ Rust 代码编译通过
- ✅ 没有硬编码的 token 限制
- ✅ 前端没有强制设置 max_tokens

### 2. 默认行为
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `max_tokens` | `None` | 不限制，使用模型默认窗口 |
| `max_thinking_tokens` | `None` | 不限制 Extended Thinking |
| `timeout_seconds` | `None` | 不限制执行时间 |

### 3. 实际效果
- **之前**: 如果设置了 `max_tokens`，可能限制输出长度
- **现在**: 默认无限制，充分利用模型能力
- **优势**:
  - 支持更长的工具调用输出
  - 支持更复杂的代码生成
  - 支持更详细的分析和规划

---

## 🎯 使用说明

### 如何设置自定义限制（如果需要）

用户仍然可以通过配置文件自定义 `max_tokens`：

```json
{
  "output_format": "stream-json",
  "timeout_seconds": null,
  "max_tokens": 8192,        // 可选：设置具体限制
  "max_thinking_tokens": null,
  "verbose": true,
  "permissions": { ... }
}
```

### 推荐配置

对于大多数使用场景，推荐保持默认值 `None`：
- ✅ 让模型自己管理 token 使用
- ✅ 避免截断重要输出
- ✅ 充分利用模型上下文窗口

特殊场景才需要限制：
- 成本控制（防止单次调用过度消耗）
- 性能优化（加快响应速度）
- 特定 API 限制要求

---

## 📊 模型上下文窗口

| 模型 | 上下文窗口 | 说明 |
|------|-----------|------|
| Claude Opus 4.5 | 200K tokens | 默认无限制使用 |
| Claude Sonnet 4 | 200K tokens | 默认无限制使用 |
| Claude Haiku 4 | 200K tokens | 默认无限制使用 |

---

## 🔍 相关文件

### 后端
- `src-tauri/src/commands/permission_config.rs` - 执行配置和参数构建
- `src-tauri/src/commands/prompt_tracker.rs` - 配置加载

### 前端
- `src/lib/api/types.ts` - TypeScript 类型定义
- `src/lib/api.ts` - API 接口

---

## 📝 总结

Token 限制已成功移除，Fangyu Code 现在可以：
- ✅ 充分利用 Claude 的 200K 上下文窗口
- ✅ 支持更长的工具调用输出
- ✅ 生成更完整的代码和分析
- ✅ 更好地处理大型项目

**状态**: ✅ **已完成，立即生效**

---

**修改人员**: Claude Opus 4.5
**验证日期**: 2026-01-21

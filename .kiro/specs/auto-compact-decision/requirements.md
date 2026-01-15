# Requirements Document

## Introduction

本文档分析 Fangyu Code 中 Auto-Compact（自动压缩）功能的现状，并决定是否保留、重构或移除该功能。核心问题是：Claude CLI 是否支持 `/compact` 命令，以及如何最优地实现上下文管理。

## Glossary

- **Auto_Compact**: 自动压缩功能，当上下文使用率达到阈值时自动触发压缩
- **Smart_Session_Continue**: 智能会话续接功能，生成摘要并创建新会话
- **Context_Manager**: Rust 后端的上下文管理模块
- **Claude_CLI**: Claude Code 命令行工具
- **Compaction**: 压缩操作，将长对话历史压缩为摘要

## Background Research

### Claude CLI /compact 命令支持情况

根据 Web 搜索结果（docs.claude.com）：
- ✅ Claude CLI **确实支持** `/compact` 命令
- `/compact` 命令会总结对话历史并开始新会话
- 用法：在 Claude CLI 中输入 `/compact` 或 `/compact [instructions]`

### 当前实现问题

1. **Rust 后端硬编码返回错误**：`execute_claude_compaction()` 直接返回错误，没有尝试调用 CLI
2. **命令调用方式可能错误**：注释掉的代码使用 `cmd.args(&["/compact"])`，但斜杠命令应该通过 `-p` 参数传递
3. **事件监听未实现**：前端发送 `compact-session-request` 事件，但后端没有监听器

## Requirements

### Requirement 1: 技术可行性分析

**User Story:** As a developer, I want to understand whether /compact is technically feasible, so that I can make an informed decision.

#### Acceptance Criteria

1. THE Analysis SHALL confirm Claude CLI supports /compact command based on official documentation
2. THE Analysis SHALL identify the correct way to invoke /compact via CLI (using -p flag)
3. THE Analysis SHALL document the current implementation gaps in Rust backend

### Requirement 2: 功能对比分析

**User Story:** As a developer, I want to compare Auto-Compact vs Smart Session Continue, so that I can choose the best approach.

#### Acceptance Criteria

1. THE Analysis SHALL compare user experience of both approaches
2. THE Analysis SHALL compare implementation complexity of both approaches
3. THE Analysis SHALL compare reliability and error handling of both approaches
4. THE Analysis SHALL provide a recommendation with clear rationale

### Requirement 3: 决策与实施方案

**User Story:** As a developer, I want a clear decision and implementation plan, so that I can proceed with the work.

#### Acceptance Criteria

1. IF keeping Auto-Compact, THEN THE Plan SHALL include steps to fix the Rust backend
2. IF removing Auto-Compact, THEN THE Plan SHALL include cleanup steps and migration path
3. THE Plan SHALL address the garbage /compact sessions in the session list
4. THE Plan SHALL ensure no ERROR logs are generated for disabled features

## Analysis Results

### Option A: 修复 Auto-Compact 功能

**优点：**
- 用户无感知的后台压缩体验
- 保持当前会话连续性
- 符合 "Invisible UX" 设计理念

**缺点：**
- 需要修复 Rust 后端实现
- Claude CLI 的 /compact 行为可能不稳定
- 需要处理压缩期间的增量消息合并

**实现难度：** 中等（需要修改 Rust 代码，测试 CLI 行为）

### Option B: 移除 Auto-Compact，强化 Smart Session Continue

**优点：**
- 代码更简洁，减少维护负担
- Smart Session Continue 已经可用
- 用户有明确的控制权

**缺点：**
- 用户需要手动触发或确认续接
- 会话切换有感知（虽然可以做到很平滑）

**实现难度：** 低（主要是删除代码和清理）

### Option C: 保留代码但默认禁用，等待 Claude CLI 稳定

**优点：**
- 保留未来可能性
- 不需要大量代码改动
- 当前已经是这个状态

**缺点：**
- 代码冗余
- 用户可能困惑为什么有这个选项但不能用

**实现难度：** 最低（只需修复日志级别）

## Recommendation

**推荐方案：Option A - 修复 Auto-Compact 功能**

理由：
1. Claude CLI 确实支持 /compact，只是我们的调用方式有问题
2. Auto-Compact 的 "Invisible UX" 设计理念更优秀
3. 代码已经写好，只需修复调用方式
4. 可以同时保留 Smart Session Continue 作为备选

## Implementation Plan

### Phase 1: 修复 /compact 调用

1. 修改 `execute_claude_compaction()` 使用正确的 CLI 调用方式
2. 使用 `-p "/compact"` 而不是 `args(&["/compact"])`
3. 添加 `compact-session-request` 事件监听器

### Phase 2: 清理垃圾会话

1. 添加批量删除会话功能
2. 清理名为 "/compact" 的失败会话

### Phase 3: 测试与验证

1. 测试 /compact 命令是否正常工作
2. 验证压缩后的会话是否可用
3. 确保错误处理正确

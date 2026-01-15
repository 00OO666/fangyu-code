# Implementation Plan: Auto-Compact 功能修复

## Overview

修复 Fangyu Code 的 Auto-Compact 功能，使 `/compact` 命令正常工作。

## Tasks

- [x] 1. 修复 Rust 后端 /compact 调用
  - [x] 1.1 修改 `execute_claude_compaction()` 函数
    - 移除硬编码的错误返回
    - 使用 `-p "/compact"` 参数调用 Claude CLI
    - 添加正确的错误处理
    - _Requirements: 1.2, 3.1_
  - [x] 1.2 添加 `execute_compact` Tauri Command
    - 创建新的 Tauri command 供前端调用
    - 返回 CompactResult 结构
    - _Requirements: 3.1_

- [x] 2. 更新前端调用方式
  - [x] 2.1 修改 `useBackgroundCompact.ts`
    - 将 `emit("compact-session-request")` 改为 `invoke("execute_compact")`
    - 简化事件监听逻辑
    - _Requirements: 3.1_

- [x] 3. 清理垃圾会话
  - [x] 3.1 添加批量删除会话功能
    - 在 Rust 后端添加 `delete_sessions_by_pattern` 命令
    - _Requirements: 3.3_
  - [x] 3.2 清理现有的 "/compact" 垃圾会话
    - 调用清理功能删除所有名为 "/compact" 的会话
    - _Requirements: 3.3_

- [x] 4. 验证与测试
  - [x] 4.1 测试 /compact 命令是否正常工作
    - 手动测试压缩功能
    - 验证新会话创建成功
    - _Requirements: 1.2, 3.1_
  - [x] 4.2 验证日志级别
    - 确保禁用时不产生 ERROR 日志
    - _Requirements: 3.4_

## Notes

- 任务按顺序执行，每个任务完成后验证
- 不自动构建，用户手动构建测试
- 如果 /compact 命令行为与预期不符，需要调整实现

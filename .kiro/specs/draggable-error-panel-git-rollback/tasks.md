# Implementation Plan: 错误监控面板拖拽 + Git 代码回滚

## Overview

基于 Git 回滚最佳实践，实现两个功能：
1. **错误监控面板拖拽** - 纯前端 React 实现
2. **Git 代码回滚** - 支持三种回滚方式：
   - `git reset` - 本地提交回滚（soft/mixed/hard）
   - `git revert` - 安全回滚（创建新提交，适合已推送的代码）
   - `git restore` - 单文件恢复

## Tasks

- [x] 1. 实现 useDraggable Hook
  - [x] 1.1 创建 useDraggable hook 基础结构
    - 实现 mousedown/mousemove/mouseup 事件处理
    - 管理 isDragging 和 position 状态
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 添加 localStorage 位置持久化
    - 初始化时从 localStorage 读取位置
    - 拖拽结束时保存位置
    - _Requirements: 1.4_
  - [x] 1.3 实现视口边界约束
    - 计算面板在视口内的有效范围
    - 拖拽时约束位置不超出边界
    - _Requirements: 1.5_

- [x] 2. 集成拖拽到 ErrorMonitorPanel
  - [x] 2.1 修改 ErrorMonitorPanel 使用 useDraggable
    - 替换 fixed 定位为动态位置
    - 添加拖拽手柄到面板头部
    - 添加拖拽光标样式（move cursor）
    - _Requirements: 1.1, 1.6_
  - [x] 2.2 添加位置重置功能
    - 双击头部重置到默认位置（右下角）
    - _Requirements: 1.3_

- [x] 3. Checkpoint - 拖拽功能完成
  - 确保拖拽功能正常工作
  - 测试位置持久化
  - 测试边界约束

- [x] 4. 实现 Tauri Git 后端命令
  - [x] 4.1 创建 git.rs 命令模块基础结构
    - 定义 GitCommandResult、GitFileStatus、GitCommitInfo 结构体
    - 实现 is_git_repository 验证函数
    - 实现 execute_git_command 通用执行函数
    - _Requirements: 2.5_
  - [x] 4.2 实现 git_status 命令
    - 执行 `git status --porcelain`
    - 解析输出为 GitFileStatus 列表（M/A/D/?/R）
    - 区分已暂存和未暂存文件
    - _Requirements: 4.1, 4.4_
  - [x] 4.3 实现 git_log 命令
    - 执行 `git log --format="%H|%h|%s|%an|%ad|%ar" --date=iso -n {count}`
    - 解析输出为 GitCommitInfo 列表
    - 包含 hash、shortHash、message、author、timestamp
    - _Requirements: 2.4_
  - [x] 4.4 实现 git_diff 命令
    - 支持 `git diff` 获取所有未暂存更改
    - 支持 `git diff --cached` 获取已暂存更改
    - 支持 `git diff -- {file}` 获取单文件 diff
    - _Requirements: 4.3_
  - [x] 4.5 实现 git_reset 命令
    - 支持 soft/mixed/hard 三种模式
    - `git reset --soft {hash}` - 保留更改在暂存区
    - `git reset --mixed {hash}` - 保留更改在工作区（默认）
    - `git reset --hard {hash}` - 丢弃所有更改
    - _Requirements: 3.1, 3.3_
  - [x] 4.6 实现 git_revert 命令
    - 执行 `git revert {hash} --no-edit`
    - 创建新提交来撤销指定提交的更改
    - 适合已推送到远程的提交
    - _Requirements: 3.1_
  - [x] 4.7 实现 git_restore 命令
    - `git restore {file}` - 恢复单文件到最新提交状态
    - `git restore --staged {file}` - 取消暂存
    - `git restore --source={hash} {file}` - 恢复到指定提交
    - _Requirements: 3.1_
  - [x] 4.8 实现 git_create_backup_branch 命令
    - 执行 `git branch backup-{timestamp}`
    - 在危险操作前自动创建备份
    - _Requirements: 3.6_
  - [x] 4.9 注册 Git 命令到 Tauri
    - 在 main.rs 中注册所有 git 命令
    - _Requirements: 2.1, 2.2_

- [x] 5. Checkpoint - Git 后端完成
  - 确保所有 Git 命令可通过 Tauri invoke 调用
  - 测试错误处理（非 Git 仓库、无效 hash 等）

- [x] 6. 创建前端 Git 服务
  - [x] 6.1 创建 gitService.ts
    - 封装所有 Tauri Git 命令调用
    - 添加 TypeScript 类型定义
    - 添加错误处理和重试逻辑
    - _Requirements: 2.1, 2.2_
  - [x] 6.2 更新 useGitAutoCommit hook
    - 替换 executeGitCommand TODO 为真实 Tauri 调用
    - 使用 gitService 封装
    - _Requirements: 2.4, 4.1, 4.2_

- [x] 7. 实现回滚 UI
  - [x] 7.1 添加回滚确认对话框
    - 显示目标提交信息（hash、message、author、time）
    - 提供三种回滚方式选择：
      - Reset (soft) - 保留更改在暂存区
      - Reset (hard) - 丢弃所有更改（危险）
      - Revert - 创建新提交撤销（安全，推荐）
    - 警告数据丢失风险（hard reset）
    - 显示是否创建备份分支选项
    - _Requirements: 3.2, 3.3_
  - [x] 7.2 实现回滚操作逻辑
    - 根据用户选择调用对应的 gitService 方法
    - Hard reset 前自动创建备份分支
    - 成功后刷新文件列表和提交历史
    - 显示成功/失败通知（toast）
    - _Requirements: 3.1, 3.4, 3.5, 3.6_
  - [x] 7.3 增强文件状态显示
    - 显示正确的状态图标和颜色：
      - M (Modified) - 蓝色
      - A (Added) - 绿色
      - D (Deleted) - 红色
      - ? (Untracked) - 灰色
      - R (Renamed) - 紫色
    - 区分已暂存（staged）和未暂存（unstaged）
    - _Requirements: 4.4_
  - [x] 7.4 添加单文件恢复功能
    - 右键菜单：恢复此文件
    - 调用 git_restore 恢复单文件
    - _Requirements: 3.1_

- [x] 8. Checkpoint - 功能集成完成
  - 测试完整的回滚流程（reset/revert/restore）
  - 验证文件列表刷新
  - 验证备份分支创建
  - 确保错误处理正常

- [x] 9. Final Checkpoint
  - 确保所有功能正常工作
  - 验证拖拽和 Git 功能集成

## Notes

- 拖拽功能可以独立于 Git 功能先完成
- Git 后端需要用户系统已安装 Git
- **回滚方式选择建议**：
  - 本地未推送的提交 → 使用 Reset
  - 已推送到远程的提交 → 使用 Revert（安全）
  - 单文件恢复 → 使用 Restore
- Hard reset 是危险操作，必须有确认对话框和备份分支
- 参考：[Git Rollback Best Practices](https://labex.io/tutorials/git-how-to-rollback-git-changes-safely-418148)


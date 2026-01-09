# Implementation Plan: Fangyu Code v2.5.0 审计与改进

## Overview

本实现计划将设计文档中的改进方案转化为可执行的编码任务。任务按优先级排序：先修复已发现的问题，再实现改进功能。

## Tasks

- [x] 1. 修复 SessionWindow 事件监听器泄漏
  - [x] 1.1 创建 useEventCleanup Hook
    - 在 `src/hooks/` 创建 `useEventCleanup.ts`
    - 实现 Tauri 事件监听器的统一管理
    - 提供 `registerListener` 和 `cleanup` 方法
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 编写 useEventCleanup 属性测试
    - **Property 1: 组件卸载清理完整性**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 1.3 重构 SessionWindow 使用 useEventCleanup
    - 替换现有的 window.listen 调用
    - 确保所有监听器在 useEffect cleanup 中被清理
    - _Requirements: 1.1, 1.2_

- [x] 2. Checkpoint - 验证事件清理
  - 确保所有测试通过，如有问题请告知

- [x] 3. 完善 SandboxManager 实现
  - [x] 3.1 实现 SandboxManager 核心功能
    - 完善 `src/core/sandbox/SandboxManager.ts`
    - 实现 `create`、`execute`、`destroy` 方法
    - 使用 Tauri invoke 调用 Docker 命令
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.2 编写 SandboxManager 属性测试
    - **Property 2: Sandbox 资源配对**
    - **Validates: Requirements 2.3**
  - [x] 3.3 添加 Rust 后端 Docker 命令
    - 在 `src-tauri/src/commands/` 添加 Docker 相关命令
    - 实现容器创建、执行、销毁的 Tauri 命令
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. 启用 Feature Flags Phase 2
  - [x] 4.1 更新 Feature Flags 配置
    - 在 `src/config/featureFlags.ts` 添加 Phase 2 标志
    - 添加 CONTEXT_WINDOW_PRUNING 和 VIRTUAL_SCROLLING
    - 添加每个标志的文档说明
    - _Requirements: 3.1_
  - [x] 4.2 编写 Feature Flags 单元测试
    - 测试标志的启用/禁用逻辑
    - 测试依赖关系检查
    - _Requirements: 3.1_

- [x] 5. Checkpoint - 验证问题修复
  - 确保所有测试通过，如有问题请告知

- [x] 6. 实现 RetryService 自动重试
  - [x] 6.1 创建 RetryService
    - 在 `src/lib/services/` 创建 `retryService.ts`
    - 实现 `withRetry` 函数
    - 支持指数退避配置
    - _Requirements: 2.2_
  - [x] 6.2 编写 RetryService 属性测试
    - **Property 4: 指数退避重试**
    - **Validates: Requirements 2.2**
  - [x] 6.3 集成 RetryService 到 API 调用
    - 在 `src/lib/api.ts` 中使用 RetryService
    - 配置网络错误的自动重试
    - _Requirements: 2.2_

- [x] 7. 增强错误处理
  - [x] 7.1 创建用户友好错误消息系统
    - 在 `src/lib/` 创建 `userFriendlyErrors.ts`
    - 定义错误类型到用户消息的映射
    - 包含建议的解决方案
    - _Requirements: 2.1_
  - [x] 7.2 编写错误消息属性测试
    - **Property 3: 错误消息用户友好性**
    - **Validates: Requirements 2.1**
  - [x] 7.3 更新 ErrorBoundary 组件
    - 增强 `src/components/ErrorBoundary.tsx`
    - 集成用户友好错误消息
    - 添加恢复选项
    - _Requirements: 2.3_

- [x] 8. Checkpoint - 验证错误处理
  - 确保所有测试通过，如有问题请告知

- [x] 9. 实现 API 密钥安全存储
  - [x] 9.1 创建 SecureStorage 模块
    - 在 `src/lib/` 创建 `secureStorage.ts`
    - 使用 Tauri 安全存储 API
    - 实现 setItem、getItem、removeItem 方法
    - _Requirements: 7.1_
  - [x] 9.2 添加 Rust 后端安全存储命令
    - 在 `src-tauri/src/commands/` 添加安全存储命令
    - 使用 keyring 或类似库存储敏感数据
    - _Requirements: 7.1_
  - [x] 9.3 创建 API 密钥验证器
    - 在 `src/lib/` 创建 `apiKeyValidator.ts`
    - 实现各提供商的密钥格式验证
    - _Requirements: 7.3_
  - [x] 9.4 编写 API 密钥验证属性测试
    - **Property 8: API 密钥格式验证**
    - **Validates: Requirements 7.3**
  - [x] 9.5 更新 APIConfigPanel 使用安全存储
    - 修改 `src/components/settings/APIConfigPanel.tsx`
    - 使用 SecureStorage 替代 localStorage
    - 添加密钥遮罩显示
    - _Requirements: 7.1, 7.2_
  - [x] 9.6 编写 API 密钥安全存储属性测试
    - **Property 7: API 密钥安全存储**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 10. Checkpoint - 验证安全存储
  - 确保所有测试通过，如有问题请告知

- [x] 11. 实现 VirtualList 虚拟滚动
  - [x] 11.1 创建 VirtualList 组件
    - 在 `src/components/common/` 创建 `VirtualList.tsx`
    - 实现虚拟滚动逻辑
    - 支持动态高度项目
    - _Requirements: 1.1_
  - [x] 11.2 编写 VirtualList 单元测试
    - 测试滚动行为
    - 测试项目渲染范围
    - _Requirements: 1.1_
  - [x] 11.3 集成 VirtualList 到消息列表
    - SessionMessages 已使用 @tanstack/react-virtual 实现虚拟滚动
    - VirtualList 组件保留作为通用虚拟滚动组件
    - _Requirements: 1.1_

- [x] 12. 实现进度指示器
  - [x] 12.1 创建 ProgressIndicator 组件
    - 在 `src/components/common/` 创建 `ProgressIndicator.tsx`
    - 支持不确定进度和确定进度
    - _Requirements: 6.2_
  - [x] 12.2 创建 useProgressIndicator Hook
    - 在 `src/hooks/` 创建 `useProgressIndicator.ts`
    - 自动检测长时间操作
    - 管理进度指示器的显示/隐藏
    - _Requirements: 6.2_
  - [x] 12.3 编写进度指示器属性测试
    - **Property 5: 进度指示器一致性**
    - **Validates: Requirements 6.2**

- [x] 13. 实现输入验证反馈
  - [x] 13.1 创建 ValidationFeedback 组件
    - 在 `src/components/common/` 创建 `ValidationFeedback.tsx`
    - 支持内联错误显示
    - 支持成功/警告/错误状态
    - _Requirements: 6.3_
  - [x] 13.2 创建 useValidation Hook
    - 在 `src/hooks/` 创建 `useValidation.ts`
    - 实现实时验证逻辑
    - 支持防抖验证
    - _Requirements: 6.3_
  - [x] 13.3 编写输入验证属性测试
    - **Property 6: 输入验证反馈**
    - **Validates: Requirements 6.3**

- [x] 14. Checkpoint - 验证 UI 改进
  - 确保所有测试通过，如有问题请告知

- [x] 15. 代码清理和文档
  - [x] 15.1 清理 TODO 注释
    - 扫描所有 TODO 注释
    - 解决或创建 Issue 跟踪
    - _Requirements: 3.1_
  - [x] 15.2 移除未使用的代码
    - 运行 ESLint 检查未使用的导入和变量
    - 清理废弃的文件
    - _Requirements: 3.2_
  - [x] 15.3 更新架构文档
    - 在 `docs/` 创建架构图
    - 更新 README 文档
    - _Requirements: 5.1_

- [x] 16. Final Checkpoint - 完成验证
  - 确保所有测试通过
  - 验证所有功能正常工作
  - 如有问题请告知

## Notes

- 所有任务都是必须完成的，包括测试任务
- 每个任务都引用了具体的需求以便追溯
- Checkpoint 任务用于增量验证
- 属性测试验证通用的正确性属性
- 单元测试验证具体的示例和边界情况

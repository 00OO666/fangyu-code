# Implementation Plan: 流式输出性能优化与错误修复

## Overview

本实现计划按优先级修复所有已知错误，并优化流式输出性能。

## Tasks

- [x] 1. 修复 useSessionThresholdMonitor 崩溃 (P0)
  - [x] 1.1 修复 generateSummary 函数中的 content 类型检查
    - 在 `src/hooks/useSessionThresholdMonitor.ts` 第 100-120 行
    - 添加 `Array.isArray()` 检查
    - 处理 string、undefined、null 类型的 content
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 1.2 编写属性测试验证 content 类型处理
    - **Property 1: Content Type Handling**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. 修复 SessionMessages flushSync 警告 (P0)
  - [x] 2.1 修复 MeasurableItem 中的 ResizeObserver 回调
    - 在 `src/components/session/SessionMessages.tsx`
    - 确保所有 measureElement 调用都在 requestAnimationFrame 中
    - 移除任何直接的 flushSync 调用
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 🔧 v2.5.1 FIX: 添加 useFlushSync: false 到 useVirtualizer 配置
    - 禁用 @tanstack/react-virtual 内部的 flushSync 调用
    - 允许 React 自然批量更新
    - _Requirements: 3.1, 3.2_

- [x] 3. 修复 Tooltip ref 错误 (P0)
  - [x] 3.1 识别所有被 Tooltip 包裹的函数组件
    - 搜索项目中所有 `<Tooltip>` 使用
    - 列出需要添加 forwardRef 的组件
    - _Requirements: 1.1_
  - [x] 3.2 为需要的组件添加 forwardRef
    - 使用 `React.forwardRef` 包裹组件
    - 添加 `displayName` 属性
    - _Requirements: 1.1, 1.2_
  - [x] 3.3 🔧 v2.5.1 FIX: 修复 TabManager 中的 motion.div ref 问题
    - 将 motion.div 替换为普通 div（移除不必要的动画）
    - _Requirements: 1.1, 1.2_
  - [x] 3.4 🔧 v2.5.1 FIX: 修复 SyncStatusIndicator 中的 motion.div ref 问题
    - 创建 MotionDivWithRef 包装组件，正确转发 ref
    - _Requirements: 1.1, 1.2_
  - [x] 3.5 🔧 v2.5.2 FIX: 移除 AnimatePresence mode="popLayout"
    - AnimatePresence 会尝试给 Tooltip 添加 ref 导致警告
    - 标签页动画改用 CSS transition 实现
    - _Requirements: 1.1, 1.2_

- [x] 4. Checkpoint - 验证 P0 错误修复
  - 运行应用确认无 console 错误
  - 确保所有测试通过

- [x] 5. 修复 Dialog 控制状态警告 (P1)
  - [x] 5.1 搜索所有 Dialog 组件使用
    - 查找 `open` prop 可能为 undefined 的情况
    - _Requirements: 4.1_
  - [x] 5.2 修复 Dialog 初始状态
    - 确保所有 `useState` 有明确的初始值 `false`
    - _Requirements: 4.1, 4.2_
  - [x] 5.3 🔧 v2.5.1 FIX: 修复 TabManager 中的 tabToClose 状态
    - 将初始值从 `null` 改为空字符串 `''`
    - 使用 `Boolean(tabToClose)` 确保 open prop 始终是 boolean
    - _Requirements: 4.1, 4.2_
  - [x] 5.4 🔧 v2.5.2 FIX: 修复取消按钮的 setTabToClose(null) 为 setTabToClose('')
    - 保持状态类型一致性
    - _Requirements: 4.1, 4.2_
  - [x] 5.5 🔧 v2.5.2 FIX: 修复 TauriAutoUpdateDialog 中的 AlertDialog open 属性
    - showDialog 可能为 undefined，使用 Boolean() 包装
    - downloading || installing 也需要 Boolean() 包装
    - _Requirements: 4.1, 4.2_
  - [ ]* 5.6 编写属性测试验证 Dialog 状态
    - **Property 4: Dialog State Consistency**
    - **Validates: Requirements 4.1, 4.2**

- [x] 6. 优化消息去重 (P1)
  - [x] 6.1 分析消息重复的根本原因
    - 检查 `useMessageTranslation.ts` 中的消息添加逻辑
    - 检查事件监听器是否重复注册
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 6.2 在消息源头添加去重逻辑
    - 使用 Set 跟踪已处理的消息 ID
    - 更新而非追加重复消息
    - _Requirements: 5.1, 5.2_
  - [x] 6.3 优化事件监听器注册
    - 确保 useEffect 正确清理监听器
    - 防止重复订阅
    - _Requirements: 5.3_
  - [x] 6.4 🔧 v2.5.1 FIX: 添加 initializeProcessedIds 方法
    - 在加载历史消息时初始化已处理的消息 ID Set
    - 防止流式消息与历史消息重复
    - _Requirements: 5.1, 5.2_
  - [x] 6.5 🔧 v2.5.2 FIX: 在 useSessionStream 加载时进行历史消息去重
    - 添加 deduplicateMessages 函数
    - 在 setMessages 前对历史消息进行去重
    - 输出去重日志便于调试
    - _Requirements: 5.1, 5.2_
  - [ ]* 6.6 编写属性测试验证去重效果
    - **Property 2: Message Deduplication Effectiveness**
    - **Property 3: Event Listener Uniqueness**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 7. Checkpoint - 验证 P1 修复
  - 确认消息重复率 < 5%
  - 确认无 Dialog 警告

- [x] 8. 应用 OptimizedMarkdown 组件 (P2)
  - [x] 8.1 更新 MessageContent 使用 OptimizedMarkdown
    - 在 `src/components/message/MessageContent.tsx`
    - 导入并使用 OptimizedMarkdown 替换 ReactMarkdown
    - 保留打字机效果逻辑
    - _Requirements: 7.1_
  - [x] 8.2 验证代码块样式
    - 确认 macOS 风格头部显示
    - 确认长代码块可折叠
    - _Requirements: 7.2, 7.3, 6.4_
  - [x] 8.3 验证流式输出光标
    - 确认 CSS 动画光标正常工作
    - _Requirements: 6.2_

- [x] 9. 性能验证 (P2)
  - [x] 9.1 验证语法高亮懒加载
    - 确认使用 dynamic import
    - _Requirements: 6.3_
  - [x] 9.2 验证渲染性能
    - 使用 React DevTools Profiler
    - 确认无不必要的重渲染
    - _Requirements: 6.1_

- [x] 10. Final Checkpoint
  - 确保所有测试通过
  - 确认无 console 错误和警告
  - 验证流式输出流畅

## Notes

- Tasks marked with `*` are optional property-based tests
- P0 tasks are critical and must be fixed first
- P1 tasks improve stability and performance
- P2 tasks enhance user experience
- 禁止自动构建，修改完成后由用户手动构建

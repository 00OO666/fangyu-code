# Implementation Plan: Unified Workflow System

## Overview

将现有的 WorkflowManagerPanel (Kiro 风格) 和 useWorkflowOrchestrator (Devin 风格) 合并为统一的工作流系统，使用 TypeScript + React + fast-check 实现。

## Tasks

- [x] 1. 创建统一工作流引擎核心
  - [x] 1.1 创建 UnifiedWorkflowEngine 类
    - 实现状态机：idle → planning → executing → paused/completed/failed
    - 集成 EventEmitter 事件系统
    - 实现 initialize/destroy 生命周期方法
    - _Requirements: 1.1, 1.2, 4.6, 7.1_

  - [x] 1.2 实现工作流生成逻辑
    - 集成 SpecGenerationEngine（简单模式）
    - 集成 TaskPlanner（复杂模式）
    - 实现 TechnicalSpec → WorkflowDAG 转换
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [x] 1.3 编写 DAG 有效性属性测试
    - **Property 1: DAG Validity**
    - **Validates: Requirements 1.2, 2.2**

  - [x] 1.4 编写并行任务识别属性测试
    - **Property 2: Parallel Task Identification**
    - **Validates: Requirements 1.3, 2.4**

- [x] 2. 实现任务规划增强
  - [x] 2.1 增强 TaskPlanner 关键路径计算
    - 优化拓扑排序算法
    - 实现最长路径计算
    - 添加复杂度权重支持
    - _Requirements: 2.3_

  - [x] 2.2 编写关键路径正确性属性测试
    - **Property 3: Critical Path Correctness**
    - **Validates: Requirements 2.3**
    - ✅ 6 个测试全部通过

- [x] 3. 实现代理池管理增强
  - [x] 3.1 增强 AgentSwarmManager 任务分配
    - 实现基于能力的代理匹配算法
    - 添加并发限制控制
    - 实现任务队列管理
    - _Requirements: 3.2, 3.3, 3.5_

  - [x] 3.2 编写代理-任务匹配属性测试
    - **Property 4: Agent-Task Matching**
    - **Validates: Requirements 3.2**
    - ✅ 3 个测试全部通过

  - [x] 3.3 编写并发限制属性测试
    - **Property 5: Concurrency Limit**
    - **Validates: Requirements 3.3**
    - ✅ 3 个测试全部通过

  - [x] 3.4 编写代理池生命周期属性测试
    - **Property 6: Agent Pool Lifecycle**
    - **Validates: Requirements 3.1, 3.4**
    - ✅ 4 个测试全部通过

  - [x] 3.5 编写任务队列保持属性测试
    - **Property 7: Task Queue Preservation**
    - **Validates: Requirements 3.5**
    - ✅ 3 个测试全部通过

- [x] 4. Checkpoint - 核心引擎测试
  - ✅ 所有 26 个属性测试通过（Property 1-7）
  - ✅ DAG 生成和代理调度功能验证完成
  - 无问题，继续执行

- [x] 5. 实现工作流执行控制
  - [x] 5.1 实现暂停/恢复功能
    - 实现 pauseExecution 方法
    - 实现 resumeExecution 方法
    - 保存/恢复执行状态
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.2 实现重试和取消功能
    - 实现 retryTask 方法（隔离重试）
    - 实现 cancelExecution 方法（资源清理）
    - _Requirements: 4.4, 4.5_

  - [x] 5.3 编写暂停/恢复往返属性测试
    - **Property 8: Pause/Resume Round-Trip**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - ✅ 4 个测试全部通过

  - [x] 5.4 编写重试隔离属性测试
    - **Property 9: Retry Isolation**
    - **Validates: Requirements 4.4**
    - ✅ 3 个测试全部通过

  - [x] 5.5 编写取消清理属性测试
    - **Property 10: Cancellation Cleanup**
    - **Validates: Requirements 4.5**
    - ✅ 4 个测试全部通过

- [x] 6. 实现事件系统
  - [x] 6.1 完善事件发射机制
    - 实现所有 WorkflowEventType 事件
    - 添加事件时间戳和数据
    - 实现订阅/取消订阅 API
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 6.2 编写事件发射完整性属性测试
    - **Property 11: Event Emission Completeness**
    - **Validates: Requirements 4.6, 7.1-7.5**
    - ✅ 4 个测试全部通过

  - [x] 6.3 编写事件订阅正确性属性测试
    - **Property 12: Event Subscription Correctness**
    - **Validates: Requirements 7.6**
    - ✅ 4 个测试全部通过

- [x] 7. Checkpoint - 执行控制测试
  - ✅ 所有 32 个属性测试通过（Property 1-12）
  - ✅ 暂停/恢复/重试/取消功能验证完成
  - ✅ 事件系统工作正常
  - 无问题，继续执行

- [x] 8. 创建 React Hook
  - [x] 8.1 实现 useUnifiedWorkflow Hook
    - 封装 UnifiedWorkflowEngine
    - 实现状态管理（useState/useRef）
    - 实现 cleanup（useEffect cleanup）
    - 暴露所有操作方法
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.2 编写进度准确性属性测试
    - **Property 13: Progress Accuracy**
    - **Validates: Requirements 5.4**

  - [x] 8.3 编写 Hook 清理属性测试
    - **Property 14: Hook Cleanup**
    - **Validates: Requirements 5.6**

- [x] 9. 重构 WorkflowManagerPanel UI
  - [x] 9.1 使用 useUnifiedWorkflow 重构 UI
    - 替换现有的 SpecDrivenWorkflow 类
    - 添加 DAG 可视化组件
    - 添加暂停/恢复/重试/取消按钮
    - 添加实时进度显示
    - 添加执行日志面板
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 10. 清理旧代码
  - [x] 10.1 删除废弃文件
    - 删除 src/hooks/agents/useWorkflowOrchestrator.ts
    - 删除 src/core/workflow/SpecDrivenWorkflow.ts（如果完全被替代）
    - 更新相关 import 引用
    - _Requirements: 代码清理规范_

- [x] 11. Final Checkpoint - 完整功能验证
  - 确保所有 14 个属性测试通过
  - 验证 UI 功能正常
  - 验证 API 配置兼容性（HiAPI、hone.vvvv.ee）
  - 如有问题请询问用户

## Notes

- 所有任务均为必选，确保完整测试覆盖
- 每个属性测试引用设计文档中的属性编号
- 使用 fast-check 库进行属性测试，每个测试至少 100 次迭代
- 保留现有的 TaskPlanner、AgentSwarmManager、SpecGenerationEngine 核心逻辑
- 新建 UnifiedWorkflowEngine 作为统一协调层

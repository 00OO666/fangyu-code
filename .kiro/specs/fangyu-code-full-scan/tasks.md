# Implementation Plan: Fangyu Code 全面扫描修复

## Overview

本计划将修复扫描发现的 351 个 TypeScript 错误，按优先级分组执行。

## Tasks

- [ ] 1. 修复阻塞性类型错误
  - [ ] 1.1 修复 useSessionThresholdMonitor 返回值解构
    - 文件: `src/components/ClaudeCodeSession.tsx`
    - 移除不存在的 `summary` 解构
    - _Requirements: 1.1_
  - [ ] 1.2 更新 ValidatableSession 类型定义
    - 文件: `src/lib/utils.ts`
    - 添加缺失的属性: `last_message_timestamp`, `message_timestamp`, `created_at`, `todo_data`, `project_id`, `project_path`
    - 添加 `siliconflow` 到 engine 类型
    - _Requirements: 1.3_
  - [ ] 1.3 修复 canvas 组件导出
    - 文件: `src/components/canvas/index.ts`
    - 添加 `CanvasRenderer`, `CanvasMode`, `CanvasLanguage`, `CanvasRendererProps` 导出
    - _Requirements: 1.2_
  - [ ] 1.4 修复 popover 组件导入
    - 文件: `src/components/copilot/CopilotSidebar.tsx`
    - 更新为使用正确的 Popover 组件 API
    - _Requirements: 1.2_

- [ ] 2. Checkpoint - 验证阻塞性错误修复
  - 运行 `npx tsc --noEmit` 确认错误数量减少

- [ ] 3. 修复缺失的模块和组件
  - [ ] 3.1 修复 @core/types/unified-agent 路径
    - 检查 tsconfig.json 路径别名配置
    - 确保 `src/core/types/unified-agent.ts` 存在
    - _Requirements: 1.2_
  - [ ] 3.2 添加 ResizablePanel 组件导入
    - 文件: `src/components/workflow/WorkflowControlPanel.tsx`
    - 添加缺失的 UI 组件导入
    - _Requirements: 1.2_
  - [ ] 3.3 修复 SmartOutputParser Button 导入
    - 文件: `src/components/output/SmartOutputParser.tsx`
    - 添加 Button 组件导入
    - _Requirements: 1.2_

- [ ] 4. 修复函数签名不匹配
  - [ ] 4.1 修复 ExecutionEngineSelector 类型
    - 文件: `src/components/ExecutionEngineSelector.tsx`
    - 统一函数签名类型
    - _Requirements: 1.1_
  - [ ] 4.2 修复 FileTreeExplorer 参数类型
    - 文件: `src/components/explorer/FileTreeExplorer.tsx`
    - 修复数组/单对象参数不匹配
    - _Requirements: 1.1_
  - [ ] 4.3 修复 HookToggleManager API 调用
    - 文件: `src/components/HookToggleManager.tsx`
    - 移除或替换不存在的 `getClaudeDir` 方法
    - _Requirements: 1.1_
  - [ ] 4.4 修复 ToolRecommendationToast 方法调用
    - 文件: `src/components/ToolRecommendationToast.tsx`
    - 移除或替换不存在的 `global` 方法
    - _Requirements: 1.1_

- [ ] 5. Checkpoint - 验证功能性错误修复
  - 运行 `npx tsc --noEmit` 确认错误数量减少

- [ ] 6. 修复测试文件问题
  - [ ] 6.1 修复 setup.ts 导入
    - 文件: `src/tests/setup.ts`
    - 添加 `beforeEach`, `afterEach` 从 vitest 导入
    - _Requirements: 1.2_
  - [ ] 6.2 修复 e2e 测试类型
    - 文件: `src/tests/e2e/agent-flow.e2e.test.ts`
    - 修复 Task 类型定义
    - _Requirements: 1.1_
  - [ ] 6.3 修复属性测试导入
    - 多个 `.property.test.ts` 文件
    - 修复模块导入路径
    - _Requirements: 1.2_

- [ ] 7. 清理未使用的代码
  - [ ] 7.1 清理 CopilotSidebar 未使用导入
    - 文件: `src/components/copilot/CopilotSidebar.tsx`
    - 移除 12 个未使用的导入
    - _Requirements: 3.2_
  - [ ] 7.2 清理 WorkflowControlPanel 未使用导入
    - 文件: `src/components/workflow/WorkflowControlPanel.tsx`
    - 移除 23 个未使用的导入和变量
    - _Requirements: 3.2_
  - [ ] 7.3 清理 MultiModalInput 未使用导入
    - 文件: `src/components/input/MultiModalInput.tsx`
    - 移除 9 个未使用的导入
    - _Requirements: 3.2_
  - [ ] 7.4 清理 NewFeaturesDemo 未使用导入
    - 文件: `src/examples/NewFeaturesDemo.tsx`
    - 移除 21 个未使用的导入
    - _Requirements: 3.2_
  - [ ] 7.5 清理其他文件未使用代码
    - 批量清理剩余的未使用导入和变量
    - _Requirements: 3.2_

- [ ] 8. Checkpoint - 验证代码清理
  - 运行 `npx tsc --noEmit` 确认所有错误已修复

- [ ] 9. 修复 undefined 检查
  - [ ] 9.1 修复 notificationService undefined 检查
    - 文件: `src/services/notificationService.ts`
    - 添加 `notification.duration` 的 undefined 检查
    - _Requirements: 2.3_
  - [ ] 9.2 移除未使用的 @ts-expect-error
    - 文件: `src/lib/services/llmApiService.ts`
    - 移除第 572 行的无效指令
    - _Requirements: 3.1_

- [ ] 10. Final Checkpoint - 完成验证
  - 运行 `npx tsc --noEmit` 确认 0 错误
  - 运行 `npm run test` 确认测试通过
  - 如有问题请告知

## Notes

- 优先修复阻塞性错误（P0）
- 每个 Checkpoint 后验证进度
- 未使用代码清理可以批量处理
- 测试文件问题可能需要更新测试框架配置

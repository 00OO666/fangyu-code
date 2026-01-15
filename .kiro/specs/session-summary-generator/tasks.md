# Implementation Plan: Session Summary Generator

## Overview

本实现计划将会话摘要生成器功能分解为可执行的编码任务，包括配置存储、API 服务、UI 组件和属性测试。

## Tasks

- [x] 1. 创建摘要配置存储模块
  - [x] 1.1 创建 SummaryConfigStore 类型定义和接口
    - 在 `src/types/summary.ts` 创建 SummaryAPIConfig、StoredSummaryConfig 等类型
    - 定义 ENGINE_MODELS 常量，包含四引擎的模型列表
    - _Requirements: 2.1, 3.2_
  - [x] 1.2 实现 SummaryConfigStore 服务
    - 在 `src/services/summaryConfigStore.ts` 实现配置的保存、加载、验证
    - 实现 API Key 加密/解密（使用 Web Crypto API）
    - 实现配置损坏检测和自动重置
    - _Requirements: 2.3, 6.1, 6.2, 6.3, 6.4_
  - [x] 1.3 编写配置存储属性测试
    - **Property 6: Configuration Persistence Round-Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 2. 实现摘要生成服务
  - [x] 2.1 创建 SummaryGeneratorService
    - 在 `src/services/summaryGeneratorService.ts` 实现摘要生成逻辑
    - 支持四引擎 API 调用（Claude/Codex/Gemini/SiliconFlow）
    - 实现进度追踪和取消功能
    - _Requirements: 1.2, 2.4_
  - [x] 2.2 实现 API 回退逻辑
    - 当摘要配置为空时，回退到主聊天 API 配置
    - _Requirements: 2.6_
  - [x] 2.3 编写 API 回退属性测试
    - **Property 8: API Fallback Behavior**
    - **Validates: Requirements 2.6**
  - [x] 2.4 编写配置隔离属性测试
    - **Property 1: Config Isolation**
    - **Validates: Requirements 2.1, 2.3, 2.4**

- [x] 3. 重构引擎选择器 UI
  - [x] 3.1 创建官方品牌图标组件
    - 在 `src/components/icons/EngineIcons.tsx` 创建四引擎 SVG 图标
    - Claude: 橙色渐变，Codex: 绿色，Gemini: 多色渐变，SiliconFlow: 紫色渐变
    - _Requirements: 4.1_
  - [x] 3.2 重构 EngineSelector 组件
    - 更新 `src/components/ExecutionEngineSelector.tsx`
    - 使用新图标，添加动画过渡效果
    - 添加 tooltip 显示引擎详情
    - 添加清晰的 API 配置入口按钮
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [x] 3.3 编写引擎选择器状态属性测试
    - **Property 3: Engine Selector State Management**
    - **Validates: Requirements 4.2, 4.6**

- [x] 4. Checkpoint - 确保所有测试通过
  - 运行 `npm run test` 确保所有测试通过
  - 如有问题，询问用户

- [x] 5. 创建摘要生成 UI 组件
  - [x] 5.1 创建 SummaryButton 工具栏按钮
    - 在 `src/components/session/SummaryButton.tsx` 创建按钮组件
    - 集成 token 阈值监控，80% 时显示警告指示器
    - _Requirements: 5.1, 5.2_
  - [x] 5.2 创建 SummaryModal 对话框
    - 在 `src/components/dialogs/SummaryModal.tsx` 创建对话框
    - 显示会话统计（消息数、token 使用、费用）
    - 集成引擎选择器（摘要模式）
    - 实现快速生成和高级选项
    - 实现摘要预览（Markdown 渲染）
    - _Requirements: 5.3, 5.4, 5.5, 5.6_
  - [x] 5.3 编写 Token 阈值警告属性测试
    - **Property 4: Token Threshold Warning**
    - **Validates: Requirements 5.2**
  - [x] 5.4 编写会话统计准确性属性测试
    - **Property 5: Session Statistics Accuracy**
    - **Validates: Requirements 5.3**

- [x] 6. 实现摘要操作功能
  - [x] 6.1 实现复制到剪贴板功能
    - 使用 Clipboard API 复制摘要
    - 显示成功/失败通知
    - _Requirements: 1.4_
  - [x] 6.2 实现"在新会话中打开"功能
    - 创建新标签页，预填充摘要作为第一条消息
    - _Requirements: 1.5_
  - [x] 6.3 编写剪贴板复制属性测试
    - **Property 7: Clipboard Copy Integrity**
    - **Validates: Requirements 1.4**

- [x] 7. 集成到主界面
  - [x] 7.1 将 SummaryButton 添加到 SessionToolbar
    - 修改 `src/components/SessionToolbar.tsx`
    - 在合适位置添加摘要按钮
    - _Requirements: 5.1_
  - [x] 7.2 创建 useSummaryGenerator Hook
    - 在 `src/hooks/useSummaryGenerator.ts` 封装摘要生成逻辑
    - 整合配置存储、生成服务、UI 状态
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 8. 实现引擎-模型选择持久化
  - [x] 8.1 实现模型列表动态加载
    - 根据选择的引擎加载对应模型列表
    - 支持从 API 获取最新模型列表（可选）
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 8.2 实现选择持久化
    - 保存最后选择的引擎和模型
    - 应用启动时恢复上次选择
    - _Requirements: 3.4, 3.5_
  - [x] 8.3 编写引擎-模型持久化属性测试
    - **Property 2: Engine-Model Selection Persistence**
    - **Validates: Requirements 3.2, 3.4**

- [x] 9. 错误处理和用户反馈
  - [x] 9.1 实现 API 错误处理
    - 处理网络错误、认证错误、限流、超时
    - 显示用户友好的错误消息
    - 提供重试按钮
    - _Requirements: 1.6_
  - [x] 9.2 实现配置错误处理
    - 检测配置损坏，自动重置
    - 提示用户配置 API Key
    - _Requirements: 6.4_

- [x] 10. Final Checkpoint - 确保所有测试通过
  - 运行 `npm run test` 确保所有测试通过
  - 运行 `npm run lint` 确保代码质量
  - 如有问题，询问用户

## Notes

- 所有任务均为必需，包括属性测试
- 每个任务引用具体的需求编号以便追溯
- 属性测试使用 fast-check 库，配置至少 100 次迭代
- 引擎图标需要匹配官方品牌色彩

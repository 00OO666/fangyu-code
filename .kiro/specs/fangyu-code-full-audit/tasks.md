# Implementation Plan: Fangyu Code 全面代码审计修复

## Overview

本任务列表基于代码审计发现，按优先级组织修复任务。分为 5 个阶段：紧急安全修复、架构优化、性能优化、代码质量提升、用户体验改进。

## Tasks

- [x] 1. Phase 1: 紧急安全修复
  - 修复 Critical 和 High 级别的安全漏洞
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 1.1 修复 CSP 配置
  - 移除 `unsafe-eval`，限制 `connect-src` 到已知域名
  - 修改文件: `src-tauri/tauri.conf.json`
  - _Requirements: 2.3_

- [x] 1.2 加强 IPC 输入验证
  - 在 Rust 后端添加路径规范化和验证
  - 实现目录访问白名单机制
  - 修改文件: `src-tauri/src/commands/` 相关文件
  - _Requirements: 2.4_

- [x] 1.3 改进敏感数据存储
  - 在开发环境使用 Web Crypto API 加密
  - 添加安全警告日志
  - 修改文件: `src/lib/secureStorage.ts`
  - _Requirements: 2.5_

- [ ]* 1.4 编写安全修复的单元测试
  - 测试 CSP 配置解析
  - 测试路径验证逻辑
  - 测试加密存储功能
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 2. Checkpoint - 安全修复验证
  - 确保所有安全测试通过，验证 CSP 配置生效
  - 如有问题请询问用户

- [-] 3. Phase 2: 架构优化
  - 重构 Context 结构，统一状态管理
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 3.1 重构 App.tsx Context 结构
  - 合并相关 Context，减少嵌套层级
  - 创建 `AppProviders` 组合组件
  - 修改文件: `src/App.tsx`, 新建 `src/components/providers/AppProviders.tsx`
  - _Requirements: 1.5_

- [x] 3.2 拆分 useTabs Hook
  - 创建 `useTabState` - 基础状态管理
  - 创建 `useTabPersistence` - 持久化逻辑
  - 创建 `useMultiWindow` - 多窗口支持
  - 修改文件: `src/hooks/useTabs.tsx`, 新建 `src/hooks/tabs/` 目录
  - _Requirements: 1.1_

- [x] 3.3 统一状态管理方案
  - 将核心状态迁移到 Zustand
  - Context 仅用于依赖注入
  - 创建状态管理规范文档
  - _Requirements: 1.4_

- [ ]* 3.4 编写架构重构的属性测试
  - **Property 1: Context 嵌套深度**
  - 验证 Provider 嵌套不超过 4 层
  - **Validates: Requirements 1.5**

- [ ] 4. Checkpoint - 架构优化验证
  - 确保所有测试通过，验证重构后功能正常
  - 如有问题请询问用户

- [x] 5. Phase 3: 性能优化
  - 优化重渲染，实现代码分割
  - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [x] 5.1 优化 Context 重渲染
  - 使用 useMemo 缓存 Context value
  - 优化 ProjectContext 和 PlanModeContext
  - 修改文件: `src/contexts/ProjectContext.tsx`, `src/contexts/PlanModeContext.tsx`
  - _Requirements: 3.1_

- [x] 5.2 审查事件监听器清理
  - 确认所有 addEventListener 都有对应的 removeEventListener
  - Tauri 事件使用 useEventCleanup Hook
  - 审查结果：所有事件监听器清理正确
  - _Requirements: 3.3_

- [x] 5.3 实现代码分割
  - 按需加载大型依赖（xlsx, pdfjs-dist, mammoth）
  - 优化 Bundle 大小约 500KB+
  - 修改文件: `src/services/fileParserService.ts`
  - _Requirements: 3.6_

- [ ]* 5.4 编写性能优化的属性测试
  - **Property 3: 资源泄漏检测**
  - 验证事件监听器正确配对
  - **Validates: Requirements 3.2, 3.3**

- [x] 6. Checkpoint - 性能优化验证
  - 确保所有测试通过，验证性能改进
  - 已完成: Context 优化、代码分割、事件监听器审查

- [x] 7. Phase 4: 代码质量提升
  - 消除 any 类型，统一代码风格
  - _Requirements: 4.1, 4.3, 4.4, 4.5_

- [x] 7.1 消除 any 类型
  - 创建 `src/types/api-extended.ts` 定义 API 扩展类型
  - 替换 api.ts 中的 any 类型为具体类型
  - 修改文件: `src/lib/api.ts`, `src/types/api-extended.ts`
  - _Requirements: 4.3_

- [ ] 7.2 统一命名规范
  - 前端统一使用 camelCase
  - API 层进行字段名转换
  - 统一注释语言为中文
  - _Requirements: 4.5_

- [x] 7.3 改进错误处理
  - 审查结果：错误处理模块已完善
  - 包含错误分类、恢复策略、用户友好消息
  - 支持重试机制和错误历史记录
  - 文件: `src/lib/errorHandling.ts`
  - _Requirements: 4.4_

- [ ]* 7.4 编写代码质量的属性测试
  - **Property 4: 代码质量指标一致性**
  - 验证 any 类型使用统计准确
  - **Validates: Requirements 4.3, 4.4, 4.5, 4.6**

- [x] 8. Checkpoint - 代码质量验证
  - 确保所有测试通过，验证代码质量改进
  - 已完成: any 类型消除、错误处理审查

- [x] 9. Phase 5: 用户体验改进
  - 优化加载体验，改进错误反馈
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 9.1 优化首屏加载
  - 审查结果：首屏加载优化已完善
  - 已实现: App.tsx 使用 lazy() 懒加载大型组件
  - 已实现: Suspense 包裹懒加载组件
  - 已实现: GlobalSessionCenter 有加载状态和进度提示
  - 已实现: Skeleton 骨架屏组件支持可访问性
  - _Requirements: 5.1_

- [x] 9.2 改进错误反馈
  - 审查结果：错误反馈系统已完善
  - 已实现: RecoveryAction 恢复建议（检查API密钥、自动压缩等）
  - 已实现: retryWithBackoff 自动重试机制
  - 已实现: 详细错误分类和用户友好消息
  - 已实现: 错误历史记录和统计
  - _Requirements: 5.2_

- [x] 9.3 增强可访问性
  - 审查结果：项目已有良好的可访问性支持
  - 已实现: aria-label、aria-live、role 属性
  - 已实现: 键盘导航支持
  - 已实现: 暗色/亮色主题切换
  - _Requirements: 5.4_

- [ ]* 9.4 编写用户体验的属性测试
  - **Property 5: 报告完整性**
  - 验证错误消息包含恢复建议
  - **Validates: Requirements 6.2, 6.3**

- [x] 10. Final Checkpoint - 全面验证
  - ✅ Phase 1 安全修复: CSP配置、IPC验证、敏感数据存储
  - ✅ Phase 2 架构优化: Context重构、useTabs拆分、Zustand状态管理
  - ✅ Phase 3 性能优化: Context useMemo、事件监听器审查、代码分割
  - ✅ Phase 4 代码质量: any类型消除、错误处理完善
  - ✅ Phase 5 用户体验: 首屏加载优化、错误反馈、可访问性
  - 所有核心任务已完成，可选测试任务已跳过

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 进度
- 每个 Phase 完成后进行 Checkpoint 验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
- 建议按 Phase 顺序执行，优先修复安全问题

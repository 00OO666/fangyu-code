# Implementation Plan: API Integration v2.5.0

## Overview

本实现计划将 Fangyu Code 从 mock 实现升级到真实 API 集成，支持 HiAPI 中转服务，并完成版本升级到 2.5.0。

## Tasks

- [x] 1. 真实 API 客户端实现
  - [x] 1.1 创建 RealAPIClient 核心类
    - 创建 `src/core/api/RealAPIClient.ts`
    - 实现 OpenAI 兼容的 chat completion 接口
    - 支持 HiAPI 中转服务配置
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.2 实现流式响应处理
    - 创建 `src/core/api/StreamHandler.ts`
    - 实现 SSE 流解析和合并
    - _Requirements: 1.4_
  
  - [x] 1.3 编写 API 客户端属性测试
    - **Property 1: API 配置正确性**
    - **Property 2: 请求格式合规性**
    - **Property 3: 流式响应完整性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**
  
  - [x] 1.4 实现错误处理和重试
    - 创建 `src/core/api/APIErrorHandler.ts`
    - 实现结构化错误和重试策略
    - _Requirements: 1.5, 1.6_
  
  - [x] 1.5 编写错误处理属性测试
    - **Property 4: 错误处理结构化**
    - **Validates: Requirements 1.5**
  
  - [x] 1.6 实现 Token 统计
    - 集成到 RealAPIClient
    - 与 ModelRouter 的 usage 统计对接
    - _Requirements: 1.7_
  
  - [x] 1.7 编写 Token 统计属性测试
    - **Property 5: Token 统计准确性**
    - **Validates: Requirements 1.7**

- [x] 2. Checkpoint - API 客户端验证
  - 确保所有 API 客户端测试通过
  - 验证与 HiAPI 的连接正常

- [x] 3. ModelRouter 集成
  - [x] 3.1 集成 RealAPIClient 到 ModelRouter
    - 修改 `src/core/models/ModelRouter.ts`
    - 注册 RealAPIClient 作为默认客户端
    - _Requirements: 2.4_
  
  - [x] 3.2 实现多提供商配置
    - 创建 `src/core/api/APIConfigManager.ts`
    - 支持 HiAPI、Anthropic、OpenAI、Google 配置
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 3.3 实现凭证验证
    - 添加 validateCredentials 方法
    - 支持配置时验证 API 密钥
    - _Requirements: 2.5_
  
  - [x] 3.4 编写多提供商路由属性测试
    - **Property 6: 多提供商路由正确性**
    - **Validates: Requirements 2.4, 2.5, 2.6**

- [x] 4. API 设置 UI
  - [x] 4.1 创建 API 配置面板
    - 创建 `src/components/settings/APIConfigPanel.tsx`
    - 支持配置 HiAPI 和其他提供商
    - _Requirements: 2.4, 2.5_
  
  - [x] 4.2 集成到 SuperAgentSettings
    - 修改 `src/components/settings/SuperAgentSettings.tsx`
    - 添加 API 配置入口
    - _Requirements: 2.4_

- [x] 5. Checkpoint - API 集成验证
  - 确保 ModelRouter 与真实 API 正常工作
  - 验证 UI 配置功能正常

- [x] 6. 版本升级到 2.5.0
  - [x] 6.1 更新版本号
    - 更新 `src-tauri/tauri.conf.json` 版本为 2.5.0
    - 更新 `package.json` 版本为 2.5.0
    - 更新 `src-tauri/Cargo.toml` 版本为 2.5.0
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 6.2 更新 Changelog
    - 修改 `src/hooks/useFirstLaunchChangelog.ts`
    - 添加 v2.5.0 版本日志
    - 描述 Super AI Agent 和 API 集成功能
    - _Requirements: 3.4, 3.5, 3.6_

- [x] 7. 端到端测试
  - [x] 7.1 创建 E2E 测试框架
    - 创建 `src/tests/e2e/` 目录
    - 配置 mock API 服务器
    - _Requirements: 4.5_
  
  - [x] 7.2 编写 Agent 流程 E2E 测试
    - 测试 Agent 任务分配流程
    - 测试任务执行和结果展示
    - _Requirements: 4.1, 4.2_
  
  - [x] 7.3 编写 API 连接 E2E 测试
    - 测试 API 连接和响应处理
    - 测试错误处理和恢复
    - _Requirements: 4.3, 4.4_

- [x] 8. Checkpoint - E2E 测试验证
  - 确保所有 E2E 测试通过 (19 tests passing)
  - 验证完整用户流程正常

- [x] 9. 文档完善
  - [x] 9.1 更新 README
    - 添加 Super AI Agent 功能说明
    - 添加 API 配置说明
    - _Requirements: 5.1_
  
  - [x] 9.2 创建 Powers 使用指南
    - 创建 `docs/POWERS_GUIDE.md`
    - 说明 Powers 系统使用方法
    - _Requirements: 5.2_
  
  - [x] 9.3 创建 API 配置指南
    - 创建 `docs/API_CONFIG_GUIDE.md`
    - 说明 HiAPI 和其他提供商配置
    - _Requirements: 5.3_
  
  - [x] 9.4 添加故障排除章节
    - 在文档中添加常见问题解答
    - _Requirements: 5.4_

- [x] 10. Final Checkpoint - 完整验证
  - 确保所有测试通过
  - 验证文档完整
  - 准备发布

## Notes

- HiAPI 中转服务 Base URL: `https://hiapi.online/v1`
- API 密钥格式: `sk-xxx`
- 所有属性测试使用 fast-check，每个测试至少运行 100 次
- E2E 测试使用 mock 服务器确保一致性
- 版本升级需要同步更新三处版本号

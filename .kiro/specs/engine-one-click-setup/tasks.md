# Implementation Plan: Engine One-Click Setup

## Overview

实现引擎配置面板的"一键配置"功能，包括配置向导、依赖检测、CLI 安装、API 配置和环境设置。

## Tasks

- [x] 1. 创建配置状态服务
  - [x] 1.1 创建 setupStateService.ts
    - 实现 saveSetupProgress 保存配置进度
    - 实现 getSetupProgress 获取配置进度
    - 实现 resetSetupProgress 重置配置进度
    - 实现 getEngineConfigStatus 获取引擎配置状态
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 1.2 编写配置状态持久化属性测试
    - **Property 3: Configuration State Persistence Round-Trip**
    - **Validates: Requirements 7.1, 7.2**

- [x] 2. 创建 OneClickSetup 组件目录结构
  - [x] 2.1 创建 StepIndicator 组件
    - 显示配置步骤列表
    - 高亮当前步骤
    - 显示步骤状态（pending/in_progress/completed/error/skipped）
    - _Requirements: 1.4_
  - [x] 2.2 创建 DependencyChecker 组件
    - 检测 Node.js 安装和版本
    - 检测 npm 安装
    - 检测 CLI 工具安装状态
    - 显示检测结果和错误提示
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. 创建 SetupWizard 主组件
  - [x] 3.1 实现 SetupWizard 框架
    - 管理配置步骤状态
    - 根据引擎类型加载对应配置流程
    - 显示日志和错误信息
    - _Requirements: 1.2_
  - [x] 3.2 实现步骤导航逻辑
    - 支持前进/后退
    - 支持跳过可选步骤
    - 支持重新开始
    - _Requirements: 8.4, 7.4_
  - [x] 3.3 编写步骤完成顺序属性测试
    - **Property 5: Step Completion Ordering**
    - **Validates: Requirements 3.1, 4.1, 5.1, 6.1**

- [x] 4. Checkpoint - 验证基础框架
  - 确保 SetupWizard 能正确显示
  - 确保步骤指示器工作正常
  - 确保依赖检测功能正常
  - 如有问题请告知

- [x] 5. 实现 Claude 配置流程
  - [x] 5.1 创建 ClaudeSetup 组件
    - Step 1: 调用 DependencyChecker 检查环境
    - Step 2: 安装 Claude Code CLI（复用 EngineInstaller）
    - Step 3: 配置 API Key（支持直接输入或选择代理商）
    - Step 4: 验证安装（运行 claude --version）
    - Step 5: 选择默认模型（可选）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 5.2 实现 API Key 配置逻辑
    - 支持直接输入 API Key
    - 支持从现有代理商选择
    - 保存到 Claude Code settings.json
    - _Requirements: 3.3, 3.4_

- [x] 6. 实现 Codex 配置流程
  - [x] 6.1 创建 CodexSetup 组件
    - Step 1: 调用 DependencyChecker 检查环境
    - Step 2: 安装 Codex CLI
    - Step 3: 引导 ChatGPT 登录（打开浏览器）
    - Step 4: 验证安装
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. 实现 Gemini 配置流程
  - [x] 7.1 创建 GeminiSetup 组件
    - Step 1: 调用 DependencyChecker 检查环境
    - Step 2: 安装 Gemini CLI
    - Step 3: 引导 Google 登录（打开浏览器）
    - Step 4: 验证安装
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. 实现 SiliconFlow 配置流程
  - [x] 8.1 创建 SiliconFlowSetup 组件
    - Step 1: 打开注册页面（可选）
    - Step 2: 引导获取 API Key
    - Step 3: 输入并验证 API Key
    - Step 4: 选择默认模型
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Checkpoint - 验证各引擎配置流程
  - 确保 Claude 配置流程完整
  - 确保 Codex 配置流程完整
  - 确保 Gemini 配置流程完整
  - 确保 SiliconFlow 配置流程完整
  - 如有问题请告知

- [x] 10. 集成到 EngineCard
  - [x] 10.1 修改 EngineCard 显示配置状态
    - 显示"未配置"/"配置中"/"已配置"状态
    - 显示未完成的步骤提示
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 10.2 添加"一键配置"按钮
    - 未完全配置时显示按钮
    - 点击打开 SetupWizard
    - _Requirements: 1.1, 1.2_
  - [x] 10.3 编写配置状态显示属性测试
    - **Property 1: Configuration Status Display Consistency**
    - **Validates: Requirements 1.1, 1.3, 1.4, 7.3**

- [x] 11. 实现引擎配置隔离
  - [x] 11.1 确保各引擎配置独立存储
    - 验证配置存储路径分离
    - 验证修改一个引擎不影响其他引擎
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 11.2 编写引擎配置隔离属性测试
    - **Property 4: Engine Configuration Isolation**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [x] 12. 实现错误处理
  - [x] 12.1 添加错误处理和恢复逻辑
    - 依赖安装失败处理
    - 网络错误重试
    - API Key 验证失败处理
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 12.2 添加日志查看功能
    - 显示详细安装日志
    - 支持复制日志
    - _Requirements: 8.5_

- [x] 13. Final Checkpoint - 完整功能验证
  - 确保所有引擎的一键配置功能正常
  - 确保配置状态正确显示
  - 确保错误处理正常
  - 所有属性测试通过

## Notes

- 复用现有的 EngineInstaller 组件进行 CLI 安装
- 复用现有的 Node.js 版本验证逻辑
- 使用 Tauri 的 shell 命令执行安装和验证
- 测试框架：vitest + fast-check
- 所有任务都必须完成，包括属性测试


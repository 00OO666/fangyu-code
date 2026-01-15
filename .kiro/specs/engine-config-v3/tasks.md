# Implementation Plan: Engine Config V3

## Overview

实现引擎配置面板的二次开发，包括更新模型测试列表、改进编辑体验、移除拖拽按钮、以及提供四种引擎的一键安装功能。

## Tasks

- [x] 1. 更新 Claude 模型测试列表
  - [x] 1.1 修改 InlineModelTester.tsx 中的 CLAUDE_MODELS 数组
    - 添加 Opus 4.5 Thinking 模型（带 31999 thinking budget）
    - 移除 Opus 4.1 模型
    - 确保只有 4 个模型：Sonnet 4.5、Haiku 4.5、Opus 4.5、Opus 4.5 Thinking
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 更新 testModel 函数支持 thinking 模式
    - 为 thinking 模型添加 thinking budget 参数
    - _Requirements: 1.1_

- [x] 2. 移除拖拽排序功能
  - [x] 2.1 修改 ProviderItem.tsx 移除 GripVertical 图标
    - 删除拖拽手柄的渲染代码
    - 调整布局保持间距一致
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 简化 ProviderList.tsx 移除 DnD 相关代码
    - 移除 @dnd-kit 相关导入和逻辑
    - 简化为普通列表渲染
    - _Requirements: 3.1_

- [x] 3. 改进代理商编辑体验
  - [x] 3.1 创建 TestedModelSelector 组件
    - 显示已测试成功的模型列表
    - 支持点击选择默认模型
    - 高亮当前选中的模型
    - _Requirements: 2.3, 2.4_
  - [x] 3.2 修改 ProviderItem.tsx 集成模型选择器
    - 在编辑模式下显示已测试模型
    - 保存测试结果到 provider 配置
    - _Requirements: 2.3, 2.4_
  - [x] 3.3 实现全局模型应用功能
    - 在 engineConfigService.ts 添加 applyModelToClaudeCode 方法
    - 更新 Claude Code settings.json 中的 model 字段
    - 确保不影响其他引擎配置
    - _Requirements: 2.5, 2.6_
  - [x] 3.4 编写引擎配置隔离属性测试
    - **Property 3: Engine Configuration Isolation**
    - **Validates: Requirements 2.6**

- [x] 4. Checkpoint - 验证基础功能
  - 确保模型测试列表更新正确
  - 确保拖拽按钮已移除
  - 确保模型选择功能正常
  - 如有问题请告知

- [x] 5. 实现引擎安装功能
  - [x] 5.1 创建 EngineInstaller 组件
    - 显示安装进度和日志
    - 处理安装成功/失败状态
    - _Requirements: 4.6, 4.7_
  - [x] 5.2 实现 Node.js 版本检测
    - 检测 Node.js 是否安装
    - 验证版本 >= 18
    - 提供下载链接和安装指引
    - _Requirements: 4.8, 4.9_
  - [x] 5.3 编写 Node.js 版本验证属性测试
    - **Property 5: Node.js Version Validation**
    - **Validates: Requirements 4.8**
  - [x] 5.4 实现各引擎安装逻辑
    - Claude Code: npm install + API Key 配置指引
    - Codex CLI: npm install + ChatGPT 登录指引
    - Gemini CLI: npm install + Google 登录指引
    - SiliconFlow: 打开注册页面 + API Key 获取指引
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [x] 5.5 在 EngineCardGrid 中集成安装按钮
    - 检测引擎安装状态
    - 显示安装/已安装状态
    - _Requirements: 4.1_

- [x] 6. Final Checkpoint - 完整功能验证
  - 确保所有功能正常工作
  - 确保 UI 布局正确
  - 所有属性测试通过

## Notes

- 所有任务都必须执行，包括属性测试
- 使用 TypeScript 和 React 实现
- 使用 Tauri 的 shell 命令执行安装
- 测试框架：vitest + fast-check

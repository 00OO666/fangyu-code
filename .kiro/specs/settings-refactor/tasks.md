# Implementation Plan: Settings Page Refactor

## Overview

重构设置页面，按执行引擎分类组织配置项。主要工作是调整现有的 Settings.tsx 组件结构，将环境变量和权限设置整合到 Claude Code 引擎配置下。

## Tasks

- [x] 1. 清理 Settings.tsx 中的冗余代码
  - 移除未使用的 HooksSettings 相关 import 和状态
  - 确保没有独立的环境变量和权限标签页
  - _Requirements: 3.1, 3.2_

- [x] 2. 验证引擎配置标签页结构
  - [x] 2.1 确认主标签页数量为7个（常规、引擎配置、翻译、提示词API、存储、Super Agent、配置管理）
    - 检查 TabsList 中的 grid-cols 设置
    - 验证每个 TabsTrigger 和 TabsContent 对应
    - _Requirements: 4.1_
  
  - [x] 2.2 确认引擎子标签页结构正确
    - 验证4个引擎子标签（Claude/Codex/Gemini/SiliconFlow）
    - 验证每个引擎有对应的颜色指示器
    - _Requirements: 1.1, 1.3, 6.1, 6.2_

- [x] 3. 验证 Claude Code 配置区域
  - [x] 3.1 确认代理商配置折叠区域存在且功能正常
    - 验证 ProviderManager 组件正确渲染
    - _Requirements: 2.1_
  
  - [x] 3.2 确认环境变量折叠区域存在且功能正常
    - 验证 EnvironmentSettings 组件正确渲染
    - _Requirements: 2.2_
  
  - [x] 3.3 确认权限规则折叠区域存在且功能正常
    - 验证 PermissionsSettings 组件正确渲染
    - _Requirements: 2.3_

- [x] 4. 验证折叠区域交互
  - 测试展开/收起功能
  - 验证箭头指示器旋转动画
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Checkpoint - 功能验证
  - 确保所有标签页切换正常
  - 确保设置保存功能正常
  - 如有问题请告知

- [ ]* 6. 编写单元测试
  - [ ]* 6.1 测试标签页结构
    - 验证主标签页数量
    - 验证引擎子标签页数量
    - _Requirements: 4.1, 1.1_
  
  - [ ]* 6.2 测试折叠区域
    - 验证折叠/展开状态切换
    - _Requirements: 5.1, 5.2_

## Notes

- 当前 Settings.tsx 已经实现了大部分功能，主要任务是验证和清理
- 任务标记 `*` 的为可选测试任务
- 重构不涉及后端 API 变更，只是前端 UI 组织调整

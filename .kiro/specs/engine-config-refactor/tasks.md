# Implementation Plan: Engine Configuration Refactor

## Overview

重构引擎配置系统，创建统一的代理商管理组件和配置数据结构，简化设置页面，添加配置导入/导出功能。

## Tasks

- [x] 1. 创建统一的类型定义和工具函数
  - [x] 1.1 创建 `src/types/provider.ts` 定义 UnifiedProviderConfig 接口
    - 定义 EngineType 类型
    - 定义 UnifiedProviderConfig 接口
    - 定义存储键常量
    - _Requirements: 2.1, 2.3_
  - [x] 1.2 创建 `src/lib/providerUtils.ts` 工具函数
    - 实现 validateProviderConfig 验证函数
    - 实现 maskSensitiveData 敏感数据脱敏函数
    - 实现 serializeConfig/deserializeConfig 序列化函数
    - _Requirements: 1.2, 2.5_
  - [x] 1.3 编写配置验证属性测试
    - **Property 1: Provider Configuration Validation**
    - **Validates: Requirements 1.2, 6.4**
  - [x] 1.4 编写序列化往返属性测试
    - **Property 2: Configuration Serialization Round-Trip**
    - **Validates: Requirements 2.5**

- [x] 2. 实现配置迁移功能
  - [x] 2.1 创建 `src/lib/providerMigration.ts` 迁移模块
    - 实现 migrateClaudeProvider 迁移 Claude 配置
    - 实现 migrateCodexProvider 迁移 Codex 配置
    - 实现 migrateGeminiProvider 迁移 Gemini 配置
    - 实现 migrateAllProviders 统一迁移入口
    - _Requirements: 2.4_
  - [x] 2.2 编写迁移数据完整性属性测试
    - **Property 3: Migration Data Preservation**
    - **Validates: Requirements 2.4**

- [x] 3. Checkpoint - 确保基础模块测试通过
  - 运行所有属性测试，确保通过
  - 如有问题，询问用户

- [x] 4. 创建 useProviderConfig Hook
  - [x] 4.1 创建 `src/hooks/useProviderConfig.ts`
    - 实现 loadProviders 加载所有配置
    - 实现 saveProvider 保存单个配置
    - 实现 updateProvider 部分更新配置
    - 实现 deleteProvider 删除配置
    - 实现 switchProvider 切换当前代理商
    - _Requirements: 1.3, 1.4, 2.2_
  - [x] 4.2 编写部分更新属性测试
    - **Property 4: Partial Update Field Preservation**
    - **Validates: Requirements 1.3**

- [x] 5. 创建 UnifiedProviderManager 组件
  - [x] 5.1 创建 `src/components/UnifiedProviderManager.tsx`
    - 实现代理商列表展示
    - 实现添加/编辑/删除代理商
    - 实现连接测试功能
    - 实现切换当前代理商
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 5.2 创建 `src/components/UnifiedProviderForm.tsx`
    - 实现通用的代理商表单
    - 根据引擎类型显示不同字段
    - 实现表单验证
    - _Requirements: 1.2_

- [x] 6. 创建 EngineStatusOverview 组件
  - [x] 6.1 创建 `src/components/EngineStatusOverview.tsx`
    - 显示四个引擎的状态卡片
    - 显示安装状态、当前代理商、连接状态
    - 支持快速切换引擎
    - _Requirements: 3.1, 7.1, 7.3_

- [x] 7. 创建 UnifiedEngineSelector 组件
  - [x] 7.1 创建 `src/components/UnifiedEngineSelector.tsx`
    - 实现 popover 变体（紧凑弹出式）
    - 实现 inline 变体（内联展开式）
    - 实现 settings 变体（完整配置视图）
    - 统一事件发射格式
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 7.2 编写引擎切换事件一致性属性测试
    - **Property 5: Engine Change Event Consistency**
    - **Validates: Requirements 4.4**

- [x] 8. Checkpoint - 确保组件功能正常
  - 运行所有测试，确保通过（57 个属性测试全部通过）
  - 如有问题，询问用户

- [x] 9. 实现配置导入/导出功能
  - [x] 9.1 创建 `src/components/ConfigImportExport.tsx`
    - 实现导出配置为 JSON 文件
    - 实现敏感数据排除选项
    - 实现导入配置文件
    - 实现配置验证和错误提示
    - 实现合并/替换选项
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 9.2 编写敏感数据导出控制属性测试
    - **Property 6: Sensitive Data Export Control**
    - **Validates: Requirements 6.2**
  - [x] 9.3 编写导入验证属性测试
    - **Property 1: Provider Configuration Validation** (复用)
    - **Validates: Requirements 6.4**

- [x] 10. 增强 useEngineStatus Hook
  - [x] 10.1 更新 `src/hooks/useEngineStatus.ts`
    - 添加 30 秒缓存机制
    - 添加错误状态消息生成
    - 统一状态返回格式
    - _Requirements: 7.1, 7.2, 7.4, 7.5_
  - [x] 10.2 编写错误消息生成属性测试
    - **Property 7: Error State Message Generation**
    - **Validates: Requirements 7.4**
  - [x] 10.3 编写状态缓存行为属性测试
    - **Property 8: Status Cache Behavior**
    - **Validates: Requirements 7.5**

- [x] 11. 重构 Settings 页面
  - [x] 11.1 更新 `src/components/Settings.tsx` 引擎配置部分
    - 集成 EngineStatusOverview 组件
    - 集成 UnifiedProviderManager 组件
    - 集成 ConfigImportExport 组件
    - 简化页面结构，减少点击深度
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 12. 清理旧组件
  - [x] 12.1 标记旧组件为 deprecated
    - 在 ExecutionEngineSelector.tsx 添加 deprecated 注释
    - 在 EnhancedEngineSelector.tsx 添加 deprecated 注释
    - 更新组件导出，指向新组件
  - [x] 12.2 更新所有引用旧组件的地方
    - 搜索并替换 ExecutionEngineSelector 引用
    - 搜索并替换 EnhancedEngineSelector 引用

- [x] 13. Final Checkpoint - 完整功能验证
  - 运行所有测试，确保通过（83 个属性测试全部通过）
  - 验证配置迁移功能
  - 验证导入/导出功能
  - 如有问题，询问用户

## Notes

- 所有任务（包括属性测试）都必须完成
- 每个属性测试引用设计文档中的对应属性
- 旧组件暂时保留，在 v3.0 版本中移除

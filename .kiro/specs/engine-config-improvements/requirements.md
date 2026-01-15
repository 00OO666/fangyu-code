# Requirements Document

## Introduction

本文档定义了 Fangyu Code 引擎配置系统的全面重构需求。基于对现有系统的深入分析，我们发现了多个 UI/UX 设计缺陷、代码逻辑漏洞和安全问题。本次重构旨在提供更简洁、安全、易用的引擎配置体验。

## Glossary

- **Engine_Config_System**: 引擎配置系统，管理 AI 引擎（Claude/Codex/Gemini/SiliconFlow）的代理商配置
- **Provider**: 代理商，提供 API 服务的第三方或官方服务商
- **Engine_Selector**: 引擎选择器，用于切换当前使用的 AI 引擎
- **Provider_Manager**: 代理商管理器，用于 CRUD 代理商配置
- **Config_Storage**: 配置存储，负责持久化代理商配置数据
- **Connection_Tester**: 连接测试器，验证 API 配置是否有效
- **Config_Migrator**: 配置迁移器，处理旧版本配置的升级
- **Sensitive_Data_Handler**: 敏感数据处理器，负责 API Key 的加密和脱敏

## Requirements

### Requirement 1: 简化引擎选择入口

**User Story:** As a user, I want a single, clear entry point for engine selection, so that I can quickly switch between AI engines without confusion.

#### Acceptance Criteria

1. THE Engine_Config_System SHALL provide exactly one visual entry point for engine selection (remove duplicate UI)
2. WHEN a user clicks on an engine card, THE Engine_Selector SHALL switch to that engine and show its configuration
3. THE Engine_Selector SHALL display engine installation status, version, and current provider in a unified card view
4. WHEN an engine is not installed, THE Engine_Selector SHALL show installation guidance with a link to documentation
5. THE Engine_Selector SHALL highlight the currently active engine with a clear visual indicator

### Requirement 2: 统一代理商管理界面

**User Story:** As a user, I want a consistent provider management experience across all engines, so that I can configure any engine without learning different interfaces.

#### Acceptance Criteria

1. THE Provider_Manager SHALL use the same UI layout and interaction patterns for all engine types
2. WHEN a user adds a provider, THE Provider_Manager SHALL show a form with engine-specific fields dynamically
3. THE Provider_Manager SHALL support inline editing without opening a modal dialog
4. WHEN displaying providers, THE Provider_Manager SHALL show key information (name, status, last used) in a compact list view
5. THE Provider_Manager SHALL allow drag-and-drop reordering of providers
6. WHEN a provider is the current selection, THE Provider_Manager SHALL display a prominent "Active" badge

### Requirement 3: 实现真正的连接测试

**User Story:** As a user, I want to test my API configuration before using it, so that I can verify my setup is correct.

#### Acceptance Criteria

1. WHEN a user clicks "Test Connection", THE Connection_Tester SHALL send a minimal API request to verify credentials
2. THE Connection_Tester SHALL display a clear success or failure message with details
3. IF the connection test fails, THEN THE Connection_Tester SHALL provide actionable error messages
4. THE Connection_Tester SHALL show a loading indicator during the test
5. THE Connection_Tester SHALL timeout after 10 seconds and report a timeout error

### Requirement 4: 安全的敏感数据处理

**User Story:** As a user, I want my API keys to be stored securely, so that they are protected from unauthorized access.

#### Acceptance Criteria

1. THE Sensitive_Data_Handler SHALL encrypt API keys before storing in localStorage using AES-256
2. WHEN displaying API keys, THE Sensitive_Data_Handler SHALL mask all but the first 4 and last 4 characters
3. THE Sensitive_Data_Handler SHALL provide a "Show/Hide" toggle for API key visibility
4. WHEN exporting configuration, THE Config_Storage SHALL require explicit confirmation to include sensitive data
5. THE Sensitive_Data_Handler SHALL clear sensitive data from memory after use

### Requirement 5: 可靠的配置迁移

**User Story:** As a user upgrading from an older version, I want my existing configurations to be safely migrated, so that I don't lose my setup.

#### Acceptance Criteria

1. WHEN the application starts, THE Config_Migrator SHALL check for legacy configuration formats
2. IF legacy data exists, THEN THE Config_Migrator SHALL create a backup before migration
3. THE Config_Migrator SHALL use atomic operations to prevent partial migration states
4. IF migration fails, THEN THE Config_Migrator SHALL rollback to the backup and notify the user
5. THE Config_Migrator SHALL log migration progress and results for debugging

### Requirement 6: 配置导入导出增强

**User Story:** As a user, I want to easily backup and restore my configurations, so that I can transfer settings between devices.

#### Acceptance Criteria

1. THE Config_Storage SHALL support exporting all configurations to a JSON file
2. WHEN exporting with sensitive data, THE Config_Storage SHALL show a security warning dialog
3. THE Config_Storage SHALL validate imported configurations before applying
4. IF import validation fails, THEN THE Config_Storage SHALL show specific error messages
5. THE Config_Storage SHALL support merge and replace import modes with clear explanations

### Requirement 7: 表单体验优化

**User Story:** As a user, I want a streamlined form experience when configuring providers, so that I can complete setup quickly and correctly.

#### Acceptance Criteria

1. THE Provider_Manager SHALL provide a single model input with autocomplete suggestions
2. THE Provider_Manager SHALL include a "Paste from clipboard" button for API key input
3. THE Provider_Manager SHALL show real-time validation feedback as the user types
4. WHEN a field has an error, THE Provider_Manager SHALL highlight it and show the error message inline
5. THE Provider_Manager SHALL remember the last used values for optional fields

### Requirement 8: 引擎特定设置统一

**User Story:** As a user, I want consistent access to advanced settings for all engines, so that I can customize each engine's behavior.

#### Acceptance Criteria

1. THE Engine_Config_System SHALL provide environment variable settings for all engines (not just Claude)
2. THE Engine_Config_System SHALL provide permission settings for all engines that support them
3. WHEN an engine doesn't support a setting, THE Engine_Config_System SHALL hide that setting section
4. THE Engine_Config_System SHALL group advanced settings in a collapsible "Advanced" section

### Requirement 9: 状态同步和缓存管理

**User Story:** As a user, I want the UI to always reflect the current state, so that I'm not confused by stale information.

#### Acceptance Criteria

1. WHEN a provider is deleted, THE Config_Storage SHALL immediately update all references
2. THE Engine_Config_System SHALL provide a manual refresh button for engine status
3. WHEN engine status changes (install/uninstall), THE Engine_Config_System SHALL update within 5 seconds
4. THE Config_Storage SHALL use optimistic updates with rollback on failure
5. IF a state sync error occurs, THEN THE Engine_Config_System SHALL show a non-blocking error notification

### Requirement 10: 空状态和引导体验

**User Story:** As a new user, I want clear guidance on how to get started, so that I can configure my first engine quickly.

#### Acceptance Criteria

1. WHEN no providers are configured, THE Provider_Manager SHALL show a "Quick Start" guide
2. THE Provider_Manager SHALL provide preset configurations for popular providers (OpenAI, Anthropic, Google)
3. WHEN a user selects a preset, THE Provider_Manager SHALL pre-fill the form with recommended values
4. THE Engine_Config_System SHALL show tooltips explaining each configuration option
5. THE Engine_Config_System SHALL link to external documentation for each engine


# Requirements Document

## Introduction

重构 Fangyu Code 的引擎配置系统，解决当前设计中存在的配置入口分散、代码重复、用户体验不一致等问题。目标是创建一个统一、简洁、易于扩展的引擎配置架构。

## Glossary

- **Engine**: 执行引擎，包括 Claude Code、OpenAI Codex、Gemini、SiliconFlow 四种
- **Provider**: 代理商/服务提供商，用户配置的 API 端点和认证信息
- **ProviderManager**: 代理商管理组件，用于添加、编辑、删除代理商配置
- **EngineSelector**: 引擎选择器，用于快速切换当前使用的引擎
- **RuntimeMode**: 运行环境模式，包括 Native（本地）和 WSL（Windows Subsystem for Linux）

## Requirements

### Requirement 1: 统一代理商管理器

**User Story:** As a developer, I want a unified provider management component, so that I can reduce code duplication and maintain consistency across all engines.

#### Acceptance Criteria

1. THE UnifiedProviderManager SHALL support all four engines (Claude, Codex, Gemini, SiliconFlow) through a single component
2. WHEN a user adds a new provider, THE UnifiedProviderManager SHALL validate the configuration based on engine-specific rules
3. WHEN a user edits a provider, THE UnifiedProviderManager SHALL preserve existing data and only update changed fields
4. WHEN a user deletes a provider, THE UnifiedProviderManager SHALL prompt for confirmation and remove the provider from storage
5. THE UnifiedProviderManager SHALL display provider status (connected/disconnected/error) consistently across all engines
6. WHEN displaying provider list, THE UnifiedProviderManager SHALL show provider name, base URL, and connection status inline without requiring expansion

### Requirement 2: 统一配置数据结构

**User Story:** As a developer, I want a unified configuration data structure, so that all engines use the same storage and retrieval patterns.

#### Acceptance Criteria

1. THE System SHALL define a common ProviderConfig interface that works for all engines
2. WHEN storing provider configuration, THE System SHALL use a consistent storage mechanism (localStorage with unified key pattern)
3. THE ProviderConfig interface SHALL include: id, name, engine type, apiKey, baseUrl, model, enabled status, and custom headers
4. WHEN migrating existing configurations, THE System SHALL preserve all user data without loss
5. THE System SHALL provide a configuration serialization format for export/import functionality

### Requirement 3: 简化设置页面结构

**User Story:** As a user, I want a simplified settings page, so that I can configure engines with fewer clicks and better overview.

#### Acceptance Criteria

1. THE Settings page SHALL display an engine status overview showing all four engines' connection status at a glance
2. WHEN viewing engine configuration, THE System SHALL show provider list inline without requiring multiple expansions
3. THE Settings page SHALL reduce the click depth from 4-5 clicks to maximum 2 clicks for common operations
4. WHEN switching between engines, THE System SHALL preserve the user's scroll position and expanded state
5. THE Settings page SHALL provide a "Quick Setup" option for first-time users to configure their primary engine

### Requirement 4: 消除重复的引擎选择器

**User Story:** As a developer, I want to consolidate engine selector components, so that there is a single source of truth for engine selection UI.

#### Acceptance Criteria

1. THE System SHALL have only one EngineSelector component that adapts to different contexts (popover, inline, settings page)
2. WHEN the EngineSelector is used in a popover context, THE System SHALL show a compact view with quick switch functionality
3. WHEN the EngineSelector is used in settings context, THE System SHALL show an expanded view with full configuration options
4. THE EngineSelector SHALL emit consistent events for engine changes regardless of context
5. WHEN an engine is selected, THE System SHALL update all UI components that display engine status

### Requirement 5: 统一运行环境配置

**User Story:** As a user, I want a unified runtime environment configuration, so that WSL settings are managed in one place for all engines.

#### Acceptance Criteria

1. THE System SHALL provide a single RuntimeConfig component that manages WSL settings for all engines
2. WHEN WSL mode is enabled, THE System SHALL apply the setting to all applicable engines simultaneously
3. THE RuntimeConfig SHALL detect WSL availability and show appropriate warnings if WSL is not installed
4. WHEN runtime mode changes, THE System SHALL restart affected engine processes automatically
5. THE System SHALL persist runtime configuration separately from provider configuration

### Requirement 6: 配置导入/导出功能

**User Story:** As a user, I want to export and import my engine configurations, so that I can backup settings or migrate to a new machine.

#### Acceptance Criteria

1. THE System SHALL provide an "Export Configuration" button that generates a JSON file with all engine settings
2. WHEN exporting configuration, THE System SHALL exclude sensitive data (API keys) by default with an option to include them
3. THE System SHALL provide an "Import Configuration" button that reads a JSON file and applies settings
4. WHEN importing configuration, THE System SHALL validate the file format and show errors for invalid configurations
5. WHEN importing configuration with existing providers, THE System SHALL prompt user to merge or replace

### Requirement 7: 引擎状态统一检测

**User Story:** As a user, I want to see real-time engine status, so that I know which engines are properly configured and connected.

#### Acceptance Criteria

1. THE System SHALL provide a unified useEngineStatus hook that returns status for all engines
2. WHEN an engine's connection status changes, THE System SHALL update the UI within 2 seconds
3. THE System SHALL display status using consistent icons and colors across all UI components
4. WHEN an engine has an error, THE System SHALL show a descriptive error message with suggested fix
5. THE System SHALL cache engine status to avoid redundant API calls within a 30-second window

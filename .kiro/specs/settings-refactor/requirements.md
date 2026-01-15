# Requirements Document

## Introduction

重构 Fangyu Code 的设置页面，将原本分散的设置项按照执行引擎进行分类组织，提供更清晰、更直观的配置体验。当前设置页面存在以下问题：
1. 环境变量和权限设置只针对 Claude Code，但没有明确标注
2. 原有的"钩子"标签与左侧栏的 Hook 管理功能重复
3. 各引擎的配置分散在不同位置，用户难以找到

## Glossary

- **Settings_Page**: 设置页面组件，提供应用程序配置的统一入口
- **Engine_Config**: 执行引擎配置，包含代理商、环境变量、权限等设置
- **Provider_Manager**: 代理商管理器，用于配置 API 端点和认证信息
- **Tab_System**: 标签页系统，用于组织和切换不同的设置分类

## Requirements

### Requirement 1: 引擎配置分类

**User Story:** As a user, I want to see all engine configurations organized by engine type, so that I can easily find and modify settings for each execution engine.

#### Acceptance Criteria

1. THE Settings_Page SHALL display an "引擎配置" tab that contains sub-tabs for each engine (Claude Code, OpenAI Codex, Gemini, SiliconFlow)
2. WHEN a user selects an engine sub-tab, THE Settings_Page SHALL display all configuration options specific to that engine
3. THE Settings_Page SHALL visually distinguish each engine with a unique color indicator (orange for Claude, green for Codex, blue for Gemini, purple for SiliconFlow)

### Requirement 2: Claude Code 配置整合

**User Story:** As a user, I want all Claude Code settings in one place, so that I don't have to navigate between multiple tabs.

#### Acceptance Criteria

1. THE Claude_Config_Section SHALL include provider/API configuration as a collapsible section
2. THE Claude_Config_Section SHALL include environment variables as a collapsible section
3. THE Claude_Config_Section SHALL include permission rules as a collapsible section
4. WHEN a user expands a section, THE Settings_Page SHALL display the corresponding configuration interface

### Requirement 3: 移除重复功能

**User Story:** As a user, I want a clean settings interface without duplicate features, so that I'm not confused about where to configure things.

#### Acceptance Criteria

1. THE Settings_Page SHALL NOT include a separate "钩子" (Hooks) tab since Hook management is available in the sidebar
2. THE Settings_Page SHALL NOT include standalone "环境变量" and "权限" tabs since they are now part of engine configuration

### Requirement 4: 主标签页结构

**User Story:** As a user, I want a clear top-level navigation in settings, so that I can quickly find the category I need.

#### Acceptance Criteria

1. THE Settings_Page SHALL display exactly 7 main tabs: 常规, 引擎配置, 翻译, 提示词API, 存储, Super Agent, 配置管理
2. WHEN a user clicks a tab, THE Settings_Page SHALL switch to display that tab's content
3. THE Settings_Page SHALL remember the last active tab within a session

### Requirement 5: 可折叠配置区域

**User Story:** As a user, I want to collapse configuration sections I'm not using, so that I can focus on the settings I need to change.

#### Acceptance Criteria

1. WHEN a configuration section is collapsed, THE Settings_Page SHALL show only the section header
2. WHEN a user clicks a collapsed section header, THE Settings_Page SHALL expand to show the full configuration interface
3. THE Settings_Page SHALL use a visual indicator (arrow) to show the expand/collapse state

### Requirement 6: 引擎状态指示

**User Story:** As a user, I want to see which engines are configured, so that I know which ones are ready to use.

#### Acceptance Criteria

1. THE Engine_Tab SHALL display a colored dot indicator next to each engine name
2. THE Settings_Page SHALL use consistent colors across the application for each engine type

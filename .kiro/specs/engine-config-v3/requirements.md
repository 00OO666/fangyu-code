# Requirements Document

## Introduction

对 Fangyu Code 的设置-引擎配置面板进行二次开发，包括：更新模型测试列表、改进编辑体验、移除无用 UI 元素、以及提供四种引擎的一键安装功能。

## Glossary

- **Engine_Config_Panel**: 引擎配置面板组件，位于设置页面的"引擎配置"标签页
- **Inline_Model_Tester**: 内嵌模型测试组件，用于测试代理商支持的所有模型
- **Provider_Item**: 代理商列表项组件，显示代理商详情并支持编辑
- **Engine_Installer**: 引擎安装器组件，提供四种引擎的一键下载安装功能
- **Claude_Code**: Anthropic 官方 CLI 工具，通过 `npm install -g @anthropic-ai/claude-code` 安装
- **Codex_CLI**: OpenAI 官方 CLI 工具，通过 `npm install -g @openai/codex` 安装
- **Gemini_CLI**: Google 官方 CLI 工具，通过 `npm install -g @google/gemini-cli` 安装
- **SiliconFlow**: 国产 AI 模型聚合平台，提供 OpenAI 兼容 API，无需安装 CLI

## Requirements

### Requirement 1: 更新 Claude 模型测试列表

**User Story:** As a user, I want to test the latest Claude models including Opus 4.5 with thinking capability, so that I can verify my API provider supports the newest models.

#### Acceptance Criteria

1. WHEN the Inline_Model_Tester tests Claude models, THE system SHALL include `claude-opus-4-5-20251101` with extended thinking (31999 budget tokens) in the test list
2. WHEN the Inline_Model_Tester tests Claude models, THE system SHALL remove `claude-opus-4-1-20250805` from the test list
3. THE Inline_Model_Tester SHALL test exactly 4 Claude models: Sonnet 4.5, Haiku 4.5, Opus 4.5, and Opus 4.5 Thinking

### Requirement 2: 改进代理商编辑体验

**User Story:** As a user, I want to see my saved API Key and tested models when editing a provider, so that I can easily manage my configuration.

#### Acceptance Criteria

1. WHEN a user expands a provider item for editing, THE Provider_Item SHALL display the masked API Key (showing first 8 and last 4 characters)
2. WHEN a user clicks the eye icon, THE Provider_Item SHALL toggle between showing masked and full API Key
3. WHEN a provider has been tested, THE Provider_Item SHALL display all successfully tested models as selectable options
4. WHEN a user clicks on a model in the tested models list, THE Provider_Item SHALL set that model as the default model
5. WHEN a user selects a default model, THE system SHALL apply this model selection to all Claude Code configurations globally
6. WHEN applying model selection globally, THE system SHALL NOT affect configurations of other engines (Codex, Gemini, SiliconFlow)

### Requirement 3: 移除无用 UI 元素

**User Story:** As a user, I want a clean interface without non-functional buttons, so that I have a better user experience.

#### Acceptance Criteria

1. THE Provider_List SHALL NOT display the 6-dot drag handle button (GripVertical icon) on provider items
2. WHEN the drag handle is removed, THE Provider_Item SHALL maintain its current layout and spacing

### Requirement 4: 引擎一键安装功能

**User Story:** As a user, I want to install AI coding engines with one click, so that I can quickly set up my development environment.

#### Acceptance Criteria

1. THE Engine_Config_Panel SHALL display an "Install" button for each engine that is not yet installed
2. WHEN a user clicks the Install button for Claude Code, THE Engine_Installer SHALL execute `npm install -g @anthropic-ai/claude-code` and guide the user through API key setup
3. WHEN a user clicks the Install button for Codex CLI, THE Engine_Installer SHALL execute `npm install -g @openai/codex` and guide the user through ChatGPT login
4. WHEN a user clicks the Install button for Gemini CLI, THE Engine_Installer SHALL execute `npm install -g @google/gemini-cli` and guide the user through Google account login
5. WHEN a user clicks the Install button for SiliconFlow, THE Engine_Installer SHALL open the SiliconFlow registration page and guide the user to obtain an API key
6. WHEN an installation is in progress, THE Engine_Installer SHALL display a progress indicator and installation logs
7. IF an installation fails, THEN THE Engine_Installer SHALL display the error message and suggest troubleshooting steps
8. WHEN checking prerequisites, THE Engine_Installer SHALL verify Node.js 18+ is installed before attempting npm installations
9. IF Node.js is not installed, THEN THE Engine_Installer SHALL provide a link to download Node.js and instructions for installation

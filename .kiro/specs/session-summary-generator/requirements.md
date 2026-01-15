# Requirements Document

## Introduction

本功能为 Fangyu Code 添加独立的会话摘要生成器，允许用户在上下文窗口接近限制时一键生成会话摘要，复制到剪贴板后在新会话中继续对话。摘要生成使用独立的 API 配置，支持选择四大执行引擎（Claude/Codex/Gemini/SiliconFlow）中的任意模型。同时重构引擎选择器 UI，提升视觉效果和交互体验。

## Glossary

- **Summary_Generator**: 会话摘要生成器组件，负责生成、显示和复制会话摘要
- **Summary_API_Config**: 摘要生成专用的 API 配置，独立于主聊天 API 配置
- **Engine_Selector**: 执行引擎选择器组件，用于切换 Claude/Codex/Gemini/SiliconFlow 引擎
- **Engine**: 执行引擎，包括 Claude Code、Codex、Gemini、SiliconFlow 四种
- **Model**: 引擎下的具体模型，如 claude-3-opus、gpt-4o、gemini-pro 等
- **Session_Context**: 当前会话的上下文信息，包括消息历史、token 使用量等

## Requirements

### Requirement 1: 会话摘要生成

**User Story:** As a user, I want to generate a summary of my current session with one click, so that I can continue the conversation in a new session without losing context.

#### Acceptance Criteria

1. WHEN a user clicks the summary generation button, THE Summary_Generator SHALL display a modal dialog with generation options
2. WHEN the user confirms generation, THE Summary_Generator SHALL call the configured API to generate a Markdown-formatted summary
3. WHEN the summary is generated successfully, THE Summary_Generator SHALL display the summary in a preview area with syntax highlighting
4. WHEN the user clicks the copy button, THE Summary_Generator SHALL copy the summary to the system clipboard and show a success notification
5. WHEN the user clicks "Open in New Session", THE Summary_Generator SHALL create a new session tab with the summary pre-filled as the first message
6. IF the API call fails, THEN THE Summary_Generator SHALL display a user-friendly error message with retry option

### Requirement 2: 独立 API 配置

**User Story:** As a user, I want to configure a separate API for summary generation, so that it doesn't affect my main chat API settings.

#### Acceptance Criteria

1. THE Summary_API_Config SHALL store configuration separately from the main chat API configuration
2. WHEN the user opens summary settings, THE Summary_API_Config SHALL display current engine, model, API endpoint, and API key fields
3. WHEN the user saves summary API configuration, THE Summary_API_Config SHALL persist the settings to local storage
4. WHEN generating a summary, THE Summary_Generator SHALL use the Summary_API_Config settings instead of main chat settings
5. THE Summary_API_Config SHALL support all four engines: Claude, Codex, Gemini, and SiliconFlow
6. WHEN no summary API is configured, THE Summary_Generator SHALL fall back to the main chat API configuration

### Requirement 3: 多引擎多模型选择

**User Story:** As a user, I want to select any engine and any model for summary generation, so that I can use the most cost-effective or capable model for this task.

#### Acceptance Criteria

1. WHEN the user opens the engine selector in summary settings, THE Summary_API_Config SHALL display all four engines with their availability status
2. WHEN the user selects an engine, THE Summary_API_Config SHALL load and display available models for that engine
3. WHEN the user selects a model, THE Summary_API_Config SHALL update the configuration and enable the save button
4. THE Summary_API_Config SHALL remember the last selected engine and model for future sessions
5. WHEN an engine requires API key configuration, THE Summary_API_Config SHALL show a clear prompt to configure it

### Requirement 4: 引擎选择器 UI 重构

**User Story:** As a user, I want a visually appealing and responsive engine selector, so that I can easily switch between engines and understand their configuration status.

#### Acceptance Criteria

1. THE Engine_Selector SHALL display engine icons that match official branding (Claude orange, Codex green, Gemini blue gradient, SiliconFlow purple)
2. WHEN the user clicks an engine, THE Engine_Selector SHALL immediately switch to that engine with visual feedback
3. THE Engine_Selector SHALL show clear status indicators for each engine (installed/configured, version, active)
4. WHEN the user hovers over an engine, THE Engine_Selector SHALL display a tooltip with engine details
5. THE Engine_Selector SHALL provide a clear entry point to configure API endpoint and key for each engine
6. WHEN an engine is not available, THE Engine_Selector SHALL display it as disabled with a reason tooltip
7. THE Engine_Selector SHALL use smooth animations for state transitions

### Requirement 5: 摘要生成 UI 组件

**User Story:** As a user, I want a dedicated UI for summary generation that is easy to access and use.

#### Acceptance Criteria

1. THE Summary_Generator SHALL be accessible from the session toolbar via a clearly labeled button
2. WHEN the session token usage exceeds 80%, THE Summary_Generator button SHALL display a warning indicator
3. THE Summary_Generator modal SHALL display current session statistics (message count, token usage, estimated cost)
4. THE Summary_Generator SHALL provide a "Quick Generate" option that uses default settings
5. THE Summary_Generator SHALL provide an "Advanced" option to customize generation parameters (max length, focus areas)
6. WHILE generating, THE Summary_Generator SHALL display a progress indicator with estimated time

### Requirement 6: 数据持久化

**User Story:** As a user, I want my summary API configuration to persist across app restarts.

#### Acceptance Criteria

1. WHEN the app starts, THE Summary_API_Config SHALL load saved configuration from local storage
2. WHEN the user modifies configuration, THE Summary_API_Config SHALL auto-save changes after a debounce period
3. THE Summary_API_Config SHALL store: selected engine, selected model, API endpoint, API key (encrypted), custom parameters
4. IF stored configuration is corrupted, THEN THE Summary_API_Config SHALL reset to defaults and notify the user

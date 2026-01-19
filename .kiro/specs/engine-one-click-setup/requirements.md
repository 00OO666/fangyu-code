# Requirements Document

## Introduction

为 Fangyu Code 的设置-引擎配置面板实现"一键配置"功能，让用户能够一键完成某个引擎所需的所有依赖安装、CLI 配置、环境设置和 API 配置。每个引擎有独立的配置流程和环境要求。

## Glossary

- **One_Click_Setup**: 一键配置组件，提供引擎的完整配置向导
- **Setup_Wizard**: 配置向导，分步骤引导用户完成引擎配置
- **Dependency_Checker**: 依赖检查器，检测系统环境和必要依赖
- **Environment_Configurator**: 环境配置器，设置引擎运行所需的环境变量和配置文件
- **Claude_Code**: Anthropic 官方 CLI，需要 Node.js 18+、npm、API Key
- **Codex_CLI**: OpenAI 官方 CLI，需要 Node.js 18+、npm、ChatGPT 账号登录
- **Gemini_CLI**: Google 官方 CLI，需要 Node.js 18+、npm、Google 账号登录
- **SiliconFlow**: 国产 AI 平台，需要 API Key，无需安装 CLI

## Requirements

### Requirement 1: 一键配置入口

**User Story:** As a user, I want to see a clear "One-Click Setup" button for each engine, so that I can quickly configure the engine without manual steps.

#### Acceptance Criteria

1. THE Engine_Card SHALL display a "一键配置" button for engines that are not fully configured
2. WHEN a user clicks the "一键配置" button, THE Setup_Wizard SHALL open with the engine-specific configuration flow
3. THE Engine_Card SHALL display "已配置" status when the engine is fully set up
4. WHEN an engine is partially configured, THE Engine_Card SHALL show which steps are incomplete

### Requirement 2: 依赖检测与安装

**User Story:** As a user, I want the system to automatically detect and install missing dependencies, so that I don't need to manually check and install them.

#### Acceptance Criteria

1. WHEN the Setup_Wizard starts, THE Dependency_Checker SHALL detect the following for CLI-based engines:
   - Node.js installation and version (requires 18+)
   - npm installation
   - CLI tool installation status
2. WHEN Node.js is not installed, THE Dependency_Checker SHALL provide a download link and installation instructions
3. WHEN Node.js version is below 18, THE Dependency_Checker SHALL warn the user and suggest upgrading
4. WHEN npm is not available, THE Dependency_Checker SHALL provide installation guidance
5. WHEN the CLI tool is not installed, THE Setup_Wizard SHALL offer to install it automatically
6. THE Dependency_Checker SHALL display real-time installation progress and logs

### Requirement 3: Claude Code 配置流程

**User Story:** As a user, I want to configure Claude Code with all necessary settings in one flow, so that I can start using it immediately.

#### Acceptance Criteria

1. THE Claude_Setup_Wizard SHALL include the following steps:
   - Step 1: Check Node.js and npm
   - Step 2: Install Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
   - Step 3: Configure API Key (direct input or proxy provider selection)
   - Step 4: Verify installation by running `claude --version`
   - Step 5: Optional: Configure default model
2. WHEN the user has existing proxy providers, THE Claude_Setup_Wizard SHALL allow selecting one as the API source
3. WHEN the user wants to use official API, THE Claude_Setup_Wizard SHALL guide API Key input
4. THE Claude_Setup_Wizard SHALL save the API Key to Claude Code's settings.json
5. WHEN all steps complete successfully, THE Claude_Setup_Wizard SHALL mark the engine as "已配置"

### Requirement 4: Codex CLI 配置流程

**User Story:** As a user, I want to configure Codex CLI with ChatGPT login, so that I can use OpenAI's coding assistant.

#### Acceptance Criteria

1. THE Codex_Setup_Wizard SHALL include the following steps:
   - Step 1: Check Node.js and npm
   - Step 2: Install Codex CLI (`npm install -g @openai/codex`)
   - Step 3: Guide user to login with ChatGPT account (`codex auth`)
   - Step 4: Verify installation by running `codex --version`
2. WHEN the user needs to login, THE Codex_Setup_Wizard SHALL open the login URL in browser
3. THE Codex_Setup_Wizard SHALL detect when login is complete
4. WHEN all steps complete successfully, THE Codex_Setup_Wizard SHALL mark the engine as "已配置"

### Requirement 5: Gemini CLI 配置流程

**User Story:** As a user, I want to configure Gemini CLI with Google account login, so that I can use Google's AI assistant.

#### Acceptance Criteria

1. THE Gemini_Setup_Wizard SHALL include the following steps:
   - Step 1: Check Node.js and npm
   - Step 2: Install Gemini CLI (`npm install -g @google/gemini-cli`)
   - Step 3: Guide user to login with Google account (`gemini auth login`)
   - Step 4: Verify installation by running `gemini --version`
2. WHEN the user needs to login, THE Gemini_Setup_Wizard SHALL open the Google login URL in browser
3. THE Gemini_Setup_Wizard SHALL detect when login is complete
4. WHEN all steps complete successfully, THE Gemini_Setup_Wizard SHALL mark the engine as "已配置"

### Requirement 6: SiliconFlow 配置流程

**User Story:** As a user, I want to configure SiliconFlow API quickly, so that I can use domestic AI models.

#### Acceptance Criteria

1. THE SiliconFlow_Setup_Wizard SHALL include the following steps:
   - Step 1: Open SiliconFlow registration page (if not registered)
   - Step 2: Guide user to obtain API Key
   - Step 3: Input and validate API Key
   - Step 4: Select default model from available models
2. THE SiliconFlow_Setup_Wizard SHALL NOT require Node.js or CLI installation
3. WHEN the API Key is valid, THE SiliconFlow_Setup_Wizard SHALL test connection
4. WHEN all steps complete successfully, THE SiliconFlow_Setup_Wizard SHALL mark the engine as "已配置"

### Requirement 7: 配置状态持久化

**User Story:** As a user, I want my configuration progress to be saved, so that I can resume if interrupted.

#### Acceptance Criteria

1. THE Setup_Wizard SHALL save configuration progress after each step
2. WHEN the user reopens the Setup_Wizard, THE system SHALL resume from the last incomplete step
3. THE Engine_Card SHALL display the current configuration status (未配置/配置中/已配置)
4. WHEN the user wants to reconfigure, THE Setup_Wizard SHALL allow resetting and starting over

### Requirement 8: 错误处理与恢复

**User Story:** As a user, I want clear error messages and recovery options when configuration fails, so that I can fix issues and continue.

#### Acceptance Criteria

1. IF a dependency installation fails, THEN THE Setup_Wizard SHALL display the error and suggest solutions
2. IF network connection fails, THEN THE Setup_Wizard SHALL offer retry option
3. IF API Key validation fails, THEN THE Setup_Wizard SHALL explain the error and allow re-entry
4. THE Setup_Wizard SHALL provide a "跳过此步骤" option for non-critical steps
5. THE Setup_Wizard SHALL provide a "查看日志" option for debugging

### Requirement 9: 独立环境隔离

**User Story:** As a user, I want each engine's configuration to be independent, so that changing one doesn't affect others.

#### Acceptance Criteria

1. THE Configuration_System SHALL store each engine's settings in separate locations
2. WHEN configuring one engine, THE system SHALL NOT modify other engines' configurations
3. THE Configuration_System SHALL support different API Keys for different engines
4. THE Configuration_System SHALL support different proxy providers for different engines


# Requirements Document

## Introduction

本功能旨在为 Fangyu Code 添加 Kiro API 集成支持，允许用户通过 Kiro 的 SSO Token 调用 Amazon Q Developer / CodeWhisperer API，从而使用 Claude 模型（包括 Opus 4.5、Sonnet 4.5、Sonnet 4、Haiku 4.5）进行对话。这是一个新的引擎类型，与现有的 Claude Code CLI、OpenAI Codex、Google Gemini、SiliconFlow 并列。

基于逆向工程研究（2026-01-16），关键发现：
- API 端点：`https://q.{region}.amazonaws.com/generateAssistantResponse`
- 模型选择通过 `userInputMessage.modelId` 参数
- 认证方式：Bearer Token（直接使用 SSO OIDC Token）
- 响应格式：Server-Sent Events (SSE) 流

## Glossary

- **Kiro_Engine**: Fangyu Code 中的 Kiro API 引擎，用于调用 Amazon Q Developer API
- **SSO_Token**: AWS Builder ID 的 SSO OIDC Access Token，存储在 `~/.aws/sso/cache/kiro-auth-token.json`
- **Q_Developer_API**: Amazon Q Developer / CodeWhisperer 的专有 API，端点为 `https://q.{region}.amazonaws.com/generateAssistantResponse`
- **Model_ID**: CodeWhisperer 模型标识符，如 `claude-opus-4.5`、`CLAUDE_SONNET_4_5_20250929_V1_0`
- **Conversation_ID**: 会话 ID，用于多轮对话，格式为 `conv-{timestamp}-{random}`
- **SSE_Stream**: Server-Sent Events 流式响应格式

## Requirements

### Requirement 1: Kiro 引擎配置

**User Story:** As a user, I want to configure Kiro API settings in Fangyu Code, so that I can use my Kiro subscription to access Claude models.

#### Acceptance Criteria

1. WHEN a user opens the engine configuration panel, THE System SHALL display "Kiro" as a selectable engine option alongside Claude Code, Codex, Gemini, and SiliconFlow
2. WHEN a user selects the Kiro engine, THE System SHALL display configuration fields for Token Path and Model selection
3. WHEN a user configures the Token Path, THE System SHALL default to `~/.aws/sso/cache/kiro-auth-token.json`
4. WHEN a user selects a model, THE System SHALL provide options with correct CodeWhisperer modelId:
   - Claude Opus 4.5: `claude-opus-4.5`
   - Claude Sonnet 4.5: `CLAUDE_SONNET_4_5_20250929_V1_0`
   - Claude Sonnet 4: `CLAUDE_SONNET_4_20250514_V1_0`
   - Claude Haiku 4.5: `claude-haiku-4.5`
   - Auto (默认): 不设置 modelId
5. THE System SHALL validate that the token file exists and contains a valid accessToken before allowing activation
6. WHEN the token file is invalid or missing, THE System SHALL display a clear error message with instructions to login via Kiro IDE

### Requirement 2: Token 管理

**User Story:** As a user, I want the system to automatically manage my Kiro token, so that I don't have to manually refresh it.

#### Acceptance Criteria

1. WHEN the Kiro engine is activated, THE System SHALL read the token file containing: accessToken, expiresAt, region, profileArn (optional)
2. THE System SHALL use the region field from token file to construct the correct API endpoint: `q.{region}.amazonaws.com`
3. WHEN the token expiresAt time has passed, THE System SHALL notify the user to re-login via Kiro IDE
4. THE System SHALL cache the token in memory to avoid repeated file reads
5. WHEN the token file is updated externally (by Kiro IDE), THE System SHALL detect the change and reload the token

### Requirement 3: API 调用

**User Story:** As a user, I want to send messages through the Kiro API, so that I can have conversations with Claude models.

#### Acceptance Criteria

1. WHEN a user sends a message with Kiro engine active, THE System SHALL construct a POST request to `https://q.{region}.amazonaws.com/generateAssistantResponse`
2. THE System SHALL include the following headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer {accessToken}`
   - `User-Agent: KiroIDE 0.7.5`
   - `Accept: application/json`
   - `x-amzn-kiro-agent-mode: vibe`
3. THE System SHALL construct the request body with structure:
   ```json
   {
     "conversationState": {
       "chatTriggerType": "MANUAL",
       "conversationId": "{unique-id}",
       "currentMessage": {
         "userInputMessage": {
           "content": "{message}",
           "origin": "AI_EDITOR",
           "modelId": "{selected-model-id}"
         }
       },
       "history": []
     },
     "profileArn": "{if-exists}"
   }
   ```
4. WHEN a model is specified, THE System SHALL include it in `userInputMessage.modelId`
5. THE System SHALL parse the SSE streaming response and extract content from JSON chunks matching `/"content"\s*:\s*"([^"]*)"/g`
6. IF the API returns an error, THEN THE System SHALL display a user-friendly error message

### Requirement 4: 多轮对话支持

**User Story:** As a user, I want to have multi-turn conversations, so that the AI can remember context from previous messages.

#### Acceptance Criteria

1. WHEN starting a new conversation, THE System SHALL generate a unique conversationId: `conv-{timestamp}-{random9chars}`
2. WHEN sending a follow-up message, THE System SHALL include the same conversationId in the request body
3. THE System SHALL maintain conversation history and include it in subsequent requests as:
   ```json
   "history": [
     { "userInputMessage": { "content": "previous user message" } },
     { "assistantResponseMessage": { "content": "previous assistant response" } }
   ]
   ```
4. WHEN starting a new conversation, THE System SHALL clear the previous conversationId and history

### Requirement 5: 模型信息显示

**User Story:** As a user, I want to see available models and their details, so that I can choose the best model for my needs.

#### Acceptance Criteria

1. THE System SHALL display a predefined list of models with their properties:
   - Claude Opus 4.5: 最强大，推理能力最强，maxOutputTokens: 16384
   - Claude Sonnet 4.5: 平衡性能和速度，maxOutputTokens: 16384
   - Claude Sonnet 4: 上一代 Sonnet，maxOutputTokens: 16384
   - Claude Haiku 4.5: 最快速，适合简单任务，maxOutputTokens: 8192
2. THE System SHALL indicate that Builders ID (免费账户) 支持所有模型包括 Opus 4.5
3. THE System SHALL indicate that IAM Identity Center (Pro) 目前不支持 Opus 4.5

### Requirement 6: 错误处理和恢复

**User Story:** As a user, I want clear error messages and recovery options, so that I can resolve issues quickly.

#### Acceptance Criteria

1. WHEN the API returns 401 Unauthorized, THE System SHALL prompt the user to refresh their token via Kiro IDE
2. WHEN the API returns 403 Forbidden, THE System SHALL display a message about potential account restrictions
3. WHEN the API returns 429 Too Many Requests, THE System SHALL implement exponential backoff retry with 2 second base delay
4. WHEN network errors occur, THE System SHALL retry up to 3 times before showing an error
5. THE System SHALL log all API errors for debugging purposes

### Requirement 7: 安全性

**User Story:** As a user, I want my credentials to be handled securely, so that my account is protected.

#### Acceptance Criteria

1. THE System SHALL NOT store the accessToken in localStorage or any persistent storage other than the original token file
2. THE System SHALL mask the accessToken in logs and UI displays (show only first 10 characters)
3. THE System SHALL use HTTPS for all API communications
4. WHEN the application closes, THE System SHALL clear any cached tokens from memory

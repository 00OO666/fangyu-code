# Design Document - Kiro API Integration

## Introduction

本设计文档描述 Fangyu Code 中 Kiro API 集成的技术架构和实现细节。基于 `requirements.md` 中定义的 7 个需求，设计一个完整的 Kiro 引擎模块。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Fangyu Code UI                            │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ EngineSelector  │    │ ChatInterface   │                     │
│  │ (选择 Kiro)     │    │ (发送消息)      │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────────────────────────────────────────────────┐
│                    Engine Layer (TypeScript)                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    KiroEngine                            │  │
│  │  - sendMessage(content, options)                        │  │
│  │  - getModels()                                          │  │
│  │  - validateConfig()                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│            │                           │                       │
│            ▼                           ▼                       │
│  ┌─────────────────────┐    ┌─────────────────────┐           │
│  │  KiroTokenManager   │    │   KiroApiClient     │           │
│  │  - loadToken()      │    │   - chat()          │           │
│  │  - isValid()        │    │   - parseSSE()      │           │
│  │  - watchFile()      │    │   - handleError()   │           │
│  └─────────────────────┘    └─────────────────────┘           │
└───────────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌───────────────────────────────────────────────────────────────┐
│                    Tauri Backend (Rust)                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                 kiro_commands.rs                         │  │
│  │  - read_kiro_token()                                    │  │
│  │  - send_kiro_request()                                  │  │
│  │  - watch_token_file()                                   │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│              Amazon Q Developer API (External)                 │
│              https://q.{region}.amazonaws.com                  │
└───────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. KiroTokenManager

负责 Token 的读取、验证和监控。

```typescript
// src/services/kiro/KiroTokenManager.ts

interface KiroToken {
  accessToken: string;
  expiresAt: string;      // ISO 8601 格式
  region: string;         // 如 "us-east-1"
  profileArn?: string;    // IAM Identity Center 才有
}

interface TokenStatus {
  isValid: boolean;
  expiresIn: number;      // 剩余秒数
  region: string;
  accountType: 'builders-id' | 'iam-identity-center';
}

class KiroTokenManager {
  private token: KiroToken | null = null;
  private tokenPath: string;
  private fileWatcher: FSWatcher | null = null;
  private onTokenChange: ((token: KiroToken | null) => void) | null = null;

  constructor(customPath?: string) {
    // 默认路径: ~/.aws/sso/cache/kiro-auth-token.json
    this.tokenPath = customPath || this.getDefaultTokenPath();
  }

  // 获取默认 Token 路径
  private getDefaultTokenPath(): string {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(home, '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  }

  // 加载 Token
  async loadToken(): Promise<KiroToken> {
    const content = await invoke<string>('read_kiro_token', { path: this.tokenPath });
    this.token = JSON.parse(content);
    return this.token;
  }

  // 验证 Token 是否有效
  isValid(): boolean {
    if (!this.token) return false;
    const expiresAt = new Date(this.token.expiresAt);
    return expiresAt > new Date();
  }

  // 获取 Token 状态
  getStatus(): TokenStatus {
    if (!this.token) {
      return { isValid: false, expiresIn: 0, region: '', accountType: 'builders-id' };
    }
    const expiresAt = new Date(this.token.expiresAt);
    const now = new Date();
    return {
      isValid: expiresAt > now,
      expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
      region: this.token.region,
      accountType: this.token.profileArn ? 'iam-identity-center' : 'builders-id'
    };
  }

  // 监控 Token 文件变化
  startWatching(callback: (token: KiroToken | null) => void): void {
    this.onTokenChange = callback;
    // 通过 Tauri 后端监控文件
    invoke('watch_token_file', { path: this.tokenPath });
  }

  // 停止监控
  stopWatching(): void {
    this.onTokenChange = null;
    invoke('unwatch_token_file', { path: this.tokenPath });
  }

  // 清除缓存
  clearCache(): void {
    this.token = null;
  }

  // 获取 Access Token（用于 API 调用）
  getAccessToken(): string | null {
    return this.token?.accessToken || null;
  }

  // 获取 Region
  getRegion(): string {
    return this.token?.region || 'us-east-1';
  }

  // 获取 Profile ARN（IAM Identity Center）
  getProfileArn(): string | null {
    return this.token?.profileArn || null;
  }

  // 获取遮蔽的 Token（用于日志）
  getMaskedToken(): string {
    if (!this.token?.accessToken) return '(no token)';
    return this.token.accessToken.substring(0, 10) + '...[MASKED]';
  }
}
```

### 2. KiroApiClient

负责与 Amazon Q Developer API 通信。

```typescript
// src/services/kiro/KiroApiClient.ts

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  modelId?: string;
  conversationId?: string;
  history?: ChatMessage[];
  onChunk?: (chunk: string) => void;  // 流式回调
}

interface ChatResponse {
  content: string;
  conversationId: string;
  modelUsed?: string;
}

class KiroApiClient {
  private tokenManager: KiroTokenManager;
  private retryCount = 3;
  private retryDelay = 2000;  // 2 秒基础延迟

  constructor(tokenManager: KiroTokenManager) {
    this.tokenManager = tokenManager;
  }

  // 发送聊天消息
  async chat(message: string, options: ChatOptions = {}): Promise<ChatResponse> {
    const {
      modelId,
      conversationId = this.generateConversationId(),
      history = [],
      onChunk
    } = options;

    // 验证 Token
    if (!this.tokenManager.isValid()) {
      throw new KiroApiError('TOKEN_EXPIRED', 'Token 已过期，请重新登录 Kiro IDE');
    }

    // 构建请求体
    const requestBody = this.buildRequestBody(message, modelId, conversationId, history);

    // 发送请求（带重试）
    return this.sendWithRetry(requestBody, onChunk, conversationId);
  }

  // 生成会话 ID
  private generateConversationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `conv-${timestamp}-${random}`;
  }

  // 构建请求体
  private buildRequestBody(
    message: string,
    modelId: string | undefined,
    conversationId: string,
    history: ChatMessage[]
  ): object {
    const userInputMessage: any = {
      content: message,
      origin: 'AI_EDITOR'
    };

    if (modelId) {
      userInputMessage.modelId = modelId;
    }

    const body: any = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId,
        currentMessage: { userInputMessage },
        history: history.map(msg => ({
          [msg.role === 'user' ? 'userInputMessage' : 'assistantResponseMessage']: {
            content: msg.content
          }
        }))
      }
    };

    const profileArn = this.tokenManager.getProfileArn();
    if (profileArn) {
      body.profileArn = profileArn;
    }

    return body;
  }

  // 带重试的请求发送
  private async sendWithRetry(
    body: object,
    onChunk: ((chunk: string) => void) | undefined,
    conversationId: string
  ): Promise<ChatResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        return await this.sendRequest(body, onChunk, conversationId);
      } catch (error) {
        lastError = error as Error;

        // 不重试的错误
        if (error instanceof KiroApiError) {
          if (['TOKEN_EXPIRED', 'FORBIDDEN', 'INVALID_MODEL'].includes(error.code)) {
            throw error;
          }
        }

        // 429 错误使用指数退避
        if (error instanceof KiroApiError && error.code === 'RATE_LIMITED') {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        // 其他错误等待后重试
        if (attempt < this.retryCount - 1) {
          await this.sleep(this.retryDelay);
        }
      }
    }

    throw lastError || new Error('Unknown error');
  }

  // 发送请求
  private async sendRequest(
    body: object,
    onChunk: ((chunk: string) => void) | undefined,
    conversationId: string
  ): Promise<ChatResponse> {
    const region = this.tokenManager.getRegion();
    const endpoint = `https://q.${region}.amazonaws.com/generateAssistantResponse`;
    const accessToken = this.tokenManager.getAccessToken();

    if (!accessToken) {
      throw new KiroApiError('NO_TOKEN', 'Token 不存在');
    }

    // 通过 Tauri 后端发送请求
    const response = await invoke<string>('send_kiro_request', {
      endpoint,
      accessToken,
      body: JSON.stringify(body)
    });

    // 解析 SSE 响应
    const content = this.parseSSEResponse(response, onChunk);

    return {
      content,
      conversationId
    };
  }

  // 解析 SSE 响应
  private parseSSEResponse(
    response: string,
    onChunk?: (chunk: string) => void
  ): string {
    const contents: string[] = [];
    const regex = /"content"\s*:\s*"([^"]*)"/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
      if (match[1] && match[1].length > 0) {
        let decoded = match[1];
        // 解码转义字符
        decoded = decoded.replace(/\\n/g, '\n');
        decoded = decoded.replace(/\\t/g, '\t');
        decoded = decoded.replace(/\\"/g, '"');
        decoded = decoded.replace(/\\\\/g, '\\');

        contents.push(decoded);

        if (onChunk) {
          onChunk(decoded);
        }
      }
    }

    return contents.join('') || '';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 自定义错误类
class KiroApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'KiroApiError';
  }
}
```

### 3. KiroEngine

整合 TokenManager 和 ApiClient，提供统一的引擎接口。

```typescript
// src/services/kiro/KiroEngine.ts

interface KiroConfig {
  tokenPath?: string;
  modelId?: string;
}

interface KiroModel {
  id: string;
  name: string;
  description: string;
  maxOutputTokens: number;
  supportedBy: ('builders-id' | 'iam-identity-center')[];
}

class KiroEngine {
  private tokenManager: KiroTokenManager;
  private apiClient: KiroApiClient;
  private config: KiroConfig;
  private conversationId: string | null = null;
  private history: ChatMessage[] = [];

  // 可用模型列表
  static readonly MODELS: KiroModel[] = [
    {
      id: 'claude-opus-4.5',
      name: 'Claude Opus 4.5',
      description: '最强大，推理能力最强',
      maxOutputTokens: 16384,
      supportedBy: ['builders-id']
    },
    {
      id: 'CLAUDE_SONNET_4_5_20250929_V1_0',
      name: 'Claude Sonnet 4.5',
      description: '平衡性能和速度',
      maxOutputTokens: 16384,
      supportedBy: ['builders-id', 'iam-identity-center']
    },
    {
      id: 'CLAUDE_SONNET_4_20250514_V1_0',
      name: 'Claude Sonnet 4',
      description: '上一代 Sonnet',
      maxOutputTokens: 16384,
      supportedBy: ['builders-id', 'iam-identity-center']
    },
    {
      id: 'claude-haiku-4.5',
      name: 'Claude Haiku 4.5',
      description: '最快速，适合简单任务',
      maxOutputTokens: 8192,
      supportedBy: ['builders-id', 'iam-identity-center']
    }
  ];

  constructor(config: KiroConfig = {}) {
    this.config = config;
    this.tokenManager = new KiroTokenManager(config.tokenPath);
    this.apiClient = new KiroApiClient(this.tokenManager);
  }

  // 初始化引擎
  async initialize(): Promise<void> {
    await this.tokenManager.loadToken();
  }

  // 验证配置
  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.tokenManager.loadToken();

      if (!this.tokenManager.isValid()) {
        return {
          valid: false,
          error: 'Token 已过期，请重新登录 Kiro IDE'
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `无法读取 Token 文件: ${(error as Error).message}`
      };
    }
  }

  // 发送消息
  async sendMessage(
    content: string,
    options: { onChunk?: (chunk: string) => void } = {}
  ): Promise<string> {
    const response = await this.apiClient.chat(content, {
      modelId: this.config.modelId,
      conversationId: this.conversationId || undefined,
      history: this.history,
      onChunk: options.onChunk
    });

    // 更新会话状态
    this.conversationId = response.conversationId;
    this.history.push(
      { role: 'user', content },
      { role: 'assistant', content: response.content }
    );

    return response.content;
  }

  // 开始新会话
  startNewConversation(): void {
    this.conversationId = null;
    this.history = [];
  }

  // 获取可用模型
  getAvailableModels(): KiroModel[] {
    const status = this.tokenManager.getStatus();
    return KiroEngine.MODELS.filter(model =>
      model.supportedBy.includes(status.accountType)
    );
  }

  // 获取所有模型
  getAllModels(): KiroModel[] {
    return KiroEngine.MODELS;
  }

  // 设置模型
  setModel(modelId: string): void {
    this.config.modelId = modelId;
  }

  // 获取当前模型
  getCurrentModel(): string | undefined {
    return this.config.modelId;
  }

  // 获取 Token 状态
  getTokenStatus(): TokenStatus {
    return this.tokenManager.getStatus();
  }

  // 监控 Token 变化
  watchToken(callback: (status: TokenStatus) => void): void {
    this.tokenManager.startWatching((token) => {
      callback(this.tokenManager.getStatus());
    });
  }

  // 停止监控
  unwatchToken(): void {
    this.tokenManager.stopWatching();
  }

  // 清理资源
  dispose(): void {
    this.tokenManager.stopWatching();
    this.tokenManager.clearCache();
  }
}
```

### 4. Rust Backend Commands

```rust
// src-tauri/src/commands/kiro.rs

use std::fs;
use std::path::PathBuf;
use tauri::command;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct KiroToken {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
    pub region: String,
    #[serde(rename = "profileArn")]
    pub profile_arn: Option<String>,
}

/// 读取 Kiro Token 文件
#[command]
pub async fn read_kiro_token(path: String) -> Result<String, String> {
    let expanded_path = expand_home_dir(&path);
    
    fs::read_to_string(&expanded_path)
        .map_err(|e| format!("无法读取 Token 文件 {}: {}", expanded_path.display(), e))
}

/// 发送 Kiro API 请求
#[command]
pub async fn send_kiro_request(
    endpoint: String,
    access_token: String,
    body: String,
) -> Result<String, String> {
    let client = Client::new();
    
    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "KiroIDE 0.7.5")
        .header("Accept", "application/json")
        .header("x-amzn-kiro-agent-mode", "vibe")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let status = response.status();
    let text = response.text().await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), &text[..500.min(text.len())]));
    }
    
    Ok(text)
}

/// 展开 ~ 为用户目录
fn expand_home_dir(path: &str) -> PathBuf {
    if path.starts_with("~") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}
```

## Data Models

### Provider Type Extension

```typescript
// src/types/provider.ts (扩展)

export type ProviderType = 
  | 'claude-code'
  | 'codex'
  | 'gemini'
  | 'siliconflow'
  | 'kiro';  // 新增

export interface KiroProviderConfig {
  type: 'kiro';
  tokenPath?: string;  // 默认 ~/.aws/sso/cache/kiro-auth-token.json
  modelId?: string;    // 默认 Auto
}
```

### Engine Config Extension

```typescript
// src/services/engineConfigService.ts (扩展)

interface EngineConfig {
  // ... 现有字段
  kiro?: {
    tokenPath: string;
    modelId: string;
  };
}
```

## Correctness Properties

基于需求分析，以下是可测试的正确性属性：

### 1. Model ID Mapping
- **Property**: 每个用户友好的模型名称必须映射到正确的 CodeWhisperer modelId
- **Test**: `getModelId('Claude Opus 4.5') === 'claude-opus-4.5'`

### 2. Token Validation
- **Property**: Token 过期时间判断必须准确
- **Test**: `isValid()` 在 expiresAt 之前返回 true，之后返回 false

### 3. Endpoint Construction
- **Property**: API 端点必须使用 Token 中的 region
- **Test**: region='us-west-2' → endpoint='https://q.us-west-2.amazonaws.com/...'

### 4. Request Body Structure
- **Property**: modelId 必须放在 `userInputMessage.modelId`
- **Test**: 验证请求体 JSON 结构

### 5. SSE Response Parsing
- **Property**: 必须正确提取所有 content 字段并解码转义字符
- **Test**: 解析示例 SSE 响应，验证输出

### 6. Conversation State
- **Property**: 多轮对话必须保持相同的 conversationId
- **Test**: 连续两次调用使用相同 conversationId

### 7. Retry Mechanism
- **Property**: 429 错误必须使用指数退避重试
- **Test**: 模拟 429 响应，验证重试间隔

### 8. Security
- **Property**: Token 在日志中必须被遮蔽
- **Test**: `getMaskedToken()` 只显示前 10 个字符

## Error Handling Strategy

| 错误类型 | HTTP 状态码 | 处理方式 |
|---------|------------|---------|
| Token 过期 | 401 | 提示用户重新登录 Kiro IDE |
| 账户受限 | 403 | 显示账户限制信息 |
| 速率限制 | 429 | 指数退避重试（最多 3 次） |
| 网络错误 | - | 重试 3 次后显示错误 |
| 无效模型 | 400 | 显示模型不支持信息 |

## Testing Strategy

### Unit Tests
- KiroTokenManager: Token 读取、验证、过期判断
- KiroApiClient: 请求构建、SSE 解析、错误处理
- KiroEngine: 模型列表、会话管理

### Integration Tests
- 完整的 API 调用流程（需要有效 Token）
- 多轮对话测试
- 错误恢复测试

### Manual Tests
- UI 配置面板
- 模型切换
- Token 过期提示

## File Structure

```
src/
├── services/
│   └── kiro/
│       ├── index.ts              # 导出
│       ├── KiroTokenManager.ts   # Token 管理
│       ├── KiroApiClient.ts      # API 客户端
│       ├── KiroEngine.ts         # 引擎主类
│       ├── types.ts              # 类型定义
│       └── errors.ts             # 错误类
├── components/
│   └── EngineConfigPanel/
│       └── KiroSettings.tsx      # Kiro 配置 UI
└── types/
    └── provider.ts               # 扩展 ProviderType

src-tauri/
└── src/
    └── commands/
        └── kiro.rs               # Rust 后端命令
```

## Dependencies

### Frontend
- 无新增依赖（使用 Tauri invoke）

### Backend (Rust)
- `reqwest` - HTTP 客户端（已有）
- `dirs` - 获取用户目录（已有）

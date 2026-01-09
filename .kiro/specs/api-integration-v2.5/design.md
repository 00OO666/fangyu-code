# Design Document: API Integration v2.5.0

## Overview

本设计文档描述 Fangyu Code v2.5.0 的真实 API 集成方案。核心目标是将现有的 mock 实现替换为真实的 AI API 调用，支持 HiAPI 中转服务作为统一入口，同时保持与多个 AI 提供商的兼容性。

### 设计原则

1. **统一入口**: 使用 HiAPI 中转服务简化多提供商管理
2. **OpenAI 兼容**: 采用 OpenAI 兼容格式，降低集成复杂度
3. **渐进式迁移**: 保留 mock 模式用于测试，支持平滑切换
4. **安全优先**: API 密钥安全存储，敏感信息脱敏

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Fangyu Code v2.5.0                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Agent       │  │ Chat        │  │ Super Agent         │  │
│  │ Dashboard   │  │ Interface   │  │ Center              │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│  ┌───────────────────────▼───────────────────────────────┐  │
│  │                   ModelRouter                          │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              RealAPIClient                       │  │  │
│  │  │  - OpenAI Compatible Format                      │  │  │
│  │  │  - Streaming Support                             │  │  │
│  │  │  - Error Handling                                │  │  │
│  │  │  - Token Tracking                                │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    HiAPI 中转服务                            │
│  Base URL: https://api.hiapi.online/v1                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Claude      │  │ GPT-4       │  │ Gemini              │  │
│  │ 3.5 Sonnet  │  │ GPT-4o      │  │ 2.5 Pro             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. RealAPIClient

真实 API 客户端，实现 OpenAI 兼容的 chat completion 接口。

```typescript
interface APIClientConfig {
  baseUrl: string;           // HiAPI 中转服务地址
  apiKey: string;            // API 密钥
  timeout?: number;          // 请求超时（默认 30000ms）
  maxRetries?: number;       // 最大重试次数（默认 3）
  retryDelay?: number;       // 重试延迟（默认 1000ms）
}

interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class RealAPIClient implements ModelAPIClient {
  constructor(config: APIClientConfig);
  
  // 同步请求
  async chat(options: ModelRequestOptions): Promise<ChatResult>;
  
  // 流式请求
  async chatStream(options: ModelRequestOptions): AsyncGenerator<string>;
  
  // 验证凭证
  async validateCredentials(): Promise<boolean>;
  
  // 获取可用模型列表
  async listModels(): Promise<string[]>;
}
```

### 2. APIConfigManager

API 配置管理器，安全存储和管理 API 密钥。

```typescript
interface APIProviderConfig {
  provider: 'hiapi' | 'anthropic' | 'openai' | 'google';
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  models: string[];
}

class APIConfigManager {
  // 保存配置（加密存储）
  async saveConfig(config: APIProviderConfig): Promise<void>;
  
  // 加载配置
  async loadConfig(provider: string): Promise<APIProviderConfig | null>;
  
  // 验证配置
  async validateConfig(config: APIProviderConfig): Promise<ValidationResult>;
  
  // 获取所有已配置的提供商
  async listProviders(): Promise<APIProviderConfig[]>;
}
```

### 3. StreamHandler

流式响应处理器，支持实时输出。

```typescript
interface StreamChunk {
  id: string;
  delta: {
    content?: string;
    role?: string;
  };
  finish_reason?: string;
}

class StreamHandler {
  // 处理 SSE 流
  async *processStream(response: Response): AsyncGenerator<StreamChunk>;
  
  // 合并流式响应
  mergeChunks(chunks: StreamChunk[]): ChatCompletionResponse;
  
  // 取消流
  abort(): void;
}
```

## Data Models

### API 配置存储结构

```typescript
// 存储在 localStorage 或 Tauri secure storage
interface StoredAPIConfig {
  version: '1.0';
  providers: {
    [key: string]: {
      baseUrl: string;
      apiKey: string;  // 加密存储
      enabled: boolean;
      defaultModel: string;
      models: string[];
      lastValidated: number;
    };
  };
  defaultProvider: string;
}
```

### 模型映射表

```typescript
// HiAPI 支持的模型映射
const MODEL_MAPPING = {
  // Claude 系列
  'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-haiku': 'claude-3-haiku-20240307',
  
  // GPT 系列
  'gpt-4o': 'gpt-4o',
  'gpt-4-turbo': 'gpt-4-turbo',
  'gpt-4o-mini': 'gpt-4o-mini',
  
  // Gemini 系列
  'gemini-2.5-pro': 'gemini-2.5-pro-preview-05-06',
  'gemini-1.5-flash': 'gemini-1.5-flash',
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API 配置正确性

*For any* valid API configuration (baseUrl, apiKey, timeout, retries), saving and loading the configuration should return an equivalent configuration object.

**Validates: Requirements 1.1, 1.6**

### Property 2: 请求格式合规性

*For any* chat request with valid messages, the formatted request should conform to OpenAI chat completion API specification (contain model, messages array, and optional parameters).

**Validates: Requirements 1.2, 1.3**

### Property 3: 流式响应完整性

*For any* sequence of stream chunks, merging them should produce a complete response where the concatenated content equals the sum of all delta.content values.

**Validates: Requirements 1.4**

### Property 4: 错误处理结构化

*For any* API error response, the parsed error should contain structured information including error code, message, and optional details.

**Validates: Requirements 1.5**

### Property 5: Token 统计准确性

*For any* sequence of API responses, the cumulative token count should equal the sum of individual response token counts.

**Validates: Requirements 1.7**

### Property 6: 多提供商路由正确性

*For any* model request through HiAPI, the request should be correctly routed to the appropriate provider based on model name prefix, and provider-specific parameters should be preserved.

**Validates: Requirements 2.4, 2.5, 2.6**

## Error Handling

### 错误类型分类

```typescript
enum APIErrorCode {
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // 认证错误
  INVALID_API_KEY = 'INVALID_API_KEY',
  EXPIRED_API_KEY = 'EXPIRED_API_KEY',
  
  // 请求错误
  INVALID_REQUEST = 'INVALID_REQUEST',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',
  
  // 服务端错误
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

interface APIError {
  code: APIErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfter?: number;
}
```

### 重试策略

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    APIErrorCode.NETWORK_ERROR,
    APIErrorCode.TIMEOUT,
    APIErrorCode.RATE_LIMITED,
    APIErrorCode.SERVER_ERROR,
    APIErrorCode.SERVICE_UNAVAILABLE,
  ],
};
```

## Testing Strategy

### 单元测试

- API 配置的保存和加载
- 请求格式化
- 响应解析
- 错误处理
- Token 计算

### 属性测试

使用 fast-check 进行属性测试，每个属性至少运行 100 次：

1. **Property 1**: 配置往返测试
2. **Property 2**: 请求格式验证
3. **Property 3**: 流式响应合并
4. **Property 4**: 错误解析
5. **Property 5**: Token 累加
6. **Property 6**: 路由正确性

### E2E 测试

使用 mock 服务器进行端到端测试：

1. Agent 任务分配 → 执行 → 结果展示
2. API 连接和响应处理
3. 错误处理和恢复
4. 流式输出显示

### 测试配置

```typescript
// vitest.config.ts 中的属性测试配置
{
  test: {
    include: ['**/*.property.test.ts'],
    testTimeout: 30000,  // 属性测试需要更长时间
  }
}
```

## Implementation Notes

### HiAPI 集成要点

1. **Base URL**: `https://api.hiapi.online/v1`
2. **认证方式**: Bearer Token (`Authorization: Bearer sk-xxx`)
3. **请求格式**: OpenAI 兼容
4. **支持模型**: Claude、GPT、Gemini 全系列

### 安全考虑

1. API 密钥使用 Tauri 的 secure storage 加密存储
2. 日志中自动脱敏 API 密钥
3. 请求中不包含敏感用户数据

### 性能优化

1. 连接复用（HTTP/2）
2. 请求缓存（相同请求 5 分钟内复用）
3. 流式响应减少首字节时间

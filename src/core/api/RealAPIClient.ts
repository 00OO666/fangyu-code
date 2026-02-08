/**
 * RealAPIClient - 真实 API 客户端
 *
 * 实现 OpenAI 兼容的 chat completion 接口
 * 支持 HiAPI 中转服务和多个 AI 提供商
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { ModelAPIClient, ModelRequestOptions } from "../models/ModelRouter";

// =============================================================================
// 类型定义
// =============================================================================

/** API 客户端配置 */
export interface APIClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/** Chat Completion 请求 */
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
}

/** Chat Completion 响应 */
export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop" | "length" | "content_filter" | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** 流式响应块 */
export interface StreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: "stop" | "length" | "content_filter" | null;
  }>;
}

/** API 错误码 */
export enum APIErrorCode {
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  INVALID_API_KEY = "INVALID_API_KEY",
  EXPIRED_API_KEY = "EXPIRED_API_KEY",
  INVALID_REQUEST = "INVALID_REQUEST",
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  CONTEXT_TOO_LONG = "CONTEXT_TOO_LONG",
  RATE_LIMITED = "RATE_LIMITED",
  SERVER_ERROR = "SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  UNKNOWN = "UNKNOWN",
}

/** API 错误 */
export interface APIError {
  code: APIErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfter?: number;
  statusCode?: number;
}

/** 模型映射 */
export const MODEL_MAPPING: Record<string, string> = {
  // Claude 系列
  "claude-3.5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-opus": "claude-3-opus-20240229",
  "claude-3-haiku": "claude-3-haiku-20240307",
  "claude-3-sonnet": "claude-3-sonnet-20240229",
  // GPT 系列
  "gpt-4o": "gpt-4o",
  "gpt-4-turbo": "gpt-4-turbo",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-3.5-turbo": "gpt-3.5-turbo",
  // Gemini 系列
  "gemini-2.5-pro": "gemini-2.5-pro-preview-05-06",
  "gemini-1.5-pro": "gemini-1.5-pro",
  "gemini-1.5-flash": "gemini-1.5-flash",
};

/** 可重试的错误码 */
const RETRYABLE_ERRORS = new Set([
  APIErrorCode.NETWORK_ERROR,
  APIErrorCode.TIMEOUT,
  APIErrorCode.RATE_LIMITED,
  APIErrorCode.SERVER_ERROR,
  APIErrorCode.SERVICE_UNAVAILABLE,
]);

// =============================================================================
// RealAPIClient 类
// =============================================================================

export class RealAPIClient implements ModelAPIClient {
  private config: Required<APIClientConfig>;
  private abortController: AbortController | null = null;

  constructor(config: APIClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""), // 移除尾部斜杠
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      headers: config.headers ?? {},
    };
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 发送 chat 请求（同步）
   * Requirements: 1.2, 1.3
   */
  async chat(options: ModelRequestOptions): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    const request = this.buildRequest(options);
    const response = await this.executeWithRetry(request);

    return {
      content: response.choices[0]?.message?.content ?? "",
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      },
    };
  }

  /**
   * 发送 chat 请求（流式）
   * Requirements: 1.4
   */
  async *chatStream(options: ModelRequestOptions): AsyncGenerator<string, void, unknown> {
    const request = this.buildRequest(options, true);

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.parseErrorResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw this.createError(APIErrorCode.NETWORK_ERROR, "No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") return;

            try {
              const chunk: StreamChunk = JSON.parse(data);
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      this.abortController = null;
    }
  }

  /**
   * 验证 API 凭证
   * Requirements: 2.5
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id) ?? [];
    } catch {
      return [];
    }
  }

  /**
   * 取消当前请求
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<APIClientConfig>): void {
    if (config.baseUrl) {
      this.config.baseUrl = config.baseUrl.replace(/\/$/, "");
    }
    if (config.apiKey) {
      this.config.apiKey = config.apiKey;
    }
    if (config.timeout !== undefined) {
      this.config.timeout = config.timeout;
    }
    if (config.maxRetries !== undefined) {
      this.config.maxRetries = config.maxRetries;
    }
    if (config.retryDelay !== undefined) {
      this.config.retryDelay = config.retryDelay;
    }
    if (config.headers) {
      this.config.headers = { ...this.config.headers, ...config.headers };
    }
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 构建请求体
   */
  private buildRequest(options: ModelRequestOptions, stream = false): ChatCompletionRequest {
    // 获取模型名称，支持映射
    const model = options.messages[0]?.content?.includes("model:")
      ? this.extractModel(options.messages[0].content)
      : "gpt-4o"; // 默认模型

    return {
      model: MODEL_MAPPING[model] ?? model,
      messages: options.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream,
    };
  }

  /**
   * 从消息中提取模型名称
   */
  private extractModel(content: string): string {
    const match = content.match(/model:\s*([^\s,]+)/i);
    return match?.[1] ?? "gpt-4o";
  }

  /**
   * 获取请求头
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
  }

  /**
   * 带重试的执行
   * Requirements: 1.6
   */
  private async executeWithRetry(
    request: ChatCompletionRequest,
    retries = 0
  ): Promise<ChatCompletionResponse> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);

        // 检查是否可重试
        if (error.retryable && retries < this.config.maxRetries) {
          const delay = error.retryAfter ?? this.config.retryDelay * Math.pow(2, retries);
          await this.delay(delay);
          return this.executeWithRetry(request, retries + 1);
        }

        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        const timeoutError = this.createError(APIErrorCode.TIMEOUT, "Request timed out");

        if (retries < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * Math.pow(2, retries));
          return this.executeWithRetry(request, retries + 1);
        }

        throw timeoutError;
      }

      if (this.isAPIError(error)) {
        throw error;
      }

      const networkError = this.createError(
        APIErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : "Network error"
      );

      if (retries < this.config.maxRetries) {
        await this.delay(this.config.retryDelay * Math.pow(2, retries));
        return this.executeWithRetry(request, retries + 1);
      }

      throw networkError;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * 解析错误响应
   * Requirements: 1.5
   */
  private async parseErrorResponse(response: Response): Promise<APIError> {
    let errorData: Record<string, unknown> = {};

    try {
      errorData = await response.json();
    } catch {
      // 忽略 JSON 解析错误
    }

    const statusCode = response.status;
    const message =
      (errorData.error as { message?: string })?.message ?? response.statusText ?? "Unknown error";

    let code: APIErrorCode;
    let retryAfter: number | undefined;

    switch (statusCode) {
      case 401:
        code = APIErrorCode.INVALID_API_KEY;
        break;
      case 403:
        code = APIErrorCode.EXPIRED_API_KEY;
        break;
      case 400:
        code = message.toLowerCase().includes("model")
          ? APIErrorCode.MODEL_NOT_FOUND
          : APIErrorCode.INVALID_REQUEST;
        break;
      case 413:
        code = APIErrorCode.CONTEXT_TOO_LONG;
        break;
      case 429:
        code = APIErrorCode.RATE_LIMITED;
        retryAfter = parseInt(response.headers.get("Retry-After") ?? "60", 10) * 1000;
        break;
      case 500:
        code = APIErrorCode.SERVER_ERROR;
        break;
      case 503:
        code = APIErrorCode.SERVICE_UNAVAILABLE;
        break;
      default:
        code = APIErrorCode.UNKNOWN;
    }

    return {
      code,
      message,
      details: errorData,
      retryable: RETRYABLE_ERRORS.has(code),
      retryAfter,
      statusCode,
    };
  }

  /**
   * 创建错误对象
   */
  private createError(code: APIErrorCode, message: string): APIError {
    return {
      code,
      message,
      retryable: RETRYABLE_ERRORS.has(code),
    };
  }

  /**
   * 检查是否为 API 错误
   */
  private isAPIError(error: unknown): error is APIError {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "message" in error &&
      "retryable" in error
    );
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建 HiAPI 客户端
 */
export function createHiAPIClient(
  apiKey: string,
  options?: Partial<APIClientConfig>
): RealAPIClient {
  return new RealAPIClient({
    baseUrl: options?.baseUrl ?? "https://hiapi.online/v1",
    apiKey,
    ...options,
  });
}

/**
 * 创建 OpenAI 客户端
 */
export function createOpenAIClient(
  apiKey: string,
  options?: Partial<APIClientConfig>
): RealAPIClient {
  return new RealAPIClient({
    baseUrl: options?.baseUrl ?? "https://api.openai.com/v1",
    apiKey,
    ...options,
  });
}

/**
 * 创建 Anthropic 客户端（通过 OpenAI 兼容层）
 */
export function createAnthropicClient(
  apiKey: string,
  options?: Partial<APIClientConfig>
): RealAPIClient {
  return new RealAPIClient({
    baseUrl: options?.baseUrl ?? "https://api.anthropic.com/v1",
    apiKey,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    ...options,
  });
}

export default RealAPIClient;

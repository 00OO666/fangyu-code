/**
 * 统一的 LLM API 调用服务
 *
 * 使用策略模式处理不同 LLM 提供商（OpenAI, Anthropic, Gemini）的 API 调用
 * 消除重复的 API 调用逻辑，提供统一的接口
 *
 * @module llmApiService
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * LLM API 格式类型
 */
export type ApiFormat = "openai" | "gemini" | "anthropic";

/**
 * LLM 提供商配置接口
 */
export interface LLMProvider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiFormat?: ApiFormat;
  enabled?: boolean; // 用于配置管理
}

/**
 * API 请求参数
 */
export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 🆕 API 调用选项（超时、重试等）
 */
export interface LLMCallOptions {
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 基础重试延迟（毫秒），指数退避，默认 1000 */
  retryDelay?: number;
  /** AbortController 信号（用于外部取消） */
  signal?: AbortSignal;
}

/**
 * API 响应接口
 */
export interface LLMResponse {
  content: string;
  finishReason?: string;
}

/**
 * API 策略接口（策略模式核心）
 */
interface ApiStrategy {
  /**
   * 规范化 API URL
   */
  normalizeUrl(baseUrl: string): string;

  /**
   * 构建请求端点
   */
  buildEndpoint(normalizedUrl: string, model: string, apiKey: string): string;

  /**
   * 构建请求体
   */
  buildRequestBody(request: LLMRequest, model: string): any;

  /**
   * 构建请求头
   */
  buildHeaders(apiKey: string): Record<string, string>;

  /**
   * 解析响应
   */
  parseResponse(data: any): string;
}

/**
 * OpenAI API 策略实现
 */
class OpenAIStrategy implements ApiStrategy {
  normalizeUrl(baseUrl: string): string {
    let url = baseUrl.trim();

    // 移除末尾斜杠
    while (url.endsWith("/")) {
      url = url.slice(0, -1);
    }

    // 如果已经包含 /chat/completions，移除它
    if (url.endsWith("/chat/completions")) {
      url = url.slice(0, -"/chat/completions".length);
    }

    // 如果不包含 /v1，添加它
    if (!url.endsWith("/v1")) {
      if (!url.match(/\/v\d+$/)) {
        url = `${url}/v1`;
      }
    }

    return url;
  }

  buildEndpoint(normalizedUrl: string): string {
    return `${normalizedUrl}/chat/completions`;
  }

  buildRequestBody(request: LLMRequest, model: string): any {
    const body: any = {
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      stream: false,
    };

    if (request.temperature !== undefined && request.temperature !== null) {
      body.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined && request.maxTokens !== null) {
      body.max_tokens = request.maxTokens;
    }

    return body;
  }

  buildHeaders(apiKey: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  parseResponse(data: any): string {
    if (!data.choices || data.choices.length === 0) {
      if (data.error) {
        throw new Error(`API error: ${JSON.stringify(data.error)}`);
      }
      throw new Error("API returned no choices");
    }

    const choice = data.choices[0];
    if (!choice.message) {
      throw new Error("Choice has no message");
    }

    const content = choice.message.content;
    if (!content || content.trim() === "") {
      if (choice.finish_reason) {
        throw new Error(`Content is empty. Finish reason: ${choice.finish_reason}`);
      }
      throw new Error("API returned empty content");
    }

    return content.trim();
  }
}

/**
 * Anthropic API 策略实现
 */
class AnthropicStrategy implements ApiStrategy {
  normalizeUrl(baseUrl: string): string {
    let url = baseUrl.trim();

    // 移除末尾斜杠
    while (url.endsWith("/")) {
      url = url.slice(0, -1);
    }

    // 如果已经包含 /messages，移除它
    if (url.endsWith("/messages")) {
      url = url.slice(0, -"/messages".length);
    }

    // 如果不包含 /v1，添加它
    if (!url.endsWith("/v1")) {
      if (!url.match(/\/v\d+$/)) {
        url = `${url}/v1`;
      }
    }

    return url;
  }

  buildEndpoint(normalizedUrl: string): string {
    return `${normalizedUrl}/messages`;
  }

  buildRequestBody(request: LLMRequest, model: string): any {
    const body: any = {
      model,
      max_tokens: request.maxTokens || 4096,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    };

    if (request.temperature !== undefined && request.temperature !== null) {
      body.temperature = request.temperature;
    }

    return body;
  }

  buildHeaders(apiKey: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  parseResponse(data: any): string {
    if (!data.content || data.content.length === 0) {
      if (data.error) {
        throw new Error(`Anthropic API error: ${JSON.stringify(data.error)}`);
      }
      throw new Error("Anthropic API returned no content");
    }

    const textContent = data.content.find((c: any) => c.type === "text");
    if (!textContent || !textContent.text) {
      throw new Error("Anthropic API returned empty text content");
    }

    return textContent.text.trim();
  }
}

/**
 * Gemini API 策略实现
 */
class GeminiStrategy implements ApiStrategy {
  normalizeUrl(baseUrl: string): string {
    let url = baseUrl.trim();

    // 移除末尾斜杠
    while (url.endsWith("/")) {
      url = url.slice(0, -1);
    }

    return url;
  }

  buildEndpoint(normalizedUrl: string, model: string, apiKey: string): string {
    return `${normalizedUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  buildRequestBody(request: LLMRequest): any {
    const body: any = {
      contents: [
        {
          parts: [{ text: `${request.systemPrompt}\n\n${request.userPrompt}` }],
        },
      ],
    };

    const generationConfig: any = {};
    if (request.temperature !== undefined && request.temperature !== null) {
      generationConfig.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined && request.maxTokens !== null) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    return body;
  }

  buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  parseResponse(data: any): string {
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("Gemini API returned empty response");
    }

    return content.trim();
  }
}

/**
 * 策略工厂函数
 */
function getApiStrategy(format: ApiFormat): ApiStrategy {
  switch (format) {
    case "openai":
      return new OpenAIStrategy();
    case "anthropic":
      return new AnthropicStrategy();
    case "gemini":
      return new GeminiStrategy();
    default:
      return new OpenAIStrategy(); // 默认使用 OpenAI
  }
}

/**
 * 自动检测 API 格式
 */
export function detectApiFormat(apiUrl: string): ApiFormat {
  const url = apiUrl.toLowerCase().trim();

  // 检测 Gemini
  if (
    url.includes("generativelanguage.googleapis.com") ||
    url.includes("aiplatform.googleapis.com")
  ) {
    return "gemini";
  }

  // 检测 Anthropic
  if (
    url.includes("api.anthropic.com") ||
    url.includes("anthropic.com") ||
    url.includes("/v1/messages")
  ) {
    return "anthropic";
  }

  // 默认 OpenAI
  return "openai";
}

/**
 * 统一的 LLM API 调用服务（主类）
 */
export class LLMApiService {
  /**
   * 统一的 API 调用方法（带超时和重试）
   *
   * @param provider LLM 提供商配置
   * @param request API 请求参数
   * @param options 调用选项（超时、重试等）
   * @returns API 响应
   */
  static async call(
    provider: LLMProvider,
    request: LLMRequest,
    options: LLMCallOptions = {},
  ): Promise<LLMResponse> {
    const { timeout = 30000, maxRetries = 3, retryDelay = 1000, signal: externalSignal } = options;

    // 1. 确定 API 格式
    const format = provider.apiFormat || detectApiFormat(provider.apiUrl);
    const strategy = getApiStrategy(format);
    // 2. URL 规范化
    const normalizedUrl = strategy.normalizeUrl(provider.apiUrl);

    // 3. 构建端点
    const endpoint = strategy.buildEndpoint(normalizedUrl, provider.model, provider.apiKey);

    // 4. 构建请求体
    const requestBody = strategy.buildRequestBody(
      {
        ...request,
        temperature: request.temperature ?? provider.temperature,
        maxTokens: request.maxTokens ?? provider.maxTokens,
      },
      provider.model,
    );

    // 5. 构建请求头
    const headers = strategy.buildHeaders(provider.apiKey);

    // 6. 🆕 带重试的请求执行
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 🆕 创建 AbortController 用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // 🆕 组合外部信号和超时信号
        const combinedSignal = controller.signal;
        if (externalSignal) {
          // 如果外部信号已中止，立即抛出
          if (externalSignal.aborted) {
            throw new Error("Request cancelled by user");
          }

          // 监听外部信号
          externalSignal.addEventListener("abort", () => controller.abort());
        }

        try {
          const response = await tauriFetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
            signal: combinedSignal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `${format} API request failed: ${response.status} ${response.statusText}\n${errorText}`,
            );
          }

          // 7. 解析响应
          const data = await response.json();
          const content = strategy.parseResponse(data);

          return { content };
        } catch (error: any) {
          clearTimeout(timeoutId);

          // 🆕 区分错误类型
          if (error.name === "AbortError" || error.message?.includes("aborted")) {
            if (externalSignal?.aborted) {
              throw new Error("Request cancelled by user");
            }
            throw new Error(`Request timeout after ${timeout}ms`);
          }
          throw error;
        }
      } catch (error: any) {
        lastError = error;

        // 🆕 不可重试的错误（用户取消、超时、4xx 错误）
        const isUserCancelled = error.message?.includes("cancelled by user");
        const is4xxError =
          error.message?.includes("400") ||
          error.message?.includes("401") ||
          error.message?.includes("403") ||
          error.message?.includes("404");

        if (isUserCancelled || is4xxError) {
          console.error(`[LLMApiService] ${format} API call failed (non-retryable):`, error);
          throw error;
        }

        // 🆕 是否还有重试机会
        const retriesLeft = maxRetries - attempt;
        if (retriesLeft > 0) {
          // 🆕 指数退避延迟（1s, 2s, 4s）
          const delay = retryDelay * 2 ** attempt;
          console.warn(
            `[LLMApiService] ${format} API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
            error.message,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 🆕 所有重试都失败
        console.error(
          `[LLMApiService] ${format} API call failed after ${maxRetries + 1} attempts:`,
          error,
        );
        throw error;
      }
    }

    // 理论上不应该到达这里，但为了类型安全
    throw lastError || new Error("Unknown error");
  }

  /**
   * 简化的调用接口（仅传递 system 和 user prompt）
   */
  static async callSimple(
    provider: LLMProvider,
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): Promise<string> {
    const response = await LLMApiService.call(
      provider,
      {
        systemPrompt,
        userPrompt,
      },
      options,
    );
    return response.content;
  }

  /**
   * 🆕 流式 API 调用方法（适用于 OpenAI 兼容 API）
   *
   * @param provider LLM 提供商配置
   * @param request API 请求参数
   * @param onChunk 每次收到新内容时的回调
   * @param options 调用选项
   * @returns 完整响应内容
   */
  static async callStream(
    provider: LLMProvider,
    request: LLMRequest,
    onChunk: (chunk: string, fullContent: string) => void,
    options: LLMCallOptions = {},
  ): Promise<LLMResponse> {
    const { timeout = 60000, signal: externalSignal } = options;

    // 目前只支持 OpenAI 格式的流式调用
    const format = provider.apiFormat || detectApiFormat(provider.apiUrl);
    if (format !== "openai") {
      // 对于非 OpenAI 格式，回退到非流式调用
      console.warn(`[LLMApiService] Streaming not supported for ${format}, falling back to non-streaming`);
      const response = await LLMApiService.call(provider, request, options);
      onChunk(response.content, response.content);
      return response;
    }

    const strategy = new OpenAIStrategy();
    const normalizedUrl = strategy.normalizeUrl(provider.apiUrl);
    const endpoint = strategy.buildEndpoint(normalizedUrl);
    const headers = strategy.buildHeaders(provider.apiKey);

    // 构建流式请求体
    const requestBody = {
      model: provider.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      stream: true, // 启用流式
      temperature: request.temperature ?? provider.temperature,
      max_tokens: request.maxTokens ?? provider.maxTokens,
    };

    // 创建 AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw new Error("Request cancelled by user");
      }
      externalSignal.addEventListener("abort", () => controller.abort());
    }

    try {
      const response = await tauriFetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API streaming failed: ${response.status} ${response.statusText}\n${errorText}`);
      }

      // 处理 SSE 流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按行解析 SSE 数据
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留未完成的行

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === "data: [DONE]") continue;

          if (trimmedLine.startsWith("data: ")) {
            try {
              const json = JSON.parse(trimmedLine.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                onChunk(delta, fullContent);
              }
            } catch (e) {
              // 忽略解析错误，继续处理
              console.debug("[LLMApiService] Failed to parse SSE line:", trimmedLine);
            }
          }
        }
      }

      return { content: fullContent };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        if (externalSignal?.aborted) {
          throw new Error("Request cancelled by user");
        }
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
}

/**
 * 导出便利函数（向后兼容）
 */
export const normalizeOpenAIUrl = (url: string) => new OpenAIStrategy().normalizeUrl(url);
export const normalizeAnthropicUrl = (url: string) => new AnthropicStrategy().normalizeUrl(url);
export const normalizeGeminiUrl = (url: string) => new GeminiStrategy().normalizeUrl(url);

/**
 * 根据 API 格式规范化 URL（向后兼容）
 */
export function normalizeApiUrl(apiUrl: string, apiFormat?: ApiFormat): string {
  const format = apiFormat || detectApiFormat(apiUrl);
  const strategy = getApiStrategy(format);
  return strategy.normalizeUrl(apiUrl);
}

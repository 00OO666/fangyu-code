/**
 * Claude SDK Service - Direct TypeScript SDK Integration
 *
 * This service provides direct Claude API integration using the official
 * Anthropic TypeScript SDK, replacing CLI calls where appropriate.
 *
 * 对于第三方 API 代理，提供 sendMessageDirect 方法直接使用 Tauri HTTP 插件，
 * 绕过 SDK 内部的 fetch，避免 CORS 问题。
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { api } from './api';


export interface ClaudeSDKConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClaudeStreamMessage {
  type: 'message_start' | 'content_block_delta' | 'message_delta' | 'message_stop';
  message?: {
    id: string;
    type: string;
    role: string;
    content: any[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  delta?: {
    type: string;
    text?: string;
    stop_reason?: string;
    stop_sequence?: string | null;
  };
  usage?: {
    output_tokens: number;
  };
}

export interface ClaudeResponse {
  id: string;
  content: string;
  role: 'assistant';
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  stop_reason: string | null;
}

export class ClaudeSDKService {
  private client: Anthropic | null = null;
  private config: ClaudeSDKConfig;
  private isInitialized = false;

  constructor(config: ClaudeSDKConfig = {}) {
    this.config = {
      defaultModel: 'claude-3-5-sonnet-20241022',
      maxTokens: 4000,
      temperature: 0.7,
      topP: 1,
      ...config,
    };
  }

  /**
   * Initialize the SDK with current provider configuration
   */
  async initialize(): Promise<void> {
    try {
      // Get current provider configuration
      const providerConfig = await api.getCurrentProviderConfig();

      // Use API key from provider config or environment
      const apiKey = providerConfig.anthropic_api_key ||
                    providerConfig.anthropic_auth_token ||
                    this.config.apiKey;

      if (!apiKey) {
        throw new Error('No API key available. Please configure provider settings.');
      }

      // Use base URL from provider config if available
      const baseURL = providerConfig.anthropic_base_url || this.config.baseURL;

      this.client = new Anthropic({
        apiKey,
        baseURL,
        dangerouslyAllowBrowser: true, // Tauri 应用不是真正的浏览器，可以安全启用
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('[ClaudeSDK] Initialization failed:', error);
      throw new Error(`Failed to initialize Claude SDK: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure SDK is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.client) {
      await this.initialize();
    }
  }

  /**
   * Send a single message and get response (non-streaming)
   * 使用 Anthropic SDK，可能受 CORS 限制
   */
  async sendMessage(
    messages: ClaudeMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<ClaudeResponse> {
    // 优先使用直接调用方式，绕过 SDK 的 CORS 问题
    return this.sendMessageDirect(messages, options);
  }

  /**
   * 直接使用 Tauri HTTP 插件发送消息，完全绕过 Anthropic SDK
   * 这是解决第三方 API 代理 CORS 问题的可靠方案
   */
  async sendMessageDirect(
    messages: ClaudeMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<ClaudeResponse> {
    // 获取配置
    const providerConfig = await api.getCurrentProviderConfig();

    const apiKey = providerConfig.anthropic_api_key ||
                  providerConfig.anthropic_auth_token ||
                  this.config.apiKey;

    if (!apiKey) {
      throw new Error('No API key available. Please configure provider settings.');
    }

    let baseURL = providerConfig.anthropic_base_url || this.config.baseURL || 'https://api.anthropic.com';

    // 规范化 URL
    baseURL = baseURL.replace(/\/+$/, ''); // 移除末尾斜杠
    if (!baseURL.endsWith('/v1')) {
      baseURL = `${baseURL}/v1`;
    }

    const endpoint = `${baseURL}/messages`;
    const model = options.model || this.config.defaultModel!;
    const maxTokens = options.maxTokens || this.config.maxTokens!;

    // 构建请求体
    const requestBody: any = {
      model,
      max_tokens: maxTokens,
      messages: messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    };

    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    if (options.systemPrompt) {
      // 第三方 API 代理可能需要数组格式的 system 字段
      requestBody.system = [{ type: 'text', text: options.systemPrompt }];
    }
    try {
      const response = await tauriFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ClaudeSDK] API error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();

      // 解析响应
      const textContent = data.content?.find((c: any) => c.type === 'text');

      return {
        id: data.id || 'direct-response',
        content: textContent?.text || '',
        role: 'assistant',
        model: data.model || model,
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0,
          cache_creation_input_tokens: data.usage?.cache_creation_input_tokens,
          cache_read_input_tokens: data.usage?.cache_read_input_tokens,
        },
        stop_reason: data.stop_reason || null,
      };
    } catch (error) {
      console.error('[ClaudeSDK] sendMessageDirect failed:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a message with streaming response
   */
  async *sendMessageStream(
    messages: ClaudeMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      onTokenUsage?: (usage: { input_tokens: number; output_tokens: number; cache_read_tokens?: number }) => void;
    } = {}
  ): AsyncGenerator<{ type: 'content' | 'usage' | 'done'; content?: string; usage?: any; response?: ClaudeResponse }, void, unknown> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('Claude SDK not initialized');
    }

    const model = options.model || this.config.defaultModel!;
    const maxTokens = options.maxTokens || this.config.maxTokens!;

    try {
      const stream = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: options.temperature || this.config.temperature,
        top_p: this.config.topP,
        system: options.systemPrompt,
        messages: messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        stream: true,
      });

      let fullContent = '';
      let messageId = '';
      let usage: any = null;

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'message_start':
            messageId = chunk.message.id;
            usage = chunk.message.usage;
            break;

          case 'content_block_delta':
            if (chunk.delta.type === 'text_delta' && chunk.delta.text) {
              fullContent += chunk.delta.text;
              yield {
                type: 'content',
                content: chunk.delta.text,
              };
            }
            break;

          case 'message_delta':
            // 🔥 修复：正确累积增量output_tokens而不是直接覆盖
            if (chunk.usage && usage) {
              // message_delta中的output_tokens是增量值，需要累积
              if (chunk.usage.output_tokens !== undefined) {
                usage.output_tokens = (usage.output_tokens || 0) + chunk.usage.output_tokens;
              }
              
              // 合并其他usage字段（如果存在）
              if (chunk.usage.cache_read_input_tokens !== undefined) {
                usage.cache_read_input_tokens = chunk.usage.cache_read_input_tokens;
              }
              if (chunk.usage.cache_creation_input_tokens !== undefined) {
                usage.cache_creation_input_tokens = chunk.usage.cache_creation_input_tokens;
              }
            }
            break;

          case 'message_stop':
            // Report final usage
            if (usage && options.onTokenUsage) {
              options.onTokenUsage({
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                cache_read_tokens: usage.cache_read_input_tokens,
              });
            }

            yield {
              type: 'usage',
              usage,
            };

            yield {
              type: 'done',
              response: {
                id: messageId,
                content: fullContent,
                role: 'assistant',
                model,
                usage,
                stop_reason: 'stop',
              },
            };
            break;
        }
      }
    } catch (error) {
      console.error('[ClaudeSDK] Streaming failed:', error);
      throw new Error(`Failed to stream message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test connection with current configuration
   */
  async testConnection(): Promise<{ success: boolean; error?: string; model?: string }> {
    try {
      await this.ensureInitialized();

      const response = await this.sendMessage([
        { role: 'user', content: 'Hello, please respond with "Connection successful"' }
      ], {
        maxTokens: 50,
      });

      return {
        success: true,
        model: response.model,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available models (mock implementation for now)
   */
  getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
    ];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ClaudeSDKConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Force re-initialization on next use
    this.isInitialized = false;
    this.client = null;
  }

  /**
   * Check if SDK is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.client = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
export const claudeSDK = new ClaudeSDKService();

// Auto-initialize on import
claudeSDK.initialize().catch(error => {
  console.warn('[ClaudeSDK] Auto-initialization failed:', error);
});

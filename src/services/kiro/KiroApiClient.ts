/**
 * Kiro API 客户端
 * 
 * 负责与 Amazon Q Developer API 通信
 */

import { logger } from '@/lib/logger';
import { invoke } from '@tauri-apps/api/core';
import type {
  KiroChatMessage,
  KiroChatOptions,
  KiroChatResponse,
  KiroApiRequestBody,
} from './types';
import { KIRO_RETRY_CONFIG } from './types';
import { KiroApiError, isKiroApiError, maskToken } from './errors';
import { KiroTokenManager } from './KiroTokenManager';

export class KiroApiClient {
  private tokenManager: KiroTokenManager;
  private retryCount: number;
  private retryDelay: number;

  constructor(tokenManager: KiroTokenManager) {
    this.tokenManager = tokenManager;
    this.retryCount = KIRO_RETRY_CONFIG.maxRetries;
    this.retryDelay = KIRO_RETRY_CONFIG.baseDelayMs;
  }

  /**
   * 发送聊天消息
   */
  async chat(message: string, options: KiroChatOptions = {}): Promise<KiroChatResponse> {
    const {
      modelId,
      conversationId = this.generateConversationId(),
      history = [],
      onChunk,
    } = options;

    // 验证 Token
    if (!this.tokenManager.isValid()) {
      // 尝试重新加载
      try {
        await this.tokenManager.loadToken(true);
      } catch {
        throw new KiroApiError('TOKEN_EXPIRED', 'Token 已过期，请重新登录 Kiro IDE');
      }

      if (!this.tokenManager.isValid()) {
        throw new KiroApiError('TOKEN_EXPIRED', 'Token 已过期，请重新登录 Kiro IDE');
      }
    }

    // 构建请求体
    const requestBody = this.buildRequestBody(message, modelId, conversationId, history);

    // 发送请求（带重试）
    return this.sendWithRetry(requestBody, onChunk, conversationId);
  }

  /**
   * 生成会话 ID
   */
  private generateConversationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `conv-${timestamp}-${random}`;
  }

  /**
   * 构建请求体
   */
  private buildRequestBody(
    message: string,
    modelId: string | undefined,
    conversationId: string,
    history: KiroChatMessage[]
  ): KiroApiRequestBody {
    const userInputMessage: any = {
      content: message,
      origin: 'AI_EDITOR' as const,
    };

    if (modelId && modelId.trim()) {
      userInputMessage.modelId = modelId;
    }

    const body: KiroApiRequestBody = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId,
        currentMessage: { userInputMessage },
        history: history.map(msg => ({
          [msg.role === 'user' ? 'userInputMessage' : 'assistantResponseMessage']: {
            content: msg.content,
          },
        })),
      },
    };

    const profileArn = this.tokenManager.getProfileArn();
    if (profileArn) {
      body.profileArn = profileArn;
    }

    return body;
  }

  /**
   * 带重试的请求发送
   */
  private async sendWithRetry(
    body: KiroApiRequestBody,
    onChunk: ((chunk: string) => void) | undefined,
    conversationId: string
  ): Promise<KiroChatResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        return await this.sendRequest(body, onChunk, conversationId);
      } catch (error) {
        lastError = error as Error;

        // 不重试的错误
        if (isKiroApiError(error)) {
          if (!error.retryable) {
            throw error;
          }
        }

        // 429 错误使用指数退避
        if (isKiroApiError(error) && error.code === 'RATE_LIMITED') {
          const delay = Math.min(
            this.retryDelay * Math.pow(2, attempt),
            KIRO_RETRY_CONFIG.maxDelayMs
          );
          logger.debug('KiroApiClient', `[KiroApiClient] 速率限制，${delay}ms 后重试 (${attempt + 1}/${this.retryCount});`);
          await this.sleep(delay);
          continue;
        }

        // 其他错误等待后重试
        if (attempt < this.retryCount - 1) {
          logger.debug('KiroApiClient', `[KiroApiClient] 请求失败，${this.retryDelay}ms 后重试 (${attempt + 1}/${this.retryCount});`);
          await this.sleep(this.retryDelay);
        }
      }
    }

    throw lastError || new KiroApiError('UNKNOWN_ERROR', '未知错误');
  }

  /**
   * 发送请求
   */
  private async sendRequest(
    body: KiroApiRequestBody,
    onChunk: ((chunk: string) => void) | undefined,
    conversationId: string
  ): Promise<KiroChatResponse> {
    const region = this.tokenManager.getRegion();
    const endpoint = `https://q.${region}.amazonaws.com/generateAssistantResponse`;
    const accessToken = this.tokenManager.getAccessToken();

    if (!accessToken) {
      throw new KiroApiError('NO_TOKEN', 'Token 不存在');
    }

    logger.debug('KiroApiClient', '发送请求:', {
      endpoint,
      region,
      conversationId,
      tokenPreview: maskToken(accessToken),
    });

    try {
      // 通过 Tauri 后端发送请求
      const response = await invoke<string>('send_kiro_request', {
        endpoint,
        accessToken,
        body: JSON.stringify(body),
      });

      // 解析 SSE 响应
      const content = await this.parseSSEResponse(response, onChunk);

      return {
        content,
        conversationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // 解析 HTTP 错误
      const httpMatch = message.match(/HTTP (\d+):/);
      if (httpMatch) {
        const statusCode = parseInt(httpMatch[1], 10);
        throw KiroApiError.fromHttpStatus(statusCode, message);
      }

      // 网络错误
      if (message.includes('请求失败') || message.includes('网络')) {
        throw new KiroApiError('NETWORK_ERROR', message);
      }

      throw new KiroApiError('UNKNOWN_ERROR', message);
    }
  }

  /**
   * 解析 SSE 响应
   */
  private async parseSSEResponse(
    response: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      // 使用 Tauri 后端解析
      const content = await invoke<string>('parse_kiro_sse_response', { response });

      if (onChunk && content) {
        onChunk(content);
      }

      return content;
    } catch (error) {
      // 回退到前端解析
      return this.parseSSEResponseFallback(response, onChunk);
    }
  }

  /**
   * 前端 SSE 解析（回退方案）
   */
  private parseSSEResponseFallback(
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

    return contents.join('');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

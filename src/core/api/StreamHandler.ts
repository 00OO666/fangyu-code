/**
 * StreamHandler - 流式响应处理器
 * 
 * 处理 SSE (Server-Sent Events) 流式响应
 * 支持实时输出和响应合并
 * 
 * Requirements: 1.4
 */

import { ChatCompletionResponse, StreamChunk } from './RealAPIClient';

// =============================================================================
// 类型定义
// =============================================================================

/** 流处理回调 */
export interface StreamCallbacks {
  onChunk?: (content: string) => void;
  onComplete?: (response: ChatCompletionResponse) => void;
  onError?: (error: Error) => void;
}

/** 流处理选项 */
export interface StreamOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/** 流状态 */
export type StreamState = 'idle' | 'streaming' | 'completed' | 'error' | 'aborted';

// =============================================================================
// StreamHandler 类
// =============================================================================

export class StreamHandler {
  private state: StreamState = 'idle';
  private chunks: StreamChunk[] = [];
  private content: string = '';
  private abortController: AbortController | null = null;

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 处理 SSE 流
   * Requirements: 1.4
   */
  async *processStream(
    response: Response,
    options?: StreamOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.state = 'streaming';
    this.chunks = [];
    this.content = '';

    const reader = response.body?.getReader();
    if (!reader) {
      this.state = 'error';
      throw new Error('No response body available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        // 检查是否被中止
        if (options?.signal?.aborted) {
          this.state = 'aborted';
          reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        
        if (done) {
          // 处理剩余的 buffer
          if (buffer.trim()) {
            const chunk = this.parseSSELine(buffer);
            if (chunk) {
              this.chunks.push(chunk);
              yield chunk;
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // 按行分割处理
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // 保留最后一个不完整的行

        for (const line of lines) {
          const chunk = this.parseSSELine(line);
          if (chunk) {
            this.chunks.push(chunk);
            this.content += chunk.choices[0]?.delta?.content ?? '';
            yield chunk;
          }
        }
      }

      this.state = 'completed';
    } catch (error) {
      this.state = 'error';
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 处理流并收集所有内容
   */
  async collectStream(
    response: Response,
    callbacks?: StreamCallbacks,
    options?: StreamOptions
  ): Promise<ChatCompletionResponse> {
    try {
      for await (const chunk of this.processStream(response, options)) {
        const content = chunk.choices[0]?.delta?.content;
        if (content && callbacks?.onChunk) {
          callbacks.onChunk(content);
        }
      }

      const result = this.mergeChunks();
      callbacks?.onComplete?.(result);
      return result;
    } catch (error) {
      callbacks?.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 合并所有流式响应块
   * Requirements: 1.4
   */
  mergeChunks(chunks?: StreamChunk[]): ChatCompletionResponse {
    const chunksToMerge = chunks ?? this.chunks;
    
    if (chunksToMerge.length === 0) {
      return this.createEmptyResponse();
    }

    const firstChunk = chunksToMerge[0];
    let mergedContent = '';
    let finishReason: 'stop' | 'length' | 'content_filter' | null = null;

    for (const chunk of chunksToMerge) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        mergedContent += delta.content;
      }
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    return {
      id: firstChunk.id,
      object: 'chat.completion',
      created: firstChunk.created,
      model: firstChunk.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: mergedContent,
        },
        finish_reason: finishReason,
      }],
      usage: {
        prompt_tokens: 0, // 流式响应通常不包含 usage
        completion_tokens: this.estimateTokens(mergedContent),
        total_tokens: this.estimateTokens(mergedContent),
      },
    };
  }

  /**
   * 获取当前状态
   */
  getState(): StreamState {
    return this.state;
  }

  /**
   * 获取已收集的内容
   */
  getContent(): string {
    return this.content;
  }

  /**
   * 获取已收集的块
   */
  getChunks(): StreamChunk[] {
    return [...this.chunks];
  }

  /**
   * 中止流处理
   */
  abort(): void {
    this.abortController?.abort();
    this.state = 'aborted';
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = 'idle';
    this.chunks = [];
    this.content = '';
    this.abortController = null;
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 解析 SSE 行
   */
  private parseSSELine(line: string): StreamChunk | null {
    const trimmed = line.trim();
    
    if (!trimmed || !trimmed.startsWith('data: ')) {
      return null;
    }

    const data = trimmed.slice(6).trim();
    
    if (data === '[DONE]') {
      return null;
    }

    try {
      return JSON.parse(data) as StreamChunk;
    } catch {
      return null;
    }
  }

  /**
   * 创建空响应
   */
  private createEmptyResponse(): ChatCompletionResponse {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'unknown',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: '',
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  /**
   * 估算 token 数量（简单估算）
   */
  private estimateTokens(text: string): number {
    // 简单估算：平均每 4 个字符约 1 个 token
    return Math.ceil(text.length / 4);
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建流处理器
 */
export function createStreamHandler(): StreamHandler {
  return new StreamHandler();
}

/**
 * 从 Response 读取流式内容
 */
export async function readStreamContent(
  response: Response,
  onChunk?: (content: string) => void
): Promise<string> {
  const handler = new StreamHandler();
  const result = await handler.collectStream(response, { onChunk });
  return result.choices[0]?.message?.content ?? '';
}

/**
 * 检查响应是否为流式
 */
export function isStreamResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('text/event-stream') || 
         contentType.includes('application/x-ndjson');
}

export default StreamHandler;

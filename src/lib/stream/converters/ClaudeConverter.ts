/**
 * Claude 消息转换器
 *
 * 处理 Claude CLI 输出的 JSONL 消息
 */

import type { ClaudeStreamMessage } from '@/types/claude';
import type { MessageConverter, EngineType } from './types';

/**
 * Claude 消息转换器
 */
export class ClaudeConverter implements MessageConverter {
  readonly engine: EngineType = 'claude';

  /**
   * 检查是否可以处理该消息
   * Claude 消息通常有 type 字段，但没有 Codex/Gemini 特有的字段
   */
  canHandle(msg: unknown): boolean {
    if (!msg || typeof msg !== 'object') return false;

    const obj = msg as Record<string, unknown>;

    // 有 type 字段
    if (!obj.type) return false;

    // 排除 Codex 特有消息
    if (obj.type === 'thread.started' || obj.type === 'turn.started' ||
        obj.type === 'turn.completed' || obj.type === 'item.started' ||
        obj.type === 'item.updated' || obj.type === 'item.completed' ||
        obj.type === 'response_item' || obj.type === 'event_msg' ||
        obj.type === 'session_meta') {
      return false;
    }

    // 排除 Gemini 特有消息
    if (obj.geminiMetadata || obj.engine === 'gemini') {
      return false;
    }

    return true;
  }

  /**
   * 转换消息
   */
  convert(msg: unknown): ClaudeStreamMessage | null {
    if (!this.canHandle(msg)) return null;

    const obj = msg as ClaudeStreamMessage;

    // 添加引擎标识
    return {
      ...obj,
      engine: 'claude' as const,
      timestamp: obj.timestamp || new Date().toISOString(),
      receivedAt: obj.receivedAt || new Date().toISOString(),
    };
  }

  /**
   * 转换 JSONL 行
   */
  convertLine(line: string): ClaudeStreamMessage | null {
    try {
      const parsed = JSON.parse(line);
      return this.convert(parsed);
    } catch (error) {
      console.error('[ClaudeConverter] Failed to parse line:', line, error);
      return null;
    }
  }

  /**
   * 重置状态
   */
  reset(): void {
    // Claude 转换器无状态，无需重置
  }
}

/**
 * 单例实例
 */
export const claudeConverter = new ClaudeConverter();

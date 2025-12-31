/**
 * Converter 注册中心
 *
 * 统一管理所有引擎的消息转换器
 * 支持自动检测消息类型并路由到对应的转换器
 */

import type { ClaudeStreamMessage } from '@/types/claude';
import type { MessageConverter, EngineType, ConvertResult } from './types';
import { ClaudeConverter } from './ClaudeConverter';
import { CodexEventConverter } from '@/lib/codexConverter';

/**
 * 转换器注册中心
 */
class ConverterRegistry {
  private converters: Map<EngineType, MessageConverter> = new Map();
  private defaultEngine: EngineType = 'claude';

  constructor() {
    // 注册默认转换器
    this.register(new ClaudeConverter());
    // Codex 转换器使用现有的包装
    this.register(new CodexConverterWrapper());
  }

  /**
   * 注册转换器
   */
  register(converter: MessageConverter): void {
    this.converters.set(converter.engine, converter);
  }

  /**
   * 获取指定引擎的转换器
   */
  get(engine: EngineType): MessageConverter | undefined {
    return this.converters.get(engine);
  }

  /**
   * 设置默认引擎
   */
  setDefaultEngine(engine: EngineType): void {
    this.defaultEngine = engine;
  }

  /**
   * 自动检测并转换消息
   */
  convert(msg: unknown, preferredEngine?: EngineType): ConvertResult {
    // 如果指定了引擎，优先使用
    if (preferredEngine) {
      const converter = this.converters.get(preferredEngine);
      if (converter && converter.canHandle(msg)) {
        const message = converter.convert(msg);
        return {
          message,
          engine: preferredEngine,
          skipped: message === null,
        };
      }
    }

    // 尝试所有转换器
    for (const [engine, converter] of this.converters) {
      if (converter.canHandle(msg)) {
        const message = converter.convert(msg);
        return {
          message,
          engine,
          skipped: message === null,
        };
      }
    }

    // 使用默认转换器
    const defaultConverter = this.converters.get(this.defaultEngine);
    if (defaultConverter) {
      const message = defaultConverter.convert(msg);
      return {
        message,
        engine: this.defaultEngine,
        skipped: message === null,
      };
    }

    return {
      message: null,
      engine: this.defaultEngine,
      skipped: true,
      error: 'No suitable converter found',
    };
  }

  /**
   * 转换 JSONL 行
   */
  convertLine(line: string, engine?: EngineType): ConvertResult {
    try {
      const parsed = JSON.parse(line);
      return this.convert(parsed, engine);
    } catch (error) {
      return {
        message: null,
        engine: engine || this.defaultEngine,
        skipped: true,
        error: `Failed to parse JSON: ${error}`,
      };
    }
  }

  /**
   * 批量转换消息
   */
  convertAll(messages: unknown[], engine?: EngineType): ClaudeStreamMessage[] {
    const results: ClaudeStreamMessage[] = [];

    for (const msg of messages) {
      const result = this.convert(msg, engine);
      if (result.message && !result.skipped) {
        results.push(result.message);
      }
    }

    return results;
  }

  /**
   * 重置所有转换器状态
   */
  resetAll(): void {
    for (const converter of this.converters.values()) {
      converter.reset();
    }
  }

  /**
   * 重置指定引擎的转换器
   */
  reset(engine: EngineType): void {
    const converter = this.converters.get(engine);
    converter?.reset();
  }
}

/**
 * Codex 转换器包装
 * 包装现有的 CodexEventConverter 以符合 MessageConverter 接口
 */
class CodexConverterWrapper implements MessageConverter {
  readonly engine: EngineType = 'codex';
  private converter = new CodexEventConverter();

  canHandle(msg: unknown): boolean {
    if (!msg || typeof msg !== 'object') return false;

    const obj = msg as Record<string, unknown>;
    const type = obj.type as string;

    // Codex 特有的事件类型
    const codexTypes = [
      'thread.started', 'turn.started', 'turn.completed', 'turn.failed',
      'item.started', 'item.updated', 'item.completed',
      'response_item', 'event_msg', 'session_meta', 'turn_context',
      'thread_token_usage_updated', 'error',
    ];

    return codexTypes.includes(type);
  }

  convert(msg: unknown): ClaudeStreamMessage | null {
    return this.converter.convertEventObject(msg as any);
  }

  convertLine(line: string): ClaudeStreamMessage | null {
    return this.converter.convertEvent(line);
  }

  reset(): void {
    this.converter.reset();
  }

  /**
   * 获取底层的 Codex 转换器（用于访问特殊方法）
   */
  getUnderlyingConverter(): CodexEventConverter {
    return this.converter;
  }
}

/**
 * 单例导出
 */
export const converterRegistry = new ConverterRegistry();

/**
 * 便捷函数：转换单条消息
 */
export function convertMessage(msg: unknown, engine?: EngineType): ClaudeStreamMessage | null {
  const result = converterRegistry.convert(msg, engine);
  return result.message;
}

/**
 * 便捷函数：转换 JSONL 行
 */
export function convertLine(line: string, engine?: EngineType): ClaudeStreamMessage | null {
  const result = converterRegistry.convertLine(line, engine);
  return result.message;
}

/**
 * 便捷函数：批量转换
 */
export function convertMessages(messages: unknown[], engine?: EngineType): ClaudeStreamMessage[] {
  return converterRegistry.convertAll(messages, engine);
}

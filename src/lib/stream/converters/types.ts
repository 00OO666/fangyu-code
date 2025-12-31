/**
 * Converter 类型定义
 *
 * 统一的消息转换器接口，支持多引擎（Claude、Codex、Gemini）
 */

import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * 引擎类型
 */
export type EngineType = 'claude' | 'codex' | 'gemini';

/**
 * 消息转换器接口
 */
export interface MessageConverter {
  /**
   * 引擎标识
   */
  readonly engine: EngineType;

  /**
   * 检查是否可以处理该消息
   */
  canHandle(msg: unknown): boolean;

  /**
   * 转换消息为统一格式
   */
  convert(msg: unknown): ClaudeStreamMessage | null;

  /**
   * 转换 JSONL 字符串
   */
  convertLine?(line: string): ClaudeStreamMessage | null;

  /**
   * 重置转换器状态（用于新会话）
   */
  reset(): void;
}

/**
 * 转换器配置
 */
export interface ConverterConfig {
  /**
   * 默认模型（用于费用计算）
   */
  defaultModel?: string;

  /**
   * 是否启用调试日志
   */
  debug?: boolean;
}

/**
 * 转换结果
 */
export interface ConvertResult {
  /**
   * 转换后的消息
   */
  message: ClaudeStreamMessage | null;

  /**
   * 使用的转换器引擎
   */
  engine: EngineType;

  /**
   * 是否跳过（例如：元数据消息）
   */
  skipped: boolean;

  /**
   * 错误信息
   */
  error?: string;
}

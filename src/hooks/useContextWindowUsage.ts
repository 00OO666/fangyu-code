/**
 * 上下文窗口使用情况计算 Hook
 *
 * 支持多引擎（Claude/Codex）的上下文窗口使用计算
 *
 * Claude Code v2.0.64 的 current_usage 功能：
 * - input_tokens: 当前上下文中的输入 tokens
 * - cache_creation_input_tokens: 写入缓存的 tokens
 * - cache_read_input_tokens: 从缓存读取的 tokens
 *
 * Codex 的 usage 功能（从 turn.completed 事件获取）：
 * - input_tokens: 输入 tokens
 * - cached_input_tokens: 缓存的输入 tokens
 * - output_tokens: 输出 tokens
 *
 * 计算公式：
 * CURRENT_TOKENS = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
 * PERCENT_USED = CURRENT_TOKENS * 100 / CONTEXT_SIZE
 */

import { useMemo } from 'react';
import { getContextWindowSize } from '@/lib/tokenCounter';
import { normalizeUsageData } from '@/lib/utils';
import { ContextWindowUsage, ContextUsageLevel, getUsageLevel } from '@/types/contextWindow';
import type { ClaudeStreamMessage } from '@/types/claude';

export interface UseContextWindowUsageResult extends ContextWindowUsage {
  /** 使用级别 */
  level: ContextUsageLevel;
  /** 是否有有效数据 */
  hasData: boolean;
  /** 格式化的百分比字符串 */
  formattedPercentage: string;
  /** 格式化的 token 使用字符串 */
  formattedTokens: string;
}

/**
 * 从消息中提取 current_usage 数据
 * 查找最后一条带有 usage 信息的消息
 *
 * 支持多引擎的 usage 格式：
 * - Claude: message.usage / message.message.usage
 * - Codex: turn.completed 事件的 usage（input_tokens, cached_input_tokens, output_tokens）
 *
 * 注意：这里的 usage 代表当前 API 调用的上下文使用情况（快照），
 * 而不是单条消息的增量 token 数。
 */
function getUsageCandidate(message: any, engine?: string): any | null {
  // Codex: 过滤掉累计 usage 事件（会远超上下文窗口大小，不能用于 Context Window）
  if (engine === 'codex') {
    const codexItemType = message?.codexMetadata?.codexItemType;
    if (codexItemType === 'thread_token_usage_updated') {
      return null;
    }
  }

  // Claude: 过滤掉会话结束时的累计统计消息
  // 这类 result 消息包含 total_cost_usd/duration_ms/num_turns 等字段，
  // 其 usage 是"会话累计"口径，不能用作 Context Window 快照
  if (engine === 'claude' && message?.type === 'result') {
    const hasCumulativeStats =
      typeof message.total_cost_usd === 'number' ||
      typeof message.cost_usd === 'number' ||
      typeof message.duration_ms === 'number' ||
      typeof message.num_turns === 'number';
    if (hasCumulativeStats) {
      return null;
    }
  }

  // Claude Code statusline / hooks may provide a context_window.current_usage snapshot
  const currentUsage = message?.context_window?.current_usage;
  if (currentUsage && typeof currentUsage === 'object') return currentUsage;

  // Prefer nested message.usage for Claude (runtime may attach non-snapshot usage on top-level)
  const usage = message.message?.usage || message.usage;
  if (usage && typeof usage === 'object') return usage;

  // Codex: fallback to codexMetadata.usage (when available)
  // 注意：token_count 的 codexMetadata.usage 通常是累计 total，不能用于上下文窗口；其 delta 在 message.usage 中。
  if (engine === 'codex') {
    const codexItemType = message?.codexMetadata?.codexItemType;
    if (codexItemType === 'token_count') {
      return null;
    }
    if (message.codexMetadata?.usage && typeof message.codexMetadata.usage === 'object') {
      return message.codexMetadata.usage;
    }
  }

  return null;
}

function normalizeUsageForIndicator(rawUsage: any): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
} {
  const normalized = normalizeUsageData(rawUsage);
  return {
    inputTokens: normalized.input_tokens || 0,
    outputTokens: normalized.output_tokens || 0,
    cacheCreationTokens: normalized.cache_creation_tokens || 0,
    cacheReadTokens: normalized.cache_read_tokens || 0,
  };
}

function extractCurrentUsage(messages: ClaudeStreamMessage[], engine?: string, contextWindowSize?: number): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
} | null {
  const isPlausibleSnapshot = (maybeCurrent: number): boolean => {
    if (maybeCurrent <= 0) return false;
    if (typeof contextWindowSize !== 'number' || contextWindowSize <= 0) return true;

    // Codex runtime 事件里可能带“累计 total”，严格过滤；Claude/Gemini 稍微放宽以容忍未知/不完整的窗口配置
    const overflowMultiplier = engine === 'codex' ? 1.1 : 2;
    return maybeCurrent <= contextWindowSize * overflowMultiplier;
  };

  const scan = (shouldConsider: (msg: ClaudeStreamMessage) => boolean): {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  } | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i] as any;
      if (!shouldConsider(message)) continue;

      const usage = getUsageCandidate(message, engine);
      if (!usage) continue;

      const normalized = normalizeUsageForIndicator(usage);
      // Context Window 只关心“输入 + 缓存”所占用的窗口大小；输出 tokens 不占用上下文窗口。
      // 某些流式/增量消息可能只携带 output_tokens（或其他非快照字段），此时不应作为 Context Window 的数据源。
      const maybeCurrent = normalized.inputTokens + normalized.cacheCreationTokens + normalized.cacheReadTokens;
      if (!isPlausibleSnapshot(maybeCurrent)) continue;
      return normalized;
    }
    return null;
  };

  // 优先使用显式 current_usage（语义最明确）
  const fromExplicitCurrentUsage = scan((m) => Boolean((m as any)?.context_window?.current_usage));
  if (fromExplicitCurrentUsage) return fromExplicitCurrentUsage;

  // Claude: 优先从 assistant/result 中提取，避免实时流中混入“累计/会话级”usage 的 system 消息污染统计
  if (engine === 'claude') {
    const fromClaudeMainFlow = scan((m) => {
      const t = (m as any)?.type;
      return t === 'assistant' || t === 'result';
    });
    if (fromClaudeMainFlow) return fromClaudeMainFlow;
  }

  // Gemini: usage 快照通常挂在 result 消息上
  if (engine === 'gemini') {
    const fromGeminiResult = scan((m) => (m as any)?.type === 'result');
    if (fromGeminiResult) return fromGeminiResult;
  }

  return scan(() => true);
}

/**
 * 计算上下文窗口使用情况
 *
 * @param messages - 会话消息列表
 * @param model - 当前使用的模型名称
 * @param engine - 引擎类型（claude/codex/gemini）
 * @returns 上下文窗口使用情况
 *
 * @example
 * const { percentage, level, formattedPercentage } = useContextWindowUsage(messages, 'sonnet', 'claude');
 * // percentage: 42.5
 * // level: 'low'
 * // formattedPercentage: '42.5%'
 *
 * @example
 * // Codex 引擎
 * const { percentage, level } = useContextWindowUsage(messages, 'codex-mini', 'codex');
 */
export function useContextWindowUsage(
  messages: ClaudeStreamMessage[],
  model?: string,
  engine?: string
): UseContextWindowUsageResult {
  return useMemo(() => {
    // 获取上下文窗口大小（根据引擎和模型）
    let contextWindowSize = getContextWindowSize(model, engine);

    // Codex: prefer runtime-reported context window when available (token_count events)
    if (engine === 'codex') {
      for (let i = messages.length - 1; i >= 0; i--) {
        const maybeCtx = (messages[i] as any)?.codexMetadata?.modelContextWindow;
        // 仅在运行时值更大时采用，避免把“可用窗口/阈值”之类的较小值误当作模型总窗口
        if (typeof maybeCtx === 'number' && maybeCtx > contextWindowSize) {
          contextWindowSize = maybeCtx;
          break;
        }
      }
    }

    // Claude/Gemini: prefer runtime-reported context window when available (statusline/hook payloads)
    if (engine === 'claude' || engine === 'gemini') {
      for (let i = messages.length - 1; i >= 0; i--) {
        const maybeCtx =
          (messages[i] as any)?.context_window?.context_window_size ??
          (messages[i] as any)?.context_window_size;

        if (typeof maybeCtx === 'number' && maybeCtx > contextWindowSize) {
          contextWindowSize = maybeCtx;
          break;
        }
      }
    }

    // 默认返回值
    const defaultResult: UseContextWindowUsageResult = {
      currentTokens: 0,
      contextWindowSize,
      percentage: 0,
      breakdown: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
      level: 'low' as ContextUsageLevel,
      hasData: false,
      formattedPercentage: '0%',
      formattedTokens: `0 / ${formatK(contextWindowSize)}`,
    };

    // 如果没有消息，返回默认值
    if (!messages || messages.length === 0) {
      return defaultResult;
    }

    // 注意：这里的 usage 代表当前使用量快照（最后一条可用 usage），而不是增量累加。
    const currentUsage = extractCurrentUsage(messages, engine, contextWindowSize);

    if (!currentUsage) {
      return defaultResult;
    }

    // 根据官方公式计算当前使用量
    // CURRENT_TOKENS = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
    // 注意：不包括 output_tokens，因为输出不占用上下文窗口（它是生成的）
    const currentTokens =
      currentUsage.inputTokens +
      currentUsage.cacheCreationTokens +
      currentUsage.cacheReadTokens;

    // 计算百分比
    const percentage = contextWindowSize > 0
      ? Math.min((currentTokens / contextWindowSize) * 100, 100)
      : 0;

    // 获取使用级别
    const level = getUsageLevel(percentage);

    // 格式化显示
    const formattedPercentage = `${percentage.toFixed(1)}%`;
    const formattedTokens = `${formatK(currentTokens)} / ${formatK(contextWindowSize)}`;

    return {
      currentTokens,
      contextWindowSize,
      percentage,
      breakdown: {
        inputTokens: currentUsage.inputTokens,
        outputTokens: currentUsage.outputTokens,
        cacheCreationTokens: currentUsage.cacheCreationTokens,
        cacheReadTokens: currentUsage.cacheReadTokens,
      },
      level,
      hasData: true,
      formattedPercentage,
      formattedTokens,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, messages.length, model, engine]);
}

/**
 * 格式化数字为 K/M 形式
 */
function formatK(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return n.toString();
}

export default useContextWindowUsage;

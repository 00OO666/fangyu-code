/**
 * 会话成本计算 Hook
 *
 * 优化：支持多模型定价，符合官方 Claude Code 规范
 * 参考：https://docs.claude.com/en/docs/claude-code/costs
 */

import { useEffect, useMemo, useRef } from "react";
import { formatCost as formatCostUtil, formatDuration, formatTokensK } from "@/lib/pricing";
import { aggregateSessionCost } from "@/lib/sessionCost";
import type { ClaudeStreamMessage } from "@/types/claude";

export interface SessionCostStats {
  /** 总成本（美元） */
  totalCost: number;
  /** 总 tokens */
  totalTokens: number;
  /** 输入 tokens */
  inputTokens: number;
  /** 输出 tokens */
  outputTokens: number;
  /** Cache 读取 tokens */
  cacheReadTokens: number;
  /** Cache 写入 tokens */
  cacheWriteTokens: number;
  /** 会话时长（秒） - wall time */
  durationSeconds: number;
  /** API 执行时长（秒） - 累计所有 API 调用时间 */
  apiDurationSeconds: number;
}

/** 增量统计（本次指令消耗） */
export interface SessionCostDelta {
  /** 增加的 tokens */
  deltaTokens: number;
  /** 增加的成本 */
  deltaCost: number;
}

interface SessionCostResult {
  /** 成本统计 */
  stats: SessionCostStats;
  /** 增量统计（最后一条指令的消耗） */
  delta: SessionCostDelta | null;
  /** 格式化成本字符串 */
  formatCost: (amount: number) => string;
  /** 格式化时长字符串 */
  formatDuration: (seconds: number) => string;
  /** 格式化 token 数量为 k 单位 */
  formatTokensK: (tokens: number) => string;
}

const EMPTY_STATS: SessionCostStats = {
  totalCost: 0,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  durationSeconds: 0,
  apiDurationSeconds: 0,
};

/**
 * 计算会话的 Token 成本和统计
 *
 * @param messages - 会话消息列表
 * @param engine - 执行引擎（claude/codex/gemini）
 * @returns 成本统计对象
 *
 * @example
 * const { stats, formatCost } = useSessionCostCalculation(messages, 'claude');
 * console.log(formatCost(stats.totalCost)); // "$0.0123"
 */
export function useSessionCostCalculation(
  messages: ClaudeStreamMessage[],
  engine?: string,
): SessionCostResult {
  const codexCacheRef = useRef<{
    stats: SessionCostStats;
    lastUsageFingerprint: string | null;
    lastMessageCount: number;
  }>({
    stats: EMPTY_STATS,
    lastUsageFingerprint: null,
    lastMessageCount: 0,
  });

  // 用于增量计算的上一次统计
  const prevStatsRef = useRef<SessionCostStats | null>(null);

  // 计算总成本和统计
  const stats = useMemo(() => {
    // Codex 会话在流式过程中会产生大量 item.updated 等事件，但只有 turn.completed 才带 usage。
    // 为避免每条事件都 O(n) 重算费用，Codex 仅在检测到新的 usage 时才重新聚合。
    if (engine === "codex") {
      const cache = codexCacheRef.current;

      if (messages.length === 0) {
        cache.stats = EMPTY_STATS;
        cache.lastUsageFingerprint = null;
        cache.lastMessageCount = 0;
        return cache.stats;
      }

      // 会话切换/重置：长度回退则清空缓存
      if (messages.length < cache.lastMessageCount) {
        cache.stats = EMPTY_STATS;
        cache.lastUsageFingerprint = null;
        cache.lastMessageCount = 0;
      }

      const last = messages[messages.length - 1] as any;
      const usage = extractUsageCandidate(last);

      // 末尾没有 usage -> 费用不可能变化，直接复用缓存
      if (!usage) {
        cache.lastMessageCount = messages.length;
        return cache.stats;
      }

      const fingerprint = buildUsageFingerprint(last, usage, messages.length);
      if (fingerprint === cache.lastUsageFingerprint) {
        cache.lastMessageCount = messages.length;
        return cache.stats;
      }

      const { totals, events, firstEventTimestampMs, lastEventTimestampMs } =
        aggregateSessionCost(messages);
      const durationSeconds = calculateSessionDuration(
        messages,
        firstEventTimestampMs,
        lastEventTimestampMs,
      );
      const apiDurationSeconds = events.length * 5;

      const nextStats: SessionCostStats = {
        totalCost: totals.totalCost,
        totalTokens: totals.totalTokens,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        cacheReadTokens: totals.cacheReadTokens,
        cacheWriteTokens: totals.cacheWriteTokens,
        durationSeconds,
        apiDurationSeconds,
      };

      cache.stats = nextStats;
      cache.lastUsageFingerprint = fingerprint;
      cache.lastMessageCount = messages.length;
      return nextStats;
    }

    if (messages.length === 0) {
      return EMPTY_STATS;
    }

    const { totals, events, firstEventTimestampMs, lastEventTimestampMs } =
      aggregateSessionCost(messages);

    const durationSeconds = calculateSessionDuration(
      messages,
      firstEventTimestampMs,
      lastEventTimestampMs,
    );

    // 计算 API 执行时长（TODO: 需要从消息中提取实际 API 响应时间）
    // 目前使用简化估算：每条唯一 assistant 消息平均 2-10 秒
    const apiDurationSeconds = events.length * 5; // 粗略估算

    return {
      totalCost: totals.totalCost,
      totalTokens: totals.totalTokens,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens,
      durationSeconds,
      apiDurationSeconds,
    };
  }, [messages, engine]);

  // 计算增量（本次指令消耗）
  const delta = useMemo<SessionCostDelta | null>(() => {
    if (!prevStatsRef.current || messages.length === 0) {
      return null;
    }

    const deltaTokens = stats.totalTokens - prevStatsRef.current.totalTokens;
    const deltaCost = stats.totalCost - prevStatsRef.current.totalCost;

    // 只有有实际增量时才返回
    if (deltaTokens > 0 || deltaCost > 0) {
      return { deltaTokens, deltaCost };
    }

    return null;
  }, [stats]);

  // 更新上一次统计
  useEffect(() => {
    prevStatsRef.current = stats;
  }, [stats]);

  return {
    stats,
    delta,
    formatCost: formatCostUtil,
    formatDuration,
    formatTokensK,
  };
}

function calculateSessionDuration(
  messages: ClaudeStreamMessage[],
  fallbackFirstEventMs?: number,
  fallbackLastEventMs?: number,
): number {
  // 绝大多数情况下 messages 是按时间顺序追加的；优先从两端取时间戳，避免 O(n) 扫描。
  const first = findTimestampMsFromStart(messages);
  const last = findTimestampMsFromEnd(messages);
  if (typeof first === "number" && typeof last === "number" && last >= first) {
    return (last - first) / 1000;
  }

  if (
    typeof fallbackFirstEventMs === "number" &&
    typeof fallbackLastEventMs === "number" &&
    fallbackLastEventMs >= fallbackFirstEventMs
  ) {
    return (fallbackLastEventMs - fallbackFirstEventMs) / 1000;
  }

  return 0;
}

function findTimestampMsFromStart(
  messages: ClaudeStreamMessage[],
  maxScan = 25,
): number | undefined {
  for (let i = 0; i < Math.min(messages.length, maxScan); i++) {
    const ts = extractTimestampMs(messages[i]);
    if (typeof ts === "number") return ts;
  }
  return undefined;
}

function findTimestampMsFromEnd(messages: ClaudeStreamMessage[], maxScan = 25): number | undefined {
  for (let i = messages.length - 1; i >= 0 && i >= messages.length - maxScan; i--) {
    const ts = extractTimestampMs(messages[i]);
    if (typeof ts === "number") return ts;
  }
  return undefined;
}

function extractTimestampMs(message: ClaudeStreamMessage): number | undefined {
  const candidates = [
    (message as any).timestamp,
    (message as any).receivedAt,
    (message as any).sentAt,
    (message as any)?.message?.timestamp,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.trim() === "") {
      continue;
    }

    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function extractUsageCandidate(message: any): any | null {
  const usage = message?.usage || message?.message?.usage || message?.codexMetadata?.usage;
  return usage && typeof usage === "object" ? usage : null;
}

function buildUsageFingerprint(message: any, usage: any, messageCount: number): string {
  const timestamp =
    typeof message?.timestamp === "string"
      ? message.timestamp
      : typeof message?.receivedAt === "string"
        ? message.receivedAt
        : "";

  // 仅提取稳定字段，避免把大对象 stringify 进指纹导致性能抖动
  const input = Number(usage?.input_tokens) || 0;
  const output = Number(usage?.output_tokens) || 0;
  const cachedInput = Number(usage?.cached_input_tokens) || 0;
  const cacheRead = Number(usage?.cache_read_tokens) || 0;
  const cacheWrite = Number(usage?.cache_creation_tokens) || Number(usage?.cache_write_tokens) || 0;

  const model = typeof message?.model === "string" ? message.model : "";
  const engine = typeof message?.engine === "string" ? message.engine : "";

  return [
    messageCount,
    timestamp,
    engine,
    model,
    input,
    cachedInput || cacheRead,
    cacheWrite,
    output,
  ].join("|");
}

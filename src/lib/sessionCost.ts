import { calculateMessageCost } from "@/lib/pricing";
import { type StandardizedTokenUsage, tokenExtractor } from "@/lib/tokenExtractor";
import type { ClaudeStreamMessage } from "@/types/claude";

export interface BillingEvent {
  key: string;
  tokens: StandardizedTokenUsage;
  model: string;
  cost: number;
  timestamp?: string;
  timestampMs?: number;
  message: ClaudeStreamMessage;
}

export interface SessionCostTotals {
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface SessionCostAggregation {
  totals: SessionCostTotals;
  events: BillingEvent[];
  assistantMessageCount: number;
  firstEventTimestampMs?: number;
  lastEventTimestampMs?: number;
}

interface MutableBillingEvent extends BillingEvent {
  totalTokenCount: number;
  order: number;
}

const MODEL_FALLBACK = "claude-sonnet-4.5";
const CODEX_MODEL_FALLBACK = "codex-mini-latest";
const GEMINI_MODEL_FALLBACK = "gemini-2.5-pro";

/**
 * 检测消息的引擎类型
 */
function getEngineType(message: ClaudeStreamMessage): string {
  // 检查消息上的 engine 字段
  const engine = (message as any).engine;
  if (engine) return engine;

  // 检查 codexMetadata 字段（Codex 特有）
  if ((message as any).codexMetadata) return "codex";

  // 检查 geminiMetadata 字段（Gemini 特有）
  if ((message as any).geminiMetadata?.provider === "gemini") return "gemini";

  // 默认为 Claude
  return "claude";
}

export function aggregateSessionCost(messages: ClaudeStreamMessage[]): SessionCostAggregation {
  const eventMap = new Map<string, MutableBillingEvent>();

  // 🔧 FIX: 去重消息数组（根据 message ID）
  // 问题：messages 数组中存在大量重复消息，导致重复计费和性能问题
  // 解决：使用 Map 去重，保留每个 ID 的最后一个版本（最新、最完整）
  const deduplicatedMessages: ClaudeStreamMessage[] = [];
  const seenIds = new Map<string, number>(); // id -> index in deduplicatedMessages

  for (const msg of messages) {
    const id = (msg as any)?.message?.id || (msg as any).id || (msg as any).uuid;

    if (id) {
      const existingIndex = seenIds.get(id);
      if (existingIndex !== undefined) {
        // 替换为最新版本（后面的消息通常更完整）
        deduplicatedMessages[existingIndex] = msg;
      } else {
        seenIds.set(id, deduplicatedMessages.length);
        deduplicatedMessages.push(msg);
      }
    } else {
      // 没有 ID 的消息直接添加（可能是临时消息）
      deduplicatedMessages.push(msg);
    }
  }

  // 🔧 DEBUG: 报告去重结果
  const duplicateCount = messages.length - deduplicatedMessages.length;
  if (duplicateCount > 0) {
    console.warn(`[SessionCost] 🔧 去重: 原始 ${messages.length} 条 → 去重后 ${deduplicatedMessages.length} 条 (移除 ${duplicateCount} 条重复)`);
  }

  // 使用去重后的消息进行后续处理
  messages = deduplicatedMessages;

  // 🔧 DEBUG: 添加详细日志来诊断重复计费问题
  console.log('[SessionCost] 🔍 开始计算会话费用...');
  console.log(`[SessionCost] 总消息数: ${messages.length}`);

  // 🔧 FIX: 从 system:init 消息中提取会话级别的默认模型
  let sessionDefaultModel: string | undefined;
  for (const msg of messages) {
    if ((msg as any).type === "system" && (msg as any).subtype === "init") {
      sessionDefaultModel = (msg as any).model;
      if (sessionDefaultModel) break;
    }
  }

  messages.forEach((message, index) => {
    const engine = getEngineType(message);

    // Claude: 只处理 assistant 消息
    // Codex: 只处理 token_count/turn.completed 等 system usage 消息（增量 usage）
    // Gemini: 只处理 result 消息（usage 快照，按 turn 计费）
    const isClaudeBillable = engine === "claude" && message.type === "assistant";
    const isCodexBillable =
      engine === "codex" && message.type === "system" && (message as any).usage;
    const isGeminiBillable =
      engine === "gemini" && message.type === "result" && (message as any).usage;

    // 对于 Codex 引擎，需要特殊处理以避免重复计算：
    // - thread_token_usage_updated (assistant 类型): 累计值，跳过（不应累加）
    // - turn.completed (system 类型，无 codexMetadata): 单次 turn 增量，允许（实时对话）
    // - token_count (system 类型，有 codexMetadata.codexItemType): 增量值，允许（历史加载）
    if (engine === "codex") {
      const codexItemType = (message as any).codexMetadata?.codexItemType;

      // 跳过 thread_token_usage_updated（累计值，不应累加到费用统计）
      if (codexItemType === "thread_token_usage_updated") {
        return;
      }
    }

    if (!isClaudeBillable && !isCodexBillable && !isGeminiBillable) {
      return;
    }

    const tokens = tokenExtractor.extract(message);
    const totalTokenCount = calculateTotalTokens(tokens);

    if (totalTokenCount === 0) {
      return;
    }

    const key = getBillingKey(message, index);
    const { timestamp, timestampMs } = extractTimestamp(message);
    // 🔧 FIX: 使用会话默认模型作为回退
    const model = getModelName(message, engine, sessionDefaultModel);

    // 🔧 FIX: 优先使用 Claude CLI 返回的 cost_usd（包含完整 Extended Thinking tokens 计费）
    // 只有在没有 cost_usd 时才自行计算（回退方案）
    // 注意：Claude CLI 使用驼峰命名 costUSD/totalCostUSD
    const actualCostUsd =
      (message as any).costUSD ??
      (message as any).totalCostUSD ??
      (message as any).cost_usd ??
      (message as any).total_cost_usd;
    const cost =
      typeof actualCostUsd === "number" && actualCostUsd > 0
        ? actualCostUsd
        : calculateMessageCost(tokens, model, engine);

    // 🔧 DEBUG: 记录每条计费消息
    console.log(`[SessionCost] 💰 消息 #${index}: key="${key}", type=${message.type}, cost=$${cost.toFixed(4)}, tokens=${totalTokenCount}, actualCostUsd=${actualCostUsd}`);

    const existing = eventMap.get(key);
    if (
      !existing ||
      totalTokenCount > existing.totalTokenCount ||
      (totalTokenCount === existing.totalTokenCount &&
        (timestampMs ?? 0) >= (existing.timestampMs ?? 0))
    ) {
      // 🔧 DEBUG: 记录是新增还是更新
      if (existing) {
        console.log(`[SessionCost] 🔄 更新消息: key="${key}", 旧tokens=${existing.totalTokenCount}, 新tokens=${totalTokenCount}`);
      } else {
        console.log(`[SessionCost] ➕ 新增消息: key="${key}"`);
      }

      eventMap.set(key, {
        key,
        tokens,
        model,
        cost,
        timestamp,
        timestampMs,
        message,
        totalTokenCount,
        order: index,
      });
    }
  });

  const events = Array.from(eventMap.values()).sort((a, b) => {
    if (
      a.timestampMs !== undefined &&
      b.timestampMs !== undefined &&
      a.timestampMs !== b.timestampMs
    ) {
      return a.timestampMs - b.timestampMs;
    }

    if (a.timestampMs !== undefined) {
      return -1;
    }

    if (b.timestampMs !== undefined) {
      return 1;
    }

    return a.order - b.order;
  });

  const totals: SessionCostTotals = {
    totalCost: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  events.forEach((event) => {
    totals.totalCost += event.cost;
    totals.inputTokens += event.tokens.input_tokens;
    totals.outputTokens += event.tokens.output_tokens;
    totals.cacheReadTokens += event.tokens.cache_read_tokens;
    totals.cacheWriteTokens += event.tokens.cache_creation_tokens;
    totals.totalTokens += calculateTotalTokens(event.tokens);
  });

  // 🔧 DEBUG: 输出最终统计
  console.log(`[SessionCost] 📊 最终统计:`);
  console.log(`  - 去重后的计费事件数: ${events.length}`);
  console.log(`  - 总费用: $${totals.totalCost.toFixed(4)}`);
  console.log(`  - 总 tokens: ${totals.totalTokens}`);

  const timestampValues = events
    .map((event) => event.timestampMs)
    .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

  const firstEventTimestampMs =
    timestampValues.length > 0 ? Math.min(...timestampValues) : undefined;
  const lastEventTimestampMs =
    timestampValues.length > 0 ? Math.max(...timestampValues) : undefined;

  return {
    totals,
    events,
    assistantMessageCount: events.length,
    firstEventTimestampMs,
    lastEventTimestampMs,
  };
}

function calculateTotalTokens(tokens: StandardizedTokenUsage): number {
  return (
    tokens.input_tokens +
    tokens.output_tokens +
    tokens.cache_creation_tokens +
    tokens.cache_read_tokens
  );
}

function getBillingKey(message: ClaudeStreamMessage, index: number): string {
  const nestedId = (message as any)?.message?.id;
  if (typeof nestedId === "string" && nestedId.trim() !== "") {
    return `message:${nestedId}`;
  }

  const messageId = (message as any).id;
  if (typeof messageId === "string" && messageId.trim() !== "") {
    return `message:${messageId}`;
  }

  const uuid = (message as any).uuid;
  if (typeof uuid === "string" && uuid.trim() !== "") {
    return `uuid:${uuid}`;
  }

  const timestamp = (message as any).timestamp ?? (message as any).receivedAt;
  if (typeof timestamp === "string" && timestamp.trim() !== "") {
    return `time:${timestamp}`;
  }

  // 🔧 DEBUG: 警告使用 index 作为 key（不稳定）
  console.warn(`[SessionCost] ⚠️ 消息 #${index} 使用 index 作为 key（无 id/uuid/timestamp）`);
  return `index:${index}`;
}

function extractTimestamp(message: ClaudeStreamMessage): {
  timestamp?: string;
  timestampMs?: number;
} {
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
      return {
        timestamp: candidate,
        timestampMs: parsed,
      };
    }
  }

  return {};
}

function getModelName(
  message: ClaudeStreamMessage,
  engine?: string,
  sessionDefaultModel?: string,
): string {
  const candidates = [
    (message as any).model,
    (message as any)?.message?.model,
    (message as any)?.codexMetadata?.model, // Codex 可能在 metadata 中存储模型
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate;
    }
  }

  // 🔧 FIX: 优先使用会话默认模型
  if (sessionDefaultModel) {
    return sessionDefaultModel;
  }

  // 根据引擎返回对应的默认模型
  if (engine === "codex") return CODEX_MODEL_FALLBACK;
  if (engine === "gemini") return GEMINI_MODEL_FALLBACK;
  return MODEL_FALLBACK;
}

import type { SessionCostTotals } from "@/lib/sessionCost";

/** 费用明细项 */
export interface PromptCostDetailItem {
  /** 消息类型 */
  type: "system" | "tool_call" | "thinking" | "assistant" | "other";
  /** 描述 */
  description: string;
  /** 费用 */
  cost: number;
  /** Token 统计 */
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  /** 模型 */
  model?: string;
  /** 引擎 */
  engine?: string;
  /** 消息索引 */
  messageIndex?: number;
}

export interface PromptCostItem {
  promptIndex: number;
  content: string;
  timestamp?: string;
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost?: number;
  /** 工具调用统计 */
  toolCalls?: {
    total: number;
    byType: Record<string, number>;
  };
  /** 思考统计 */
  thinking?: {
    count: number;
    tokens: number;
  };
  /** 缓存命中率百分比 (0-100) */
  cacheHitRate?: number;
  /** 引擎 */
  engine?: string;
  /** 模型 */
  model?: string;
  /** 费用明细列表 */
  costDetails?: PromptCostDetailItem[];
}

export interface PromptCostSummary {
  items: PromptCostItem[];
  promptsTotalCost: number;
  sessionTotalCost: number;
  sessionTotals: SessionCostTotals;
}

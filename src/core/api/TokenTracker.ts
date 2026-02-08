/**
 * TokenTracker - Token 使用量追踪器
 *
 * 追踪 API 调用的 Token 使用量和成本
 *
 * Requirements: 1.7
 */

// =============================================================================
// 类型定义
// =============================================================================

/** Token 使用记录 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  model: string;
  requestId?: string;
}

/** 累计统计 */
export interface TokenStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalRequests: number;
  totalCost: number;
  averageTokensPerRequest: number;
  startTime: number;
  lastRequestTime: number;
}

/** 模型定价（每 1M tokens） */
export interface ModelPricing {
  inputPrice: number; // 输入价格 ($/1M tokens)
  outputPrice: number; // 输出价格 ($/1M tokens)
}

/** 会话统计 */
export interface SessionStats extends TokenStats {
  sessionId: string;
  modelBreakdown: Record<string, TokenStats>;
}

// =============================================================================
// 模型定价配置
// =============================================================================

/** 默认模型定价（美元/1M tokens） */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 系列
  "claude-3-5-sonnet-20241022": { inputPrice: 3, outputPrice: 15 },
  "claude-3-opus-20240229": { inputPrice: 15, outputPrice: 75 },
  "claude-3-haiku-20240307": { inputPrice: 0.25, outputPrice: 1.25 },
  "claude-3-sonnet-20240229": { inputPrice: 3, outputPrice: 15 },
  // GPT 系列
  "gpt-4o": { inputPrice: 2.5, outputPrice: 10 },
  "gpt-4-turbo": { inputPrice: 10, outputPrice: 30 },
  "gpt-4o-mini": { inputPrice: 0.15, outputPrice: 0.6 },
  "gpt-3.5-turbo": { inputPrice: 0.5, outputPrice: 1.5 },
  // Gemini 系列
  "gemini-2.5-pro-preview-05-06": { inputPrice: 1.25, outputPrice: 10 },
  "gemini-1.5-pro": { inputPrice: 1.25, outputPrice: 5 },
  "gemini-1.5-flash": { inputPrice: 0.075, outputPrice: 0.3 },
  // 默认
  default: { inputPrice: 2, outputPrice: 8 },
};

// =============================================================================
// TokenTracker 类
// =============================================================================

export class TokenTracker {
  private usageHistory: TokenUsage[] = [];
  private sessionId: string;
  private customPricing: Record<string, ModelPricing> = {};
  private maxHistorySize: number;

  constructor(options?: {
    sessionId?: string;
    maxHistorySize?: number;
    customPricing?: Record<string, ModelPricing>;
  }) {
    this.sessionId = options?.sessionId ?? this.generateSessionId();
    this.maxHistorySize = options?.maxHistorySize ?? 1000;
    this.customPricing = options?.customPricing ?? {};
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 记录 Token 使用
   * Requirements: 1.7
   */
  recordUsage(usage: Omit<TokenUsage, "timestamp">): void {
    const record: TokenUsage = {
      ...usage,
      timestamp: Date.now(),
    };

    this.usageHistory.push(record);

    // 限制历史记录大小
    if (this.usageHistory.length > this.maxHistorySize) {
      this.usageHistory = this.usageHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 获取累计统计
   */
  getStats(): TokenStats {
    if (this.usageHistory.length === 0) {
      return this.createEmptyStats();
    }

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;

    for (const usage of this.usageHistory) {
      totalPromptTokens += usage.promptTokens;
      totalCompletionTokens += usage.completionTokens;
      totalCost += this.calculateCost(usage);
    }

    const totalTokens = totalPromptTokens + totalCompletionTokens;

    return {
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalRequests: this.usageHistory.length,
      totalCost,
      averageTokensPerRequest: totalTokens / this.usageHistory.length,
      startTime: this.usageHistory[0].timestamp,
      lastRequestTime: this.usageHistory[this.usageHistory.length - 1].timestamp,
    };
  }

  /**
   * 获取会话统计（包含模型分解）
   */
  getSessionStats(): SessionStats {
    const stats = this.getStats();
    const modelBreakdown: Record<string, TokenStats> = {};

    // 按模型分组
    const modelGroups = new Map<string, TokenUsage[]>();
    for (const usage of this.usageHistory) {
      const group = modelGroups.get(usage.model) ?? [];
      group.push(usage);
      modelGroups.set(usage.model, group);
    }

    // 计算每个模型的统计
    for (const [model, usages] of modelGroups) {
      let promptTokens = 0;
      let completionTokens = 0;
      let cost = 0;

      for (const usage of usages) {
        promptTokens += usage.promptTokens;
        completionTokens += usage.completionTokens;
        cost += this.calculateCost(usage);
      }

      const totalTokens = promptTokens + completionTokens;

      modelBreakdown[model] = {
        totalPromptTokens: promptTokens,
        totalCompletionTokens: completionTokens,
        totalTokens,
        totalRequests: usages.length,
        totalCost: cost,
        averageTokensPerRequest: totalTokens / usages.length,
        startTime: usages[0].timestamp,
        lastRequestTime: usages[usages.length - 1].timestamp,
      };
    }

    return {
      ...stats,
      sessionId: this.sessionId,
      modelBreakdown,
    };
  }

  /**
   * 计算单次使用的成本
   */
  calculateCost(usage: TokenUsage): number {
    const pricing = this.getPricing(usage.model);
    const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputPrice;
    const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputPrice;
    return inputCost + outputCost;
  }

  /**
   * 获取使用历史
   */
  getHistory(): TokenUsage[] {
    return [...this.usageHistory];
  }

  /**
   * 获取最近 N 条记录
   */
  getRecentUsage(count: number): TokenUsage[] {
    return this.usageHistory.slice(-count);
  }

  /**
   * 获取时间范围内的统计
   */
  getStatsInRange(startTime: number, endTime: number): TokenStats {
    const filtered = this.usageHistory.filter(
      (u) => u.timestamp >= startTime && u.timestamp <= endTime
    );

    if (filtered.length === 0) {
      return this.createEmptyStats();
    }

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;

    for (const usage of filtered) {
      totalPromptTokens += usage.promptTokens;
      totalCompletionTokens += usage.completionTokens;
      totalCost += this.calculateCost(usage);
    }

    const totalTokens = totalPromptTokens + totalCompletionTokens;

    return {
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalRequests: filtered.length,
      totalCost,
      averageTokensPerRequest: totalTokens / filtered.length,
      startTime: filtered[0].timestamp,
      lastRequestTime: filtered[filtered.length - 1].timestamp,
    };
  }

  /**
   * 设置自定义定价
   */
  setCustomPricing(model: string, pricing: ModelPricing): void {
    this.customPricing[model] = pricing;
  }

  /**
   * 获取模型定价
   */
  getPricing(model: string): ModelPricing {
    return this.customPricing[model] ?? MODEL_PRICING[model] ?? MODEL_PRICING["default"];
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.usageHistory = [];
    this.sessionId = this.generateSessionId();
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 导出数据
   */
  export(): {
    sessionId: string;
    history: TokenUsage[];
    stats: TokenStats;
  } {
    return {
      sessionId: this.sessionId,
      history: this.getHistory(),
      stats: this.getStats(),
    };
  }

  /**
   * 导入数据
   */
  import(data: { sessionId?: string; history: TokenUsage[] }): void {
    if (data.sessionId) {
      this.sessionId = data.sessionId;
    }
    this.usageHistory = [...data.history];
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 创建空统计
   */
  private createEmptyStats(): TokenStats {
    const now = Date.now();
    return {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      totalCost: 0,
      averageTokensPerRequest: 0,
      startTime: now,
      lastRequestTime: now,
    };
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建 Token 追踪器
 */
export function createTokenTracker(options?: {
  sessionId?: string;
  maxHistorySize?: number;
}): TokenTracker {
  return new TokenTracker(options);
}

/**
 * 格式化 Token 数量
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * 格式化成本
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * 估算文本的 Token 数量（简单估算）
 */
export function estimateTokens(text: string): number {
  // 简单估算：英文约 4 字符/token，中文约 2 字符/token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

export default TokenTracker;

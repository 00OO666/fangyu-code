/**
 * 统一的 AI 模型定价模块
 * ⚠️ MUST MATCH: src-tauri/src/commands/usage.rs::ModelPricing
 *
 * Claude 定价：https://platform.claude.com/docs/en/about-claude/pricing
 * Codex 定价：https://platform.openai.com/docs/pricing (codex-mini-latest)
 * 价格单位：美元/百万 tokens
 * Last Updated: December 2025
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * 模型定价常量（每百万 tokens）
 * 来源：各厂商官方定价
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ============================================================================
  // Claude Models (Anthropic)
  // ============================================================================

  // Claude 4.5 Series (Latest - December 2025)
  'claude-opus-4.5': {
    input: 5.0,
    output: 25.0,
    cacheWrite: 6.25,
    cacheRead: 0.50
  },
  'claude-sonnet-4.5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  },
  'claude-haiku-4.5': {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.10
  },

  // Claude 4.1 Series
  'claude-opus-4.1': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.50
  },

  // ============================================================================
  // Codex Models (OpenAI)
  // Source: https://platform.openai.com/docs/pricing (2025-12 官方定价)
  // Note: Codex 使用 ChatGPT 订阅时按会话限制计费，API Key 用户按 token 计费
  // ============================================================================

  // GPT-5.1-Codex 系列 - Codex CLI 主要使用的模型
  // Context: 400K tokens
  // Note: OpenAI API cache write 免费，只有 cache read 收费
  'gpt-5.1-codex': {
    input: 1.25,      // $1.25 / 1M input tokens (Standard tier)
    output: 10.00,    // $10.00 / 1M output tokens
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.125  // 官方: $0.125 cached input
  },
  'gpt-5.1-codex-mini': {
    input: 0.25,      // $0.25 / 1M input tokens
    output: 2.00,     // $2.00 / 1M output tokens
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.025  // 官方: $0.025 cached input
  },
  'gpt-5.1-codex-max': {
    input: 1.25,      // $1.25 / 1M input tokens (same as base)
    output: 10.00,    // $10.00 / 1M output tokens
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.125
  },
  // codex-mini-latest - 默认 Codex CLI 模型
  'codex-mini-latest': {
    input: 1.50,      // $1.50 / 1M input tokens (官方定价)
    output: 6.00,     // $6.00 / 1M output tokens
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.375  // 官方: $0.375 cached input
  },
  // gpt-5-codex 别名
  'gpt-5-codex': {
    input: 1.25,
    output: 10.00,
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.125
  },

  // GPT-5.2 系列 - 最新模型
  // Context: 400K tokens, Max Output: 128K tokens
  // Note: OpenAI API cache write 免费，只有 cache read 收费
  'gpt-5.2': {
    input: 1.75,      // $1.75 / 1M input tokens (Standard tier)
    output: 14.00,    // $14.00 / 1M output tokens
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.175  // 官方: $0.175 cached input
  },
  // GPT-5.2-Codex - 最新代码模型（2025年12月18日发布）
  // Source: https://openai.com/index/introducing-gpt-5-2-codex/
  'gpt-5.2-codex': {
    input: 1.75,      // $1.75 / 1M input tokens (same as GPT-5.2)
    output: 14.00,    // $14.00 / 1M output tokens
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.175
  },
  // GPT-5.2 variants (Instant, Thinking, Pro) - 同定价
  'gpt-5.2-instant': {
    input: 1.75,
    output: 14.00,
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.175
  },
  'gpt-5.2-thinking': {
    input: 1.75,
    output: 14.00,
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.175
  },
  'gpt-5.2-pro': {
    input: 1.75,
    output: 14.00,
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.175
  },

  // o4-mini (Codex 底层模型之一)
  // Source: https://platform.openai.com/docs/pricing
  'o4-mini': {
    input: 1.10,      // $1.10 / 1M input tokens (Standard tier)
    output: 4.40,     // $4.40 / 1M output tokens
    cacheWrite: 0,    // OpenAI cache write 免费
    cacheRead: 0.275  // 官方: $0.275 cached input
  },

  // ============================================================================
  // Gemini Models (Google)
  // Source: https://ai.google.dev/gemini-api/docs/pricing (Last updated 2025-12-15 UTC)
  // Notes:
  // - Prices are per 1M tokens (USD), standard tier.
  // - Some models have tiered pricing based on prompt length (<=200k vs >200k).
  // - Output price already includes thinking tokens.
  // - Context caching has a separate per-token price (storage fee not modeled here).
  // ============================================================================

  // Gemini 3 Pro Preview (tiered pricing; here is the <=200k tier)
  'gemini-3-pro-preview': {
    input: 2.00,
    output: 12.00,
    cacheWrite: 0.0,
    cacheRead: 0.20
  },

  // Gemini 2.5 Pro (tiered pricing; here is the <=200k tier)
  'gemini-2.5-pro': {
    input: 1.25,
    output: 10.00,
    cacheWrite: 0.0,
    cacheRead: 0.125
  },

  // Gemini 2.5 Flash
  'gemini-2.5-flash': {
    input: 0.30,
    output: 2.50,
    cacheWrite: 0.0,
    cacheRead: 0.03
  },

  // Gemini 2.5 Flash-Lite
  'gemini-2.5-flash-lite': {
    input: 0.10,
    output: 0.40,
    cacheWrite: 0.0,
    cacheRead: 0.01
  },

  // Gemini 2.0 Flash (treat -exp variants as the same family)
  'gemini-2.0-flash': {
    input: 0.10,
    output: 0.40,
    cacheWrite: 0.0,
    cacheRead: 0.025
  },

  // ============================================================================
  // Default fallback (use latest Sonnet 4.5 pricing)
  // ============================================================================
  'default': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  }
};

/**
 * 根据模型名称获取定价
 * ⚠️ MUST MATCH: Backend logic in usage.rs::parse_model_family
 *
 * @param model - 模型名称或标识符
 * @param engine - 引擎类型（claude/codex/gemini）
 * @returns 模型定价对象
 */
export function getPricingForModel(model?: string, engine?: string): ModelPricing {
  if (!model) {
    // 根据引擎选择默认定价
    if (engine === 'codex') {
      return MODEL_PRICING['codex-mini-latest'];
    }
    if (engine === 'gemini') {
      return MODEL_PRICING['gemini-2.5-pro'];
    }
    return MODEL_PRICING['default'];
  }

  // Normalize: lowercase + remove common prefixes/suffixes
  let normalized = model.toLowerCase();
  normalized = normalized.replace('anthropic.', '');
  normalized = normalized.replace('openai.', '');
  normalized = normalized.replace('-v1:0', '');

  // Handle @ symbol for Vertex AI format
  const atIndex = normalized.indexOf('@');
  if (atIndex !== -1) {
    normalized = normalized.substring(0, atIndex);
  }

  // ============================================================================
  // Gemini Models (Google)
  // ============================================================================

  if (normalized.includes('gemini')) {
    if (normalized.includes('gemini-3-pro') || normalized.includes('gemini_3_pro')) {
      return MODEL_PRICING['gemini-3-pro-preview'];
    }
    if (normalized.includes('2.5-pro') || normalized.includes('2_5_pro')) {
      return MODEL_PRICING['gemini-2.5-pro'];
    }
    if (normalized.includes('2.5-flash-lite') || normalized.includes('2_5_flash_lite')) {
      return MODEL_PRICING['gemini-2.5-flash-lite'];
    }
    if (normalized.includes('2.5-flash') || normalized.includes('2_5_flash')) {
      return MODEL_PRICING['gemini-2.5-flash'];
    }
    if (normalized.includes('2.0-flash') || normalized.includes('2_0_flash')) {
      return MODEL_PRICING['gemini-2.0-flash'];
    }

    // Unknown Gemini model - default to Gemini 2.5 Pro
    return MODEL_PRICING['gemini-2.5-pro'];
  }

  // ============================================================================
  // Codex Models (OpenAI)
  // ============================================================================

  // GPT-5.1-Codex 系列
  if (normalized.includes('5.1-codex-max') || normalized.includes('5_1_codex_max')) {
    return MODEL_PRICING['gpt-5.1-codex-max'];
  }
  if (normalized.includes('5.1-codex-mini') || normalized.includes('5_1_codex_mini')) {
    return MODEL_PRICING['gpt-5.1-codex-mini'];
  }
  if (normalized.includes('5.1-codex') || normalized.includes('5_1_codex')) {
    return MODEL_PRICING['gpt-5.1-codex'];
  }

  // GPT-5.2 系列 (Codex, Instant, Thinking, Pro variants)
  // GPT-5.2-Codex 优先匹配（最新代码模型）
  if (normalized.includes('5.2-codex') || normalized.includes('5_2_codex')) {
    return MODEL_PRICING['gpt-5.2-codex'];
  }
  if (normalized.includes('5.2-pro') || normalized.includes('5_2_pro')) {
    return MODEL_PRICING['gpt-5.2-pro'];
  }
  if (normalized.includes('5.2-thinking') || normalized.includes('5_2_thinking')) {
    return MODEL_PRICING['gpt-5.2-thinking'];
  }
  if (normalized.includes('5.2-instant') || normalized.includes('5_2_instant')) {
    return MODEL_PRICING['gpt-5.2-instant'];
  }
  if (normalized.includes('gpt-5.2') || normalized.includes('gpt_5_2') || normalized.includes('5.2')) {
    return MODEL_PRICING['gpt-5.2'];
  }

  // o4-mini (Codex 底层模型)
  if (normalized.includes('o4-mini') || normalized.includes('o4_mini')) {
    return MODEL_PRICING['o4-mini'];
  }

  // codex-mini-latest - 默认 CLI 模型
  if (normalized.includes('codex-mini-latest') || normalized.includes('codex_mini_latest')) {
    return MODEL_PRICING['codex-mini-latest'];
  }

  // gpt-5-codex (别名)
  if (normalized.includes('gpt-5-codex') || normalized.includes('gpt_5_codex')) {
    return MODEL_PRICING['gpt-5-codex'];
  }

  // 通用 Codex 匹配 - 默认使用 codex-mini-latest
  if (normalized.includes('codex')) {
    return MODEL_PRICING['codex-mini-latest'];
  }

  // ============================================================================
  // Claude Models (Anthropic)
  // ============================================================================

  // Claude 4.5 Series (Latest)
  if (normalized.includes('opus') && (normalized.includes('4.5') || normalized.includes('4-5'))) {
    return MODEL_PRICING['claude-opus-4.5'];
  }
  if (normalized.includes('haiku') && (normalized.includes('4.5') || normalized.includes('4-5'))) {
    return MODEL_PRICING['claude-haiku-4.5'];
  }
  if (normalized.includes('sonnet') && (normalized.includes('4.5') || normalized.includes('4-5'))) {
    return MODEL_PRICING['claude-sonnet-4.5'];
  }

  // Claude 4.1 Series
  if (normalized.includes('opus') && (normalized.includes('4.1') || normalized.includes('4-1'))) {
    return MODEL_PRICING['claude-opus-4.1'];
  }

  // Generic family detection (fallback - MUST match backend)
  if (normalized.includes('haiku')) {
    return MODEL_PRICING['claude-haiku-4.5']; // Default to latest
  }
  if (normalized.includes('opus')) {
    return MODEL_PRICING['claude-opus-4.5']; // Default to latest
  }
  if (normalized.includes('sonnet')) {
    return MODEL_PRICING['claude-sonnet-4.5']; // Default to latest
  }

  // Codex 引擎使用 Codex 默认定价
  if (engine === 'codex') {
    return MODEL_PRICING['codex-mini-latest'];
  }

  // Gemini 引擎使用 Gemini 默认定价
  if (engine === 'gemini') {
    return MODEL_PRICING['gemini-2.5-pro'];
  }

  // Unknown model - use default
  console.warn(`[pricing] Unknown model: '${model}'. Using default pricing.`);
  return MODEL_PRICING['default'];
}

function getGeminiTieredPricing(model: string, promptTokens: number): ModelPricing {
  const lower = model.toLowerCase();
  const isOver200k = promptTokens > 200_000;

  // Gemini 3 Pro Preview
  if (lower.includes('gemini-3-pro') || lower.includes('gemini_3_pro')) {
    return {
      input: isOver200k ? 4.00 : 2.00,
      output: isOver200k ? 18.00 : 12.00,
      cacheWrite: 0.0,
      cacheRead: isOver200k ? 0.40 : 0.20,
    };
  }

  // Gemini 2.5 Pro
  if (lower.includes('2.5-pro') || lower.includes('2_5_pro')) {
    return {
      input: isOver200k ? 2.50 : 1.25,
      output: isOver200k ? 15.00 : 10.00,
      cacheWrite: 0.0,
      cacheRead: isOver200k ? 0.25 : 0.125,
    };
  }

  // Non-tiered Gemini models use the standard pricing table
  return getPricingForModel(model, 'gemini');
}

/**
 * 计算单个消息的成本
 * @param tokens - token 使用统计
 * @param model - 模型名称
 * @param engine - 引擎类型（claude/codex/gemini）
 * @returns 成本（美元）
 */
export function calculateMessageCost(
  tokens: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  },
  model?: string,
  engine?: string
): number {
  const resolvedModel = model || (engine === 'gemini' ? 'gemini-2.5-pro' : undefined);

  // Gemini: tiered pricing depends on prompt length (<=200k vs >200k)
  const pricing =
    engine === 'gemini' && resolvedModel
      ? getGeminiTieredPricing(
          resolvedModel,
          tokens.input_tokens + tokens.cache_creation_tokens + tokens.cache_read_tokens
        )
      : getPricingForModel(resolvedModel, engine);

  const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (tokens.cache_creation_tokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = (tokens.cache_read_tokens / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * 格式化成本显示
 * @param amount - 成本金额（美元）
 * @returns 格式化的字符串
 */
export function formatCost(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) {
    // 小于 1 美分时显示为美分
    const cents = amount * 100;
    return `$${cents.toFixed(3)}¢`;
  }
  return `$${amount.toFixed(4)}`;
}

/**
 * 格式化时长
 * @param seconds - 秒数
 * @returns 格式化的时长字符串（如 "6m 19s" 或 "6h 33m"）
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

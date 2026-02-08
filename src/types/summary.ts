/**
 * Summary Generator Types
 *
 * 会话摘要生成器相关类型定义
 *
 * Requirements: 2.1, 3.2
 */

// =============================================================================
// 引擎类型
// =============================================================================

/** 支持的执行引擎 */
export type SummaryEngine = "claude" | "codex" | "gemini";

/** 模型信息 */
export interface ModelInfo {
  /** 模型 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 每 1K tokens 成本（美元） */
  costPer1k: number;
  /** 最大上下文长度 */
  maxContext?: number;
  /** 是否推荐用于摘要 */
  recommended?: boolean;
}

/** 引擎信息 */
export interface EngineInfo {
  /** 引擎 ID */
  id: SummaryEngine;
  /** 显示名称 */
  name: string;
  /** 品牌颜色 */
  color: string;
  /** 渐变色（可选） */
  gradient?: string;
  /** 是否可用 */
  available: boolean;
  /** 版本号 */
  version?: string;
  /** 支持的模型列表 */
  models: ModelInfo[];
  /** API 配置 URL */
  configUrl?: string;
  /** 不可用原因 */
  unavailableReason?: string;
}

// =============================================================================
// 配置类型
// =============================================================================

/** 摘要 API 配置 */
export interface SummaryAPIConfig {
  /** 选择的引擎 */
  engine: SummaryEngine;
  /** 选择的模型 */
  model: string;
  /** API 端点（可选，使用默认值） */
  apiEndpoint?: string;
  /** API Key（加密存储） */
  apiKey?: string;
  /** 自定义参数 */
  customParams?: SummaryCustomParams;
  /** 最后更新时间 */
  updatedAt: number;
}

/** 自定义生成参数 */
export interface SummaryCustomParams {
  /** 最大 token 数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** 重点关注领域 */
  focusAreas?: string[];
  /** 是否包含代码片段 */
  includeCodeSnippets?: boolean;
}

/** 存储的配置（包含加密信息） */
export interface StoredSummaryConfig {
  /** Schema 版本号（用于迁移） */
  version: number;
  /** 配置内容 */
  config: SummaryAPIConfig;
  /** 加密的 API Key */
  encryptedApiKey?: string;
}

/** 配置验证结果 */
export interface ConfigValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
}

// =============================================================================
// 生成相关类型
// =============================================================================

/** 生成选项 */
export interface GenerationOptions {
  /** 最大长度 */
  maxLength?: number;
  /** 重点关注领域 */
  focusAreas?: string[];
  /** 是否包含代码片段 */
  includeCodeSnippets?: boolean;
  /** 摘要语言 */
  language?: "zh" | "en" | "auto";
}

/** 生成进度 */
export interface GenerationProgress {
  /** 当前状态 */
  status: "idle" | "preparing" | "generating" | "completed" | "error";
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 预估剩余时间（秒） */
  estimatedTimeRemaining?: number;
  /** 当前步骤描述 */
  currentStep?: string;
}

/** 生成结果 */
export interface SummaryResult {
  /** 是否成功 */
  success: boolean;
  /** 生成的摘要 */
  summary?: string;
  /** 错误信息 */
  error?: string;
  /** 元数据 */
  metadata: SummaryMetadata;
}

/** 摘要元数据 */
export interface SummaryMetadata {
  /** 使用的 token 数 */
  tokensUsed: number;
  /** 生成耗时（毫秒） */
  generationTime: number;
  /** 使用的模型 */
  model: string;
  /** 使用的引擎 */
  engine: SummaryEngine;
  /** 生成时间戳 */
  timestamp: number;
}

// =============================================================================
// 会话统计类型
// =============================================================================

/** 会话统计信息 */
export interface SessionStats {
  /** 消息数量 */
  messageCount: number;
  /** Token 数量 */
  tokenCount: number;
  /** Token 使用百分比 (0-1) */
  tokenPercentage: number;
  /** 预估费用（美元） */
  estimatedCost: number;
  /** 用户消息数 */
  userMessageCount: number;
  /** 助手消息数 */
  assistantMessageCount: number;
}

// =============================================================================
// 引擎模型注册表
// =============================================================================

/** 三引擎模型注册表 */
export const ENGINE_MODELS: Record<SummaryEngine, ModelInfo[]> = {
  claude: [
    // Claude 4.5 系列（最新）
    {
      id: "claude-opus-4-5-20251101",
      name: "Claude Opus 4.5",
      costPer1k: 0.015,
      maxContext: 200000,
    },
    {
      id: "claude-sonnet-4-5-20250929",
      name: "Claude Sonnet 4.5",
      costPer1k: 0.003,
      maxContext: 200000,
      recommended: true,
    },
    {
      id: "claude-haiku-4-5-20251001",
      name: "Claude Haiku 4.5",
      costPer1k: 0.0008,
      maxContext: 200000,
    },
    // Claude 4 系列
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude Sonnet 4",
      costPer1k: 0.003,
      maxContext: 200000,
    },
    // Claude 3.5 系列（旧版）
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      costPer1k: 0.003,
      maxContext: 200000,
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      costPer1k: 0.0008,
      maxContext: 200000,
    },
  ],
  codex: [
    { id: "gpt-4o", name: "GPT-4o", costPer1k: 0.005, maxContext: 128000 },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      costPer1k: 0.00015,
      maxContext: 128000,
      recommended: true,
    },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", costPer1k: 0.01, maxContext: 128000 },
    { id: "o1-preview", name: "o1 Preview", costPer1k: 0.015, maxContext: 128000 },
    { id: "o1-mini", name: "o1 Mini", costPer1k: 0.003, maxContext: 128000 },
  ],
  gemini: [
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", costPer1k: 0.00125, maxContext: 2000000 },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      costPer1k: 0.000075,
      maxContext: 1000000,
      recommended: true,
    },
    {
      id: "gemini-2.0-flash-exp",
      name: "Gemini 2.0 Flash",
      costPer1k: 0.0001,
      maxContext: 1000000,
    },
  ],
};

/** 默认摘要配置 */
export const DEFAULT_SUMMARY_CONFIG: SummaryAPIConfig = {
  engine: "claude",
  model: "claude-sonnet-4-5-20250929",
  customParams: {
    maxTokens: 4096,
    temperature: 0.3,
    includeCodeSnippets: true,
  },
  updatedAt: Date.now(),
};

/** 引擎显示信息 */
export const ENGINE_DISPLAY_INFO: Record<
  SummaryEngine,
  Omit<EngineInfo, "available" | "version" | "models">
> = {
  claude: {
    id: "claude",
    name: "Claude",
    color: "#FF6B35",
    gradient: "linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)",
  },
  codex: {
    id: "codex",
    name: "OpenAI",
    color: "#10A37F",
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    color: "#4285F4",
    gradient: "linear-gradient(135deg, #4285F4 0%, #34A853 33%, #FBBC05 66%, #EA4335 100%)",
  },
};

/** 存储 key */
export const SUMMARY_CONFIG_STORAGE_KEY = "fangyu-summary-api-config";

/** 当前配置 schema 版本 - 增加版本号会触发配置重置 */
export const SUMMARY_CONFIG_VERSION = 2; // v2: 更新为 Claude 4.5 模型列表

// =============================================================================
// 模型测试相关类型
// =============================================================================

/** 模型测试状态 */
export type ModelTestStatus = "pending" | "success" | "replaced" | "error" | "untested";

/** 带测试状态的模型信息 */
export interface TestedModelInfo extends ModelInfo {
  /** 测试状态 */
  testStatus: ModelTestStatus;
  /** 响应延迟（毫秒） */
  latency?: number;
  /** 错误信息 */
  errorMessage?: string;
}

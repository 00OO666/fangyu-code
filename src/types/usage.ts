/**
 * 多引擎使用统计类型定义
 * 支持 Claude、Codex、Gemini 引擎的统计数据
 */

// ============================================================================
// 基础统计类型
// ============================================================================

/**
 * 模型使用统计
 */
export interface ModelUsage {
  model: string;
  total_cost: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  session_count: number;
}

/**
 * 每日使用统计
 */
export interface DailyUsage {
  date: string;
  total_cost: number;
  total_tokens: number;
  models_used: string[];
}

/**
 * 项目使用统计
 */
export interface ProjectUsage {
  project_path: string;
  project_name: string;
  total_cost: number;
  total_tokens: number;
  session_count: number;
  last_used: string;
}

/**
 * 单引擎使用统计（Claude 格式）
 */
export interface UsageStats {
  total_cost: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  total_sessions: number;
  by_model: ModelUsage[];
  by_date: DailyUsage[];
  by_project: ProjectUsage[];
}

// ============================================================================
// 多引擎统计类型
// ============================================================================

/**
 * 引擎类型
 */
export type EngineType = 'claude' | 'codex' | 'gemini';

/**
 * 单引擎统计摘要
 */
export interface EngineSummary {
  engine: EngineType;
  total_cost: number;
  total_tokens: number;
  total_sessions: number;
  by_model: ModelUsage[];
}

/**
 * 多引擎聚合统计
 */
export interface MultiEngineUsageStats {
  /** 总计 */
  total_cost: number;
  total_tokens: number;
  total_sessions: number;

  /** 各引擎统计摘要 */
  by_engine: EngineSummary[];

  /** 所有模型统计（跨引擎） */
  by_model: ModelUsage[];

  /** 每日统计（跨引擎） */
  by_date: DailyUsage[];

  /** 项目统计（跨引擎） */
  by_project: ProjectUsage[];
}

// ============================================================================
// Codex 专用类型
// ============================================================================

/**
 * Codex 会话使用统计
 */
export interface CodexSessionUsage {
  session_id: string;
  project_path: string;
  model: string;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  created_at: number;
  updated_at: number;
  first_message?: string;
}

/**
 * Codex 使用统计响应
 */
export interface CodexUsageStats {
  total_cost: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_input_tokens: number;
  total_cache_creation_tokens?: number;
  total_cache_read_tokens?: number;
  total_sessions: number;
  by_model: ModelUsage[];
  by_date: DailyUsage[];
  by_project: ProjectUsage[];
  sessions: CodexSessionUsage[];
}

// ============================================================================
// Gemini 专用类型
// ============================================================================

/**
 * Gemini 会话使用统计
 */
export interface GeminiSessionUsage {
  session_id: string;
  project_path: string;
  model: string;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  start_time: string;
  first_message?: string;
}

/**
 * Gemini 使用统计响应
 */
export interface GeminiUsageStats {
  total_cost: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens?: number;
  total_cache_read_tokens?: number;
  total_sessions: number;
  by_model: ModelUsage[];
  by_date: DailyUsage[];
  by_project: ProjectUsage[];
  sessions: GeminiSessionUsage[];
}

// ============================================================================
// UI 辅助类型
// ============================================================================

/**
 * 引擎显示信息
 */
export interface EngineDisplayInfo {
  type: EngineType;
  label: string;
  color: string;
  icon: string;
}

/**
 * 统计卡片数据
 */
export interface StatsCardData {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
}

/**
 * 引擎图标颜色映射
 */
export const ENGINE_COLORS: Record<EngineType, string> = {
  claude: '#D97706',  // orange-500
  codex: '#3B82F6',   // blue-500
  gemini: '#8B5CF6',  // purple-500
};

/**
 * 引擎显示名称映射
 */
export const ENGINE_LABELS: Record<EngineType, string> = {
  claude: 'Claude',
  codex: 'OpenAI Codex',
  gemini: 'Google Gemini',
};

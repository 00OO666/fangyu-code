import { logger } from '@/lib/logger';

/**
 * Feature flags for gradual rollout of optimizations
 *
 * Phase 1 flags are enabled by default (stable)
 * Phase 2 flags are ready for testing (can be enabled via UI or localStorage)
 * Phase 3+ flags are experimental
 */

/**
 * Feature Flag 详细信息
 */
export interface FeatureFlagInfo {
  /** 功能标志 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 功能描述 */
  description: string;
  /** 是否默认启用 */
  enabled: boolean;
  /** 所属阶段 */
  phase: 1 | 2 | 3 | 4;
  /** 依赖的其他功能标志 */
  dependencies?: string[];
}

/**
 * 所有功能标志的详细配置
 */
export const FEATURE_FLAG_INFO: Record<string, FeatureFlagInfo> = {
  // Phase 1: Quick Wins (已稳定)
  LAZY_HISTORY_LOADING: {
    id: 'lazy-history-loading',
    name: '延迟历史加载',
    description: '仅在需要时加载会话历史，减少初始加载时间',
    enabled: true,
    phase: 1,
  },
  SELECTIVE_MCP_CONTEXT: {
    id: 'selective-mcp-context',
    name: '选择性 MCP 上下文',
    description: '智能选择相关的 MCP 上下文，减少 Token 消耗',
    enabled: true,
    phase: 1,
  },
  TOKEN_OPTIMIZER_MCP: {
    id: 'token-optimizer-mcp',
    name: 'Token 优化器',
    description: '自动优化 MCP 调用的 Token 使用',
    enabled: true,
    phase: 1,
  },

  // Phase 2: Context Optimization (准备测试)
  CONTEXT_WINDOW_PRUNING: {
    id: 'context-window-pruning',
    name: '上下文窗口修剪',
    description: '自动修剪超出上下文窗口的旧消息，保持对话流畅',
    enabled: false,
    phase: 2,
  },
  VIRTUAL_SCROLLING: {
    id: 'virtual-scrolling',
    name: '虚拟滚动',
    description: '使用虚拟滚动优化大量消息的渲染性能，保持 60fps',
    enabled: false,
    phase: 2,
  },
  TOOL_RESULT_COMPRESSION: {
    id: 'tool-result-compression',
    name: '工具结果压缩',
    description: '压缩工具调用结果，减少上下文占用',
    enabled: false,
    phase: 2,
  },

  // Phase 3: Architecture Refactoring (实验性)
  NEW_CONTEXT_ARCHITECTURE: {
    id: 'new-context-architecture',
    name: '新上下文架构',
    description: '使用新的上下文管理架构，提供更好的性能和可扩展性',
    enabled: false,
    phase: 3,
    dependencies: ['CONTEXT_WINDOW_PRUNING'],
  },

  // Phase 4: Advanced Optimizations (高级)
  INTELLIGENT_CONTEXT_CACHING: {
    id: 'intelligent-context-caching',
    name: '智能上下文缓存',
    description: '智能缓存常用上下文，减少重复计算',
    enabled: false,
    phase: 4,
    dependencies: ['NEW_CONTEXT_ARCHITECTURE'],
  },
  MCP_TO_SKILL_CONVERTER: {
    id: 'mcp-to-skill-converter',
    name: 'MCP 转 Skill 转换器',
    description: '自动将 MCP 服务器转换为本地 Skill',
    enabled: false,
    phase: 4,
  },
  PERFORMANCE_MONITORING: {
    id: 'performance-monitoring',
    name: '性能监控',
    description: '实时监控应用性能，提供优化建议',
    enabled: false,
    phase: 4,
  },
};

/**
 * 简化的功能标志配置（向后兼容）
 */
export const FEATURE_FLAGS = Object.fromEntries(
  Object.entries(FEATURE_FLAG_INFO).map(([key, info]) => [key, info.enabled])
) as Record<string, boolean>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature flag is enabled
 * Supports user overrides via localStorage
 */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  // Check for user override in localStorage
  const userOverride = localStorage.getItem(`feature_${flag}`);
  if (userOverride !== null) {
    return userOverride === "true";
  }

  // Return default value
  return FEATURE_FLAGS[flag] ?? false;
};

/**
 * Enable a feature flag (persists to localStorage)
 * Checks dependencies before enabling
 */
export const enableFeature = (flag: FeatureFlag): { success: boolean; error?: string } => {
  const info = FEATURE_FLAG_INFO[flag];
  if (!info) {
    return { success: false, error: `Unknown feature flag: ${flag}` };
  }

  // Check dependencies
  if (info.dependencies) {
    for (const dep of info.dependencies) {
      if (!isFeatureEnabled(dep as FeatureFlag)) {
        return {
          success: false,
          error: `Cannot enable ${flag}: requires ${dep} to be enabled first`,
        };
      }
    }
  }

  localStorage.setItem(`feature_${flag}`, "true");
  logger.debug('featureFlags', `[FeatureFlags] Enabled: ${flag}`);
  return { success: true };
};

/**
 * Disable a feature flag (persists to localStorage)
 * Also disables dependent features
 */
export const disableFeature = (flag: FeatureFlag): void => {
  localStorage.setItem(`feature_${flag}`, "false");
  logger.debug('featureFlags', `[FeatureFlags] Disabled: ${flag}`);

  // Disable dependent features
  for (const [key, info] of Object.entries(FEATURE_FLAG_INFO)) {
    if (info.dependencies?.includes(flag)) {
      disableFeature(key as FeatureFlag);
    }
  }
};

/**
 * Reset a feature flag to default value
 */
export const resetFeature = (flag: FeatureFlag): void => {
  localStorage.removeItem(`feature_${flag}`);
  logger.debug('featureFlags', `[FeatureFlags] Reset to default: ${flag}`);
};

/**
 * Get all feature flags with their current status
 */
export const getAllFeatureFlags = (): Record<FeatureFlag, boolean> => {
  const flags: Record<string, boolean> = {};
  for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
    flags[flag] = isFeatureEnabled(flag);
  }
  return flags as Record<FeatureFlag, boolean>;
};

/**
 * Get detailed info for all feature flags
 */
export const getAllFeatureFlagInfo = (): FeatureFlagInfo[] => {
  return Object.entries(FEATURE_FLAG_INFO).map(([key, info]) => ({
    ...info,
    enabled: isFeatureEnabled(key as FeatureFlag),
  }));
};

/**
 * Get feature flags by phase
 */
export const getFeatureFlagsByPhase = (phase: 1 | 2 | 3 | 4): FeatureFlagInfo[] => {
  return getAllFeatureFlagInfo().filter((info) => info.phase === phase);
};

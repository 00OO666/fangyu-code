/**
 * Feature flags for gradual rollout of optimizations
 *
 * Phase 1 flags are enabled by default
 * Phase 2+ flags are disabled until tested
 */
export const FEATURE_FLAGS = {
  // Phase 1: Quick Wins
  LAZY_HISTORY_LOADING: true,
  SELECTIVE_MCP_CONTEXT: true,
  TOKEN_OPTIMIZER_MCP: true,

  // Phase 2: Context Optimization
  CONTEXT_WINDOW_PRUNING: false,
  VIRTUAL_SCROLLING: false,
  TOOL_RESULT_COMPRESSION: false,

  // Phase 3: Architecture Refactoring
  NEW_CONTEXT_ARCHITECTURE: false,

  // Phase 4: Advanced Optimizations
  INTELLIGENT_CONTEXT_CACHING: false,
  MCP_TO_SKILL_CONVERTER: false,
  PERFORMANCE_MONITORING: false,
} as const;

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
  return FEATURE_FLAGS[flag];
};

/**
 * Enable a feature flag (persists to localStorage)
 */
export const enableFeature = (flag: FeatureFlag): void => {
  localStorage.setItem(`feature_${flag}`, "true");
  console.log(`[FeatureFlags] Enabled: ${flag}`);
};

/**
 * Disable a feature flag (persists to localStorage)
 */
export const disableFeature = (flag: FeatureFlag): void => {
  localStorage.setItem(`feature_${flag}`, "false");
  console.log(`[FeatureFlags] Disabled: ${flag}`);
};

/**
 * Reset a feature flag to default value
 */
export const resetFeature = (flag: FeatureFlag): void => {
  localStorage.removeItem(`feature_${flag}`);
  console.log(`[FeatureFlags] Reset to default: ${flag}`);
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

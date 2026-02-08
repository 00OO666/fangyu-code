/**
 * MCP Context Manager - Selective MCP Context Loading
 *
 * Optimizes token usage by selectively loading MCP server contexts
 * based on usage patterns and explicit mentions.
 *
 * Strategy:
 * - Always load: Core tools (github, filesystem)
 * - Lazy load: Load if mentioned in recent messages
 * - On-demand: Load only on explicit @mention
 */

import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/config/featureFlags";

export interface MCPContextConfig {
  /** Always include these MCP servers in context */
  alwaysLoad: string[];
  /** Load if mentioned in last N messages */
  lazyLoad: string[];
  /** Load only on explicit @mention */
  loadOnDemand: string[];
}

const DEFAULT_CONFIG: MCPContextConfig = {
  alwaysLoad: ["github", "filesystem"],
  lazyLoad: ["context7", "sequential-thinking"],
  loadOnDemand: ["puppeteer", "chrome-devtools", "fetch", "memory"],
};

/**
 * Get MCP context configuration
 * Can be overridden via localStorage for testing
 */
export const getMCPContextConfig = (): MCPContextConfig => {
  const stored = localStorage.getItem("mcp_context_config");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      logger.warn("mcpContextManager", "[MCPContextManager] Invalid stored config, using default");
    }
  }
  return DEFAULT_CONFIG;
};

/**
 * Set MCP context configuration
 */
export const setMCPContextConfig = (config: Partial<MCPContextConfig>): void => {
  const current = getMCPContextConfig();
  const updated = { ...current, ...config };
  localStorage.setItem("mcp_context_config", JSON.stringify(updated));
  logger.debug("mcpContextManager", "[MCPContextManager] Config updated:", updated);
};

/**
 * Check if an MCP server context should be loaded
 *
 * @param serverName - Name of the MCP server
 * @param recentMessages - Last N messages (typically 3-5)
 * @param currentMessage - The current message being sent
 * @returns true if the server context should be included
 */
export const shouldLoadMCPContext = (
  serverName: string,
  recentMessages: string[],
  currentMessage: string
): boolean => {
  // Feature flag check
  if (!isFeatureEnabled("SELECTIVE_MCP_CONTEXT")) {
    return true; // Load all contexts if feature is disabled
  }

  const config = getMCPContextConfig();

  // Always load core servers
  if (config.alwaysLoad.includes(serverName)) {
    return true;
  }

  // Check for explicit @mention in current message
  if (currentMessage.includes(`@${serverName}`)) {
    return true;
  }

  // Lazy load: check if mentioned in recent messages
  if (config.lazyLoad.includes(serverName)) {
    const mentioned = recentMessages.some(
      (msg) =>
        msg.includes(serverName) ||
        msg.includes(`@${serverName}`) ||
        msg.toLowerCase().includes(serverName.toLowerCase())
    );
    if (mentioned) {
      return true;
    }
  }

  // On-demand servers: only load on explicit mention
  if (config.loadOnDemand.includes(serverName)) {
    return false; // Already checked for @mention above
  }

  // Default: don't load
  return false;
};

/**
 * Filter MCP servers based on context loading strategy
 *
 * @param availableServers - List of all available MCP server names
 * @param recentMessages - Last N messages
 * @param currentMessage - Current message being sent
 * @returns Filtered list of server names to include in context
 */
export const filterMCPServers = (
  availableServers: string[],
  recentMessages: string[],
  currentMessage: string
): string[] => {
  if (!isFeatureEnabled("SELECTIVE_MCP_CONTEXT")) {
    return availableServers; // Return all if feature disabled
  }

  const filtered = availableServers.filter((server) =>
    shouldLoadMCPContext(server, recentMessages, currentMessage)
  );

  const excluded = availableServers.filter((s) => !filtered.includes(s));
  if (excluded.length > 0) {
    logger.debug(
      "mcpContextManager",
      `Excluded ${excluded.length} servers: ${excluded.join(", ")}`
    );
    logger.debug(
      "mcpContextManager",
      `Included ${filtered.length} servers: ${filtered.join(", ")}`
    );
  }

  return filtered;
};

/**
 * Get recent messages for context analysis
 * Extracts last N user messages from message history
 */
export const getRecentMessagesForContext = (
  messages: Array<{ role: string; content: string }>,
  count: number = 3
): string[] => {
  return messages
    .filter((msg) => msg.role === "user")
    .slice(-count)
    .map((msg) => msg.content);
};

/**
 * Calculate token savings from selective MCP loading
 * Estimates based on average MCP context size
 */
export const estimateTokenSavings = (
  totalServers: number,
  loadedServers: number
): { savedServers: number; estimatedTokensSaved: number; savingsPercent: number } => {
  const savedServers = totalServers - loadedServers;
  const avgTokensPerServer = 200; // Conservative estimate
  const estimatedTokensSaved = savedServers * avgTokensPerServer;
  const savingsPercent = totalServers > 0 ? (savedServers / totalServers) * 100 : 0;

  return {
    savedServers,
    estimatedTokensSaved,
    savingsPercent,
  };
};

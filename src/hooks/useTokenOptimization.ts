/**
 * Token Optimization Integration Hook
 *
 * This hook demonstrates how to integrate the token optimization services
 * into the message flow. It can be used as a wrapper around existing
 * message handling logic.
 *
 * Usage Example:
 * ```typescript
 * const { optimizeMessages, optimizeMCPServers, getStats } = useTokenOptimization();
 *
 * // Before sending messages to API
 * const optimizedMessages = optimizeMessages(allMessages);
 * const activeMCPServers = optimizeMCPServers(availableServers, messages, currentPrompt);
 *
 * // Get optimization statistics
 * const stats = getStats();
 * logger.debug('useTokenOptimization', `Saved ${stats.totalTokensSaved} tokens`);
 * ```
 */

import { logger } from '@/lib/logger';
import { useCallback, useMemo, useRef } from "react";
import { isFeatureEnabled } from "@/config/featureFlags";
import {
  filterMCPServers,
  getRecentMessagesForContext,
  estimateTokenSavings as estimateMCPTokenSavings,
} from "@/services/mcpContextManager";
import {
  getOptimizedMessageContext,
  type OptimizedMessageContext,
} from "@/services/messageContextOptimizer";
import type { ClaudeStreamMessage } from "@/types/claude";

interface TokenOptimizationStats {
  messagesExcluded: number;
  mcpServersExcluded: number;
  totalTokensSaved: number;
  optimizationEnabled: boolean;
}

export function useTokenOptimization() {
  const statsRef = useRef<TokenOptimizationStats>({
    messagesExcluded: 0,
    mcpServersExcluded: 0,
    totalTokensSaved: 0,
    optimizationEnabled: false,
  });

  /**
   * Optimize message history for API context
   * Reduces token usage by limiting message window
   */
  const optimizeMessages = useCallback(
    (messages: ClaudeStreamMessage[], windowSize?: number): OptimizedMessageContext => {
      const result = getOptimizedMessageContext(messages, windowSize);

      // Update stats
      statsRef.current.messagesExcluded = result.excludedCount;
      statsRef.current.totalTokensSaved += result.estimatedTokensSaved;
      statsRef.current.optimizationEnabled = isFeatureEnabled("LAZY_HISTORY_LOADING");

      // Log optimization results
      if (result.excludedCount > 0) {
        logger.debug('TokenOptimization', `Message optimization: ${result.totalMessages} → ${result.messages.length} messages`);
        logger.debug('TokenOptimization', `Estimated tokens saved: ${result.estimatedTokensSaved}`);
      }

      return result;
    },
    [],
  );

  /**
   * Filter MCP servers based on usage context
   * Reduces token usage by excluding unused MCP contexts
   */
  const optimizeMCPServers = useCallback(
    (
      availableServers: string[],
      messages: Array<{ role: string; content: string }>,
      currentMessage: string,
    ): string[] => {
      const recentMessages = getRecentMessagesForContext(messages, 3);
      const filtered = filterMCPServers(availableServers, recentMessages, currentMessage);

      // Calculate savings
      const savings = estimateMCPTokenSavings(availableServers.length, filtered.length);
      statsRef.current.mcpServersExcluded = savings.savedServers;
      statsRef.current.totalTokensSaved += savings.estimatedTokensSaved;

      // Log optimization results
      if (savings.savedServers > 0) {
        logger.debug('TokenOptimization', `MCP optimization: ${availableServers.length} → ${filtered.length} servers`);
        logger.debug('TokenOptimization', `Estimated tokens saved: ${savings.estimatedTokensSaved} (${savings.savingsPercent.toFixed(1)}%)`);
      }

      return filtered;
    },
    [],
  );

  /**
   * Get current optimization statistics
   */
  const getStats = useCallback((): TokenOptimizationStats => {
    return { ...statsRef.current };
  }, []);

  /**
   * Reset optimization statistics
   */
  const resetStats = useCallback(() => {
    statsRef.current = {
      messagesExcluded: 0,
      mcpServersExcluded: 0,
      totalTokensSaved: 0,
      optimizationEnabled: isFeatureEnabled("LAZY_HISTORY_LOADING"),
    };
  }, []);

  /**
   * Check if optimizations are enabled
   */
  const isOptimizationEnabled = useMemo(() => {
    return (
      isFeatureEnabled("LAZY_HISTORY_LOADING") || isFeatureEnabled("SELECTIVE_MCP_CONTEXT")
    );
  }, []);

  return {
    optimizeMessages,
    optimizeMCPServers,
    getStats,
    resetStats,
    isOptimizationEnabled,
  };
}

/**
 * Integration Points for Fangyu Code
 *
 * To integrate token optimization into the existing codebase:
 *
 * 1. **Message Optimization** (src/hooks/usePromptExecution.ts or similar):
 *    ```typescript
 *    const { optimizeMessages } = useTokenOptimization();
 *
 *    // Before sending to API
 *    const { messages: optimizedMessages } = optimizeMessages(allMessages);
 *    // Use optimizedMessages instead of allMessages in API call
 *    ```
 *
 * 2. **MCP Context Optimization** (where MCP servers are loaded):
 *    ```typescript
 *    const { optimizeMCPServers } = useTokenOptimization();
 *
 *    // Before loading MCP contexts
 *    const activeServers = optimizeMCPServers(
 *      availableMCPServers,
 *      messageHistory,
 *      currentPrompt
 *    );
 *    // Only load contexts for activeServers
 *    ```
 *
 * 3. **Statistics Display** (src/components/UsageDashboard.tsx or similar):
 *    ```typescript
 *    const { getStats } = useTokenOptimization();
 *    const stats = getStats();
 *
 *    return (
 *      <div>
 *        <p>Tokens Saved: {stats.totalTokensSaved}</p>
 *        <p>Messages Excluded: {stats.messagesExcluded}</p>
 *        <p>MCP Servers Excluded: {stats.mcpServersExcluded}</p>
 *      </div>
 *    );
 *    ```
 *
 * Key Files to Modify:
 * - src/hooks/usePromptExecution.ts - Add message optimization before API calls
 * - src/lib/api.ts or src/lib/services/llmApiService.ts - Integrate MCP filtering
 * - src/components/UsageDashboard.tsx - Display optimization statistics
 * - src/hooks/useSessionStream.ts - Apply optimization to loaded history
 */

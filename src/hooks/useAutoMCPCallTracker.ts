import { logger } from "@/lib/logger";
import { useEffect, useRef } from "react";

/**
 * 自动追踪 MCP 工具调用时间
 * 监听消息流，检测 MCP 工具调用并更新调用时间
 */

interface MCPCallTimeRecord {
  [engine: string]: {
    [serverId: string]: number; // Unix timestamp
  };
}

const STORAGE_KEY = "mcp_call_times";

/**
 * 从 localStorage 获取所有调用时间记录
 */
function getAllCallTimes(): MCPCallTimeRecord {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    logger.error("useAutoMCPCallTracker", "Failed to load MCP call times:", error);
    return {};
  }
}

/**
 * 保存所有调用时间记录到 localStorage
 */
function saveAllCallTimes(times: MCPCallTimeRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
  } catch (error) {
    logger.error("useAutoMCPCallTracker", "Failed to save MCP call times:", error);
  }
}

/**
 * 从 MCP 工具名称中提取服务器 ID
 * 格式: mcp__serverName__toolName -> serverName
 */
function extractServerIdFromToolName(toolName: string): string | null {
  const match = toolName.match(/^mcp__([^_]+)__/);
  return match ? match[1] : null;
}

/**
 * 更新 MCP 服务器的调用时间
 */
function updateMCPCallTime(engine: "claude" | "codex" | "gemini", serverId: string): void {
  const now = Date.now();
  const allTimes = getAllCallTimes();

  if (!allTimes[engine]) {
    allTimes[engine] = {};
  }

  allTimes[engine][serverId] = now;
  saveAllCallTimes(allTimes);

  logger.debug(
    "useAutoMCPCallTracker",
    `[MCP Call Tracker] Updated call time for ${engine}/${serverId}`
  );
}

/**
 * 检查消息中的 MCP 工具调用
 */
function checkMCPToolCallsInMessage(message: any): Set<string> {
  const mcpServers = new Set<string>();

  if (!message || !message.message || !message.message.content) {
    return mcpServers;
  }

  const content = message.message.content;

  // 检查内容数组中的 tool_use 块
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "tool_use" && typeof block.name === "string") {
        const serverId = extractServerIdFromToolName(block.name);
        if (serverId) {
          mcpServers.add(serverId);
        }
      }
    }
  }

  return mcpServers;
}

/**
 * Hook: 自动追踪 MCP 调用时间
 *
 * @param messages - 消息数组
 * @param engine - 当前引擎类型
 */
export function useAutoMCPCallTracker(
  messages: any[] | undefined,
  engine: "claude" | "codex" | "gemini"
) {
  const processedMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!messages || messages.length === 0) {
      return;
    }

    // 检查最后几条消息中的 MCP 工具调用
    // 只检查新消息，避免重复处理
    const recentMessages = messages.slice(-5); // 检查最后5条消息

    for (const message of recentMessages) {
      // 生成消息 ID（用于去重）
      const messageId = message.id || `${message.timestamp || Date.now()}_${Math.random()}`;

      // 跳过已处理的消息
      if (processedMessageIds.current.has(messageId)) {
        continue;
      }

      // 检查消息中的 MCP 工具调用
      const mcpServers = checkMCPToolCallsInMessage(message);

      // 更新调用时间
      if (mcpServers.size > 0) {
        mcpServers.forEach((serverId) => {
          updateMCPCallTime(engine, serverId);
        });
      }

      // 标记为已处理
      processedMessageIds.current.add(messageId);
    }

    // 清理旧的已处理记录（保留最后1000条）
    if (processedMessageIds.current.size > 1000) {
      const arr = Array.from(processedMessageIds.current);
      processedMessageIds.current = new Set(arr.slice(-1000));
    }
  }, [messages, engine]);
}

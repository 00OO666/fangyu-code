import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";

/**
 * MCP 调用时间记录
 */
interface MCPCallTimeRecord {
  [engine: string]: {
    [serverId: string]: number; // Unix timestamp
  };
}

const STORAGE_KEY = "mcp_call_times";

/**
 * 获取所有 MCP 调用时间记录
 */
function getAllCallTimes(): MCPCallTimeRecord {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    logger.error("useMCPCallTimes", "Failed to load MCP call times:", error);
    return {};
  }
}

/**
 * 保存所有 MCP 调用时间记录
 */
function saveAllCallTimes(times: MCPCallTimeRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
  } catch (error) {
    logger.error("useMCPCallTimes", "Failed to save MCP call times:", error);
  }
}

/**
 * Hook for managing MCP call times
 */
export function useMCPCallTimes(engine: "claude" | "codex" | "gemini") {
  const [callTimes, setCallTimes] = useState<Record<string, number>>({});

  // 加载该引擎的调用时间
  useEffect(() => {
    const allTimes = getAllCallTimes();
    setCallTimes(allTimes[engine] || {});
  }, [engine]);

  /**
   * 更新指定服务器的调用时间为当前时间
   */
  const updateCallTime = (serverId: string) => {
    const now = Date.now();
    const allTimes = getAllCallTimes();

    if (!allTimes[engine]) {
      allTimes[engine] = {};
    }

    allTimes[engine][serverId] = now;
    saveAllCallTimes(allTimes);
    setCallTimes(allTimes[engine]);
  };

  /**
   * 获取指定服务器的最后调用时间
   */
  const getCallTime = (serverId: string): number | undefined => {
    return callTimes[serverId];
  };

  /**
   * 格式化调用时间为相对时间字符串
   */
  const formatCallTime = (timestamp: number | undefined): string => {
    if (!timestamp) return "从未调用";

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    if (seconds > 0) return `${seconds}秒前`;
    return "刚刚";
  };

  /**
   * 格式化调用时间为完整日期时间
   */
  const formatCallTimeFull = (timestamp: number | undefined): string => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return {
    callTimes,
    updateCallTime,
    getCallTime,
    formatCallTime,
    formatCallTimeFull,
  };
}

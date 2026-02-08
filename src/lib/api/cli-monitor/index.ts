/**
 * CLI 监控 API 模块
 * 封装与 Rust 后端的 CLI 监控命令交互
 */

import { invoke } from "@tauri-apps/api/core";
import type { CliSession, ProcessInfo, ScanResult, WindowScanResult } from "@/types/cli-monitor";
import { logger } from "@/lib/logger";

/**
 * 扫描所有 CLI 会话
 * @returns 扫描结果，包含所有会话列表
 */
export async function scanCliSessions(): Promise<ScanResult> {
  try {
    logger.info("CLI Monitor", "Scanning CLI sessions...");
    const result = await invoke<ScanResult>("scan_cli_sessions");
    logger.info("CLI Monitor", `Found ${result.sessions.length} sessions`);
    return result;
  } catch (error) {
    logger.error("CLI Monitor", `Failed to scan CLI sessions: ${error}`);
    throw new Error(`Failed to scan CLI sessions: ${error}`);
  }
}

/**
 * 获取正在运行的进程列表
 * @returns 进程信息列表
 */
export async function getRunningProcesses(): Promise<ProcessInfo[]> {
  try {
    logger.info("CLI Monitor", "Getting running processes...");
    const processes = await invoke<ProcessInfo[]>("get_running_processes");
    logger.info("CLI Monitor", `Found ${processes.length} Claude Code processes`);
    return processes;
  } catch (error) {
    logger.error("CLI Monitor", `Failed to get running processes: ${error}`);
    throw new Error(`Failed to get running processes: ${error}`);
  }
}

/**
 * 监听会话变化（文件系统监听）
 * @param callback 会话变化时的回调函数
 * @returns 取消监听的函数
 */
export async function watchSessions(
  callback: (sessions: CliSession[]) => void
): Promise<() => void> {
  try {
    logger.info("CLI Monitor", "Starting session watch...");

    // 初始扫描
    const initialResult = await scanCliSessions();
    callback(initialResult.sessions);

    // 设置定时轮询（每 5 秒）
    const intervalId = setInterval(async () => {
      try {
        const result = await scanCliSessions();
        callback(result.sessions);
      } catch (error) {
        logger.error("CLI Monitor", `Error during session watch: ${error}`);
      }
    }, 5000);

    // 返回取消监听的函数
    return () => {
      logger.info("CLI Monitor", "Stopping session watch...");
      clearInterval(intervalId);
    };
  } catch (error) {
    logger.error("CLI Monitor", `Failed to start session watch: ${error}`);
    throw new Error(`Failed to start session watch: ${error}`);
  }
}

/**
 * 获取单个会话的详细信息
 * @param sessionId 会话 ID
 * @param sessions 所有会话列表
 * @returns 会话详细信息，如果未找到则返回 null
 */
export function getSessionById(sessionId: string, sessions: CliSession[]): CliSession | null {
  return sessions.find((s) => s.session_id === sessionId) || null;
}

/**
 * 过滤会话列表
 * @param sessions 所有会话列表
 * @param keyword 搜索关键词
 * @param activeOnly 只显示活跃会话
 * @returns 过滤后的会话列表
 */
export function filterSessions(
  sessions: CliSession[],
  keyword?: string,
  activeOnly?: boolean
): CliSession[] {
  let filtered = sessions;

  // 过滤活跃状态
  if (activeOnly) {
    filtered = filtered.filter((s) => s.is_active);
  }

  // 关键词搜索
  if (keyword && keyword.trim()) {
    const lowerKeyword = keyword.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.summary.toLowerCase().includes(lowerKeyword) ||
        s.project_path.toLowerCase().includes(lowerKeyword) ||
        s.git_branch?.toLowerCase().includes(lowerKeyword) ||
        s.session_id.toLowerCase().includes(lowerKeyword)
    );
  }

  return filtered;
}

/**
 * 排序会话列表
 * @param sessions 会话列表
 * @param sortBy 排序字段
 * @param direction 排序方向
 * @returns 排序后的会话列表
 */
export function sortSessions(
  sessions: CliSession[],
  sortBy: "modified" | "created" | "message_count" | "project_path",
  direction: "asc" | "desc" = "desc"
): CliSession[] {
  const sorted = [...sessions].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "modified":
        comparison = a.modified - b.modified;
        break;
      case "created":
        comparison = a.created - b.created;
        break;
      case "message_count":
        comparison = a.message_count - b.message_count;
        break;
      case "project_path":
        comparison = a.project_path.localeCompare(b.project_path);
        break;
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * 扫描所有 Claude CLI 窗口
 * @returns 窗口扫描结果
 */
export async function scanWindows(): Promise<WindowScanResult> {
  try {
    logger.info("CLI Monitor", "Scanning Claude CLI windows...");
    const result = await invoke<WindowScanResult>("scan_windows");
    logger.info("CLI Monitor", `Found ${result.total_count} windows`);
    return result;
  } catch (error) {
    logger.error("CLI Monitor", `Failed to scan windows: ${error}`);
    throw new Error(`Failed to scan windows: ${error}`);
  }
}

/**
 * 聚焦指定窗口
 * @param hwnd - 窗口句柄
 */
export async function focusWindow(hwnd: number): Promise<void> {
  try {
    logger.info("CLI Monitor", `Focusing window: hwnd=${hwnd}`);
    await invoke<void>("focus_window", { hwnd });
    logger.info("CLI Monitor", `Successfully focused window: hwnd=${hwnd}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("CLI Monitor", `Failed to focus window (hwnd=${hwnd}):`, error);
    throw new Error(`Failed to focus window: ${errorMsg}`);
  }
}

/**
 * 开始监控文件系统变化
 */
export async function startFileWatching(): Promise<void> {
  try {
    logger.info("CLI Monitor", "Starting file system watching...");
    await invoke<void>("start_file_watching");
    logger.info("CLI Monitor", "File system watching started");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("CLI Monitor", `Failed to start file watching: ${errorMsg}`);
    throw new Error(`Failed to start file watching: ${errorMsg}`);
  }
}

/**
 * 停止监控文件系统变化
 */
export async function stopFileWatching(): Promise<void> {
  try {
    logger.info("CLI Monitor", "Stopping file system watching...");
    await invoke<void>("stop_file_watching");
    logger.info("CLI Monitor", "File system watching stopped");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("CLI Monitor", `Failed to stop file watching: ${errorMsg}`);
    throw new Error(`Failed to stop file watching: ${errorMsg}`);
  }
}

/**
 * 获取文件变化事件
 */
export async function getFileEvents(): Promise<FileChangeEvent[]> {
  try {
    const events = await invoke<FileChangeEvent[]>("get_file_events");
    return events;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("CLI Monitor", `Failed to get file events: ${errorMsg}`);
    throw new Error(`Failed to get file events: ${errorMsg}`);
  }
}

/**
 * 检查是否正在监控文件系统
 */
export async function isFileWatching(): Promise<boolean> {
  try {
    const watching = await invoke<boolean>("is_file_watching");
    return watching;
  } catch (error) {
    logger.error("CLI Monitor", `Failed to check file watching status: ${error}`);
    throw new Error(`Failed to check file watching status: ${error}`);
  }
}

/**
 * 文件变化事件类型
 */
export interface FileChangeEvent {
  path: string;
  change_type: "Created" | "Modified" | "Deleted";
  timestamp: number;
}

/**
 * 会话消息
 */
export interface SessionMessage {
  role: string;
  content: string;
  timestamp?: number;
}

/**
 * 会话内容
 */
export interface SessionContent {
  session_id: string;
  messages: SessionMessage[];
  total_messages: number;
}

/**
 * 读取会话内容
 * @param sessionId - 会话 ID
 */
export async function readSessionContent(sessionId: string): Promise<SessionContent> {
  try {
    logger.info("CLI Monitor", `Reading session content: ${sessionId}`);
    const content = await invoke<SessionContent>("read_session_content", { sessionId });
    logger.info("CLI Monitor", `Read ${content.total_messages} messages from session ${sessionId}`);
    return content;
  } catch (error) {
    logger.error(`[CLI Monitor] Failed to read session content (${sessionId}):`, error);
    throw new Error(`Failed to read session content: ${error}`);
  }
}

/**
 * 读取会话的最后 N 条消息
 * @param sessionId - 会话 ID
 * @param count - 消息数量
 */
export async function readLastMessages(sessionId: string, count: number): Promise<SessionContent> {
  try {
    logger.info("CLI Monitor", `Reading last ${count} messages from session ${sessionId}`);
    const content = await invoke<SessionContent>("read_last_messages", { sessionId, count });
    logger.info(
      "CLI Monitor",
      `Read ${content.messages.length} messages from session ${sessionId}`
    );
    return content;
  } catch (error) {
    logger.error(`[CLI Monitor] Failed to read last messages (${sessionId}):`, error);
    throw new Error(`Failed to read last messages: ${error}`);
  }
}

/**
 * 获取会话摘要
 * @param sessionId - 会话 ID
 * @param maxChars - 最大字符数
 */
export async function getSessionSummary(
  sessionId: string,
  maxChars: number = 100
): Promise<string> {
  try {
    const summary = await invoke<string>("get_session_summary", { sessionId, maxChars });
    return summary;
  } catch (error) {
    logger.error(`[CLI Monitor] Failed to get session summary (${sessionId}):`, error);
    throw new Error(`Failed to get session summary: ${error}`);
  }
}

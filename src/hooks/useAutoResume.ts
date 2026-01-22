/**
 * 自动继续任务 Hook - 智能检测并自动恢复未完成的任务
 *
 * 设计原则（Cost-Effective UX）：
 * 1. 智能检测：基于 TodoList + 消息分析，精确判断是否需要继续
 * 2. 安全机制：防抖 + 次数限制 + 间隔限制，防止崩溃和无限循环
 * 3. 用户控制：倒计时 + 取消按钮，用户可随时中断
 * 4. 成本优化：避免用户重复说"继续"，节省 token 费用
 *
 * 参考资料：
 * - https://blog.logrocket.com/solve-react-useeffect-hook-infinite-loop-patterns/
 * - https://dmitripavlutin.com/react-throttle-debounce/
 * - https://www.letsgroto.com/blog/ux-best-practices-for-ai-chatbots
 */

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClaudeStreamMessage } from "@/types/claude";

// 🔧 FIX: Use ref to track messages without triggering re-renders

// 🚨 EMERGENCY KILL SWITCH: Set to false to completely disable auto-resume
const AUTO_RESUME_ENABLED = false;  // 🔧 临时禁用以诊断 token 消耗问题

interface AutoResumeConfig {
  /** 会话 ID */
  sessionId: string | null | undefined;
  /** 消息列表 */
  messages: ClaudeStreamMessage[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在流式传输 */
  isStreaming: boolean;
  /** 触发延迟（毫秒），默认 5000ms */
  delay?: number;
  /** 最大连续继续次数，默认 5 次 */
  maxAttempts?: number;
  /** 每次继续的最小间隔（毫秒），默认 30000ms */
  minInterval?: number;
  /** 会话不活跃超时（毫秒），默认 1 小时 */
  inactiveTimeout?: number;
}

interface AutoResumeReturn {
  /** 是否应该自动继续 */
  shouldResume: boolean;
  /** 倒计时剩余秒数 */
  countdown: number;
  /** 取消自动继续 */
  cancel: () => void;
  /** 手动触发继续 */
  resume: () => void;
  /** 是否已取消 */
  isCancelled: boolean;
  /** 剩余可继续次数 */
  remainingAttempts: number;
}

const DEFAULT_CONFIG = {
  delay: 5000,
  maxAttempts: 5,
  minInterval: 30000,
  inactiveTimeout: 60 * 60 * 1000, // 1 hour
};

/**
 * 从 localStorage 获取会话元数据
 */
function getSessionMetadata(sessionId: string) {
  const key = `auto_resume_${sessionId}`;
  const data = localStorage.getItem(key);
  if (!data) {
    return {
      attemptCount: 0,
      lastResumeTime: 0,
      cancelled: false,
    };
  }
  try {
    return JSON.parse(data);
  } catch {
    return {
      attemptCount: 0,
      lastResumeTime: 0,
      cancelled: false,
    };
  }
}

/**
 * 保存会话元数据到 localStorage
 */
function saveSessionMetadata(
  sessionId: string,
  metadata: {
    attemptCount: number;
    lastResumeTime: number;
    cancelled: boolean;
  },
) {
  const key = `auto_resume_${sessionId}`;
  localStorage.setItem(key, JSON.stringify(metadata));
}

/**
 * 从消息中提取文本内容
 */
function extractMessageContent(msg: ClaudeStreamMessage): string {
  // 尝试多种可能的内容字段
  if (typeof msg.content === "string") {
    return msg.content;
  }
  if (typeof msg.text === "string") {
    return msg.text;
  }
  if (msg.message?.content) {
    if (typeof msg.message.content === "string") {
      return msg.message.content;
    }
    if (Array.isArray(msg.message.content)) {
      return msg.message.content
        .map((item: any) => (typeof item === "string" ? item : item?.text || ""))
        .join(" ");
    }
  }
  return "";
}

/**
 * 从消息中提取最新的 TodoList
 */
function extractLatestTodoList(messages: ClaudeStreamMessage[]): any[] | null {
  // 倒序查找包含 TodoWrite 的消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    // 检查是否是工具调用消息
    if (msg.type === "result" || msg.type === "assistant") {
      // 尝试从不同的可能字段提取 todos
      const todos =
        (msg as any).todos ||
        (msg as any).result?.todos ||
        (msg as any).message?.content?.todos ||
        (msg as any).tool_use?.parameters?.todos;

      if (todos && Array.isArray(todos)) {
        logger.debug('useAutoResume', "[useAutoResume] 📋 Found TodoList with", todos.length, "items");
        return todos;
      }
    }
  }

  logger.debug('useAutoResume', "[useAutoResume] ℹ️ No TodoList found in messages");
  return null;
}

/**
 * 检测 TodoList 中是否有未完成的任务
 */
function detectIncompleteTasksFromTodo(todos: any[]): boolean {
  const hasInProgress = todos.some(
    (todo) => todo.status === "in_progress" || todo.status === "pending",
  );

  if (hasInProgress) {
    const inProgressTasks = todos.filter((t) => t.status === "in_progress");
    const pendingTasks = todos.filter((t) => t.status === "pending");
    logger.debug('useAutoResume', '🎯 Found incomplete tasks:', {
      in_progress: inProgressTasks.length,
      pending: pendingTasks.length,
    });

    // 如果有 in_progress 任务，肯定需要继续
    if (inProgressTasks.length > 0) {
      return true;
    }

    // 如果只有 pending 任务，检查已完成任务的数量
    // 如果有已完成的任务，说明 Claude 正在执行，需要继续
    const completedTasks = todos.filter((t) => t.status === "completed");
    if (completedTasks.length > 0 && pendingTasks.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * 检测是否有未完成的任务（基于消息内容）
 * 🔧 IMPROVED: More strict detection to reduce false positives
 */
function detectIncompleteTasksFromContent(messages: ClaudeStreamMessage[]): boolean {
  // 🔧 FIX: Only check last 3 messages instead of 10 to reduce false positives
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - 3); i--) {
    const msg = messages[i];
    const msgType = msg.type || msg.role;

    // 跳过 system 消息
    if (msgType === "system") continue;

    // 如果最后一条是用户消息，不需要继续（用户已经发送了新消息）
    if (msgType === "user" && i === messages.length - 1) {
      logger.debug('useAutoResume', "[useAutoResume] 📝 Last message is from user, no need to resume");
      return false;
    }

    // 如果是 assistant 消息，检查是否有未完成的任务
    if (msgType === "assistant" || msgType === "result") {
      const content = extractMessageContent(msg).toLowerCase();

      if (!content) continue;

      // 🔧 IMPROVED: More strict keyword matching
      // 1. 检查是否有明确的待续标记（减少关键词，提高精确度）
      const hasContinueMarker =
        content.includes("待续") ||
        content.includes("未完成") ||
        (content.includes("in_progress") && content.includes("status"));  // Must have both

      // 2. 检查是否有工具调用失败
      const hasToolError =
        content.includes("error") ||
        content.includes("failed") ||
        content.includes("失败") ||
        content.includes("错误");

      // 3. 检查是否有明确的结束标记
      const hasEndMarker =
        content.includes("已完成") ||
        content.includes("全部完成") ||
        content.includes("任务完成") ||
        content.includes("done") ||
        content.includes("finished") ||
        content.includes("completed") ||
        content.includes("all done");

      // 如果有继续标记或工具错误，且没有明确结束，认为需要继续
      if ((hasContinueMarker || hasToolError) && !hasEndMarker) {
        logger.debug('useAutoResume', '🎯 Detected incomplete task from content:', content.slice(0, 100));
        return true;
      }

      // 如果有明确结束标记，不需要继续
      if (hasEndMarker) {
        logger.debug('useAutoResume', "[useAutoResume] ✅ Found end marker, no need to resume");
        return false;
      }
    }
  }

  return false;
}

/**
 * 检测是否有未完成的任务（综合判断）
 */
function detectIncompleteTasks(messages: ClaudeStreamMessage[]): boolean {
  if (!messages || messages.length === 0) return false;

  logger.debug('useAutoResume', "[useAutoResume] 🔍 Checking", messages.length, "messages for incomplete tasks");

  // 🆕 优先级 1: 检查 TodoList 中的 in_progress 状态（最准确）
  const latestTodos = extractLatestTodoList(messages);
  if (latestTodos) {
    const hasTodoIncomplete = detectIncompleteTasksFromTodo(latestTodos);
    if (hasTodoIncomplete) {
      return true;
    }
  }

  // 🆕 优先级 2: 检查消息内容中的关键词（兜底方案）
  return detectIncompleteTasksFromContent(messages);
}

/**
 * 自动继续任务 Hook
 */
export function useAutoResume(config: AutoResumeConfig): AutoResumeReturn {
  const {
    sessionId,
    messages,
    isLoading,
    isStreaming,
    delay = DEFAULT_CONFIG.delay,
    maxAttempts = DEFAULT_CONFIG.maxAttempts,
    minInterval = DEFAULT_CONFIG.minInterval,
    inactiveTimeout = DEFAULT_CONFIG.inactiveTimeout,
  } = config;

  // 状态
  const [shouldResume, setShouldResume] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);

  // Refs（避免 useEffect 依赖导致无限循环）
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const metadataRef = useRef({ attemptCount: 0, lastResumeTime: 0, cancelled: false });

  // 🔧 CRITICAL FIX: Use ref for messages to prevent infinite loop
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 加载会话元数据
  useEffect(() => {
    if (!sessionId) return;
    const metadata = getSessionMetadata(sessionId);
    metadataRef.current = metadata;
    setIsCancelled(metadata.cancelled);
  }, [sessionId]);

  // 清理定时器
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // 取消自动继续
  const cancel = useCallback(() => {
    logger.debug('useAutoResume', "[useAutoResume] ❌ User cancelled auto-resume");
    clearTimers();
    setShouldResume(false);
    setCountdown(0);
    setIsCancelled(true);

    if (sessionId) {
      saveSessionMetadata(sessionId, {
        ...metadataRef.current,
        cancelled: true,
      });
    }
  }, [sessionId, clearTimers]);

  // 手动触发继续
  const resume = useCallback(() => {
    logger.debug('useAutoResume', "[useAutoResume] ✅ Manual resume triggered");
    clearTimers();
    setShouldResume(true);
    setCountdown(0);

    if (sessionId) {
      const now = Date.now();
      metadataRef.current = {
        attemptCount: metadataRef.current.attemptCount + 1,
        lastResumeTime: now,
        cancelled: false,
      };
      saveSessionMetadata(sessionId, metadataRef.current);
    }
  }, [sessionId, clearTimers]);

  // 主逻辑：检测并触发自动继续
  useEffect(() => {
    // 🚨 EMERGENCY KILL SWITCH: Check if auto-resume is enabled
    if (!AUTO_RESUME_ENABLED) {
      logger.debug('useAutoResume', "[useAutoResume] 🚫 Auto-resume is disabled by kill switch");
      return;
    }

    // 清理之前的定时器
    clearTimers();

    // 前置检查：必要条件
    if (!sessionId || isLoading || isStreaming || isCancelled) {
      return;
    }

    // 检查是否超过最大尝试次数
    if (metadataRef.current.attemptCount >= maxAttempts) {
      logger.debug('useAutoResume', "[useAutoResume] 🛑 Max attempts reached:", maxAttempts);
      return;
    }

    // 检查是否在最小间隔内
    const now = Date.now();
    const timeSinceLastResume = now - metadataRef.current.lastResumeTime;
    if (timeSinceLastResume < minInterval) {
      logger.debug('useAutoResume', "[useAutoResume] ⏱️ Too soon to resume:", timeSinceLastResume, "ms");
      return;
    }

    // 检查会话是否超时（仅当消息有时间戳时检查）
    // 🔧 FIX: Use messagesRef to access current messages
    if (messagesRef.current.length > 0) {
      const lastMessage = messagesRef.current[messagesRef.current.length - 1];

      // 🔧 FIX: 如果消息没有 timestamp，说明是刚加载的历史消息，跳过超时检查
      if (lastMessage.timestamp) {
        const lastMessageTime = new Date(lastMessage.timestamp).getTime();
        const timeSinceLastMessage = now - lastMessageTime;

        if (timeSinceLastMessage > inactiveTimeout) {
          logger.debug('useAutoResume', '⏰ Session inactive for too long:', timeSinceLastMessage, 'ms');
          return;
        }
      } else {
        logger.debug('useAutoResume', 'ℹ️ Message has no timestamp, skipping timeout check (likely historical data)');
      }
    }

    // 检测是否有未完成的任务
    // 🔧 CRITICAL FIX: Use messagesRef instead of messages to prevent infinite loop
    const hasIncompleteTasks = detectIncompleteTasks(messagesRef.current);
    if (!hasIncompleteTasks) {
      logger.debug('useAutoResume', "[useAutoResume] ✅ No incomplete tasks detected");
      return;
    }

    logger.debug('useAutoResume', "[useAutoResume] 🚀 Starting auto-resume countdown...");

    // 开始倒计时
    let remainingSeconds = Math.floor(delay / 1000);
    setCountdown(remainingSeconds);

    // 倒计时定时器
    const startCountdown = () => {
      countdownTimerRef.current = setInterval(() => {
        remainingSeconds -= 1;
        setCountdown(remainingSeconds);

        if (remainingSeconds <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
        }
      }, 1000);
    };

    startCountdown();

    // 主定时器：delay 后触发继续
    timerRef.current = setTimeout(() => {
      logger.debug('useAutoResume', "[useAutoResume] ✅ Auto-resume triggered!");
      setShouldResume(true);
      setCountdown(0);

      // 更新元数据
      metadataRef.current = {
        attemptCount: metadataRef.current.attemptCount + 1,
        lastResumeTime: Date.now(),
        cancelled: false,
      };
      saveSessionMetadata(sessionId, metadataRef.current);
    }, delay);

    // 清理函数
    return () => {
      clearTimers();
    };
  }, [
    sessionId,
    // 🔧 CRITICAL FIX: Removed 'messages' from dependencies to prevent infinite loop
    // messages, ❌ This caused infinite loop: auto-resume → new messages → re-trigger
    isLoading,
    isStreaming,
    isCancelled,
    delay,
    maxAttempts,
    minInterval,
    inactiveTimeout,
    clearTimers,
  ]);

  // 当 shouldResume 变为 true 后，立即重置（避免重复触发）
  useEffect(() => {
    if (shouldResume) {
      const timer = setTimeout(() => {
        setShouldResume(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [shouldResume]);

  return {
    shouldResume,
    countdown,
    cancel,
    resume,
    isCancelled,
    remainingAttempts: Math.max(0, maxAttempts - metadataRef.current.attemptCount),
  };
}

export default useAutoResume;

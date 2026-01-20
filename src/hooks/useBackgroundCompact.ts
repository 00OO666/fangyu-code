/**
 * useBackgroundCompact Hook - v2.0
 *
 * 🎯 后台无缝压缩上下文（Invisible UX 设计）
 *
 * 设计原则（参考搜索结果）：
 * 1. Invisible UX - 压缩过程对用户完全透明，不打断任何操作
 * 2. Hierarchical Summarization - 旧内容压缩，新内容保持原样
 * 3. Attention Sinks - 压缩期间继续处理新输入，动态合并
 * 4. Persistent Streaming - 压缩完成后无缝衔接，行云流水
 *
 * 工作流程：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  正常操作 (0-75%)                                                │
 * │     ↓                                                           │
 * │  达到 75% → 后台静默启动压缩（用户无感知）                        │
 * │     ↓                                                           │
 * │  压缩期间：用户继续操作，新消息实时捕获到增量队列                  │
 * │     ↓                                                           │
 * │  压缩完成 → 合并增量消息 → 自动切换上下文（200ms 无缝过渡）        │
 * │     ↓                                                           │
 * │  继续操作（用户完全无感知压缩发生过）                             │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { logger } from '@/lib/logger';
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { notify } from "@/services/notificationService";
import { NotificationTemplates } from "@/types/notification";

// 压缩状态（内部状态，UI 可选择性显示微妙指示器）
export type CompactStatus =
  | "idle" // 空闲
  | "preparing" // 准备中（收集上下文快照）
  | "compacting" // 压缩中（后台执行，用户继续操作）
  | "merging" // 合并中（合并压缩期间的新消息）
  | "switching" // 切换中（200ms 无缝过渡）
  | "error"; // 错误（静默恢复）

// 压缩期间捕获的增量消息
export interface DeltaMessage {
  id: string;
  type: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  rawPayload?: string; // 原始 JSONL，用于完整恢复
}

// Hook 配置
interface UseBackgroundCompactConfig {
  /** 当前会话 ID */
  sessionId?: string;
  /** 项目路径 */
  projectPath?: string;
  /** 触发压缩的阈值（0-1，默认 0.75 = 75%）*/
  compactThreshold?: number;
  /** ⚠️ 是否启用自动压缩（默认 false - 后端未实现） */
  autoCompact?: boolean;
  /** 上下文使用率（0-1） */
  contextUsage?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 当前 token 数 */
  currentTokens?: number;
}

// Hook 返回值
interface UseBackgroundCompactReturn {
  /** 当前压缩状态（内部状态，UI 可选择性显示） */
  status: CompactStatus;
  /** 是否正在压缩（UI 可显示微妙的指示器） */
  isCompacting: boolean;
  /** 压缩进度（0-100，仅供诊断） */
  progress: number;
  /** 增量消息数量（压缩期间捕获的新消息） */
  deltaMessagesCount: number;
  /** 手动触发压缩（通常不需要，自动触发） */
  triggerCompact: () => Promise<void>;
  /** 捕获新消息到增量队列（压缩期间调用） */
  captureDeltaMessage: (message: Omit<DeltaMessage, "id" | "timestamp">) => void;
  /** 获取增量消息（用于合并到新会话） */
  getDeltaMessages: () => DeltaMessage[];
  /** 清除增量消息 */
  clearDeltaMessages: () => void;
  /** 压缩完成后的新会话 ID（用于自动切换） */
  newSessionId?: string;
  /** 是否应该切换到新会话（触发无缝过渡） */
  shouldSwitchSession: boolean;
  /** 确认切换完成（由使用方调用，确认已切换） */
  confirmSwitch: () => void;
}

export function useBackgroundCompact(
  config: UseBackgroundCompactConfig,
): UseBackgroundCompactReturn {
  const {
    sessionId,
    projectPath,
    compactThreshold = 0.75, // 🎯 75% 阈值
    autoCompact = false, // ⚠️ 默认禁用 - 后端未实现 compact-session-request
    contextUsage = 0,
    maxTokens = 200000,
    currentTokens = 0,
  } = config;

  // 状态
  const [status, setStatus] = useState<CompactStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [deltaMessages, setDeltaMessages] = useState<DeltaMessage[]>([]);
  const [newSessionId, setNewSessionId] = useState<string | undefined>();
  const [shouldSwitchSession, setShouldSwitchSession] = useState(false);

  // Refs
  const compactTaskRef = useRef<AbortController | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const isMountedRef = useRef(true);
  const hasTriggeredCompactRef = useRef(false);
  const compactStartTimeRef = useRef<number>(0);
  const compactNotificationIdRef = useRef<string | null>(null); // 🆕 存储通知 ID

  // 计算上下文使用率
  const calculatedUsage = contextUsage || (maxTokens > 0 ? currentTokens / maxTokens : 0);

  // 是否正在压缩（用户操作不受影响）
  const isCompacting = status === "preparing" || status === "compacting" || status === "merging";

  // 捕获增量消息（压缩期间继续操作产生的新消息）
  const captureDeltaMessage = useCallback(
    (message: Omit<DeltaMessage, "id" | "timestamp">) => {
      if (!isCompacting) return; // 只在压缩期间捕获

      const deltaMsg: DeltaMessage = {
        ...message,
        id: `delta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
      };

      setDeltaMessages((prev) => [...prev, deltaMsg]);
      console.log(
        "[BackgroundCompact] 🔄 Captured delta message:",
        message.type,
        message.content.slice(0, 50),
      );
    },
    [isCompacting],
  );

  // 获取增量消息
  const getDeltaMessages = useCallback(() => deltaMessages, [deltaMessages]);

  // 清除增量消息
  const clearDeltaMessages = useCallback(() => {
    setDeltaMessages([]);
  }, []);

  // ⚠️ 后台压缩功能已修复：使用 Tauri invoke 直接调用 execute_compact 命令
  // 不再依赖事件监听，避免超时问题
  const COMPACT_TIMEOUT_MS = 60000; // 60 秒超时（压缩可能需要较长时间）

  // 执行压缩（后台，不阻塞用户操作）
  const executeCompact = useCallback(async () => {
    if (!sessionId || !projectPath || compactTaskRef.current) {
      return;
    }

    logger.debug('useBackgroundCompact', "[BackgroundCompact] 🚀 Starting background compact for session:", sessionId);
    compactStartTimeRef.current = Date.now();
    setStatus("preparing");
    setProgress(0);
    setDeltaMessages([]); // 清空之前的增量

    // 🆕 显示全局通知 - 后台压缩开始
    const template = NotificationTemplates.compactStart();
    const notificationId = notify.info(template.message, template);
    compactNotificationIdRef.current = notificationId;

    const abortController = new AbortController();
    compactTaskRef.current = abortController;

    try {
      // 1. 准备阶段
      setStatus("compacting");
      setProgress(10);

      // 🔧 修复：使用 Tauri invoke 直接调用 execute_compact 命令
      // 不再使用事件监听，避免后端未实现事件监听器的问题
      const { invoke } = await import("@tauri-apps/api/core");

      interface CompactResult {
        success: boolean;
        message: string;
        tokens_before?: number;
        tokens_after?: number;
      }

      // 监听进度事件
      const progressUnlisten = await listen<number>("compact-progress", (evt) => {
        if (!isMountedRef.current || abortController.signal.aborted) return;
        setProgress(evt.payload);
      });
      unlistenRefs.current.push(progressUnlisten);

      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          if (!abortController.signal.aborted) {
            reject(new Error("Compact timeout"));
          }
        }, COMPACT_TIMEOUT_MS);
      });

      // 调用 Tauri 命令
      const result = await Promise.race([
        invoke<CompactResult>("execute_compact", {
          sessionId,
          projectPath,
          instructions: null,
        }),
        timeoutPromise,
      ]);

      if (abortController.signal.aborted) {
        logger.debug('useBackgroundCompact', "[BackgroundCompact] Aborted during compact");
        return;
      }

      if (!result.success) {
        throw new Error(result.message || "Compact failed");
      }

      logger.debug('useBackgroundCompact', "[BackgroundCompact] ✅ Compact complete:", result.message);
      logger.debug('useBackgroundCompact', "[BackgroundCompact] 📝 Delta messages captured:", deltaMessages.length);

      // 2. 合并阶段：将压缩期间的增量消息追加到新会话
      if (deltaMessages.length > 0) {
        setStatus("merging");
        logger.debug('useBackgroundCompact', "[BackgroundCompact] 🔀 Merging", deltaMessages.length, "delta messages...");
        // Note: 增量消息合并逻辑可以在这里实现
      }

      // 3. 切换阶段：无缝过渡
      setStatus("switching");
      setProgress(100);
      // Note: /compact 命令会在当前会话中执行，不会创建新会话
      // 所以不需要切换会话，只需要通知用户压缩完成
      setShouldSwitchSession(false);

      // 200ms 过渡动画时间
      await new Promise((r) => setTimeout(r, 200));

      logger.debug('useBackgroundCompact', "[BackgroundCompact] 🎯 Compact completed successfully");

      // 🆕 关闭"后台压缩中"通知，显示"压缩完成"通知
      if (compactNotificationIdRef.current) {
        notify.close(compactNotificationIdRef.current);
        compactNotificationIdRef.current = null;
      }
      const completeTemplate = NotificationTemplates.compactComplete();
      notify.success(completeTemplate.message, completeTemplate);

      // 重置状态
      setStatus("idle");
      setProgress(0);
      hasTriggeredCompactRef.current = false;
    } catch (err) {
      const error = err as Error;

      // 🆕 清理所有监听器，防止内存泄漏
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];

      logger.error('useBackgroundCompact', "[BackgroundCompact] ❌ Compact failed:", error.message);
      setStatus("idle");

      // 🆕 关闭"后台压缩中"通知，显示错误通知
      if (compactNotificationIdRef.current) {
        notify.close(compactNotificationIdRef.current);
        compactNotificationIdRef.current = null;
      }

      const errorMessage = error.message === "Compact timeout"
        ? "压缩超时（60 秒）"
        : error.message;

      const errorTemplate = NotificationTemplates.compactError(errorMessage);
      notify.error(errorTemplate.message, errorTemplate);

      // 重置状态
      hasTriggeredCompactRef.current = false;
      setProgress(0);
    } finally {
      compactTaskRef.current = null;
    }
  }, [sessionId, projectPath, deltaMessages]);

  // 手动触发压缩
  const triggerCompact = useCallback(async () => {
    if (isCompacting) {
      logger.warn('useBackgroundCompact', "[BackgroundCompact] Already compacting, skipping");
      return;
    }
    hasTriggeredCompactRef.current = true;
    await executeCompact();
  }, [isCompacting, executeCompact]);

  // 确认切换完成
  const confirmSwitch = useCallback(() => {
    logger.debug('useBackgroundCompact', "[BackgroundCompact] ✨ Switch confirmed, cleaning up");
    setShouldSwitchSession(false);
    setStatus("idle");
    setProgress(0);
    setDeltaMessages([]);
    setNewSessionId(undefined);
    hasTriggeredCompactRef.current = false;
  }, []);

  // 自动压缩逻辑
  useEffect(() => {
    if (!autoCompact || !sessionId) return;
    if (isCompacting || status === "switching") return;
    if (hasTriggeredCompactRef.current) return;

    // 🔧 v2.8.1: 添加调试日志，帮助诊断压缩功能失效问题
    if (import.meta.env.DEV) {
      console.log('[BackgroundCompact] 🔍 Auto-compact check:', {
        autoCompact,
        sessionId: sessionId?.slice(0, 8),
        calculatedUsage: (calculatedUsage * 100).toFixed(1) + '%',
        compactThreshold: (compactThreshold * 100).toFixed(1) + '%',
        shouldTrigger: calculatedUsage >= compactThreshold,
        isCompacting,
        status,
        hasTriggered: hasTriggeredCompactRef.current,
      });
    }

    // 达到 75% 阈值时触发后台压缩
    if (calculatedUsage >= compactThreshold) {
      console.log(
        `[BackgroundCompact] 📊 Context usage ${(calculatedUsage * 100).toFixed(1)}% >= ${(compactThreshold * 100).toFixed(1)}% threshold`,
      );
      console.log(
        "[BackgroundCompact] 🔄 Auto-triggering background compact (user can continue working)",
      );
      hasTriggeredCompactRef.current = true;
      executeCompact();
    }
  }, [
    autoCompact,
    sessionId,
    calculatedUsage,
    compactThreshold,
    isCompacting,
    status,
    executeCompact,
  ]);

  // 清理
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // 取消进行中的压缩
      if (compactTaskRef.current) {
        compactTaskRef.current.abort();
      }
      // 清理所有监听器
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];
    };
  }, []);

  return {
    status,
    isCompacting,
    progress,
    deltaMessagesCount: deltaMessages.length,
    triggerCompact,
    captureDeltaMessage,
    getDeltaMessages,
    clearDeltaMessages,
    newSessionId,
    shouldSwitchSession,
    confirmSwitch,
  };
}

export default useBackgroundCompact;

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

import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';

// 压缩状态（内部状态，UI 可选择性显示微妙指示器）
export type CompactStatus =
  | 'idle'           // 空闲
  | 'preparing'      // 准备中（收集上下文快照）
  | 'compacting'     // 压缩中（后台执行，用户继续操作）
  | 'merging'        // 合并中（合并压缩期间的新消息）
  | 'switching'      // 切换中（200ms 无缝过渡）
  | 'error';         // 错误（静默恢复）

// 压缩期间捕获的增量消息
export interface DeltaMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  rawPayload?: string;  // 原始 JSONL，用于完整恢复
}

// Hook 配置
interface UseBackgroundCompactConfig {
  /** 当前会话 ID */
  sessionId?: string;
  /** 项目路径 */
  projectPath?: string;
  /** 触发压缩的阈值（0-1，默认 0.75 = 75%）*/
  compactThreshold?: number;
  /** 是否启用自动压缩（默认 true） */
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
  captureDeltaMessage: (message: Omit<DeltaMessage, 'id' | 'timestamp'>) => void;
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

export function useBackgroundCompact(config: UseBackgroundCompactConfig): UseBackgroundCompactReturn {
  const {
    sessionId,
    projectPath,
    compactThreshold = 0.75,  // 🎯 75% 阈值
    autoCompact = true,
    contextUsage = 0,
    maxTokens = 200000,
    currentTokens = 0,
  } = config;

  // 状态
  const [status, setStatus] = useState<CompactStatus>('idle');
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

  // 计算上下文使用率
  const calculatedUsage = contextUsage || (maxTokens > 0 ? currentTokens / maxTokens : 0);

  // 是否正在压缩（用户操作不受影响）
  const isCompacting = status === 'preparing' || status === 'compacting' || status === 'merging';

  // 捕获增量消息（压缩期间继续操作产生的新消息）
  const captureDeltaMessage = useCallback((message: Omit<DeltaMessage, 'id' | 'timestamp'>) => {
    if (!isCompacting) return;  // 只在压缩期间捕获

    const deltaMsg: DeltaMessage = {
      ...message,
      id: `delta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    setDeltaMessages(prev => [...prev, deltaMsg]);
    console.log('[BackgroundCompact] 🔄 Captured delta message:', message.type, message.content.slice(0, 50));
  }, [isCompacting]);

  // 获取增量消息
  const getDeltaMessages = useCallback(() => deltaMessages, [deltaMessages]);

  // 清除增量消息
  const clearDeltaMessages = useCallback(() => {
    setDeltaMessages([]);
  }, []);

  // 执行压缩（后台，不阻塞用户操作）
  const executeCompact = useCallback(async () => {
    if (!sessionId || compactTaskRef.current) {
      return;
    }

    console.log('[BackgroundCompact] 🚀 Starting background compact for session:', sessionId);
    compactStartTimeRef.current = Date.now();
    setStatus('preparing');
    setProgress(0);
    setDeltaMessages([]);  // 清空之前的增量

    const abortController = new AbortController();
    compactTaskRef.current = abortController;

    try {
      // 1. 准备阶段：收集当前上下文快照
      setStatus('compacting');

      // 监听压缩进度
      const progressUnlisten = await listen<number>('compact-progress', (evt) => {
        if (!isMountedRef.current || abortController.signal.aborted) return;
        setProgress(evt.payload);
      });
      unlistenRefs.current.push(progressUnlisten);

      // 监听压缩完成
      const completePromise = new Promise<string>((resolve, reject) => {
        listen<{ newSessionId: string; summary?: string }>('compact-complete', (evt) => {
          if (!isMountedRef.current || abortController.signal.aborted) {
            reject(new Error('Aborted'));
            return;
          }
          resolve(evt.payload.newSessionId);
        }).then(unlisten => unlistenRefs.current.push(unlisten));

        listen<string>('compact-error', (evt) => {
          if (!isMountedRef.current || abortController.signal.aborted) return;
          reject(new Error(evt.payload));
        }).then(unlisten => unlistenRefs.current.push(unlisten));
      });

      // 触发后端压缩（通过事件）
      await emit('compact-session-request', {
        sessionId,
        projectPath,
        background: true,
      });

      // 等待压缩完成（期间用户可以继续操作，新消息通过 captureDeltaMessage 捕获）
      const completedSessionId = await completePromise;

      console.log('[BackgroundCompact] ✅ Compact complete, new session:', completedSessionId);
      console.log('[BackgroundCompact] 📝 Delta messages captured:', deltaMessages.length);

      // 2. 合并阶段：将压缩期间的增量消息追加到新会话
      if (deltaMessages.length > 0) {
        setStatus('merging');
        console.log('[BackgroundCompact] 🔀 Merging', deltaMessages.length, 'delta messages...');

        // 发送增量消息到新会话
        await emit('compact-merge-delta', {
          newSessionId: completedSessionId,
          deltaMessages: deltaMessages,
        });
      }

      // 3. 切换阶段：无缝过渡到新会话
      setStatus('switching');
      setProgress(100);
      setNewSessionId(completedSessionId);
      setShouldSwitchSession(true);

      // 200ms 过渡动画时间
      await new Promise(r => setTimeout(r, 200));

      console.log('[BackgroundCompact] 🎯 Ready for seamless switch');

    } catch (err) {
      if ((err as Error).message !== 'Aborted') {
        console.error('[BackgroundCompact] ❌ Compact failed:', err);
        setStatus('error');

        // 静默恢复：5 秒后重试
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('idle');
            hasTriggeredCompactRef.current = false;
          }
        }, 5000);
      }
    } finally {
      compactTaskRef.current = null;
    }
  }, [sessionId, projectPath, deltaMessages]);

  // 手动触发压缩
  const triggerCompact = useCallback(async () => {
    if (isCompacting) {
      console.warn('[BackgroundCompact] Already compacting, skipping');
      return;
    }
    hasTriggeredCompactRef.current = true;
    await executeCompact();
  }, [isCompacting, executeCompact]);

  // 确认切换完成
  const confirmSwitch = useCallback(() => {
    console.log('[BackgroundCompact] ✨ Switch confirmed, cleaning up');
    setShouldSwitchSession(false);
    setStatus('idle');
    setProgress(0);
    setDeltaMessages([]);
    setNewSessionId(undefined);
    hasTriggeredCompactRef.current = false;
  }, []);

  // 自动压缩逻辑
  useEffect(() => {
    if (!autoCompact || !sessionId) return;
    if (isCompacting || status === 'switching') return;
    if (hasTriggeredCompactRef.current) return;

    // 达到 75% 阈值时触发后台压缩
    if (calculatedUsage >= compactThreshold) {
      console.log(`[BackgroundCompact] 📊 Context usage ${(calculatedUsage * 100).toFixed(1)}% >= ${(compactThreshold * 100).toFixed(1)}% threshold`);
      console.log('[BackgroundCompact] 🔄 Auto-triggering background compact (user can continue working)');
      hasTriggeredCompactRef.current = true;
      executeCompact();
    }
  }, [autoCompact, sessionId, calculatedUsage, compactThreshold, isCompacting, status, executeCompact]);

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
      unlistenRefs.current.forEach(fn => fn());
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

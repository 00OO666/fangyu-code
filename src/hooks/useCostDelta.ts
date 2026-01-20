import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "session_cost_snapshot_v3";

/**
 * ✨ REFACTORED v3: 修复初始化问题
 *
 * 核心改进：
 * 1. 使用 isDataLoaded 标记，避免在数据加载前计算错误的 delta
 * 2. 对于恢复的会话，正确使用上次保存的 baseline
 * 3. 对于新指令，使用发送前的 cost 作为 baseline
 *
 * 问题诊断：
 * - 原问题：页面加载时 lastUserMessageCost = 0，导致显示整个会话费用
 * - 修复：等待 currentCost 稳定后再初始化 baseline
 */
interface SessionCostSnapshot {
  sessionId: string;
  sessionStartCost: number;
  lastUserMessageCost: number;
  lastUserMessageIndex: number;
  lastKnownCost: number; // 🆕 记录上次的总费用，用于恢复时验证
  createdAt: number;
  lastUpdate: number;
}

export function useCostDelta(sessionId: string | undefined, currentCost: number, messages?: any[]) {
  const [sessionStartCost, setSessionStartCost] = useState<number>(0);
  const [lastUserMessageCost, setLastUserMessageCost] = useState<number>(0);
  const lastUserMessageIndexRef = useRef<number>(-1);

  // 🔑 关键：数据加载完成标记
  const isDataLoadedRef = useRef<boolean>(false);
  // 🔑 关键：保存每一帧的费用（只在数据加载后才有效）
  const prevCostRef = useRef<number>(0);
  // 🆕 等待稳定的计数器
  const stabilityCountRef = useRef<number>(0);

  // 找到最后一条用户消息的索引
  const findLastUserMessageIndex = useCallback((msgs: any[]): number => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      const isUser = msg?.type === "user" || msg?.role === "user";
      if (isUser) {
        return i;
      }
    }
    return -1;
  }, []);

  // 保存快照到 localStorage
  const saveSnapshot = useCallback((snapshot: SessionCostSnapshot) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const records: Record<string, SessionCostSnapshot> = stored ? JSON.parse(stored) : {};
      records[snapshot.sessionId] = snapshot;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      logger.error('useCostDelta', "[useCostDelta] Failed to save snapshot:", error);
    }
  }, []);

  // 🔧 FIX: 等待数据稳定后再初始化
  useEffect(() => {
    if (!sessionId) return;
    if (isDataLoadedRef.current) return;

    // 🆕 等待 currentCost 稳定（连续 2 次相同值，或者 > 0）
    if (currentCost <= 0) {
      stabilityCountRef.current = 0;
      return;
    }

    // currentCost > 0，检查是否稳定
    if (prevCostRef.current === currentCost) {
      stabilityCountRef.current++;
    } else {
      stabilityCountRef.current = 1;
      prevCostRef.current = currentCost;
      return;
    }

    // 需要稳定 2 帧
    if (stabilityCountRef.current < 2) {
      return;
    }

    // 数据已稳定，开始初始化
    isDataLoadedRef.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const records: Record<string, SessionCostSnapshot> = JSON.parse(stored);
        const snapshot = records[sessionId];

        if (snapshot) {
          // 🔧 FIX: 验证存储的数据是否有效
          // 如果当前费用与存储的 lastKnownCost 相差不大，说明是同一个会话状态
          const costDiff = Math.abs(currentCost - (snapshot.lastKnownCost || 0));
          const isValidSnapshot = costDiff < 0.1; // 允许 $0.1 的误差

          if (isValidSnapshot) {
            setSessionStartCost(snapshot.sessionStartCost);
            setLastUserMessageCost(snapshot.lastUserMessageCost);
            lastUserMessageIndexRef.current = snapshot.lastUserMessageIndex;
            prevCostRef.current = currentCost;

            console.log("[useCostDelta] ✅ 恢复快照:", {
              sessionId,
              baseline: snapshot.lastUserMessageCost,
              currentCost,
            });
            return;
          }
        }
      }

      // 新会话或快照无效：使用当前费用作为起始基准
      const currentMsgIndex = messages ? findLastUserMessageIndex(messages) : -1;

      const initialSnapshot: SessionCostSnapshot = {
        sessionId,
        sessionStartCost: currentCost,
        lastUserMessageCost: currentCost, // 🔑 关键：使用当前费用，不是 0
        lastUserMessageIndex: currentMsgIndex,
        lastKnownCost: currentCost,
        createdAt: Date.now(),
        lastUpdate: Date.now(),
      };

      setSessionStartCost(currentCost);
      setLastUserMessageCost(currentCost);
      lastUserMessageIndexRef.current = currentMsgIndex;
      prevCostRef.current = currentCost;

      saveSnapshot(initialSnapshot);

      console.log("[useCostDelta] 🆕 新会话初始化:", {
        sessionId,
        baseline: currentCost,
        msgIndex: currentMsgIndex,
      });
    } catch (error) {
      logger.error('useCostDelta', "[useCostDelta] Failed to initialize:", error);
    }
  }, [sessionId, currentCost, messages, findLastUserMessageIndex, saveSnapshot]);

  // 🔑 关键：监听消息变化，检测新用户消息
  useEffect(() => {
    // 只有在数据加载完成后才检测新消息
    if (!isDataLoadedRef.current) return;
    if (!sessionId || !messages || messages.length === 0) return;

    const currentUserMsgIndex = findLastUserMessageIndex(messages);

    // 检测到新的用户消息
    if (currentUserMsgIndex > lastUserMessageIndexRef.current) {
      // 🎯 使用上一帧的费用作为 baseline（发送前的费用）
      const baselineCost = prevCostRef.current;

      setLastUserMessageCost(baselineCost);
      lastUserMessageIndexRef.current = currentUserMsgIndex;

      console.log("[useCostDelta] 🆕 新指令，设置 baseline:", {
        baselineCost,
        currentCost,
        msgIndex: currentUserMsgIndex,
      });

      // 保存快照
      saveSnapshot({
        sessionId,
        sessionStartCost,
        lastUserMessageCost: baselineCost,
        lastUserMessageIndex: currentUserMsgIndex,
        lastKnownCost: currentCost,
        createdAt: 0,
        lastUpdate: Date.now(),
      });
    }
  }, [sessionId, messages, currentCost, sessionStartCost, findLastUserMessageIndex, saveSnapshot]);

  // 🔑 关键：在每次 render 后更新 prevCostRef（只在数据加载后）
  useEffect(() => {
    if (isDataLoadedRef.current) {
      prevCostRef.current = currentCost;
    }
  });

  // 定期保存 lastKnownCost（用于下次恢复时验证）
  useEffect(() => {
    if (!isDataLoadedRef.current || !sessionId) return;

    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const records: Record<string, SessionCostSnapshot> = JSON.parse(stored);
          if (records[sessionId]) {
            records[sessionId].lastKnownCost = currentCost;
            records[sessionId].lastUpdate = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
          }
        }
      } catch (error) {
        // ignore
      }
    }, 5000); // 5秒后保存

    return () => clearTimeout(timer);
  }, [sessionId, currentCost]);

  // 手动重置会话基准
  const resetSessionBaseline = useCallback(() => {
    setSessionStartCost(currentCost);
    setLastUserMessageCost(currentCost);
    prevCostRef.current = currentCost;

    if (sessionId) {
      saveSnapshot({
        sessionId,
        sessionStartCost: currentCost,
        lastUserMessageCost: currentCost,
        lastUserMessageIndex: lastUserMessageIndexRef.current,
        lastKnownCost: currentCost,
        createdAt: Date.now(),
        lastUpdate: Date.now(),
      });
    }
  }, [sessionId, currentCost, saveSnapshot]);

  // 手动重置指令基准
  const resetCommandBaseline = useCallback(() => {
    setLastUserMessageCost(currentCost);
    prevCostRef.current = currentCost;

    if (sessionId) {
      saveSnapshot({
        sessionId,
        sessionStartCost,
        lastUserMessageCost: currentCost,
        lastUserMessageIndex: lastUserMessageIndexRef.current,
        lastKnownCost: currentCost,
        createdAt: 0,
        lastUpdate: Date.now(),
      });
    }
  }, [sessionId, currentCost, sessionStartCost, saveSnapshot]);

  // 清理旧记录（30天）
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const records: Record<string, SessionCostSnapshot> = JSON.parse(stored);
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        const cleanedRecords = Object.fromEntries(
          Object.entries(records).filter(([_, record]) => record.lastUpdate > thirtyDaysAgo),
        );

        if (Object.keys(cleanedRecords).length !== Object.keys(records).length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedRecords));
        }
      }
    } catch (error) {
      logger.error('useCostDelta', "[useCostDelta] Failed to clean up old records:", error);
    }
  }, []);

  // 计算费用增量
  // 🔧 FIX: 只有在数据加载完成后才计算有效的 delta
  // 否则 lastUserMessageCost = 0 会导致显示整个会话费用
  const sessionDelta = isDataLoadedRef.current ? currentCost - sessionStartCost : 0;
  const commandDelta = isDataLoadedRef.current ? currentCost - lastUserMessageCost : 0;

  return {
    // 会话总增量（相对于会话开始）
    sessionDelta: sessionDelta > 0 ? sessionDelta : 0,

    // 当前指令增量（相对于发送前）= 整条指令的总消耗
    commandDelta: commandDelta > 0 ? commandDelta : 0,

    // 最新指令的总消耗（别名）
    lastCommandCost: commandDelta > 0 ? commandDelta : 0,

    // 兼容性别名
    costDelta: commandDelta > 0 ? commandDelta : 0,

    // 重置函数
    resetSessionBaseline,
    resetCommandBaseline,
    resetDelta: resetCommandBaseline,

    // 调试信息
    sessionStartCost,
    lastUserMessageCost,
    baseCost: lastUserMessageCost,
    currentCost,
    isDataLoaded: isDataLoadedRef.current,
  };
}

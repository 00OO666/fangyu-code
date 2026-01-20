import { logger } from '@/lib/logger';

/**
 * 会话累计消耗计数器
 *
 * 用于记录本次会话的实际累计消耗（不可逆），即使清空聊天记录也不会减少。
 * 只有在新建会话时才会重置。
 */

interface SessionAccumulation {
  /** 累计消耗的 tokens */
  totalTokens: number;
  /** 累计消耗的成本（美元） */
  totalCost: number;
  /** 会话 ID（用于识别会话切换） */
  sessionId: string;
}

const STORAGE_KEY = "fangyu_session_accumulation";

/**
 * 获取当前会话的累计消耗
 */
export function getSessionAccumulation(sessionId: string): SessionAccumulation {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: SessionAccumulation = JSON.parse(stored);
      // 如果会话 ID 匹配，返回累计数据
      if (data.sessionId === sessionId) {
        return data;
      }
    }
  } catch (error) {
    logger.error('sessionAccumulator', "[SessionAccumulator] 读取累计数据失败:", error);
  }

  // 新会话或读取失败，返回初始值
  return {
    totalTokens: 0,
    totalCost: 0,
    sessionId,
  };
}

/**
 * 累加消耗（只增不减）
 */
export function addToAccumulation(
  sessionId: string,
  deltaTokens: number,
  deltaCost: number,
): SessionAccumulation {
  const current = getSessionAccumulation(sessionId);

  const updated: SessionAccumulation = {
    totalTokens: current.totalTokens + deltaTokens,
    totalCost: current.totalCost + deltaCost,
    sessionId,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    logger.error('sessionAccumulator', "[SessionAccumulator] 保存累计数据失败:", error);
  }

  return updated;
}

/**
 * 重置累计计数器（新建会话时调用）
 */
export function resetAccumulation(sessionId: string): void {
  const initial: SessionAccumulation = {
    totalTokens: 0,
    totalCost: 0,
    sessionId,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    logger.debug('sessionAccumulator', "[SessionAccumulator] 已重置累计计数器:", sessionId);
  } catch (error) {
    logger.error('sessionAccumulator', "[SessionAccumulator] 重置累计数据失败:", error);
  }
}

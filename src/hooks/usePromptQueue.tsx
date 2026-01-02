/**
 * usePromptQueue Hook
 *
 * 提示词队列管理系统，支持：
 * - 队列管理（添加/删除/排序）
 * - 撤回到输入框
 * - 插队发送（指导/纠正当前任务）
 * - 多条指令打包发送
 *
 * @author Fangyu Code
 * @version 1.0.0
 */

import type React from "react";
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";
import type { ModelType } from "@/components/FloatingPromptInput/types";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 发送模式
 * - sequential: 等待当前任务完成后发送
 * - interrupt: 立即作为指导/纠正插入（不停止当前任务）
 * - merge: 与其他指令合并成一条发送
 */
export type PromptSendMode = "sequential" | "interrupt" | "merge";

/**
 * 队列项状态
 */
export type PromptQueueItemStatus = "pending" | "sending" | "sent" | "revoked" | "failed";

/**
 * 队列项
 */
export interface PromptQueueItem {
  id: string;
  prompt: string;
  model: ModelType;
  createdAt: number;
  mode: PromptSendMode;
  status: PromptQueueItemStatus;
  /** 预估 token 数量（粗略估算） */
  estimatedTokens?: number;
  /** 错误信息（如果发送失败） */
  errorMessage?: string;
}

/**
 * 队列状态
 */
export interface PromptQueueState {
  items: PromptQueueItem[];
  isProcessing: boolean;
  currentItemId: string | null;
  /** 是否自动打包发送 merge 模式的指令 */
  autoMerge: boolean;
}

/**
 * 队列操作接口
 */
export interface PromptQueueActions {
  /** 添加到队列 */
  enqueue: (prompt: string, model: ModelType, mode?: PromptSendMode) => PromptQueueItem;
  /** 从队列移除 */
  dequeue: (itemId: string) => PromptQueueItem | null;
  /** 撤回到输入框（返回撤回的提示词内容） */
  revokeToInput: (itemId: string) => string | null;
  /** 标记为发送中 */
  markSending: (itemId: string) => void;
  /** 标记为已发送 */
  markSent: (itemId: string) => void;
  /** 标记为失败 */
  markFailed: (itemId: string, errorMessage: string) => void;
  /** 清空队列 */
  clearQueue: () => void;
  /** 获取下一个待发送项（sequential 模式） */
  getNextSequential: () => PromptQueueItem | null;
  /** 获取所有待合并项（merge 模式） */
  getMergeItems: () => PromptQueueItem[];
  /** 打包合并指令为单条 */
  getMergedPrompt: () => string | null;
  /** 移动队列项位置 */
  reorderItem: (itemId: string, newIndex: number) => void;
  /** 更新队列项模式 */
  updateItemMode: (itemId: string, mode: PromptSendMode) => void;
  /** 🆕 更新队列项提示词 */
  updateItemPrompt: (itemId: string, prompt: string) => void;
  /** 设置自动打包 */
  setAutoMerge: (enabled: boolean) => void;
  /** 获取队列统计 */
  getStats: () => { total: number; pending: number; sending: number; sent: number };
}

/**
 * 完整的队列 Context 值
 */
export interface PromptQueueContextValue extends PromptQueueState, PromptQueueActions {}

// ============================================================================
// Context
// ============================================================================

const PromptQueueContext = createContext<PromptQueueContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface PromptQueueProviderProps {
  children: ReactNode;
}

/**
 * 粗略估算 token 数量（中文约 2 字符/token，英文约 4 字符/token）
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `pq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const PromptQueueProvider: React.FC<PromptQueueProviderProps> = ({ children }) => {
  const [items, setItems] = useState<PromptQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [autoMerge, setAutoMerge] = useState(true);

  // 用于跟踪撤回的项（供外部获取）
  const lastRevokedRef = useRef<string | null>(null);

  // 添加到队列
  const enqueue = useCallback(
    (prompt: string, model: ModelType, mode: PromptSendMode = "sequential"): PromptQueueItem => {
      const newItem: PromptQueueItem = {
        id: generateId(),
        prompt,
        model,
        createdAt: Date.now(),
        mode,
        status: "pending",
        estimatedTokens: estimateTokens(prompt),
      };

      setItems((prev) => [...prev, newItem]);
      console.log("[PromptQueue] 添加到队列:", {
        id: newItem.id,
        mode,
        promptPreview: prompt.substring(0, 50),
      });

      return newItem;
    },
    [],
  );

  // 从队列移除
  const dequeue = useCallback((itemId: string): PromptQueueItem | null => {
    let removedItem: PromptQueueItem | null = null;

    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === itemId);
      if (index === -1) return prev;

      removedItem = prev[index];
      return [...prev.slice(0, index), ...prev.slice(index + 1)];
    });

    if (removedItem) {
      console.log("[PromptQueue] 从队列移除:", itemId);
    }

    return removedItem;
  }, []);

  // 撤回到输入框
  const revokeToInput = useCallback((itemId: string): string | null => {
    let revokedPrompt: string | null = null;

    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === itemId);
      if (index === -1) return prev;

      const item = prev[index];
      // 只能撤回 pending 状态的项
      if (item.status !== "pending") {
        console.warn("[PromptQueue] 无法撤回非 pending 状态的项:", item.status);
        return prev;
      }

      revokedPrompt = item.prompt;
      lastRevokedRef.current = item.prompt;

      // 更新状态为 revoked 并移除
      const updated = [...prev];
      updated[index] = { ...item, status: "revoked" };
      return updated.filter((i) => i.id !== itemId);
    });

    if (revokedPrompt) {
      console.log("[PromptQueue] 撤回到输入框:", itemId);
    }

    return revokedPrompt;
  }, []);

  // 标记为发送中
  const markSending = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: "sending" as const } : item)),
    );
    setCurrentItemId(itemId);
    setIsProcessing(true);
  }, []);

  // 标记为已发送
  const markSent = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: "sent" as const } : item)),
    );
    setCurrentItemId(null);
    setIsProcessing(false);
  }, []);

  // 标记为失败
  const markFailed = useCallback((itemId: string, errorMessage: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: "failed" as const, errorMessage } : item,
      ),
    );
    setCurrentItemId(null);
    setIsProcessing(false);
  }, []);

  // 清空队列
  const clearQueue = useCallback(() => {
    setItems([]);
    setCurrentItemId(null);
    setIsProcessing(false);
    console.log("[PromptQueue] 队列已清空");
  }, []);

  // 获取下一个待发送项（sequential 模式）
  const getNextSequential = useCallback((): PromptQueueItem | null => {
    return items.find((item) => item.status === "pending" && item.mode === "sequential") || null;
  }, [items]);

  // 获取所有待合并项（merge 模式）
  const getMergeItems = useCallback((): PromptQueueItem[] => {
    return items.filter((item) => item.status === "pending" && item.mode === "merge");
  }, [items]);

  // 打包合并指令为单条
  const getMergedPrompt = useCallback((): string | null => {
    const mergeItems = items.filter((item) => item.status === "pending" && item.mode === "merge");

    if (mergeItems.length === 0) return null;
    if (mergeItems.length === 1) return mergeItems[0].prompt;

    // 多条指令打包
    const merged = mergeItems
      .map((item, index) => `【任务 ${index + 1}】\n${item.prompt}`)
      .join("\n\n---\n\n");

    return `以下是多个相关任务，请按顺序依次处理：\n\n${merged}`;
  }, [items]);

  // 移动队列项位置
  const reorderItem = useCallback((itemId: string, newIndex: number) => {
    setItems((prev) => {
      const currentIndex = prev.findIndex((item) => item.id === itemId);
      if (currentIndex === -1 || newIndex < 0 || newIndex >= prev.length) return prev;

      const updated = [...prev];
      const [removed] = updated.splice(currentIndex, 1);
      updated.splice(newIndex, 0, removed);

      console.log("[PromptQueue] 移动队列项:", { itemId, from: currentIndex, to: newIndex });
      return updated;
    });
  }, []);

  // 更新队列项模式
  const updateItemMode = useCallback((itemId: string, mode: PromptSendMode) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, mode } : item)));
    console.log("[PromptQueue] 更新模式:", { itemId, mode });
  }, []);

  // 🆕 更新队列项提示词
  const updateItemPrompt = useCallback((itemId: string, prompt: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, prompt, estimatedTokens: estimateTokens(prompt) } : item,
      ),
    );
    console.log("[PromptQueue] 更新提示词:", { itemId, promptPreview: prompt.substring(0, 50) });
  }, []);

  // 获取队列统计
  const getStats = useCallback(() => {
    const stats = {
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      sending: items.filter((i) => i.status === "sending").length,
      sent: items.filter((i) => i.status === "sent").length,
    };
    return stats;
  }, [items]);

  const contextValue: PromptQueueContextValue = {
    // State
    items,
    isProcessing,
    currentItemId,
    autoMerge,
    // Actions
    enqueue,
    dequeue,
    revokeToInput,
    markSending,
    markSent,
    markFailed,
    clearQueue,
    getNextSequential,
    getMergeItems,
    getMergedPrompt,
    reorderItem,
    updateItemMode,
    updateItemPrompt,
    setAutoMerge,
    getStats,
  };

  return <PromptQueueContext.Provider value={contextValue}>{children}</PromptQueueContext.Provider>;
};

// ============================================================================
// Hook
// ============================================================================

/**
 * 使用提示词队列
 */
export function usePromptQueue(): PromptQueueContextValue {
  const context = useContext(PromptQueueContext);
  if (!context) {
    throw new Error("usePromptQueue must be used within a PromptQueueProvider");
  }
  return context;
}

/**
 * 获取队列中 pending 状态的项数量
 */
export function usePendingCount(): number {
  const { items } = usePromptQueue();
  return items.filter((i) => i.status === "pending").length;
}

export default usePromptQueue;

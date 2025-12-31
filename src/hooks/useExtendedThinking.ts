/**
 * useExtendedThinking - 扩展思考模式 Hook
 *
 * 功能:
 * - 检测 "ultrathink" 等关键词触发深度思考
 * - 管理思考深度级别
 * - 可视化思考过程
 * - 统计思考时间和 token 消耗
 *
 * 来源: Claude Extended Thinking + OpenAI o1 Reasoning
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================
// 类型定义
// ============================================================

export type ThinkingDepth = 'normal' | 'deep' | 'ultra';

export interface ThinkingConfig {
  /** 当前思考深度 */
  depth: ThinkingDepth;
  /** 是否启用自动检测 */
  autoDetect: boolean;
  /** 触发关键词 */
  triggerKeywords: string[];
  /** 是否显示思考过程 */
  showProcess: boolean;
  /** 最大思考时间（秒） */
  maxThinkingTime: number;
}

export interface ThinkingStats {
  /** 总思考次数 */
  totalCount: number;
  /** 总思考时间（毫秒） */
  totalTime: number;
  /** 平均思考时间（毫秒） */
  avgTime: number;
  /** 思考模式使用统计 */
  depthUsage: Record<ThinkingDepth, number>;
}

export interface ThinkingSession {
  id: string;
  depth: ThinkingDepth;
  startTime: number;
  endTime?: number;
  duration?: number;
  prompt: string;
  thinkingContent?: string;
  finalResponse?: string;
  tokenCount?: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: ThinkingConfig = {
  depth: 'normal',
  autoDetect: true,
  triggerKeywords: [
    'ultrathink',
    'think deeply',
    'deep thinking',
    'reasoning',
    'analyze carefully',
    'step by step',
    'think hard',
    '深度思考',
    '仔细分析',
    '推理',
    '逐步分析',
  ],
  showProcess: true,
  maxThinkingTime: 120, // 2分钟
};

// ============================================================
// Hook
// ============================================================

interface UseExtendedThinkingOptions {
  /** 初始配置 */
  initialConfig?: Partial<ThinkingConfig>;
  /** 思考开始回调 */
  onThinkingStart?: (session: ThinkingSession) => void;
  /** 思考结束回调 */
  onThinkingEnd?: (session: ThinkingSession) => void;
  /** 思考过程更新回调 */
  onThinkingUpdate?: (session: ThinkingSession, content: string) => void;
}

export function useExtendedThinking(options: UseExtendedThinkingOptions = {}) {
  const { initialConfig, onThinkingStart, onThinkingEnd, onThinkingUpdate } = options;

  // 配置状态
  const [config, setConfig] = useState<ThinkingConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  // 会话状态
  const [currentSession, setCurrentSession] = useState<ThinkingSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<ThinkingSession[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<ThinkingConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // 设置思考深度
  const setDepth = useCallback((depth: ThinkingDepth) => {
    updateConfig({ depth });
  }, [updateConfig]);

  /**
   * 检测输入是否包含触发关键词
   */
  const detectTrigger = useCallback(
    (input: string): { triggered: boolean; suggestedDepth: ThinkingDepth } => {
      if (!config.autoDetect) {
        return { triggered: false, suggestedDepth: 'normal' };
      }

      const lowerInput = input.toLowerCase();

      // 检查是否包含触发关键词
      const hasKeyword = config.triggerKeywords.some((keyword) =>
        lowerInput.includes(keyword.toLowerCase())
      );

      if (!hasKeyword) {
        return { triggered: false, suggestedDepth: 'normal' };
      }

      // 根据关键词强度建议深度
      const ultraKeywords = ['ultrathink', 'think hard', '深度思考', 'analyze carefully'];
      const deepKeywords = ['think deeply', 'reasoning', '推理', 'step by step'];

      const hasUltra = ultraKeywords.some((keyword) =>
        lowerInput.includes(keyword.toLowerCase())
      );
      const hasDeep = deepKeywords.some((keyword) =>
        lowerInput.includes(keyword.toLowerCase())
      );

      let suggestedDepth: ThinkingDepth = 'normal';
      if (hasUltra) {
        suggestedDepth = 'ultra';
      } else if (hasDeep) {
        suggestedDepth = 'deep';
      }

      return { triggered: true, suggestedDepth };
    },
    [config.autoDetect, config.triggerKeywords]
  );

  /**
   * 开始思考会话
   */
  const startThinking = useCallback(
    (prompt: string, depth?: ThinkingDepth): ThinkingSession => {
      const session: ThinkingSession = {
        id: `thinking_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        depth: depth || config.depth,
        startTime: Date.now(),
        prompt,
      };

      setCurrentSession(session);
      setIsThinking(true);
      onThinkingStart?.(session);

      return session;
    },
    [config.depth, onThinkingStart]
  );

  /**
   * 更新思考内容
   */
  const updateThinking = useCallback(
    (content: string) => {
      if (!currentSession) return;

      const updatedSession = {
        ...currentSession,
        thinkingContent: content,
      };

      setCurrentSession(updatedSession);
      onThinkingUpdate?.(updatedSession, content);
    },
    [currentSession, onThinkingUpdate]
  );

  /**
   * 结束思考会话
   */
  const endThinking = useCallback(
    (finalResponse?: string, tokenCount?: number) => {
      if (!currentSession) return;

      const endTime = Date.now();
      const duration = endTime - currentSession.startTime;

      const completedSession: ThinkingSession = {
        ...currentSession,
        endTime,
        duration,
        finalResponse,
        tokenCount,
      };

      setCurrentSession(null);
      setIsThinking(false);
      setSessionHistory((prev) => [...prev, completedSession]);
      onThinkingEnd?.(completedSession);

      return completedSession;
    },
    [currentSession, onThinkingEnd]
  );

  /**
   * 取消当前思考
   */
  const cancelThinking = useCallback(() => {
    if (!currentSession) return;

    const endTime = Date.now();
    const duration = endTime - currentSession.startTime;

    const canceledSession: ThinkingSession = {
      ...currentSession,
      endTime,
      duration,
      finalResponse: '[思考已取消]',
    };

    setCurrentSession(null);
    setIsThinking(false);
    setSessionHistory((prev) => [...prev, canceledSession]);
  }, [currentSession]);

  /**
   * 获取思考统计信息
   */
  const getStats = useCallback((): ThinkingStats => {
    const totalCount = sessionHistory.length;
    const totalTime = sessionHistory.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgTime = totalCount > 0 ? totalTime / totalCount : 0;

    const depthUsage: Record<ThinkingDepth, number> = {
      normal: 0,
      deep: 0,
      ultra: 0,
    };

    sessionHistory.forEach((session) => {
      depthUsage[session.depth]++;
    });

    return {
      totalCount,
      totalTime,
      avgTime,
      depthUsage,
    };
  }, [sessionHistory]);

  /**
   * 清除历史记录
   */
  const clearHistory = useCallback(() => {
    setSessionHistory([]);
  }, []);

  /**
   * 获取深度描述
   */
  const getDepthDescription = useCallback((depth: ThinkingDepth): string => {
    switch (depth) {
      case 'normal':
        return '正常思考 - 快速响应';
      case 'deep':
        return '深度思考 - 详细分析问题';
      case 'ultra':
        return '超深度思考 - 全面推理和验证';
    }
  }, []);

  /**
   * 获取深度建议的系统提示
   */
  const getSystemPrompt = useCallback((depth: ThinkingDepth): string => {
    switch (depth) {
      case 'normal':
        return '';
      case 'deep':
        return `请进行深度思考分析：
1. 仔细理解问题的每个方面
2. 考虑多种可能的解决方案
3. 评估每种方案的优劣
4. 给出详细的推理过程`;
      case 'ultra':
        return `请进行超深度思考分析：
1. 从多个角度全面理解问题
2. 列举所有可能的解决方案
3. 详细分析每种方案的优缺点、适用场景和潜在风险
4. 考虑边界条件和特殊情况
5. 验证推理逻辑的正确性
6. 提供step-by-step的详细推理过程
7. 给出最优解并说明理由`;
    }
  }, []);

  /**
   * 获取当前思考进度（0-100）
   */
  const getProgress = useCallback((): number => {
    if (!currentSession) return 0;

    const elapsed = Date.now() - currentSession.startTime;
    const maxTime = config.maxThinkingTime * 1000;

    return Math.min(100, (elapsed / maxTime) * 100);
  }, [currentSession, config.maxThinkingTime]);

  /**
   * 格式化思考内容（添加语法高亮标记）
   */
  const formatThinkingContent = useCallback((content: string): string => {
    // 标记思考步骤
    let formatted = content.replace(
      /^(\d+[\.\)]|\*|\-)\s+(.+)$/gm,
      '<step>$1 $2</step>'
    );

    // 标记推理链
    formatted = formatted.replace(
      /(因为|所以|因此|因而|由于|根据|基于|考虑到)/g,
      '<reasoning>$1</reasoning>'
    );

    // 标记关键结论
    formatted = formatted.replace(
      /(结论|总结|综上|最终|最佳)/g,
      '<conclusion>$1</conclusion>'
    );

    return formatted;
  }, []);

  // 计算思考深度的成本估算（相对值）
  const depthCostMultiplier = useMemo((): Record<ThinkingDepth, number> => {
    return {
      normal: 1.0,
      deep: 2.5,
      ultra: 5.0,
    };
  }, []);

  return {
    // 状态
    config,
    currentSession,
    isThinking,
    sessionHistory,

    // 配置方法
    updateConfig,
    setDepth,

    // 检测和触发
    detectTrigger,

    // 会话管理
    startThinking,
    updateThinking,
    endThinking,
    cancelThinking,

    // 工具方法
    getStats,
    clearHistory,
    getDepthDescription,
    getSystemPrompt,
    getProgress,
    formatThinkingContent,

    // 常量
    depthCostMultiplier,
  };
}

export default useExtendedThinking;

/**
 * useProgressIndicator - 进度指示器管理 Hook
 *
 * 自动检测长时间操作，管理进度指示器的显示/隐藏
 * 支持确定进度和不确定进度
 *
 * _Requirements: 6.2_
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ProgressVariant } from '@/components/common/ProgressIndicator';

// =============================================================================
// 类型定义
// =============================================================================

export interface ProgressState {
  /** 是否显示进度指示器 */
  isVisible: boolean;
  /** 进度值 (0-100)，undefined 表示不确定进度 */
  value?: number;
  /** 进度标签 */
  label?: string;
  /** 样式变体 */
  variant: ProgressVariant;
}

export interface UseProgressIndicatorOptions {
  /** 显示进度指示器的延迟时间（毫秒），避免闪烁 */
  showDelay?: number;
  /** 隐藏进度指示器的延迟时间（毫秒），确保用户看到完成状态 */
  hideDelay?: number;
  /** 自动检测长时间操作的阈值（毫秒） */
  longOperationThreshold?: number;
  /** 默认标签 */
  defaultLabel?: string;
  /** 默认变体 */
  defaultVariant?: ProgressVariant;
}

export interface UseProgressIndicatorReturn {
  /** 当前进度状态 */
  progress: ProgressState;
  /** 开始进度（不确定进度） */
  start: (label?: string) => void;
  /** 更新进度值 */
  update: (value: number, label?: string) => void;
  /** 完成进度 */
  complete: (label?: string) => void;
  /** 设置错误状态 */
  error: (label?: string) => void;
  /** 重置进度 */
  reset: () => void;
  /** 包装异步操作，自动管理进度 */
  withProgress: <T>(
    operation: () => Promise<T>,
    options?: { label?: string; showProgress?: boolean }
  ) => Promise<T>;
}

// =============================================================================
// Hook 实现
// =============================================================================

export function useProgressIndicator(
  options: UseProgressIndicatorOptions = {}
): UseProgressIndicatorReturn {
  const {
    showDelay = 200,
    hideDelay = 300,
    longOperationThreshold = 500,
    defaultLabel = '处理中...',
    defaultVariant = 'default',
  } = options;

  const [progress, setProgress] = useState<ProgressState>({
    isVisible: false,
    value: undefined,
    label: undefined,
    variant: defaultVariant,
  });

  const showTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const operationStartRef = useRef<number>(0);
  const pendingShowRef = useRef(false);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // 开始进度（不确定进度）
  const start = useCallback(
    (label?: string) => {
      // 清理之前的定时器
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }

      operationStartRef.current = Date.now();
      pendingShowRef.current = true;

      // 延迟显示，避免短操作闪烁
      showTimeoutRef.current = setTimeout(() => {
        if (pendingShowRef.current) {
          setProgress({
            isVisible: true,
            value: undefined,
            label: label ?? defaultLabel,
            variant: defaultVariant,
          });
        }
      }, showDelay);
    },
    [showDelay, defaultLabel, defaultVariant]
  );

  // 更新进度值
  const update = useCallback(
    (value: number, label?: string) => {
      pendingShowRef.current = true;

      // 如果操作时间超过阈值，立即显示
      const elapsed = Date.now() - operationStartRef.current;
      if (elapsed >= longOperationThreshold) {
        if (showTimeoutRef.current) {
          clearTimeout(showTimeoutRef.current);
          showTimeoutRef.current = undefined;
        }
        setProgress((prev) => ({
          ...prev,
          isVisible: true,
          value: Math.min(100, Math.max(0, value)),
          label: label ?? prev.label,
          variant: defaultVariant,
        }));
      } else {
        setProgress((prev) => ({
          ...prev,
          value: Math.min(100, Math.max(0, value)),
          label: label ?? prev.label,
        }));
      }
    },
    [longOperationThreshold, defaultVariant]
  );

  // 完成进度
  const complete = useCallback(
    (label?: string) => {
      pendingShowRef.current = false;

      // 清理显示定时器
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = undefined;
      }

      // 如果进度指示器可见，显示完成状态后延迟隐藏
      setProgress((prev) => {
        if (prev.isVisible) {
          return {
            isVisible: true,
            value: 100,
            label: label ?? '完成',
            variant: 'success',
          };
        }
        return prev;
      });

      // 延迟隐藏
      hideTimeoutRef.current = setTimeout(() => {
        setProgress({
          isVisible: false,
          value: undefined,
          label: undefined,
          variant: defaultVariant,
        });
      }, hideDelay);
    },
    [hideDelay, defaultVariant]
  );

  // 设置错误状态
  const error = useCallback(
    (label?: string) => {
      pendingShowRef.current = false;

      // 清理显示定时器
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = undefined;
      }

      setProgress({
        isVisible: true,
        value: undefined,
        label: label ?? '操作失败',
        variant: 'error',
      });

      // 延迟隐藏
      hideTimeoutRef.current = setTimeout(() => {
        setProgress({
          isVisible: false,
          value: undefined,
          label: undefined,
          variant: defaultVariant,
        });
      }, hideDelay * 3); // 错误状态显示更长时间
    },
    [hideDelay, defaultVariant]
  );

  // 重置进度
  const reset = useCallback(() => {
    pendingShowRef.current = false;

    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = undefined;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }

    setProgress({
      isVisible: false,
      value: undefined,
      label: undefined,
      variant: defaultVariant,
    });
  }, [defaultVariant]);

  // 包装异步操作
  const withProgress = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      operationOptions?: { label?: string; showProgress?: boolean }
    ): Promise<T> => {
      const { label, showProgress = true } = operationOptions ?? {};

      if (showProgress) {
        start(label);
      }

      try {
        const result = await operation();
        if (showProgress) {
          complete();
        }
        return result;
      } catch (err) {
        if (showProgress) {
          error(err instanceof Error ? err.message : '操作失败');
        }
        throw err;
      }
    },
    [start, complete, error]
  );

  return {
    progress,
    start,
    update,
    complete,
    error,
    reset,
    withProgress,
  };
}

export default useProgressIndicator;

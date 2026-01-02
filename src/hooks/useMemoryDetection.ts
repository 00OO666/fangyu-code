import { useEffect, useRef, useState } from "react";

/**
 * 记忆匹配结果
 */
export interface MemoryMatch {
  file: string;
  title: string;
  matched_keywords: string[];
  priority: "high" | "medium" | "low";
  category: string;
  score: number;
}

/**
 * Hook 配置选项
 */
export interface UseMemoryDetectionOptions {
  enabled?: boolean;
  debounceMs?: number;
  minLength?: number;
}

/**
 * 智能记忆检测 Hook
 *
 * 实时检测用户输入中的关键词，自动匹配相关记忆文件
 */
export const useMemoryDetection = (inputText: string, options: UseMemoryDetectionOptions = {}) => {
  const { enabled = true, debounceMs = 500, minLength = 3 } = options;

  const [matches, setMatches] = useState<MemoryMatch[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || inputText.length < minLength) {
      setMatches([]);
      setIsDetecting(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setIsDetecting(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    timerRef.current = setTimeout(async () => {
      try {
        // 动态导入 Tauri API（仅在 Tauri 环境中可用）
        const tauriModule = await import("@tauri-apps/api/core").catch(() => null);
        if (!tauriModule) {
          console.warn("[useMemoryDetection] Tauri API not available");
          setIsDetecting(false);
          return;
        }

        const result = await (tauriModule as any).invoke<MemoryMatch[]>("detect_memory_keywords", {
          text: inputText,
        });

        if (!controller.signal.aborted) {
          setMatches(result);
          console.log("[useMemoryDetection] Detected matches:", result);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[useMemoryDetection] Error:", error);
          setMatches([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsDetecting(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      controller.abort();
    };
  }, [inputText, enabled, debounceMs, minLength]);

  return {
    matches,
    isDetecting,
    hasMatches: matches.length > 0,
  };
};

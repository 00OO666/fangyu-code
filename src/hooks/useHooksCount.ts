/**
 * Hook 数量统计
 *
 * 获取当前配置的 Hooks 数量
 */

import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface HooksCountResult {
  /** 总 Hook 数量 */
  count: number;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 获取已配置的 Hooks 数量
 * @returns Hook 数量统计
 */
export function useHooksCount(): HooksCountResult {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHooksCount() {
      try {
        setIsLoading(true);
        setError(null);

        // 获取用户级别的 hooks 配置
        const config = await api.getHooksConfig("user");

        if (cancelled) return;

        // 统计所有事件类型下的 hooks 数量
        let total = 0;
        if (config && typeof config === "object") {
          Object.values(config).forEach((matchers: any) => {
            if (Array.isArray(matchers)) {
              matchers.forEach((matcher: any) => {
                if (matcher?.hooks && Array.isArray(matcher.hooks)) {
                  total += matcher.hooks.length;
                }
              });
            }
          });
        }

        setCount(total);
      } catch (err) {
        if (cancelled) return;
        logger.error("useHooksCount", "Failed to fetch hooks count:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setCount(0);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchHooksCount();

    return () => {
      cancelled = true;
    };
  }, []);

  return { count, isLoading, error };
}

export default useHooksCount;

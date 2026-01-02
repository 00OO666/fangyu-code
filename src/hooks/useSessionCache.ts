import { useCallback, useEffect, useState } from "react";
import type { Session } from "@/lib/api";
import { api } from "@/lib/api";
import { filterValidSessions } from "@/lib/utils";

const SESSION_CACHE_KEY = "fangyu_session_center_cache";
const SESSION_CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟缓存过期

interface SessionCache {
  sessions: Session[];
  timestamp: number;
}

// 🚀 获取新鲜缓存（5分钟内有效）
const getSessionCache = (): Session[] | null => {
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (!cached) return null;

    const { sessions, timestamp }: SessionCache = JSON.parse(cached);
    if (Date.now() - timestamp > SESSION_CACHE_EXPIRY) {
      return null; // 缓存过期
    }
    return sessions;
  } catch {
    return null;
  }
};

// 🚀 获取可能过期的缓存（用于立即显示）
const getStaleSessionCache = (): Session[] | null => {
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (!cached) return null;

    const { sessions }: SessionCache = JSON.parse(cached);
    return sessions;
  } catch {
    return null;
  }
};

// 🚀 保存缓存到 localStorage
const setSessionCache = (sessions: Session[]) => {
  try {
    const cache: SessionCache = {
      sessions,
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to cache sessions:", e);
  }
};

// 排序函数
const sortSessions = (sessionsToSort: Session[]) => {
  return [...sessionsToSort].sort((a, b) => {
    const timeA = a.last_message_timestamp
      ? new Date(a.last_message_timestamp).getTime()
      : a.message_timestamp
        ? new Date(a.message_timestamp).getTime()
        : a.created_at * 1000;

    const timeB = b.last_message_timestamp
      ? new Date(b.last_message_timestamp).getTime()
      : b.message_timestamp
        ? new Date(b.message_timestamp).getTime()
        : b.created_at * 1000;

    return timeB - timeA;
  });
};

export interface UseSessionCacheReturn {
  sessions: Session[];
  loading: boolean;
  loadingMore: boolean;
  totalProjectCount: number;
  loadedProjectCount: number;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 🚀 会话缓存 Hook - 先显示缓存，后台静默刷新
 *
 * 优化策略：
 * 1. 优先显示过期缓存（用户瞬间看到内容）
 * 2. 检查5分钟缓存是否有效
 * 3. 缓存无效则后台加载，完成后更新
 */
export const useSessionCache = (): UseSessionCacheReturn => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedProjectCount, setLoadedProjectCount] = useState(0);
  const [totalProjectCount, setTotalProjectCount] = useState(0);

  const loadAllSessions = useCallback(async (forceRefresh = false) => {
    try {
      // 1. 🚀 优先显示过期缓存（即使过期也立即显示）
      const staleCache = getStaleSessionCache();
      if (staleCache && !forceRefresh) {
        setSessions(staleCache);
        setLoading(false); // 立即关闭 loading，用户瞬间看到内容
      }

      // 2. 检查新鲜缓存（5分钟内有效）
      const freshCache = getSessionCache();
      if (freshCache && !forceRefresh) {
        setSessions(freshCache);
        return; // 缓存有效，直接返回
      }

      // 3. 缓存无效或强制刷新，后台加载新数据
      setError(null);
      setLoadedProjectCount(0);

      // 只有没有缓存时才显示 loading
      if (!staleCache) {
        setLoading(true);
      }

      // 获取所有项目
      const projects = await api.listProjects();
      setTotalProjectCount(projects.length);

      let allSessions: Session[] = [];

      // 分批并发（每批 10 个项目，避免过多并发）
      const BATCH_SIZE = 10;
      for (let i = 0; i < projects.length; i += BATCH_SIZE) {
        const batch = projects.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (project) => {
            try {
              const projectSessions = await api.getProjectSessions(project.id, project.path);
              return projectSessions.map((session) => ({
                ...session,
                project_path: session.project_path || project.path,
              }));
            } catch (err) {
              console.error(`Failed to load sessions for project ${project.id}:`, err);
              return [];
            }
          }),
        );

        // 合并并立即更新 UI
        const batchSessions = batchResults.flat();
        allSessions = [...allSessions, ...batchSessions];

        const validSessions = filterValidSessions(allSessions);
        const sortedSessions = sortSessions(validSessions);

        setSessions(sortedSessions);
        setLoadedProjectCount(Math.min(i + BATCH_SIZE, projects.length));

        // 首批加载完成后关闭主 loading 状态
        if (i === 0) {
          setLoading(false);
          setLoadingMore(true);
        }
      }

      // 4. 缓存最终结果（内存 + localStorage 双重缓存）
      const finalSessions = sortSessions(filterValidSessions(allSessions));
      setSessionCache(finalSessions); // 🚀 保存到 localStorage
      setSessions(finalSessions);
    } catch (err) {
      console.error("Failed to load all sessions:", err);
      setError("加载会话失败");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 组件挂载时加载
  useEffect(() => {
    loadAllSessions();
  }, [loadAllSessions]);

  return {
    sessions,
    loading,
    loadingMore,
    totalProjectCount,
    loadedProjectCount,
    error,
    refresh: () => loadAllSessions(true),
  };
};

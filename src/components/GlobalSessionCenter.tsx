import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Clock, Plus, Search, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, filterValidSessions } from "@/lib/utils";
import { formatISOTimestamp, truncateText, getFirstLine } from "@/lib/date-utils";
import type { Session } from "@/lib/api";
import { api } from "@/lib/api";

// 🚀 性能优化常量
const INITIAL_DISPLAY_COUNT = 50;  // 首次显示数量
const LOAD_MORE_COUNT = 50;        // 每次加载更多数量
// import { useTranslation } from '@/hooks/useTranslation'; // Unused

interface GlobalSessionCenterProps {
  /**
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when new session button is clicked
   */
  onNewSession?: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * 全局会话中心 - 聚合显示所有项目的所有会话
 * 按最近打开时间排序，提供快速输入框创建新会话
 */
export const GlobalSessionCenter: React.FC<GlobalSessionCenterProps> = ({
  onSessionClick,
  onNewSession,
  className,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedProjectCount, setLoadedProjectCount] = useState(0);
  const [totalProjectCount, setTotalProjectCount] = useState(0);

  // 🚀 缓存会话索引以加速重复加载
  const sessionCacheRef = useRef<Session[] | null>(null);

  // 🚀 排序函数（提取复用）
  const sortSessions = useCallback((sessionsToSort: Session[]) => {
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
  }, []);

  // 🚀 渐进式加载：边加载边显示
  const loadAllSessions = useCallback(async () => {
    // 如果有缓存，直接使用
    if (sessionCacheRef.current) {
      setSessions(sessionCacheRef.current);
      setTotalCount(sessionCacheRef.current.length);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setLoadedProjectCount(0);

      // 1. 获取所有项目
      const projects = await api.listProjects();
      setTotalProjectCount(projects.length);

      // 2. 🚀 渐进式加载：每个项目完成后立即更新 UI
      let allSessions: Session[] = [];

      // 分批并发（每批 10 个项目，避免过多并发）
      const BATCH_SIZE = 10;
      for (let i = 0; i < projects.length; i += BATCH_SIZE) {
        const batch = projects.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (project) => {
            try {
              const projectSessions = await api.getProjectSessions(project.id, project.path);
              return projectSessions.map(session => ({
                ...session,
                project_path: session.project_path || project.path,
              }));
            } catch (err) {
              console.error(`Failed to load sessions for project ${project.id}:`, err);
              return [];
            }
          })
        );

        // 合并并立即更新 UI
        const batchSessions = batchResults.flat();
        allSessions = [...allSessions, ...batchSessions];

        const validSessions = filterValidSessions(allSessions);
        const sortedSessions = sortSessions(validSessions);

        setSessions(sortedSessions);
        setTotalCount(sortedSessions.length);
        setLoadedProjectCount(Math.min(i + BATCH_SIZE, projects.length));

        // 首批加载完成后关闭主 loading 状态（快速响应）
        if (i === 0) {
          setLoading(false);
          setLoadingMore(true);
        }
      }

      // 3. 缓存结果
      const finalSessions = sortSessions(filterValidSessions(allSessions));
      sessionCacheRef.current = finalSessions;
      setSessions(finalSessions);
      setTotalCount(finalSessions.length);

    } catch (err) {
      console.error("Failed to load all sessions:", err);
      setError("加载会话失败");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sortSessions]);

  // 组件挂载时加载
  useEffect(() => {
    loadAllSessions();
  }, [loadAllSessions]);

  // 🚀 加载更多显示
  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  }, []);

  // 🚀 搜索过滤 + 显示数量限制（使用 useMemo 避免重复计算）
  const { filteredSessions, displayedSessions, hasMore } = useMemo(() => {
    const filtered = searchQuery
      ? sessions.filter(session => {
          const firstMessage = session.first_message || "";
          const projectPath = session.project_path || "";
          const query = searchQuery.toLowerCase();
          return (
            firstMessage.toLowerCase().includes(query) ||
            projectPath.toLowerCase().includes(query) ||
            session.id.toLowerCase().includes(query)
          );
        })
      : sessions;

    const displayed = filtered.slice(0, displayCount);
    const hasMore = filtered.length > displayCount;

    return { filteredSessions: filtered, displayedSessions: displayed, hasMore };
  }, [sessions, searchQuery, displayCount]);

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      {/* 顶部标题和搜索栏 */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">会话中心</h1>
            <p className="text-sm text-muted-foreground mt-1">
              所有项目的会话记录，按最近打开时间排序
            </p>
          </div>
          <Button
            onClick={onNewSession}
            size="default"
            className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建会话
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话内容、项目路径或会话ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              正在加载会话...
              {totalProjectCount > 0 && ` (${loadedProjectCount}/${totalProjectCount} 项目)`}
            </p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "未找到匹配的会话" : "暂无会话记录"}
            </p>
            {!searchQuery && (
              <Button
                onClick={onNewSession}
                variant="outline"
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                创建第一个会话
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayedSessions.map((session) => {
              const firstMessagePreview = session.first_message
                ? truncateText(getFirstLine(session.first_message), 100)
                : session.id;
              const timeDisplay = session.last_message_timestamp
                ? formatISOTimestamp(session.last_message_timestamp)
                : session.message_timestamp
                ? formatISOTimestamp(session.message_timestamp)
                : new Date(session.created_at * 1000).toLocaleString();

              return (
                <button
                  key={`${session.project_id}-${session.id}`}
                  onClick={() => onSessionClick?.(session)}
                  className="w-full text-left px-6 py-4 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* 会话信息 */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* 首条消息预览 */}
                      <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                        {firstMessagePreview}
                      </p>

                      {/* 项目完整路径 */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono truncate max-w-lg"
                          title={session.project_path || "未知项目"}
                        >
                          {session.project_path || "未知项目"}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="font-mono">{session.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    {/* 时间戳 */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <time>{timeDisplay}</time>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* 🚀 加载更多按钮 */}
            {hasMore && (
              <div className="p-6 flex justify-center">
                <Button
                  onClick={handleLoadMore}
                  variant="outline"
                  className="w-full max-w-xs"
                >
                  加载更多 ({filteredSessions.length - displayCount} 剩余)
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 🚀 后台加载指示器 */}
        {loadingMore && displayedSessions.length > 0 && (
          <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground border-t">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载更多会话... ({loadedProjectCount}/{totalProjectCount} 项目)
          </div>
        )}
      </div>

      {/* 底部统计信息 */}
      {!loading && filteredSessions.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/30 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            显示 {displayedSessions.length} / {filteredSessions.length} 个会话
            {searchQuery && ` • 已过滤 ${sessions.length - filteredSessions.length} 个`}
          </p>
          {totalCount > filteredSessions.length && (
            <p className="text-xs text-muted-foreground/70">
              共 {totalCount} 个会话 • {loadedProjectCount}/{totalProjectCount} 项目已加载
            </p>
          )}
        </div>
      )}
    </div>
  );
};

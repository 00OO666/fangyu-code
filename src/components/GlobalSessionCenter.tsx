import React, { useState, useCallback, useMemo } from "react";
import { Clock, Plus, Search, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatISOTimestamp, truncateText, getFirstLine } from "@/lib/date-utils";
import type { Session } from "@/lib/api";
import { useSessionCache } from "@/hooks/useSessionCache";

const INITIAL_DISPLAY_COUNT = 50;
const LOAD_MORE_COUNT = 50;

interface GlobalSessionCenterProps {
  onSessionClick?: (session: Session) => void;
  onNewSession?: () => void;
  className?: string;
}

export const GlobalSessionCenter: React.FC<GlobalSessionCenterProps> = ({
  onSessionClick,
  onNewSession,
  className,
}) => {
  const { sessions, loading, loadingMore, totalProjectCount, loadedProjectCount, error } = useSessionCache();
  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  }, []);

  const { filteredSessions, displayedSessions, hasMore, totalCount } = useMemo(() => {
    const filtered = searchQuery
      ? sessions.filter(session => {
          const firstMessage = session.first_message || "";
          const projectPath = session.project_path || "";
          const query = searchQuery.toLowerCase();
          return firstMessage.toLowerCase().includes(query) || projectPath.toLowerCase().includes(query) || session.id.toLowerCase().includes(query);
        })
      : sessions;
    const displayed = filtered.slice(0, displayCount);
    return { filteredSessions: filtered, displayedSessions: displayed, hasMore: filtered.length > displayCount, totalCount: sessions.length };
  }, [sessions, searchQuery, displayCount]);

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">会话中心</h1>
            <p className="text-sm text-muted-foreground mt-1">所有项目的会话记录，按最近打开时间排序</p>
          </div>
          <Button onClick={onNewSession} size="default" className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all duration-200 hover:shadow-md">
            <Plus className="mr-2 h-4 w-4" />新建会话
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索会话内容、项目路径或会话ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">正在加载会话...{totalProjectCount > 0 && ` (${loadedProjectCount}/${totalProjectCount} 项目)`}</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64"><p className="text-sm text-destructive">{error}</p></div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">{searchQuery ? "未找到匹配的会话" : "暂无会话记录"}</p>
            {!searchQuery && <Button onClick={onNewSession} variant="outline" className="mt-4"><Plus className="mr-2 h-4 w-4" />创建第一个会话</Button>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayedSessions.map((session) => {
              const firstMessagePreview = session.first_message ? truncateText(getFirstLine(session.first_message), 100) : session.id;
              const timeDisplay = session.last_message_timestamp ? formatISOTimestamp(session.last_message_timestamp) : session.message_timestamp ? formatISOTimestamp(session.message_timestamp) : new Date(session.created_at * 1000).toLocaleString();
              return (
                <button key={`${session.project_id}-${session.id}`} onClick={() => onSessionClick?.(session)} className="w-full text-left px-6 py-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">{firstMessagePreview}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono truncate max-w-lg" title={session.project_path || "未知项目"}>{session.project_path || "未知项目"}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="font-mono">{session.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0"><Clock className="h-3 w-3" /><time>{timeDisplay}</time></div>
                  </div>
                </button>
              );
            })}
            {hasMore && <div className="p-6 flex justify-center"><Button onClick={handleLoadMore} variant="outline" className="w-full max-w-xs">加载更多 ({filteredSessions.length - displayCount} 剩余)</Button></div>}
          </div>
        )}
        {loadingMore && displayedSessions.length > 0 && (
          <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground border-t">
            <Loader2 className="h-4 w-4 animate-spin" />正在加载更多会话... ({loadedProjectCount}/{totalProjectCount} 项目)
          </div>
        )}
      </div>
      {!loading && filteredSessions.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/30 text-center space-y-1">
          <p className="text-xs text-muted-foreground">显示 {displayedSessions.length} / {filteredSessions.length} 个会话{searchQuery && ` • 已过滤 ${sessions.length - filteredSessions.length} 个`}</p>
          {totalCount > filteredSessions.length && <p className="text-xs text-muted-foreground/70">共 {totalCount} 个会话 • {loadedProjectCount}/{totalProjectCount} 项目已加载</p>}
        </div>
      )}
    </div>
  );
};

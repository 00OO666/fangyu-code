import React, { useState, useEffect } from "react";
import { MessageSquare, Clock, GitBranch, Folder, Eye } from "lucide-react";
import type { CliSession } from "@/types/cli-monitor";
import { getSessionSummary } from "@/lib/api/cli-monitor";
import { logger } from "@/lib/logger";

interface SessionThumbnailProps {
  session: CliSession;
  onClick?: () => void;
  className?: string;
}

export const SessionThumbnail: React.FC<SessionThumbnailProps> = ({
  session,
  onClick,
  className = "",
}) => {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [session.session_id]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const sessionSummary = await getSessionSummary(session.session_id, 150);
      setSummary(sessionSummary);
    } catch (err) {
      logger.error("[SessionThumbnail] Failed to load summary:", err);
      setSummary(session.summary || "无摘要");
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "今天";
    } else if (days === 1) {
      return "昨天";
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group relative p-4 bg-[#141824] border border-white/10 rounded-lg hover:border-blue-500/50 transition-all cursor-pointer ${className}`}
      style={{
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Status Indicator */}
      {session.is_active && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate mb-1">
            {session.summary || "未命名会话"}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{formatTimestamp(session.modified)}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-3">
        {loading ? (
          <div className="text-xs text-gray-500">加载中...</div>
        ) : (
          <p className="text-xs text-gray-400 line-clamp-3">{summary}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Folder className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{session.project_path}</span>
        </div>
        {session.git_branch && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <GitBranch className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{session.git_branch}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <MessageSquare className="w-3 h-3 flex-shrink-0" />
          <span>{session.message_count} 条消息</span>
        </div>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />

      {/* View Icon */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Eye className="w-4 h-4 text-blue-400" />
      </div>
    </div>
  );
};

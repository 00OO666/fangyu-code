import React, { useState, useEffect, useRef } from "react";
import { X, MessageSquare, Clock, GitBranch, Folder } from "lucide-react";
import type { CliSession } from "@/types/cli-monitor";
import type { SessionContent } from "@/lib/api/cli-monitor";
import { readSessionContent, readLastMessages } from "@/lib/api/cli-monitor";
import { logger } from "@/lib/logger";

interface SessionDetailPanelProps {
  session: CliSession;
  onClose: () => void;
  className?: string;
}

export const SessionDetailPanel: React.FC<SessionDetailPanelProps> = ({
  session,
  onClose,
  className = "",
}) => {
  const [content, setContent] = useState<SessionContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    loadSessionContent(requestId);
  }, [session.session_id]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSessionContent = async (requestId: number) => {
    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // 默认只加载最后 20 条消息
      const sessionContent = await readLastMessages(session.session_id, 20);
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setContent(sessionContent);
        setShowFullContent(false);
      }
    } catch (err) {
      logger.error("SessionDetailPanel", `Failed to load session content: ${err}`);
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const loadFullContent = async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const sessionContent = await readSessionContent(session.session_id);
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setContent(sessionContent);
        setShowFullContent(true);
      }
    } catch (err) {
      logger.error("SessionDetailPanel", `Failed to load full content: ${err}`);
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "user":
        return "text-blue-400";
      case "assistant":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "user":
        return "用户";
      case "assistant":
        return "助手";
      default:
        return role;
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#0a0e1a] border border-white/10 rounded-xl overflow-hidden ${className}`}
      style={{
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-2">
            {session.summary || "未命名会话"}
          </h2>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <Folder className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{session.project_path}</span>
            </div>
            {session.git_branch && (
              <div className="flex items-center gap-1">
                <GitBranch className="w-4 h-4" />
                <span>{session.git_branch}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              <span>{session.message_count} 条消息</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{formatTimestamp(session.modified)}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">加载中...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400">加载失败: {error}</div>
          </div>
        )}

        {!loading && !error && content && (
          <div className="space-y-4">
            {/* Load More Button */}
            {!showFullContent && content.total_messages > content.messages.length && (
              <button
                onClick={loadFullContent}
                className="w-full py-2 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
              >
                加载全部 {content.total_messages} 条消息
              </button>
            )}

            {/* Messages */}
            {content.messages.map((message, index) => (
              <div key={index} className="p-4 bg-[#141824] rounded-lg border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-semibold ${getRoleColor(message.role)}`}>
                    {getRoleLabel(message.role)}
                  </span>
                  {message.timestamp && (
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  )}
                </div>
                <div className="text-gray-300 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

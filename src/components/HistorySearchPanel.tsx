/**
 * HistorySearchPanel - 聊天历史回溯面板
 *
 * 功能:
 * - 语义搜索历史对话
 * - FTS5 全文搜索支持
 * - 显示搜索结果和上下文
 * - 支持加载历史记录到当前会话
 */

import { logger } from "@/lib/logger";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  History,
  MessageSquare,
  Calendar,
  FolderOpen,
  X,
  Loader2,
  ChevronRight,
  ArrowUpRight,
  Database,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// 类型定义
// ============================================================================

interface ChatSession {
  id: number;
  session_id: string;
  project_path?: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  tokens_input: number;
  tokens_output: number;
  model?: string;
}

interface SearchResult {
  message: ChatMessage;
  session: ChatSession;
  relevance_score: number;
}

interface ChatHistoryStats {
  total_sessions: number;
  total_messages: number;
  total_tokens_input: number;
  total_tokens_output: number;
  database_size_mb: number;
}

interface HistorySearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 可选：当选择历史记录时的回调 */
  onLoadContext?: (messages: ChatMessage[], session: ChatSession) => void;
  /** 触发器元素的引用，用于定位面板 */
  triggerRef?: React.RefObject<HTMLElement>;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化时间戳为相对时间
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString("zh-CN");
}

/**
 * 截断文本，保留关键信息
 */
function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * 高亮搜索关键词
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function HistorySearchPanel({
  open,
  onOpenChange,
  onLoadContext,
  triggerRef,
}: HistorySearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<ChatHistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 面板位置
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // 计算面板位置
  useEffect(() => {
    if (open && triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(16, rect.left - 200),
      });
    }
  }, [open, triggerRef]);

  // 聚焦输入框
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // 加载统计和最近会话
  useEffect(() => {
    if (open) {
      loadStats();
      loadRecentSessions();
    }
  }, [open]);

  // 搜索防抖
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const loadStats = async () => {
    try {
      const data = await invoke<ChatHistoryStats>("get_chat_history_stats");
      setStats(data);
    } catch (error) {
      logger.error("HistorySearchPanel", "Failed to load stats:", error);
    }
  };

  const loadRecentSessions = async () => {
    try {
      const sessions = await invoke<ChatSession[]>("get_recent_sessions", { limit: 10 });
      setRecentSessions(sessions);
    } catch (error) {
      logger.error("HistorySearchPanel", "Failed to load recent sessions:", error);
    }
  };

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const searchResults = await invoke<SearchResult[]>("search_chat_history", {
        query: searchQuery,
        limit: 20,
      });
      setResults(searchResults);
    } catch (error) {
      logger.error("HistorySearchPanel", "Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    setIsLoadingMessages(true);
    try {
      const messages = await invoke<ChatMessage[]>("get_session_messages", {
        sessionId,
        limit: 50,
      });
      setSessionMessages(messages);
    } catch (error) {
      logger.error("HistorySearchPanel", "Failed to load messages:", error);
      setSessionMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result);
    loadSessionMessages(result.session.session_id);
  };

  const handleLoadContext = useCallback(() => {
    if (selectedResult && sessionMessages.length > 0 && onLoadContext) {
      onLoadContext(sessionMessages, selectedResult.session);
      onOpenChange(false);
    }
  }, [selectedResult, sessionMessages, onLoadContext, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="fixed bg-background border rounded-xl shadow-2xl"
        style={{
          top: position.top,
          left: position.left,
          width: "600px",
          maxHeight: "70vh",
          zIndex: "var(--z-dropdown)",
        }}
      >
        {/* 头部 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <History className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-base">历史回溯</h2>
          {stats && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
              <Badge variant="secondary" className="gap-1">
                <Database className="w-3 h-3" />
                {stats.total_messages} 条消息
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="w-3 h-3" />
                {stats.total_sessions} 个会话
              </Badge>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索历史对话... (支持语义搜索)"
              className="pl-9 pr-4"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* 内容区域 */}
        <ScrollArea className="h-[400px]">
          <div className="p-4">
            {/* 搜索结果 */}
            {query.trim() && results.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  搜索结果 ({results.length})
                </h3>
                {results.map((result, index) => (
                  <motion.div
                    key={`${result.session.session_id}-${result.message.id}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50",
                      selectedResult?.message.id === result.message.id && "bg-accent border-primary"
                    )}
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                          result.message.role === "user"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        )}
                      >
                        {result.message.role === "user" ? "你" : "AI"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {result.session.title && (
                            <span className="text-sm font-medium truncate">
                              {result.session.title}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(result.message.timestamp)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {highlightMatch(truncateText(result.message.content, 200), query)}
                        </p>
                        {result.session.project_path && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <FolderOpen className="w-3 h-3" />
                            <span className="truncate">{result.session.project_path}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 无搜索结果 */}
            {query.trim() && !isLoading && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>未找到相关对话</p>
                <p className="text-xs mt-1">尝试使用不同的关键词</p>
              </div>
            )}

            {/* 默认：最近会话 */}
            {!query.trim() && recentSessions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">最近会话</h3>
                {recentSessions.map((session, index) => (
                  <motion.div
                    key={session.session_id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50"
                    onClick={() => {
                      setSelectedResult({
                        message: {
                          id: 0,
                          session_id: session.session_id,
                          role: "user",
                          content: "",
                          timestamp: session.updated_at,
                          tokens_input: 0,
                          tokens_output: 0,
                        },
                        session,
                        relevance_score: 0,
                      });
                      loadSessionMessages(session.session_id);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session.title || session.session_id.slice(0, 8)}
                        </p>
                        {session.project_path && (
                          <p className="text-xs text-muted-foreground truncate">
                            {session.project_path}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelativeTime(session.updated_at)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 空状态 */}
            {!query.trim() && recentSessions.length === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无历史记录</p>
                <p className="text-xs mt-1">开始对话后，历史记录将自动保存</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 底部：选中会话详情 */}
        {selectedResult && (
          <div className="border-t p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(selectedResult.session.created_at).toLocaleDateString("zh-CN")}
                </span>
                {isLoadingMessages && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {onLoadContext && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={handleLoadContext}
                      disabled={sessionMessages.length === 0}
                      className="gap-1.5"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      加载到当前会话
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>将历史对话上下文加载到当前会话</TooltipContent>
                </Tooltip>
              )}
            </div>
            {sessionMessages.length > 0 && (
              <div className="text-xs text-muted-foreground">
                共 {sessionMessages.length} 条消息
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export default HistorySearchPanel;

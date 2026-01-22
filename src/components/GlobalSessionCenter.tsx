/**
 * GlobalSessionCenter - 会话中心组件
 * 
 * 功能：
 * - 显示所有项目的会话记录
 * - 搜索会话
 * - 编辑模式：多选、批量删除
 */

import { logger } from '@/lib/logger';
import React, { useState, useCallback, useMemo } from "react";
import Clock from 'lucide-react/dist/esm/icons/clock'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Search from 'lucide-react/dist/esm/icons/search'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import CheckSquare from 'lucide-react/dist/esm/icons/check-square'
import Square from 'lucide-react/dist/esm/icons/square'
import X from 'lucide-react/dist/esm/icons/x'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatISOTimestamp, truncateText, getFirstLine } from "@/lib/date-utils";
import type { Session } from "@/lib/api";
import { useSessionCache } from "@/hooks/useSessionCache";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

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
  const { sessions, loading, loadingMore, totalProjectCount, loadedProjectCount, error, refresh } = useSessionCache();
  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // 编辑模式状态
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // 生成唯一键（使用 JSON 序列化避免分隔符冲突）
  const getSessionKey = (session: Session) => JSON.stringify({ p: session.project_id, s: session.id });

  // 从 key 解析 project_id 和 session_id
  const parseSessionKey = (key: string): { projectId: string; sessionId: string } => {
    try {
      const { p, s } = JSON.parse(key);
      return { projectId: p, sessionId: s };
    } catch {
      logger.error('GlobalSessionCenter', '[parseSessionKey] Failed to parse:', key);
      return { projectId: '', sessionId: '' };
    }
  };

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  // 切换单个选择
  const toggleSelect = useCallback((session: Session) => {
    const key = getSessionKey(session);
    console.log('[Select] Session:', {
      id: session.id,
      project_id: session.project_id,
      project_path: session.project_path,
      key
    });
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === displayedSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedSessions.map(getSessionKey)));
    }
  }, [displayedSessions, selectedIds.size]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      // 按项目分组
      const sessionsByProject = new Map<string, string[]>();
      for (const key of selectedIds) {
        const { projectId, sessionId } = parseSessionKey(key);
        logger.debug('GlobalSessionCenter', '[Delete] Parsed key:', key, '→', { projectId, sessionId });
        if (!sessionsByProject.has(projectId)) {
          sessionsByProject.set(projectId, []);
        }
        sessionsByProject.get(projectId)!.push(sessionId);
      }

      logger.debug('GlobalSessionCenter', '[Delete] Sessions by project:', Object.fromEntries(sessionsByProject));

      let totalDeleted = 0;
      let totalFailed = 0;

      // 逐项目删除
      for (const [projectId, sessionIds] of sessionsByProject) {
        try {
          logger.debug('GlobalSessionCenter', '[Delete] Calling delete_sessions_batch:', { projectId, sessionIds });
          const result = await invoke<string>('delete_sessions_batch', {
            sessionIds,
            projectId,
          });
          logger.debug('GlobalSessionCenter', '[Delete] Result:', result);
          // 解析结果
          const match = result.match(/Deleted (\d+) sessions/);
          if (match) {
            totalDeleted += parseInt(match[1], 10);
          }
        } catch (e) {
          logger.error('GlobalSessionCenter', `[Delete] Failed for project ${projectId}:`, e);
          totalFailed += sessionIds.length;
        }
      }

      if (totalDeleted > 0) {
        toast.success(`已删除 ${totalDeleted} 个会话`);
      }
      if (totalFailed > 0) {
        toast.error(`${totalFailed} 个会话删除失败`);
      }

      // 刷新列表（先清除缓存）
      localStorage.removeItem('fangyu_session_center_cache');
      setSelectedIds(new Set());
      setEditMode(false);
      await refresh();
    } catch (e) {
      logger.error('GlobalSessionCenter', '[Delete] Error:', e);
      toast.error(`删除失败: ${e}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [selectedIds, refresh]);

  // 点击会话
  const handleSessionClick = useCallback((session: Session) => {
    if (editMode) {
      toggleSelect(session);
    } else {
      onSessionClick?.(session);
    }
  }, [editMode, toggleSelect, onSessionClick]);

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">会话中心</h1>
            <p className="text-sm text-muted-foreground mt-1">所有项目的会话记录，按最近打开时间排序</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 编辑模式按钮 */}
            {!loading && sessions.length > 0 && (
              <Button
                onClick={toggleEditMode}
                variant={editMode ? "secondary" : "outline"}
                size="default"
              >
                {editMode ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    取消
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    管理
                  </>
                )}
              </Button>
            )}
            {!editMode && (
              <Button
                onClick={onNewSession}
                size="default"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <Plus className="mr-2 h-4 w-4" />新建会话
              </Button>
            )}
          </div>
        </div>

        {/* 编辑模式工具栏 */}
        {editMode && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50 border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="text-sm"
            >
              {selectedIds.size === displayedSessions.length && displayedSessions.length > 0 ? (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  取消全选
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  全选
                </>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              已选择 {selectedIds.size} 个会话
            </span>
            <div className="flex-1" />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={selectedIds.size === 0 || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除选中 ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        )}

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
              const key = getSessionKey(session);
              const isSelected = selectedIds.has(key);
              const firstMessagePreview = session.first_message ? truncateText(getFirstLine(session.first_message), 100) : session.id;
              const timeDisplay = session.last_message_timestamp ? formatISOTimestamp(session.last_message_timestamp) : session.message_timestamp ? formatISOTimestamp(session.message_timestamp) : new Date(session.created_at * 1000).toLocaleString();

              return (
                <button
                  key={key}
                  onClick={() => handleSessionClick(session)}
                  className={cn(
                    "w-full text-left px-6 py-4 transition-colors group",
                    editMode
                      ? isSelected
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/30"
                      : "hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* 复选框 */}
                    {editMode && (
                      <div className="flex items-center pt-0.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(session)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className={cn(
                        "text-sm font-medium truncate transition-colors",
                        isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
                      )}>
                        {firstMessagePreview}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono truncate max-w-lg" title={session.project_path || "未知项目"}>
                          {session.project_path || "未知项目"}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="font-mono">{session.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <time>{timeDisplay}</time>
                    </div>
                  </div>
                </button>
              );
            })}
            {hasMore && (
              <div className="p-6 flex justify-center">
                <Button onClick={handleLoadMore} variant="outline" className="w-full max-w-xs">
                  加载更多 ({filteredSessions.length - displayCount} 剩余)
                </Button>
              </div>
            )}
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

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 个会话吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

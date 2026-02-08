/**
 * Recent Sessions List - 最近会话列表组件
 *
 * 功能：
 * - 显示最近使用的会话列表
 * - 支持一键切换会话
 * - 支持删除会话
 * - 显示会话详细信息（标题、引擎、消息数、时间）
 *
 * 特点：
 * - 深色主题设计
 * - 响应式布局
 * - 平滑过渡动画
 */

import React, { useCallback } from 'react';
import { Clock, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import {
  useRecentSessions,
  useCurrentRecentSessionId,
  useRecentSessionsActions,
} from '@/stores/useRecentSessionsStore';
import type { SessionSnapshot } from '@/types/recentSessions';

interface RecentSessionsListProps {
  /**
   * 点击会话时的回调函数。
   */
  onSessionClick?: (session: SessionSnapshot) => void;

  /**
   * 可选的 className。
   */
  className?: string;
}

/**
 * 格式化时间戳为相对时间。
 */
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
};

/**
 * 获取引擎显示名称。
 */
const getEngineName = (engine: string): string => {
  const engineNames: Record<string, string> = {
    claude: 'Claude',
    codex: 'Codex',
    gemini: 'Gemini',
  };
  return engineNames[engine] || engine;
};

/**
 * 获取引擎颜色类名。
 */
const getEngineColor = (engine: string): string => {
  const engineColors: Record<string, string> = {
    claude: 'text-blue-400',
    codex: 'text-green-400',
    gemini: 'text-purple-400',
  };
  return engineColors[engine] || 'text-gray-400';
};

/**
 * 最近会话列表组件。
 *
 * @example
 * <RecentSessionsList
 *   onSessionClick={(session) => console.log('Clicked:', session)}
 * />
 */
export const RecentSessionsList: React.FC<RecentSessionsListProps> = ({
  onSessionClick,
  className,
}) => {
  const sessions = useRecentSessions();
  const currentSessionId = useCurrentRecentSessionId();
  const { switchSession, removeRecentSession } = useRecentSessionsActions();

  // 🔧 处理会话点击
  const handleSessionClick = useCallback(
    (session: SessionSnapshot) => {
      logger.debug('RecentSessionsList', '[RecentSessionsList] Switching to session:', session.id);
      switchSession(session.id);
      onSessionClick?.(session);
    },
    [switchSession, onSessionClick]
  );

  // 🔧 处理会话删除
  const handleSessionDelete = useCallback(
    (sessionId: string, event: React.MouseEvent) => {
      event.stopPropagation(); // 阻止触发会话点击
      logger.debug('RecentSessionsList', '[RecentSessionsList] Deleting session:', sessionId);
      removeRecentSession(sessionId);
    },
    [removeRecentSession]
  );

  // 🔧 如果没有会话，显示空状态
  if (sessions.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-gray-500', className)}>
        <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">暂无最近会话</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2 p-4', className)}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">最近会话</h3>
        <span className="text-xs text-gray-500">{sessions.length} 个会话</span>
      </div>

      {/* 会话列表 */}
      <div className="flex flex-col gap-2">
        {sessions.map((session) => {
          const isActive = session.id === currentSessionId;

          return (
            <div
              key={session.id}
              onClick={() => handleSessionClick(session)}
              className={cn(
                'flex flex-col gap-2 p-3 rounded-lg cursor-pointer transition-all',
                'border border-gray-700 hover:border-gray-600',
                isActive
                  ? 'bg-gray-700 border-blue-500'
                  : 'bg-gray-800 hover:bg-gray-750'
              )}
            >
              {/* 会话标题和引擎 */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">
                    {session.title || '未命名会话'}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {session.lastMessage || '暂无消息'}
                  </p>
                </div>

                {/* 删除按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleSessionDelete(session.id, e)}
                  className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              {/* 会话元信息 */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {/* 引擎 */}
                <span className={cn('font-medium', getEngineColor(session.engine))}>
                  {getEngineName(session.engine)}
                </span>

                {/* 消息数 */}
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {session.messageCount} 条消息
                </span>

                {/* 时间 */}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(session.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

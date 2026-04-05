import { logger } from '@/lib/logger';
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ClaudeCodeSession } from './ClaudeCodeSession';
import { useTabSession, useTabs } from '@/hooks/useTabs';
import { useExecutionTracking } from '@/hooks/useExecutionTracking';
import type { Session } from '@/lib/api';

interface TabSessionWrapperProps {
  tabId: string;
  session?: Session;
  initialProjectPath?: string;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
  isActive: boolean;
}

/**
 * TabSessionWrapper - 标签页会话包装器
 * 为每个标签页提供独立的会话状态管理和生命周期控制
 * 使用React.memo优化，避免不必要的重新渲染
 */
const TabSessionWrapperComponent: React.FC<TabSessionWrapperProps> = ({
  tabId,
  session,
  initialProjectPath,
  onStreamingChange,
  isActive,
}) => {
  // ✅ FIXED: Removed unused 'tab' variable to fix TS6133
  const { tab, updateStreaming, setCleanup, updateTitle, updateEngine, updateSession } = useTabSession(tabId);
  const { upgradeSmartSession } = useTabs();
  const sessionRef = useRef<{ hasChanges: boolean; sessionId: string | null }>({
    hasChanges: false,
    sessionId: null,
  });

  // 🆕 执行状态追踪 - 记录是否正在执行
  const [isCurrentlyStreaming, setIsCurrentlyStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentEngine, setCurrentEngine] = useState<
    'claude' | 'codex' | 'gemini' | 'siliconflow' | 'kiro'
  >('claude');

  // 🆕 集成 GlobalExecutionContext
  useExecutionTracking({
    tabId,
    isLoading: isCurrentlyStreaming,
    sessionId: currentSessionId,
    projectPath: initialProjectPath || session?.project_path || '',
    engine: currentEngine,
    isActive,
  });

  // 🔧 NEW: Register cleanup callback for proper resource management
  useEffect(() => {
    const cleanup = async () => {
      // This will be called when the tab is closed
      // The ClaudeCodeSession cleanup is handled by its own useEffect
    };

    setCleanup(cleanup);
  }, [tabId, setCleanup]);

  // 🔧 NEW: Helper function to extract project name from path
  const extractProjectName = useCallback((path: string): string => {
    if (!path) return '';

    // 判断是 Windows 路径还是 Unix 路径
    const isWindowsPath = path.includes('\\');
    const separator = isWindowsPath ? '\\' : '/';

    // 分割路径并获取最后一个片段
    const segments = path.split(separator);
    const projectName = segments[segments.length - 1] || '';

    // 格式化项目名：移除常见前缀，替换分隔符为空格
    const formattedName = projectName
      .replace(/^(my-|test-|demo-)/, '')
      .replace(/[-_]/g, ' ')
      .trim();

    return formattedName;
  }, []);

  // 🔧 NEW: Handle project path change and update tab title
  const handleProjectPathChange = useCallback((newPath: string) => {
    if (newPath && newPath !== '__NEW_PROJECT__') {
      const projectName = extractProjectName(newPath);
      if (projectName) {
        updateTitle(projectName);
      }
    }
  }, [extractProjectName, updateTitle]);

  // 🆕 Handle engine change - 更新标签页显示的引擎类型
  const handleEngineChange = useCallback((
    engine: 'claude' | 'codex' | 'gemini' | 'siliconflow' | 'kiro',
  ) => {
    setCurrentEngine(engine);
    updateEngine(engine);
  }, [updateEngine]);

  // 🔧 FIX: Handle session info change - 持久化新建会话的信息
  // 解决路由切换后新建会话消息丢失的问题
  const handleSessionInfoChange = useCallback((info: {
    sessionId: string;
    projectId: string;
    projectPath: string;
    engine?: 'claude' | 'codex' | 'gemini' | 'siliconflow' | 'kiro';
  }) => {
    logger.debug('TabSessionWrapper', '[TabSessionWrapper] Session info received, updating tab:', { tabId, info });
    updateSession(info);
  }, [tabId, updateSession]);

  // 包装 onStreamingChange 以更新标签页状态
  // 🔧 性能修复：使用 useCallback 避免无限渲染循环（从 1236 renders/s 降至 1 render/s）
  const handleStreamingChange = useCallback((isStreaming: boolean, sessionId: string | null) => {
    sessionRef.current.sessionId = sessionId;
    // 🆕 更新执行追踪状态
    setIsCurrentlyStreaming(isStreaming);
    setCurrentSessionId(sessionId);
    updateStreaming(isStreaming, sessionId);
    onStreamingChange?.(isStreaming, sessionId);

    // 🔧 移除标题自动更新逻辑
    // 会话 ID 已经在 Tooltip 中显示，不需要在标题中重复显示
  }, [updateStreaming, onStreamingChange]);

  // 🆕 智能会话升级回调 - 当用户发送第一条消息时，自动创建项目文件夹
  const handleSmartSessionUpgrade = useCallback(async (firstMessage: string): Promise<{ projectPath: string; title: string } | null> => {
    logger.debug('TabSessionWrapper', '[TabSessionWrapper] handleSmartSessionUpgrade called', { tabId, smartMode: tab?.smartMode, messageLength: firstMessage?.length });

    // 只有智能模式才需要升级
    if (!tab?.smartMode) {
      logger.warn('TabSessionWrapper', '[TabSessionWrapper] Not in smart mode, skipping upgrade');
      return null;
    }

    try {
      logger.debug('TabSessionWrapper', '[TabSessionWrapper] Calling upgradeSmartSession...');
      const result = await upgradeSmartSession(tabId, firstMessage);
      logger.debug('TabSessionWrapper', '[TabSessionWrapper] upgradeSmartSession result:', result);
      return result;
    } catch (err) {
      logger.error('TabSessionWrapper', '[TabSessionWrapper] Smart session upgrade failed with error:', err);
      logger.error('TabSessionWrapper', '[TabSessionWrapper] Error stack:', err instanceof Error ? err.stack : 'No stack');
      return null;
    }
  }, [tab?.smartMode, tabId, upgradeSmartSession]);

  // 监听会话变化并标记为已更改
  useEffect(() => {
    // 这里可以监听会话内容变化
    // 暂时注释掉，等待 ClaudeCodeSession 组件支持变更回调
  }, []);

  // 当标签页变为非活跃时，保持会话状态在后台
  useEffect(() => {
    // Tab state changes are handled silently
  }, [isActive, tabId]);

  return (
    <div
      className="h-full w-full"
      // 🔧 REMOVED: display control CSS - now using conditional rendering
    >
      <ClaudeCodeSession
        session={session}
        initialProjectPath={initialProjectPath}
        onStreamingChange={handleStreamingChange}
        onProjectPathChange={handleProjectPathChange}
        onEngineChange={handleEngineChange}
        onSessionInfoChange={handleSessionInfoChange}
        isActive={isActive}
        onTitleUpdate={updateTitle}
        onSmartSessionUpgrade={tab?.smartMode ? handleSmartSessionUpgrade : undefined}
      />
    </div>
  );
};

// 使用React.memo优化，避免不必要的重新渲染
export const TabSessionWrapper = React.memo(TabSessionWrapperComponent, (prevProps, nextProps) => {
  // 自定义比较函数，只有这些props变化时才重新渲染

  // 🔧 FIX: 当 session 从 undefined "升级"为有值时，不应触发重新渲染
  // 因为 ClaudeCodeSession 内部已经通过 extractedSessionInfo 追踪到了 session 信息
  // 如果此时重新渲染，会导致 MessagesProvider 被重新创建，消息丢失
  const sessionIdUnchanged = (() => {
    const prevId = prevProps.session?.id;
    const nextId = nextProps.session?.id;

    // 如果两者都是 undefined 或相同，返回 true
    if (prevId === nextId) return true;

    // 🔧 CRITICAL: 如果 prevId 是 undefined，nextId 有值，这是 "session 升级"
    // 不应该触发重新渲染，返回 true 表示"相同"
    if (prevId === undefined && nextId !== undefined) {
      logger.debug('TabSessionWrapper', '[TabSessionWrapper] Session upgraded from undefined to', nextId, '- skipping re-render');
      return true;
    }

    // 其他情况（如 session 真的变了），返回 false
    return false;
  })();

  return (
    prevProps.tabId === nextProps.tabId &&
    prevProps.isActive === nextProps.isActive &&
    sessionIdUnchanged &&
    prevProps.initialProjectPath === nextProps.initialProjectPath
    // onStreamingChange 等函数props通常是稳定的
  );
});

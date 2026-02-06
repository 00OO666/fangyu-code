/**
 * SessionToolbar - 会话工具栏组件
 * 提供导出、复制、检查点、摘要生成等会话操作功能
 */

import { logger } from '@/lib/logger';
import React, { useState, useCallback } from 'react';
import FileDown from 'lucide-react/dist/esm/icons/file-down'
import Check from 'lucide-react/dist/esm/icons/check'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import FileJson from 'lucide-react/dist/esm/icons/file-json'
import FileCode2 from 'lucide-react/dist/esm/icons/file-code-2'
import Copy from 'lucide-react/dist/esm/icons/copy'
import History from 'lucide-react/dist/esm/icons/history'
import Save from 'lucide-react/dist/esm/icons/save'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Zap from 'lucide-react/dist/esm/icons/zap'
import { SummaryButton } from '@/components/session/SummaryButton';
import { SummaryModal } from '@/components/dialogs/SummaryModal';
import { useSummaryGenerator } from '@/hooks/useSummaryGenerator';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Popover } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { exportSession, copyToClipboard, exportAsJsonl, exportAsMarkdown, exportAsJson } from '@/lib/sessionExport';
import { api, Checkpoint } from '@/lib/api';
import { CheckpointTimeline } from './CheckpointTimeline';
import { TabContext } from '@/hooks/useTabs';
import { useSetPrefillMessage } from '@/stores/sessionStore';
import { toast } from 'sonner';
import { useContext } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';
import type { Session } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { setSessionThemePreference } from '@/lib/themePreferences';

interface SessionToolbarProps {
  /** 当前会话的消息列表 */
  messages: ClaudeStreamMessage[];
  /** 当前会话信息 */
  session?: Session;
  /** 项目路径（用于检查点功能） */
  projectPath?: string;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * SessionToolbar 组件（合并导出、复制和检查点功能）
 *
 * @example
 * <SessionToolbar
 *   messages={messages}
 *   session={session}
 *   projectPath="/path/to/project"
 *   isStreaming={false}
 * />
 */
export const SessionToolbar: React.FC<SessionToolbarProps> = ({
  messages,
  session,
  projectPath,
  isStreaming = false,
  className,
}) => {
  const [actionStatus, setActionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [checkpointPopoverOpen, setCheckpointPopoverOpen] = useState(false);
  const [isCreatingCheckpoint, setIsCreatingCheckpoint] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  // Tab 管理和预填充消息
  // 🔧 FIX: 使用可选的 Context 访问，避免在 TabProvider 外部使用时崩溃
  const tabContext = useContext(TabContext);
  const { themeName, setTheme } = useTheme();
  const setPrefillMessage = useSetPrefillMessage();

  // 摘要生成 Hook
  const {
    sessionStats,
    isGenerating: isSummaryGenerating,
  } = useSummaryGenerator({ messages });

  // 没有消息或正在流式输出时禁用
  const hasMessages = messages.length > 0;
  const isDisabled = !hasMessages || isStreaming;

  /**
   * 显示状态提示
   */
  const showStatus = (status: 'success' | 'error', message: string) => {
    setActionStatus(status);
    setStatusMessage(message);
    setTimeout(() => {
      setActionStatus('idle');
      setStatusMessage('');
    }, 2000);
  };

  /**
   * 处理复制操作
   */
  const handleCopy = async (format: 'jsonl' | 'markdown' | 'json') => {
    try {
      let content: string;
      let label: string;

      switch (format) {
        case 'jsonl':
          content = exportAsJsonl(messages);
          label = 'JSONL';
          break;
        case 'markdown':
          content = exportAsMarkdown(messages, session);
          label = 'Markdown';
          break;
        case 'json':
          content = exportAsJson(messages, session);
          label = 'JSON';
          break;
      }

      await copyToClipboard(content);
      showStatus('success', `已复制为 ${label}`);
      setIsMenuOpen(false);
    } catch (error) {
      logger.error('SessionToolbar', '复制失败:', error);
      showStatus('error', '复制失败');
    }
  };

  /**
   * 处理保存文件操作
   */
  const handleSave = async (format: 'json' | 'jsonl' | 'markdown') => {
    try {
      const filePath = await exportSession(messages, format, session);

      if (filePath) {
        showStatus('success', '文件已保存');
      }

      setIsMenuOpen(false);
    } catch (error) {
      logger.error('SessionToolbar', '保存文件失败:', error);
      showStatus('error', '保存失败');
    }
  };

  /**
   * 手动创建检查点
   */
  const handleCreateCheckpoint = useCallback(async () => {
    if (!session?.id || !projectPath) {
      showStatus('error', '无法创建检查点');
      return;
    }

    try {
      setIsCreatingCheckpoint(true);
      await api.createCheckpoint(
        session.id,
        projectPath,
        'manual',
        `手动检查点 - ${new Date().toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`
      );
      showStatus('success', '检查点已创建');
    } catch (error) {
      logger.error('SessionToolbar', '创建检查点失败:', error);
      showStatus('error', '创建失败');
    } finally {
      setIsCreatingCheckpoint(false);
    }
  }, [session?.id, projectPath]);

  /**
   * 检查点恢复回调
   */
  const handleCheckpointRestore = useCallback((_checkpoint: Checkpoint) => {
    showStatus('success', '已恢复检查点');
    setCheckpointPopoverOpen(false);
  }, []);

  /**
   * 处理摘要复制成功
   */
  const handleSummaryCopySuccess = useCallback(() => {
    showStatus('success', '摘要已复制');
  }, []);

  /**
   * 处理在新会话中打开摘要
   */
  const handleOpenInNewSession = useCallback(async (summary: string) => {
    try {
      // 1. 复制摘要到剪贴板
      await navigator.clipboard.writeText(summary);

      // 2. 检查 TabContext 是否可用
      if (!tabContext) {
        // TabProvider 不可用时，只复制到剪贴板
        toast.success('摘要已复制到剪贴板', {
          description: '请手动创建新会话并粘贴',
        });
        showStatus('success', '摘要已复制');
        return;
      }

      // 3. 设置预填充消息（供新标签页使用）
      setPrefillMessage(summary);

      // 4. 创建新的智能标签页
      tabContext.createSmartTab(true);

      // 5. 显示成功提示
      toast.success('已创建新会话', {
        description: '摘要已复制到剪贴板，可直接粘贴使用',
      });

      showStatus('success', '已在新会话中打开');
    } catch (error) {
      logger.error('SessionToolbar', '[SessionToolbar] Failed to open in new session:', error);
      toast.error('创建新会话失败');
      showStatus('error', '操作失败');
    }
  }, [tabContext, setPrefillMessage]);

  const handleToggleTheme = useCallback(() => {
    const nextTheme = themeName === 'deep-glass-pro'
      ? 'deep-glass-scifi'
      : 'deep-glass-pro';

    setTheme(nextTheme);

    if (session?.id || projectPath) {
      setSessionThemePreference(
        { sessionId: session?.id, projectPath },
        nextTheme
      );
    }

    if (tabContext?.activeTabId) {
      tabContext.updateTabTheme(tabContext.activeTabId, nextTheme);
    }
  }, [themeName, setTheme, session?.id, projectPath, tabContext]);

  // 检查点功能是否可用
  const checkpointEnabled = !!session?.id && !!projectPath;

  return (
    <div className={cn('session-toolbar flex items-center gap-2', className)}>
      {/* 主题切换（仅会话级） */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleTheme}
        className="h-8 px-2 gap-1.5"
        title={themeName === 'deep-glass-scifi' ? '切换到 Pro 主题' : '切换到 Sci-Fi 主题'}
      >
        {themeName === 'deep-glass-scifi' ? (
          <Sparkles className="h-4 w-4 text-amber-500" />
        ) : (
          <Zap className="h-4 w-4 text-blue-500" />
        )}
        <span className="text-xs">主题</span>
      </Button>

      {/* 摘要生成按钮 */}
      <SummaryButton
        tokenPercentage={sessionStats.tokenPercentage}
        isGenerating={isSummaryGenerating}
        disabled={!hasMessages || isStreaming}
        onClick={() => setSummaryModalOpen(true)}
      />

      {/* 摘要生成对话框 */}
      <SummaryModal
        open={summaryModalOpen}
        onOpenChange={setSummaryModalOpen}
        messages={messages}
        sessionStats={sessionStats}
        onCopySuccess={handleSummaryCopySuccess}
        onOpenInNewSession={handleOpenInNewSession}
      />

      {/* 检查点功能 */}
      {checkpointEnabled && (
        <>
          {/* 快速创建检查点按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateCheckpoint}
            disabled={isCreatingCheckpoint || isStreaming}
            className="h-8 px-2 gap-1.5"
            title="创建手动检查点 (保存当前文件状态)"
          >
            {isCreatingCheckpoint ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="text-xs">检查点</span>
          </Button>

          {/* 检查点历史 Popover */}
          <Popover
            open={checkpointPopoverOpen}
            onOpenChange={setCheckpointPopoverOpen}
            align="end"
            side="bottom"
            className="w-[min(20rem,calc(100vw-2rem))] p-0"
            usePortal={true}
            viewportPadding={16}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5"
                title="查看检查点历史"
              >
                <History className="h-4 w-4" />
                <span className="text-xs">历史</span>
              </Button>
            }
            content={
              <>
                <div className="p-3 border-b">
                  <h4 className="font-medium text-sm">检查点历史</h4>
                  <p className="text-xs text-muted-foreground">点击恢复可将文件回滚到指定状态</p>
                </div>
                <div className="p-2">
                  <CheckpointTimeline
                    sessionId={session.id}
                    projectPath={projectPath}
                    onRestore={handleCheckpointRestore}
                  />
                </div>
              </>
            }
          />
        </>
      )}

      {/* 导出菜单 */}
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isDisabled}
            className="h-8 px-2 gap-1.5"
          >
            {actionStatus === 'success' ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span className="text-xs">
              {actionStatus === 'success' ? statusMessage :
                actionStatus === 'error' ? statusMessage :
                  '导出'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* 复制到剪贴板 */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            复制到剪贴板
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleCopy('jsonl')}>
            <Copy className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="text-sm">复制为 JSONL</span>
              <span className="text-xs text-muted-foreground">原始消息数据</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopy('json')}>
            <Copy className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="text-sm">复制为 JSON</span>
              <span className="text-xs text-muted-foreground">结构化数据</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopy('markdown')}>
            <Copy className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="text-sm">复制为 Markdown</span>
              <span className="text-xs text-muted-foreground">可读格式</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* 保存到文件 */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            保存到文件
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleSave('json')}>
            <FileJson className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="text-sm">保存为 JSON</span>
              <span className="text-xs text-muted-foreground">完整会话数据</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSave('jsonl')}>
            <FileCode2 className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="text-sm">保存为 JSONL</span>
              <span className="text-xs text-muted-foreground">流式数据格式</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSave('markdown')}>
            <FileText className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="text-sm">保存为 Markdown</span>
              <span className="text-xs text-muted-foreground">人类可读文档</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/**
 * HookToggleManager - Hook 一键开关管理组件
 *
 * 功能:
 * - 列表展示所有 Hook 文件（~/.claude/hooks/）
 * - 一键启用/禁用 Hook（自动写入 settings.json）
 * - 选择 Hook 触发事件类型
 * - Hook 状态可视化
 *
 * 参考: SkillsManager.tsx 实现方式
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import Zap from 'lucide-react/dist/esm/icons/zap'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import Play from 'lucide-react/dist/esm/icons/play'
import Pause from 'lucide-react/dist/esm/icons/pause'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Info from 'lucide-react/dist/esm/icons/info'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import { open } from '@tauri-apps/plugin-shell';

// ============================================================
// 类型定义
// ============================================================

export interface HookFile {
  name: string;
  path: string;
  extension: string;
  description?: string;
  isEnabled: boolean;
  eventType?: string;
}

// Hook 事件类型
const HOOK_EVENT_TYPES = [
  { value: 'PreToolUse', label: '工具调用前', description: '在 Claude 调用工具之前触发' },
  { value: 'PostToolUse', label: '工具调用后', description: '在工具调用完成后触发' },
  { value: 'SessionStart', label: '会话开始', description: '每次会话启动时触发' },
  { value: 'Stop', label: '会话结束', description: '会话结束时触发' },
  { value: 'Notification', label: '通知', description: '接收通知时触发' },
];

interface HookToggleManagerProps {
  onBack?: () => void;
  className?: string;
}

// ============================================================
// 主组件
// ============================================================

export const HookToggleManager: React.FC<HookToggleManagerProps> = ({
  onBack,
  className,
}) => {
  const [hooks, setHooks] = useState<HookFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // 事件类型选择对话框
  const [eventDialog, setEventDialog] = useState<{
    open: boolean;
    hook: HookFile | null;
    selectedEvent: string;
  }>({
    open: false,
    hook: null,
    selectedEvent: 'PreToolUse',
  });

  // 加载 Hook 文件列表
  const loadHooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.listHookFiles();
      setHooks(result);
    } catch (err) {
      logger.error('HookToggleManager', '[HookToggleManager] Failed to load hooks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHooks();
  }, [loadHooks]);

  // 切换 Hook 状态
  const handleToggle = async (hook: HookFile, enabled: boolean) => {
    // Prompt Hook (.md files) 事件类型已在 frontmatter 中定义，无需选择
    const isPromptHook = hook.extension === 'md';

    if (enabled && !hook.eventType && !isPromptHook) {
      // 如果要启用 Command Hook 但没有设置事件类型，打开选择对话框
      setEventDialog({
        open: true,
        hook,
        selectedEvent: 'PreToolUse',
      });
      return;
    }

    try {
      setToggling(hook.path);
      await api.toggleHookFile(hook.path, enabled, hook.eventType || 'PreToolUse');
      await loadHooks(); // 重新加载列表
    } catch (err) {
      logger.error('HookToggleManager', '[HookToggleManager] Failed to toggle hook:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle hook');
    } finally {
      setToggling(null);
    }
  };

  // 确认启用 Hook（选择事件类型后）
  const handleConfirmEnable = async () => {
    const { hook, selectedEvent } = eventDialog;
    if (!hook) return;

    try {
      setToggling(hook.path);
      setEventDialog({ ...eventDialog, open: false });
      await api.toggleHookFile(hook.path, true, selectedEvent);
      await loadHooks();
    } catch (err) {
      logger.error('HookToggleManager', '[HookToggleManager] Failed to enable hook:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable hook');
    } finally {
      setToggling(null);
    }
  };

  // 打开 Hooks 目录
  const openHooksDirectory = async () => {
    try {
      const homeDir = 'C:\\Users\\666\\.claude';
      const hooksDir = `${homeDir}\\hooks`;
      await open(hooksDir);
    } catch (err) {
      logger.error('HookToggleManager', '[HookToggleManager] Failed to open hooks directory:', err);
    }
  };

  // 获取扩展名对应的图标颜色
  const getExtensionColor = (ext: string) => {
    switch (ext) {
      case 'ps1':
        return 'text-blue-500';
      case 'sh':
        return 'text-green-500';
      case 'py':
        return 'text-yellow-500';
      case 'bat':
      case 'cmd':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  // 渲染 Hook 卡片
  const renderHookCard = (hook: HookFile) => {
    const isToggling = toggling === hook.path;
    const isPromptHook = hook.extension === 'md';

    return (
      <Card
        key={hook.path}
        className={`p-4 transition-all ${hook.isEnabled
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-border hover:border-muted-foreground/30'
          }`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* 左侧：Hook 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Terminal className={`h-4 w-4 ${getExtensionColor(hook.extension)}`} />
              <span className="font-medium truncate">{hook.name}</span>
              <Badge variant="outline" className="text-xs">
                .{hook.extension}
              </Badge>
              {isPromptHook && (
                <Badge variant="default" className="text-xs bg-purple-500">
                  Prompt Hook
                </Badge>
              )}
              {hook.eventType && (
                <Badge variant="secondary" className="text-xs">
                  {HOOK_EVENT_TYPES.find(e => e.value === hook.eventType)?.label || hook.eventType}
                </Badge>
              )}
            </div>

            {hook.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {hook.description}
              </p>
            )}

            <p className="text-xs text-muted-foreground/60 mt-2 truncate" title={hook.path}>
              {hook.path}
            </p>
          </div>

          {/* 右侧：开关 */}
          <div className="flex items-center gap-2">
            {hook.isEnabled ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Pause className="h-4 w-4 text-muted-foreground" />
            )}
            <Switch
              checked={hook.isEnabled}
              onCheckedChange={(checked) => handleToggle(hook, checked)}
              disabled={isToggling}
            />
          </div>
        </div>
      </Card>
    );
  };

  // 统计信息
  const enabledCount = hooks.filter(h => h.isEnabled).length;
  const totalCount = hooks.length;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Hook 管理
            </h2>
            <p className="text-sm text-muted-foreground">
              一键启用/禁用 Hook 脚本 · 自动写入 settings.json
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 统计 */}
          <Badge variant={enabledCount > 0 ? 'default' : 'secondary'}>
            {enabledCount} / {totalCount} 已启用
          </Badge>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadHooks}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>

          {/* 打开目录按钮 */}
          <Button variant="outline" size="sm" onClick={openHooksDirectory}>
            <FolderOpen className="h-4 w-4 mr-2" />
            打开目录
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setError(null)}
          >
            关闭
          </Button>
        </div>
      )}

      {/* 提示信息 */}
      <div className="mx-4 mt-4 p-3 bg-muted/50 rounded-md flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          <p>Hook 文件位于 <code className="bg-muted px-1 rounded">~/.claude/hooks/</code> 目录</p>
          <p className="mt-1">启用 Hook 后会自动添加到 <code className="bg-muted px-1 rounded">settings.json</code> 的 hooks 配置中</p>
        </div>
      </div>

      {/* Hook 列表 */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Terminal className="h-8 w-8 mb-2" />
            <p>没有找到 Hook 文件</p>
            <p className="text-sm mt-1">在 ~/.claude/hooks/ 目录添加 .ps1、.sh 或 .py 文件</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hooks.map(renderHookCard)}
          </div>
        )}
      </ScrollArea>

      {/* 事件类型选择对话框 */}
      <Dialog
        open={eventDialog.open}
        onOpenChange={(open) => setEventDialog({ ...eventDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择触发事件</DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>为 Hook 选择触发时机</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              选择 Hook <span className="font-medium">{eventDialog.hook?.name}</span> 的触发时机
            </p>

            <Select
              value={eventDialog.selectedEvent}
              onValueChange={(value) =>
                setEventDialog({ ...eventDialog, selectedEvent: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择事件类型" />
              </SelectTrigger>
              <SelectContent>
                {HOOK_EVENT_TYPES.map((event) => (
                  <SelectItem key={event.value} value={event.value}>
                    <div className="flex flex-col">
                      <span>{event.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {event.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEventDialog({ ...eventDialog, open: false })}
            >
              取消
            </Button>
            <Button onClick={handleConfirmEnable}>
              <Play className="h-4 w-4 mr-2" />
              启用 Hook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HookToggleManager;

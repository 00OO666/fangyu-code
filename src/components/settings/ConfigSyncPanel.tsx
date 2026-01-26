/**
 * ConfigSyncPanel - 配置同步面板
 *
 * 功能：
 * 1. 显示 Fangyu Code 和 Claude Code CLI 的配置同步状态
 * 2. 提供一键全局同步按钮
 * 3. 检测并提示配置冲突
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left';
import FileJson from 'lucide-react/dist/esm/icons/file-json';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Info from 'lucide-react/dist/esm/icons/info';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { notify } from '@/components/notifications';
import { cn } from '@/lib/utils';

interface SyncStatus {
  settingsPath: string;
  claudeJsonPath: string;
  settingsMcpCount: number;
  claudeJsonMcpCount: number;
  isSynced: boolean;
  recommendation: string;
}

export const ConfigSyncPanel: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // 加载同步状态
  const loadSyncStatus = async () => {
    try {
      setLoading(true);
      const status = await api.getMcpSyncStatus();
      setSyncStatus(status as SyncStatus);
    } catch (error) {
      console.error('Failed to load sync status:', error);
      notify.error('加载同步状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载状态
  useEffect(() => {
    loadSyncStatus();
  }, []);

  // 一键全局同步
  const handleFullSync = async () => {
    try {
      setSyncing(true);
      const result = await api.fullSyncMcpConfigs();
      notify.success(result);
      setLastSyncTime(new Date());
      await loadSyncStatus();
    } catch (error) {
      console.error('Full sync failed:', error);
      notify.error('配置同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 从 Claude Code CLI 同步到 Fangyu Code
  const handleSyncFromCli = async () => {
    try {
      setSyncing(true);
      const result = await api.syncClaudeJsonToSettings();
      notify.success(result);
      setLastSyncTime(new Date());
      await loadSyncStatus();
    } catch (error) {
      console.error('Sync from CLI failed:', error);
      notify.error('从 Claude Code CLI 同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 从 Fangyu Code 同步到 Claude Code CLI
  const handleSyncToCli = async () => {
    try {
      setSyncing(true);
      const result = await api.syncSettingsToClaudeJson();
      notify.success(result);
      setLastSyncTime(new Date());
      await loadSyncStatus();
    } catch (error) {
      console.error('Sync to CLI failed:', error);
      notify.error('同步到 Claude Code CLI 失败');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和说明 */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">配置同步管理</h3>
        <p className="text-sm text-muted-foreground">
          管理 Fangyu Code 和 Claude Code CLI 之间的配置同步
        </p>
      </div>

      {/* 同步状态卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="light-glass rounded-lg p-6 space-y-4"
      >
        {/* 状态指示器 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {syncStatus?.isSynced ? (
              <>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">配置已同步</h4>
                  <p className="text-xs text-muted-foreground">
                    两个配置文件内容一致
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">配置不同步</h4>
                  <p className="text-xs text-muted-foreground">
                    {syncStatus?.recommendation}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* 刷新按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSyncStatus}
            disabled={loading || syncing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            刷新
          </Button>
        </div>

        {/* 配置文件信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
          {/* Fangyu Code 配置 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileJson className="h-4 w-4 text-blue-500" />
              Fangyu Code 配置
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center justify-between">
                <span>路径:</span>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                  {syncStatus?.settingsPath.split('/').pop()}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>MCP 服务器:</span>
                <span className="font-medium text-foreground">
                  {syncStatus?.settingsMcpCount} 个
                </span>
              </div>
            </div>
          </div>

          {/* Claude Code CLI 配置 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileJson className="h-4 w-4 text-orange-500" />
              Claude Code CLI 配置
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center justify-between">
                <span>路径:</span>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                  {syncStatus?.claudeJsonPath.split('/').pop()}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>MCP 服务器:</span>
                <span className="font-medium text-foreground">
                  {syncStatus?.claudeJsonMcpCount} 个
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 最后同步时间 */}
        {lastSyncTime && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <Info className="h-3.5 w-3.5" />
            最后同步: {lastSyncTime.toLocaleString('zh-CN')}
          </div>
        )}
      </motion.div>

      {/* 同步操作按钮 */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">同步操作</h4>

        {/* 一键全局同步 */}
        <Button
          onClick={handleFullSync}
          disabled={syncing}
          className="w-full gap-2 btn-glass-blue"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              同步中...
            </>
          ) : (
            <>
              <ArrowRightLeft className="h-4 w-4" />
              一键全局同步
            </>
          )}
        </Button>

        {/* 单向同步按钮 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleSyncFromCli}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            从 CLI 同步
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncToCli}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            同步到 CLI
          </Button>
        </div>
      </div>

      {/* 说明信息 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="light-glass rounded-lg p-4 space-y-2"
      >
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">配置同步说明:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>
                <strong>一键全局同步</strong>: 以 Claude Code CLI 的配置为准，同步到 Fangyu Code
              </li>
              <li>
                <strong>从 CLI 同步</strong>: 将 Claude Code CLI 的 MCP 配置同步到 Fangyu Code
              </li>
              <li>
                <strong>同步到 CLI</strong>: 将 Fangyu Code 的 MCP 配置同步到 Claude Code CLI
              </li>
              <li>
                <strong>配置隔离</strong>: Fangyu Code 运行时优先使用 settings.json，可与 Claude CLI 同时运行
              </li>
              <li>
                配置文件位置:
                <ul className="list-circle list-inside ml-4 mt-0.5">
                  <li>Fangyu Code: <code className="text-[10px] bg-muted px-1 rounded">~/.claude/settings.json</code></li>
                  <li>Claude Code CLI: <code className="text-[10px] bg-muted px-1 rounded">~/.claude.json</code></li>
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* 冲突提示 */}
      <AnimatePresence>
        {!syncStatus?.isSynced && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="light-glass rounded-lg p-4 border-l-4 border-yellow-500"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h5 className="text-sm font-medium text-foreground">检测到配置冲突</h5>
                <p className="text-xs text-muted-foreground">
                  Fangyu Code 和 Claude Code CLI 的 MCP 配置数量不一致。
                  建议运行"一键全局同步"以保持配置一致。
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">差异:</span>
                  <span className="text-xs font-medium text-foreground">
                    {Math.abs((syncStatus?.settingsMcpCount || 0) - (syncStatus?.claudeJsonMcpCount || 0))} 个服务器配置不同
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

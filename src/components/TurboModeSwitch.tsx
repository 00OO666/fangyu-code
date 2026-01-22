/**
 * TurboModeSwitch - Turbo 自主模式开关组件
 *
 * 功能:
 * - 快速切换 Turbo 模式级别
 * - 显示当前状态和剩余时间
 * - 配置白名单/黑名单
 * - 查看执行历史
 *
 * 来源: Claude Code Auto Accept UI + Cursor Agent Mode Indicator
 */

import { logger } from '@/lib/logger';
import { useState } from 'react';
import {
  useTurboMode,
  type TurboModeLevel,
  type CommandAnalysis,
} from '@/hooks/useTurboMode';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import Zap from 'lucide-react/dist/esm/icons/zap'
import ZapOff from 'lucide-react/dist/esm/icons/zap-off'
import Shield from 'lucide-react/dist/esm/icons/shield'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Clock from 'lucide-react/dist/esm/icons/clock'
import History from 'lucide-react/dist/esm/icons/history'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Check from 'lucide-react/dist/esm/icons/check'
import Info from 'lucide-react/dist/esm/icons/info';

// ============================================================
// 组件
// ============================================================

interface TurboModeSwitchProps {
  /** 执行命令的回调 */
  onExecute?: (command: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  /** 请求确认的回调 */
  onConfirmationNeeded?: (analysis: CommandAnalysis) => Promise<boolean>;
}

export function TurboModeSwitch({ onExecute, onConfirmationNeeded }: TurboModeSwitchProps) {
  const turboMode = useTurboMode({
    onExecute: onExecute
      ? async (command) => {
          const result = await onExecute(command);
          return { ...result, retryCount: 0 };
        }
      : undefined,
    onConfirmationNeeded,
    onModeChange: (level) => {
      logger.debug('TurboModeSwitch', 'Turbo 模式变更:', level);
    },
  });

  const {
    config,
    isActive,
    consecutiveAutoCount,
    executionHistory,
    setLevel,
    addToWhitelist,
    addToBlacklist,
    removeFromWhitelist,
    removeFromBlacklist,
    getModeDescription,
    getSessionRemainingTime,
  } = turboMode;

  // UI 状态
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [newWhitelistCommand, setNewWhitelistCommand] = useState('');
  const [newBlacklistCommand, setNewBlacklistCommand] = useState('');
  const [activeTab, setActiveTab] = useState<'whitelist' | 'blacklist'>('whitelist');

  // 获取剩余时间的可读格式
  const getFormattedRemainingTime = (): string | null => {
    const ms = getSessionRemainingTime();
    if (ms === null) return null;

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 模式级别选项
  const levelOptions: Array<{
    value: TurboModeLevel;
    label: string;
    icon: any;
    color: string;
  }> = [
    { value: 'off', label: '关闭', icon: ZapOff, color: 'text-gray-400' },
    { value: 'safe', label: '安全', icon: Shield, color: 'text-green-500' },
    { value: 'moderate', label: '中等', icon: AlertTriangle, color: 'text-yellow-500' },
    { value: 'full', label: '完全', icon: Zap, color: 'text-red-500' },
  ];

  const currentOption = levelOptions.find((opt) => opt.value === config.level);

  // 风险等级显示
  const getRiskColor = (risk: CommandAnalysis['risk']): string => {
    switch (risk) {
      case 'safe':
        return 'text-green-500 bg-green-500/10';
      case 'moderate':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'dangerous':
        return 'text-orange-500 bg-orange-500/10';
      case 'critical':
        return 'text-red-500 bg-red-500/10';
    }
  };

  const getRiskLabel = (risk: CommandAnalysis['risk']): string => {
    switch (risk) {
      case 'safe':
        return '安全';
      case 'moderate':
        return '中等';
      case 'dangerous':
        return '危险';
      case 'critical':
        return '严重';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* 主开关按钮 */}
      <div className="relative">
        <Button
          variant={isActive ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowLevelMenu(!showLevelMenu)}
          className={`flex items-center gap-2 ${isActive ? 'animate-pulse-slow' : ''}`}
        >
          {currentOption && <currentOption.icon className={`w-4 h-4 ${currentOption.color}`} />}
          <span className="text-sm font-medium">{currentOption?.label}</span>
          <ChevronDown className="w-3 h-3" />
        </Button>

        {/* 级别选择菜单 */}
        {showLevelMenu && (
          <div className="absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-50 min-w-[200px]">
            {levelOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setLevel(option.value);
                  setShowLevelMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <option.icon className={`w-4 h-4 ${option.color}`} />
                <div className="flex-1 text-left">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {getModeDescription(option.value)}
                  </div>
                </div>
                {config.level === option.value && <Check className="w-4 h-4 text-green-500" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 状态指示器 */}
      {isActive && (
        <>
          {/* 剩余时间 */}
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)]">
            <Clock className="w-3 h-3" />
            <span>{getFormattedRemainingTime()}</span>
          </div>

          {/* 连续自动执行计数 */}
          {consecutiveAutoCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/10 text-xs text-yellow-500">
              <Zap className="w-3 h-3" />
              <span>{consecutiveAutoCount}</span>
            </div>
          )}
        </>
      )}

      {/* 设置按钮 */}
      <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
        <Settings className="w-4 h-4" />
      </Button>

      {/* 历史记录按钮 */}
      <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
        <History className="w-4 h-4" />
      </Button>

      {/* 设置对话框 */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Turbo 模式设置
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 标签页 */}
            <div className="flex gap-2 border-b border-[var(--border-primary)]">
              <button
                onClick={() => setActiveTab('whitelist')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'whitelist'
                    ? 'border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  白名单 ({config.whitelist.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('blacklist')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'blacklist'
                    ? 'border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  黑名单 ({config.blacklist.length})
                </div>
              </button>
            </div>

            {/* 白名单内容 */}
            {activeTab === 'whitelist' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWhitelistCommand}
                    onChange={(e) => setNewWhitelistCommand(e.target.value)}
                    placeholder="添加命令到白名单..."
                    className="flex-1 px-3 py-2 text-sm rounded border border-[var(--border-primary)] bg-[var(--bg-primary)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newWhitelistCommand.trim()) {
                        addToWhitelist(newWhitelistCommand.trim());
                        setNewWhitelistCommand('');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newWhitelistCommand.trim()) {
                        addToWhitelist(newWhitelistCommand.trim());
                        setNewWhitelistCommand('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <ScrollArea className="h-64 border border-[var(--border-primary)] rounded">
                  <div className="p-2 space-y-1">
                    {config.whitelist.map((cmd, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-[var(--bg-hover)]"
                      >
                        <code className="text-xs text-[var(--text-secondary)]">{cmd}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromWhitelist(cmd)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex items-start gap-2 p-3 rounded bg-blue-500/10 text-sm text-blue-400">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>白名单中的命令将总是自动执行，无需确认</span>
                </div>
              </div>
            )}

            {/* 黑名单内容 */}
            {activeTab === 'blacklist' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlacklistCommand}
                    onChange={(e) => setNewBlacklistCommand(e.target.value)}
                    placeholder="添加命令到黑名单..."
                    className="flex-1 px-3 py-2 text-sm rounded border border-[var(--border-primary)] bg-[var(--bg-primary)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newBlacklistCommand.trim()) {
                        addToBlacklist(newBlacklistCommand.trim());
                        setNewBlacklistCommand('');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newBlacklistCommand.trim()) {
                        addToBlacklist(newBlacklistCommand.trim());
                        setNewBlacklistCommand('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <ScrollArea className="h-64 border border-[var(--border-primary)] rounded">
                  <div className="p-2 space-y-1">
                    {config.blacklist.map((cmd, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-[var(--bg-hover)]"
                      >
                        <code className="text-xs text-[var(--text-secondary)]">{cmd}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromBlacklist(cmd)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex items-start gap-2 p-3 rounded bg-red-500/10 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>黑名单中的命令总是需要手动确认，即使在完全模式下</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 历史记录对话框 */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              执行历史
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-96 py-4">
            <div className="space-y-2">
              {executionHistory.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-tertiary)]">
                  暂无执行历史
                </div>
              ) : (
                executionHistory.slice().reverse().map((analysis, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <code className="text-sm flex-1 break-all">{analysis.command}</code>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${getRiskColor(
                          analysis.risk
                        )}`}
                      >
                        {getRiskLabel(analysis.risk)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                      <span>分类: {analysis.category}</span>
                      <span>原因: {analysis.reason}</span>
                      {analysis.requiresConfirmation ? (
                        <span className="text-yellow-500">需要确认</span>
                      ) : (
                        <span className="text-green-500">自动执行</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setShowHistory(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TurboModeSwitch;

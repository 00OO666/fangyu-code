/**
 * ExecutionEngineSelector Component - v2.0 重构版
 *
 * @deprecated 此组件已废弃，请使用 UnifiedEngineSelector 替代
 * @see src/components/UnifiedEngineSelector.tsx
 * 
 * 支持 Claude Code、Codex、Gemini 三种执行引擎
 * 提供统一的配置入口和状态显示
 * 
 * 迁移指南：
 * - 使用 UnifiedEngineSelector 的 variant="popover" 获得相同功能
 * - 新组件支持更统一的配置管理和更好的类型安全
 * 
 * 此组件将在 v3.0 版本中移除
 */

import React, { useState } from 'react';
import Settings from 'lucide-react/dist/esm/icons/settings'
import Check from 'lucide-react/dist/esm/icons/check'
import Monitor from 'lucide-react/dist/esm/icons/monitor'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { relaunchApp } from '@/lib/updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { useEngineStatus } from '@/hooks/useEngineStatus';
import {
  ClaudeEngineIcon,
  CodexEngineIcon,
  GeminiEngineIcon,
} from '@/components/icons/EngineIcons';
import type { CodexExecutionMode } from '@/types/codex';

// ====================================================================
// Type Definitions
// ====================================================================

export type ExecutionEngine = 'claude' | 'codex' | 'gemini';
export type CodexRuntimeMode = 'auto' | 'native' | 'wsl';
export type ClaudeRuntimeMode = 'auto' | 'native' | 'wsl';
export type GeminiRuntimeMode = 'auto' | 'native' | 'wsl';

export interface ExecutionEngineConfig {
  engine: ExecutionEngine;
  codexMode?: CodexExecutionMode;
  codexModel?: string;
  codexApiKey?: string;
  codexReasoningLevel?: 'low' | 'medium' | 'high' | 'xhigh';
  geminiModel?: string;
  geminiApprovalMode?: 'auto_edit' | 'yolo' | 'default';
}

interface CodexModeConfig {
  mode: CodexRuntimeMode;
  wslDistro: string | null;
  actualMode: 'native' | 'wsl';
  nativeAvailable: boolean;
  wslAvailable: boolean;
  availableDistros: string[];
  isWindows: boolean;
}

interface GeminiWslModeConfig {
  mode: GeminiRuntimeMode;
  wslDistro: string | null;
  wslAvailable: boolean;
  availableDistros: string[];
  wslEnabled: boolean;
  wslGeminiPath: string | null;
  wslGeminiVersion: string | null;
  nativeAvailable: boolean;
  isWindows: boolean;
}

interface ClaudeWslModeConfig {
  mode: ClaudeRuntimeMode;
  wslDistro: string | null;
  wslAvailable: boolean;
  availableDistros: string[];
  wslEnabled: boolean;
  wslClaudePath: string | null;
  wslClaudeVersion: string | null;
  nativeAvailable: boolean;
  actualMode: 'native' | 'wsl';
  isWindows: boolean;
}

interface ExecutionEngineSelectorProps {
  value: ExecutionEngineConfig;
  onChange: (config: ExecutionEngineConfig) => void;
  className?: string;
}

// ====================================================================
// 引擎配置
// ====================================================================

const ENGINE_CONFIG = {
  claude: {
    id: 'claude' as const,
    name: 'Claude Code',
    Icon: ClaudeEngineIcon,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  codex: {
    id: 'codex' as const,
    name: 'OpenAI',
    Icon: CodexEngineIcon,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  gemini: {
    id: 'gemini' as const,
    name: 'Gemini',
    Icon: GeminiEngineIcon,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
};

// ====================================================================
// Component
// ====================================================================

export const ExecutionEngineSelector: React.FC<ExecutionEngineSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // 使用全局缓存的引擎状态
  const {
    codexAvailable,
    codexVersion,
    geminiInstalled: geminiAvailable,
    geminiVersion,
    claudeInstalled,
    claudeVersion,
    codexModeConfig: cachedCodexModeConfig,
    geminiWslModeConfig: cachedGeminiWslModeConfig,
    claudeWslModeConfig: cachedClaudeWslModeConfig,
  } = useEngineStatus();

  // 本地状态
  const [localCodexModeConfig, setLocalCodexModeConfig] = useState<CodexModeConfig | null>(null);
  const [localGeminiWslModeConfig, setLocalGeminiWslModeConfig] = useState<GeminiWslModeConfig | null>(null);
  const [localClaudeWslModeConfig, setLocalClaudeWslModeConfig] = useState<ClaudeWslModeConfig | null>(null);

  const codexModeConfig = localCodexModeConfig || cachedCodexModeConfig || null;
  const geminiWslModeConfig = localGeminiWslModeConfig || cachedGeminiWslModeConfig || null;
  const claudeWslModeConfig = localClaudeWslModeConfig || cachedClaudeWslModeConfig || null;

  // ====================================================================
  // Handlers
  // ====================================================================

  const handleEngineChange = (engine: ExecutionEngine) => {
    if (engine === 'codex' && !codexAvailable) {
      alert('Codex CLI 未安装。请先安装 Codex CLI。');
      return;
    }
    if (engine === 'gemini' && !geminiAvailable) {
      alert('Gemini CLI 未安装。请运行 npm install -g @google/gemini-cli 安装。');
      return;
    }
    onChange({ ...value, engine });
  };

  const handleCodexModeChange = (mode: CodexExecutionMode) => {
    onChange({ ...value, codexMode: mode });
  };

  const handleGeminiApprovalModeChange = (mode: 'auto_edit' | 'yolo' | 'default') => {
    onChange({ ...value, geminiApprovalMode: mode });
  };

  const handleRuntimeModeChange = async <T extends string>(
    _engine: 'claude' | 'codex' | 'gemini',
    mode: T,
    currentConfig: any,
    setLocalConfig: (config: any) => void,
    apiCall: (mode: T, distro: string | null, customPath?: string | null) => Promise<string | void>
  ) => {
    if (!currentConfig) return;
    setSavingConfig(true);
    try {
      await apiCall(mode, currentConfig.wslDistro, currentConfig.customCodexPath);
      setLocalConfig({ ...currentConfig, mode });
      const shouldRestart = await ask('配置已保存。是否立即重启应用以使更改生效？', {
        title: '重启应用',
        kind: 'info',
        okLabel: '立即重启',
        cancelLabel: '稍后重启',
      });
      if (shouldRestart) {
        try {
          await relaunchApp();
        } catch (e) {
          await message('配置已保存，但自动重启失败。请手动重启应用。', { title: '提示', kind: 'warning' });
        }
      }
    } catch (error) {
      await message('保存配置失败: ' + (error instanceof Error ? error.message : String(error)), { title: '错误', kind: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleClaudeRuntimeModeChange = (mode: ClaudeRuntimeMode) => {
    handleRuntimeModeChange('claude', mode, claudeWslModeConfig, setLocalClaudeWslModeConfig, api.setClaudeWslModeConfig);
  };

  const handleCodexRuntimeModeChange = (mode: CodexRuntimeMode) => {
    handleRuntimeModeChange('codex', mode, codexModeConfig, setLocalCodexModeConfig, api.setCodexModeConfig);
  };

  const handleGeminiRuntimeModeChange = (mode: GeminiRuntimeMode) => {
    handleRuntimeModeChange('gemini', mode, geminiWslModeConfig, setLocalGeminiWslModeConfig, api.setGeminiWslModeConfig);
  };

  // ====================================================================
  // Render Helpers
  // ====================================================================

  const getEngineDisplayName = () => {
    return ENGINE_CONFIG[value.engine]?.name || 'Claude Code';
  };

  const getCurrentEngineConfig = () => ENGINE_CONFIG[value.engine];

  const renderEngineStatus = (
    engine: ExecutionEngine,
    installed: boolean,
    version?: string
  ) => {
    const statusOk = installed;
    const statusText = installed ? '已安装' : '未安装';

    return (
      <div className="flex items-center gap-2 text-xs">
        <div className={`h-2 w-2 rounded-full ${statusOk ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={statusOk ? 'text-foreground' : 'text-muted-foreground'}>{statusText}</span>
        {version && <span className="text-muted-foreground">• {version}</span>}
      </div>
    );
  };

  const renderRuntimeSelector = (
    config: ClaudeWslModeConfig | CodexModeConfig | GeminiWslModeConfig | null,
    onChangeHandler: (mode: any) => void,
    label: string
  ) => {
    if (!config || (!config.nativeAvailable && !config.wslAvailable)) return null;

    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center gap-2">
          <Terminal className="h-3 w-3" />
          {label}
        </Label>
        <Select
          value={config.isWindows ? config.mode : 'native'}
          onValueChange={onChangeHandler}
          disabled={savingConfig}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {config.isWindows && (
              <SelectItem value="auto">
                <span className="text-xs">自动检测</span>
              </SelectItem>
            )}
            <SelectItem value="native" disabled={!config.nativeAvailable}>
              <div className="flex items-center gap-2">
                <Monitor className="h-3 w-3" />
                <span className="text-xs">{config.isWindows ? 'Windows 原生' : 'Linux 原生'}</span>
              </div>
            </SelectItem>
            {config.isWindows && (
              <SelectItem value="wsl" disabled={!config.wslAvailable}>
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3" />
                  <span className="text-xs">WSL</span>
                </div>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    );
  };

  // ====================================================================
  // Render
  // ====================================================================

  const currentEngine = getCurrentEngineConfig();
  const EngineIcon = currentEngine.Icon;

  return (
    <>
      <Popover
        open={showSettings}
        onOpenChange={setShowSettings}
        trigger={
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={showSettings}
            className={`h-8 justify-between light-glass hover:medium-glass ${className}`}
          >
            <div className="flex items-center gap-2">
              <EngineIcon className={`h-4 w-4 ${currentEngine.color}`} />
              <span>{getEngineDisplayName()}</span>
            </div>
            <Settings className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
        content={
          <div className="w-80 space-y-4 p-4">
            {/* 引擎选择 - 2x2 网格 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">执行引擎</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(ENGINE_CONFIG).map((engine) => {
                  const Icon = engine.Icon;
                  const isSelected = value.engine === engine.id;
                  const isDisabled =
                    (engine.id === 'codex' && !codexAvailable) ||
                    (engine.id === 'gemini' && !geminiAvailable);

                  return (
                    <Button
                      key={engine.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={`h-auto py-2 px-3 justify-start ${isSelected ? '' : 'hover:bg-accent/50'}`}
                      onClick={() => handleEngineChange(engine.id)}
                      disabled={isDisabled}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className={`h-4 w-4 ${isSelected ? '' : engine.color}`} />
                        <span className="text-xs font-medium">{engine.name}</span>
                        {isSelected && <Check className="h-3 w-3 ml-auto" />}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* 当前引擎配置区域 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <currentEngine.Icon className={`h-4 w-4 ${currentEngine.color}`} />
                  {currentEngine.name} 配置
                </Label>
              </div>

              {/* Claude 配置 */}
              {value.engine === 'claude' && (
                <div className="space-y-3">
                  <div className={`rounded-md border p-2 ${currentEngine.bgColor} ${currentEngine.borderColor}`}>
                    {renderEngineStatus('claude', claudeInstalled, claudeVersion)}
                  </div>
                  {renderRuntimeSelector(claudeWslModeConfig, handleClaudeRuntimeModeChange, '运行环境')}
                  <p className="text-xs text-muted-foreground">
                    更多配置请前往设置页面
                  </p>
                </div>
              )}

              {/* Codex 配置 */}
              {value.engine === 'codex' && (
                <div className="space-y-3">
                  <div className={`rounded-md border p-2 ${currentEngine.bgColor} ${currentEngine.borderColor}`}>
                    {renderEngineStatus('codex', codexAvailable, codexVersion)}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">执行模式</Label>
                    <Select value={value.codexMode || 'read-only'} onValueChange={handleCodexModeChange}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read-only">
                          <span className="text-xs">只读模式</span>
                        </SelectItem>
                        <SelectItem value="full-auto">
                          <span className="text-xs">自动编辑</span>
                        </SelectItem>
                        <SelectItem value="full-access">
                          <span className="text-xs text-destructive">完全访问</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {renderRuntimeSelector(codexModeConfig, handleCodexRuntimeModeChange, '运行环境')}
                </div>
              )}

              {/* Gemini 配置 */}
              {value.engine === 'gemini' && (
                <div className="space-y-3">
                  <div className={`rounded-md border p-2 ${currentEngine.bgColor} ${currentEngine.borderColor}`}>
                    {renderEngineStatus('gemini', geminiAvailable, geminiVersion)}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">审批模式</Label>
                    <Select value={value.geminiApprovalMode || 'auto_edit'} onValueChange={handleGeminiApprovalModeChange}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">
                          <span className="text-xs">默认（每次确认）</span>
                        </SelectItem>
                        <SelectItem value="auto_edit">
                          <span className="text-xs">自动编辑</span>
                        </SelectItem>
                        <SelectItem value="yolo">
                          <span className="text-xs text-destructive">YOLO 模式</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {renderRuntimeSelector(geminiWslModeConfig, handleGeminiRuntimeModeChange, '运行环境')}
                </div>
              )}

            </div>
          </div>
        }
        className="w-80"
        align="start"
        side="top"
      />
    </>
  );
};

export default ExecutionEngineSelector;

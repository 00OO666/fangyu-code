/**
 * EnhancedEngineSelector Component - v3.0
 *
 * @deprecated 此组件已废弃，请使用 UnifiedEngineSelector 替代
 * @see src/components/UnifiedEngineSelector.tsx
 * 
 * 重构版引擎选择器，使用官方品牌图标
 * 支持 Claude Code、Codex、Gemini 三种执行引擎
 * 提供更美观的 UI 和更好的交互体验
 * 
 * 迁移指南：
 * - 使用 UnifiedEngineSelector 的 variant="inline" 获得相同功能
 * - 新组件支持更统一的配置管理和更好的类型安全
 * 
 * 此组件将在 v3.0 版本中移除
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import React, { useState, useCallback } from 'react';
import { Check, Monitor, Terminal, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
export type RuntimeMode = 'auto' | 'native' | 'wsl';

export interface ExecutionEngineConfig {
    engine: ExecutionEngine;
    codexMode?: CodexExecutionMode;
    codexModel?: string;
    codexApiKey?: string;
    codexReasoningLevel?: 'low' | 'medium' | 'high' | 'xhigh';
    geminiModel?: string;
    geminiApprovalMode?: 'auto_edit' | 'yolo' | 'default';
}

interface EnhancedEngineSelectorProps {
    value: ExecutionEngineConfig;
    onChange: (config: ExecutionEngineConfig) => void;
    /** 模式：主聊天 or 摘要生成 */
    mode?: 'chat' | 'summary';
    /** 紧凑模式 */
    compact?: boolean;
    className?: string;
}

// ====================================================================
// 引擎配置
// ====================================================================

const ENGINE_CONFIG = {
    claude: {
        id: 'claude' as const,
        name: 'Claude',
        fullName: 'Claude Code',
        Icon: ClaudeEngineIcon,
        color: '#FF6B35',
        bgClass: 'bg-orange-500/10 hover:bg-orange-500/20',
        borderClass: 'border-orange-500/30',
        textClass: 'text-orange-500',
        description: 'Anthropic Claude - 强大的代码理解和生成能力',
    },
    codex: {
        id: 'codex' as const,
        name: 'OpenAI',
        fullName: 'OpenAI Codex',
        Icon: CodexEngineIcon,
        color: '#10A37F',
        bgClass: 'bg-green-500/10 hover:bg-green-500/20',
        borderClass: 'border-green-500/30',
        textClass: 'text-green-500',
        description: 'OpenAI GPT-4 - 业界领先的大语言模型',
    },
    gemini: {
        id: 'gemini' as const,
        name: 'Gemini',
        fullName: 'Google Gemini',
        Icon: GeminiEngineIcon,
        color: '#4285F4',
        bgClass: 'bg-blue-500/10 hover:bg-blue-500/20',
        borderClass: 'border-blue-500/30',
        textClass: 'text-blue-500',
        description: 'Google Gemini - 多模态 AI 模型',
    },
};

// ====================================================================
// Component
// ====================================================================

export const EnhancedEngineSelector: React.FC<EnhancedEngineSelectorProps> = ({
    value,
    onChange,
    mode = 'chat',
    compact = false,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [switchingEngine, setSwitchingEngine] = useState<ExecutionEngine | null>(null);

    // 使用全局缓存的引擎状态
    const {
        codexAvailable,
        codexVersion,
        geminiInstalled: geminiAvailable,
        geminiVersion,
        claudeInstalled,
        claudeVersion,
        codexModeConfig,
        geminiWslModeConfig,
        claudeWslModeConfig,
    } = useEngineStatus();

    // ====================================================================
    // Handlers
    // ====================================================================

    const getEngineAvailability = useCallback((engine: ExecutionEngine): { available: boolean; reason?: string } => {
        switch (engine) {
            case 'claude':
                return { available: claudeInstalled, reason: claudeInstalled ? undefined : 'Claude Code CLI 未安装' };
            case 'codex':
                return { available: codexAvailable, reason: codexAvailable ? undefined : 'Codex CLI 未安装' };
            case 'gemini':
                return { available: geminiAvailable, reason: geminiAvailable ? undefined : 'Gemini CLI 未安装' };
            default:
                return { available: false, reason: '未知引擎' };
        }
    }, [claudeInstalled, codexAvailable, geminiAvailable]);

    const handleEngineChange = useCallback(async (engine: ExecutionEngine) => {
        const { available, reason } = getEngineAvailability(engine);

        if (!available) {
            await message(reason || '引擎不可用', { title: '提示', kind: 'warning' });
            return;
        }

        // 添加切换动画
        setSwitchingEngine(engine);

        // 短暂延迟以显示动画
        await new Promise(resolve => setTimeout(resolve, 150));

        onChange({ ...value, engine });
        setSwitchingEngine(null);
    }, [value, onChange, getEngineAvailability]);

    const handleCodexModeChange = useCallback((mode: CodexExecutionMode) => {
        onChange({ ...value, codexMode: mode });
    }, [value, onChange]);

    const handleGeminiApprovalModeChange = useCallback((mode: 'auto_edit' | 'yolo' | 'default') => {
        onChange({ ...value, geminiApprovalMode: mode });
    }, [value, onChange]);

    const handleRuntimeModeChange = useCallback(async (
        engine: 'claude' | 'codex' | 'gemini',
        mode: RuntimeMode
    ) => {
        const configMap = {
            claude: { config: claudeWslModeConfig, api: api.setClaudeWslModeConfig },
            codex: { config: codexModeConfig, api: api.setCodexModeConfig },
            gemini: { config: geminiWslModeConfig, api: api.setGeminiWslModeConfig },
        };

        const { config, api: apiCall } = configMap[engine];
        if (!config) return;

        setSavingConfig(true);
        try {
            await apiCall(mode, config.wslDistro, null);
            const shouldRestart = await ask('配置已保存。是否立即重启应用以使更改生效？', {
                title: '重启应用',
                kind: 'info',
                okLabel: '立即重启',
                cancelLabel: '稍后重启',
            });
            if (shouldRestart) {
                await relaunchApp().catch(() => {
                    message('配置已保存，但自动重启失败。请手动重启应用。', { title: '提示', kind: 'warning' });
                });
            }
        } catch (error) {
            await message('保存配置失败: ' + (error instanceof Error ? error.message : String(error)), { title: '错误', kind: 'error' });
        } finally {
            setSavingConfig(false);
        }
    }, [claudeWslModeConfig, codexModeConfig, geminiWslModeConfig]);

    // ====================================================================
    // Render Helpers
    // ====================================================================

    const currentEngine = ENGINE_CONFIG[value.engine];
    const CurrentIcon = currentEngine.Icon;

    const renderEngineCard = (engineId: ExecutionEngine) => {
        const engine = ENGINE_CONFIG[engineId];
        const Icon = engine.Icon;
        const isSelected = value.engine === engineId;
        const isSwitching = switchingEngine === engineId;
        const { available, reason } = getEngineAvailability(engineId);

        // 获取版本信息
        const getVersion = () => {
            switch (engineId) {
                case 'claude': return claudeVersion;
                case 'codex': return codexVersion;
                case 'gemini': return geminiVersion;
                default: return undefined;
            }
        };

        const version = getVersion();

        return (
            <TooltipProvider key={engineId}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => handleEngineChange(engineId)}
                            disabled={!available || savingConfig}
                            className={cn(
                                'relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200',
                                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                                isSelected ? [
                                    engine.bgClass,
                                    engine.borderClass,
                                    'ring-2 ring-offset-1',
                                ] : [
                                    'bg-background/50 border-border/50',
                                    'hover:border-border hover:bg-accent/30',
                                ],
                                !available && 'opacity-50 cursor-not-allowed',
                                isSwitching && 'scale-95',
                            )}
                            style={{
                                '--tw-ring-color': isSelected ? engine.color : undefined,
                            } as React.CSSProperties}
                        >
                            {/* 选中指示器 */}
                            {isSelected && (
                                <div className="absolute top-1 right-1">
                                    <Check className="h-3 w-3" style={{ color: engine.color }} />
                                </div>
                            )}

                            {/* 加载指示器 */}
                            {isSwitching && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: engine.color }} />
                                </div>
                            )}

                            {/* 图标 */}
                            <Icon size={28} className="mb-1" />

                            {/* 名称 */}
                            <span className={cn(
                                'text-xs font-medium',
                                isSelected ? engine.textClass : 'text-foreground'
                            )}>
                                {engine.name}
                            </span>

                            {/* 状态指示 */}
                            <div className="flex items-center gap-1 mt-1">
                                <div className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    available ? 'bg-green-500' : 'bg-red-500'
                                )} />
                                {version && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                                        {version}
                                    </span>
                                )}
                            </div>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                        <div className="space-y-1">
                            <p className="font-medium">{engine.fullName}</p>
                            <p className="text-xs text-muted-foreground">{engine.description}</p>
                            {!available && reason && (
                                <p className="text-xs text-destructive">{reason}</p>
                            )}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderRuntimeSelector = (
        engine: 'claude' | 'codex' | 'gemini',
        config: any
    ) => {
        if (!config || (!config.nativeAvailable && !config.wslAvailable)) return null;

        return (
            <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-2">
                    <Terminal className="h-3 w-3" />
                    运行环境
                </Label>
                <Select
                    value={config.isWindows ? config.mode : 'native'}
                    onValueChange={(mode) => handleRuntimeModeChange(engine, mode as RuntimeMode)}
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

    if (compact) {
        // 紧凑模式：只显示当前引擎图标和下拉
        return (
            <div className={cn('relative', className)}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(!isOpen)}
                    className="h-8 gap-2"
                >
                    <CurrentIcon size={16} />
                    <span className="text-xs">{currentEngine.name}</span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
                </Button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 min-w-[200px]">
                        <div className="grid grid-cols-2 gap-2">
                            {Object.keys(ENGINE_CONFIG).map((id) => renderEngineCard(id as ExecutionEngine))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <div className={cn('space-y-4', className)}>
                {/* 引擎选择网格 */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        {mode === 'summary' ? '摘要生成引擎' : '执行引擎'}
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.keys(ENGINE_CONFIG).map((id) => renderEngineCard(id as ExecutionEngine))}
                    </div>
                </div>

                <Separator />

                {/* 当前引擎配置 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            <CurrentIcon size={16} />
                            {currentEngine.fullName} 配置
                        </Label>
                    </div>

                    {/* Claude 配置 */}
                    {value.engine === 'claude' && (
                        <div className="space-y-3">
                            {renderRuntimeSelector('claude', claudeWslModeConfig)}
                            <p className="text-xs text-muted-foreground">
                                更多配置请前往设置页面
                            </p>
                        </div>
                    )}

                    {/* Codex 配置 */}
                    {value.engine === 'codex' && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium">执行模式</Label>
                                <Select value={value.codexMode || 'read-only'} onValueChange={handleCodexModeChange}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="read-only">只读模式</SelectItem>
                                        <SelectItem value="full-auto">自动编辑</SelectItem>
                                        <SelectItem value="full-access">
                                            <span className="text-destructive">完全访问</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {renderRuntimeSelector('codex', codexModeConfig)}
                        </div>
                    )}

                    {/* Gemini 配置 */}
                    {value.engine === 'gemini' && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium">审批模式</Label>
                                <Select value={value.geminiApprovalMode || 'auto_edit'} onValueChange={handleGeminiApprovalModeChange}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">默认（每次确认）</SelectItem>
                                        <SelectItem value="auto_edit">自动编辑</SelectItem>
                                        <SelectItem value="yolo">
                                            <span className="text-destructive">YOLO 模式</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {renderRuntimeSelector('gemini', geminiWslModeConfig)}
                        </div>
                    )}

                </div>
            </div>
        </>
    );
};

export default EnhancedEngineSelector;

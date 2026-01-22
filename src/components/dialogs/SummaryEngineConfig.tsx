/**
 * SummaryEngineConfig Component
 *
 * 摘要引擎配置组件
 * 支持独立配置 API Key、Endpoint 和模型
 * 🆕 支持 API 测试，只显示可用模型
 *
 * Requirements: 5.7, 5.8
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Settings from 'lucide-react/dist/esm/icons/settings'
import Check from 'lucide-react/dist/esm/icons/check'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import TestTube from 'lucide-react/dist/esm/icons/test-tube'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Zap from 'lucide-react/dist/esm/icons/zap';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    ClaudeEngineIcon,
    CodexEngineIcon,
    GeminiEngineIcon,
    SiliconFlowEngineIcon,
} from '@/components/icons/EngineIcons';
import { getSummaryConfigStore } from '@/services/summaryConfigStore';
import type { SummaryEngine, SummaryAPIConfig, TestedModelInfo, ModelTestStatus } from '@/types/summary';
import { ENGINE_MODELS } from '@/types/summary';

import {
    testEngineModels,
    getCachedTestResults,
    cacheTestResult,
    type ModelTestResult,
    type TestProgress,
} from '@/services/summaryModelTester';

// =============================================================================
// Props & Types
// =============================================================================

interface SummaryEngineConfigProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfigSaved?: (config: SummaryAPIConfig) => void;
}

// =============================================================================
// 引擎配置
// =============================================================================

const ENGINE_CONFIG = {
    claude: {
        id: 'claude' as const,
        name: 'Claude',
        Icon: ClaudeEngineIcon,
        color: '#FF6B35',
        bgClass: 'bg-orange-500/10 hover:bg-orange-500/20',
        borderClass: 'border-orange-500/30',
        textClass: 'text-orange-500',
        description: '使用当前 Claude Code 配置',
        needsApiKey: false,
        configUrl: '',
    },
    codex: {
        id: 'codex' as const,
        name: 'OpenAI',
        Icon: CodexEngineIcon,
        color: '#10A37F',
        bgClass: 'bg-green-500/10 hover:bg-green-500/20',
        borderClass: 'border-green-500/30',
        textClass: 'text-green-500',
        description: 'OpenAI GPT 系列模型',
        needsApiKey: true,
        configUrl: 'https://platform.openai.com/api-keys',
        defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    },
    gemini: {
        id: 'gemini' as const,
        name: 'Gemini',
        Icon: GeminiEngineIcon,
        color: '#4285F4',
        bgClass: 'bg-blue-500/10 hover:bg-blue-500/20',
        borderClass: 'border-blue-500/30',
        textClass: 'text-blue-500',
        description: 'Google Gemini 系列模型',
        needsApiKey: true,
        configUrl: 'https://aistudio.google.com/app/apikey',
        defaultEndpoint: '',
    },
    siliconflow: {
        id: 'siliconflow' as const,
        name: 'SiliconFlow',
        Icon: SiliconFlowEngineIcon,
        color: '#7C3AED',
        bgClass: 'bg-purple-500/10 hover:bg-purple-500/20',
        borderClass: 'border-purple-500/30',
        textClass: 'text-purple-500',
        description: '国产高性价比 AI 平台',
        needsApiKey: true,
        configUrl: 'https://siliconflow.cn/account/ak',
        defaultEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    },
};

// =============================================================================
// 组件
// =============================================================================

export const SummaryEngineConfig: React.FC<SummaryEngineConfigProps> = ({
    open,
    onOpenChange,
    onConfigSaved,
}) => {
    // 基础状态
    const [selectedEngine, setSelectedEngine] = useState<SummaryEngine>('claude');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [apiKey, setApiKey] = useState<string>('');
    const [apiEndpoint, setApiEndpoint] = useState<string>('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 模型测试状态
    const [isTesting, setIsTesting] = useState(false);
    const [testProgress, setTestProgress] = useState<TestProgress | null>(null);
    const [modelTestResults, setModelTestResults] = useState<Record<string, ModelTestResult>>({});
    const [showAllModels, setShowAllModels] = useState(false);
    const [hasTestedCurrentEngine, setHasTestedCurrentEngine] = useState(false);

    // 加载已保存的配置
    useEffect(() => {
        if (open) {
            const store = getSummaryConfigStore();
            store.loadConfig().then(config => {
                setSelectedEngine(config.engine);
                setSelectedModel(config.model);
                setApiKey(config.apiKey || '');
                setApiEndpoint(config.apiEndpoint || '');
            });

            // 加载缓存的测试结果
            const cached = getCachedTestResults();
            const engineCache = cached[selectedEngine];
            if (engineCache) {
                const resultsMap: Record<string, ModelTestResult> = {};
                engineCache.results.forEach(r => {
                    resultsMap[r.modelId] = r;
                });
                setModelTestResults(resultsMap);
                setHasTestedCurrentEngine(true);
            }
        }
    }, [open]);

    // 当引擎改变时，更新默认模型和端点
    useEffect(() => {
        const models = ENGINE_MODELS[selectedEngine];
        const recommended = models.find(m => m.recommended) || models[0];
        if (recommended) {
            setSelectedModel(recommended.id);
        }

        // 设置默认端点
        const engineConfig = ENGINE_CONFIG[selectedEngine];
        if ('defaultEndpoint' in engineConfig && engineConfig.defaultEndpoint) {
            setApiEndpoint(engineConfig.defaultEndpoint);
        } else {
            setApiEndpoint('');
        }

        // 加载该引擎的缓存测试结果
        const cached = getCachedTestResults();
        const engineCache = cached[selectedEngine];
        if (engineCache) {
            const resultsMap: Record<string, ModelTestResult> = {};
            engineCache.results.forEach(r => {
                resultsMap[r.modelId] = r;
            });
            setModelTestResults(resultsMap);
            setHasTestedCurrentEngine(true);
        } else {
            setModelTestResults({});
            setHasTestedCurrentEngine(false);
        }
    }, [selectedEngine]);

    // 计算带测试状态的模型列表
    const testedModels = useMemo((): TestedModelInfo[] => {
        const models = ENGINE_MODELS[selectedEngine];
        return models.map(model => {
            const result = modelTestResults[model.id];
            let testStatus: ModelTestStatus = 'untested';
            if (result) {
                testStatus = result.status;
            }
            return {
                ...model,
                testStatus,
                latency: result?.latency,
                errorMessage: result?.error,
            };
        });
    }, [selectedEngine, modelTestResults]);

    // 过滤显示的模型
    const displayModels = useMemo(() => {
        if (showAllModels || !hasTestedCurrentEngine) {
            return testedModels;
        }
        return testedModels.filter(m =>
            m.testStatus === 'success' || m.testStatus === 'replaced' || m.testStatus === 'untested'
        );
    }, [testedModels, showAllModels, hasTestedCurrentEngine]);

    // 统计信息
    const testStats = useMemo(() => {
        const total = testedModels.length;
        const tested = testedModels.filter(m => m.testStatus !== 'untested').length;
        const available = testedModels.filter(m =>
            m.testStatus === 'success' || m.testStatus === 'replaced'
        ).length;
        const failed = testedModels.filter(m => m.testStatus === 'error').length;
        return { total, tested, available, failed };
    }, [testedModels]);

    // 测试所有模型
    const handleTestAllModels = useCallback(async () => {
        const engineConfig = ENGINE_CONFIG[selectedEngine];

        if (engineConfig.needsApiKey && !apiKey) {
            toast.error('请先输入 API Key');
            return;
        }

        setIsTesting(true);
        setTestProgress({ current: 0, total: ENGINE_MODELS[selectedEngine].length, currentModel: '' });

        try {
            const result = await testEngineModels(
                selectedEngine,
                apiKey,
                apiEndpoint,
                (progress) => setTestProgress(progress)
            );

            // 更新测试结果
            const resultsMap: Record<string, ModelTestResult> = {};
            result.results.forEach(r => {
                resultsMap[r.modelId] = r;
            });
            setModelTestResults(resultsMap);
            setHasTestedCurrentEngine(true);

            // 缓存结果
            cacheTestResult(result);

            // 显示结果
            const available = result.availableModels.length;
            const total = result.results.length;
            if (available === total) {
                toast.success(`全部 ${total} 个模型可用`);
            } else if (available > 0) {
                toast.success(`${available}/${total} 个模型可用`);
            } else {
                toast.error('没有可用的模型，请检查 API Key');
            }

            // 自动选择推荐的可用模型
            if (result.availableModels.length > 0) {
                const recommended = result.availableModels.find(m => m.recommended);
                if (recommended) {
                    setSelectedModel(recommended.id);
                } else {
                    setSelectedModel(result.availableModels[0].id);
                }
            }
        } catch (error) {
            toast.error(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsTesting(false);
            setTestProgress(null);
        }
    }, [selectedEngine, apiKey, apiEndpoint]);

    // 保存配置
    const handleSave = useCallback(async () => {
        const engineConfig = ENGINE_CONFIG[selectedEngine];

        if (engineConfig.needsApiKey && !apiKey) {
            toast.error('请输入 API Key');
            return;
        }

        if (!selectedModel) {
            toast.error('请选择模型');
            return;
        }

        setIsSaving(true);
        try {
            const store = getSummaryConfigStore();
            const config: SummaryAPIConfig = {
                engine: selectedEngine,
                model: selectedModel,
                apiKey: apiKey || undefined,
                apiEndpoint: apiEndpoint || undefined,
                updatedAt: Date.now(),
            };

            await store.saveConfig(config);
            toast.success('摘要引擎配置已保存');
            onConfigSaved?.(config);
            onOpenChange(false);
        } catch (error) {
            toast.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsSaving(false);
        }
    }, [selectedEngine, selectedModel, apiKey, apiEndpoint, onConfigSaved, onOpenChange]);

    // 渲染引擎选择卡片
    const renderEngineCard = (engineId: SummaryEngine) => {
        const engine = ENGINE_CONFIG[engineId];
        const Icon = engine.Icon;
        const isSelected = selectedEngine === engineId;

        return (
            <button
                key={engineId}
                onClick={() => setSelectedEngine(engineId)}
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
                )}
                style={{
                    '--tw-ring-color': isSelected ? engine.color : undefined,
                } as React.CSSProperties}
            >
                {isSelected && (
                    <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3" style={{ color: engine.color }} />
                    </div>
                )}
                <Icon size={24} className="mb-1" />
                <span className={cn(
                    'text-xs font-medium',
                    isSelected ? engine.textClass : 'text-foreground'
                )}>
                    {engine.name}
                </span>
            </button>
        );
    };

    // 渲染模型测试状态图标
    const renderModelStatusIcon = (model: TestedModelInfo) => {
        switch (model.testStatus) {
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'replaced':
                return <CheckCircle2 className="h-4 w-4 text-yellow-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'pending':
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const currentEngine = ENGINE_CONFIG[selectedEngine];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        摘要引擎配置
                    </DialogTitle>
                    <DialogDescription>
                        配置用于生成会话摘要的 AI 引擎，独立于主聊天引擎
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* 引擎选择 */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">选择引擎</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(ENGINE_CONFIG) as SummaryEngine[]).map(renderEngineCard)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {currentEngine.description}
                        </p>
                    </div>

                    <Separator />

                    {/* API Key 配置（非 Claude） */}
                    {currentEngine.needsApiKey && (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">API Key</Label>
                                    {'configUrl' in currentEngine && currentEngine.configUrl && (
                                        <a
                                            href={currentEngine.configUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                            获取 API Key <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                                <div className="relative">
                                    <Input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="输入 API Key"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* 自定义端点 */}
                            {'defaultEndpoint' in currentEngine && currentEngine.defaultEndpoint && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        API 端点 <span className="text-muted-foreground font-normal">(可选)</span>
                                    </Label>
                                    <Input
                                        type="text"
                                        value={apiEndpoint}
                                        onChange={(e) => setApiEndpoint(e.target.value)}
                                        placeholder={currentEngine.defaultEndpoint}
                                    />
                                </div>
                            )}

                            <Separator />
                        </>
                    )}

                    {/* 模型测试区域 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">模型可用性测试</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTestAllModels}
                                disabled={isTesting || (currentEngine.needsApiKey && !apiKey)}
                            >
                                {isTesting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        测试中...
                                    </>
                                ) : (
                                    <>
                                        <TestTube className="h-4 w-4 mr-1" />
                                        测试所有模型
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* 测试进度条 */}
                        {isTesting && testProgress && (
                            <div className="space-y-1">
                                <Progress
                                    value={(testProgress.current / testProgress.total) * 100}
                                    className="h-2"
                                />
                                <p className="text-xs text-muted-foreground">
                                    正在测试: {testProgress.currentModel} ({testProgress.current}/{testProgress.total})
                                </p>
                            </div>
                        )}

                        {/* 测试结果统计 */}
                        {hasTestedCurrentEngine && !isTesting && (
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    {testStats.available} 可用
                                </span>
                                <span className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3 text-red-500" />
                                    {testStats.failed} 不可用
                                </span>
                                <div className="flex-1" />
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">显示全部</span>
                                    <Switch
                                        checked={showAllModels}
                                        onCheckedChange={setShowAllModels}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* 模型选择 */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">选择模型</Label>
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                            <SelectTrigger>
                                <SelectValue placeholder="选择模型" />
                            </SelectTrigger>
                            <SelectContent>
                                {displayModels.map((model) => (
                                    <SelectItem
                                        key={model.id}
                                        value={model.id}
                                        disabled={model.testStatus === 'error'}
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            {renderModelStatusIcon(model)}
                                            <span className={cn(
                                                model.testStatus === 'error' && 'text-muted-foreground line-through'
                                            )}>
                                                {model.name}
                                            </span>
                                            {model.recommended && model.testStatus !== 'error' && (
                                                <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                                    推荐
                                                </span>
                                            )}
                                            {model.latency !== undefined && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                                    <Zap className="h-3 w-3" />
                                                    {model.latency}ms
                                                </span>
                                            )}
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                ${model.costPer1k}/1K
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Claude 特殊提示 */}
                    {selectedEngine === 'claude' && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-orange-700 dark:text-orange-300">
                                Claude 引擎使用当前 Claude Code 的配置，无需额外设置 API Key。
                                摘要将通过 Tauri 后端调用。
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isTesting}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                保存中...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                保存配置
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SummaryEngineConfig;

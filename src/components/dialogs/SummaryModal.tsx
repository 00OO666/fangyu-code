/**
 * SummaryModal Component
 * 
 * 会话摘要生成对话框
 * 显示会话统计、引擎选择、摘要预览
 * 
 * Requirements: 5.3, 5.4, 5.5, 5.6
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Copy, Check, ExternalLink, Loader2, RefreshCw,
    MessageSquare, Coins, Clock, AlertCircle, Settings
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { EnhancedEngineSelector, type ExecutionEngineConfig } from '@/components/EnhancedEngineSelector';
import { SummaryEngineConfig } from '@/components/dialogs/SummaryEngineConfig';
import { getSummaryGeneratorService } from '@/services/summaryGeneratorService';
import { getSummaryConfigStore } from '@/services/summaryConfigStore';
import { ENGINE_DISPLAY_INFO } from '@/types/summary';
import type { SessionStats, GenerationProgress, SummaryResult, SummaryAPIConfig } from '@/types/summary';
import type { ClaudeStreamMessage } from '@/types/claude';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SummaryModalProps {
    /** 是否打开 */
    open: boolean;
    /** 关闭回调 */
    onOpenChange: (open: boolean) => void;
    /** 当前会话消息 */
    messages: ClaudeStreamMessage[];
    /** 会话统计信息 */
    sessionStats: SessionStats;
    /** 复制成功回调 */
    onCopySuccess?: () => void;
    /** 在新会话中打开回调 */
    onOpenInNewSession?: (summary: string) => void;
}

/**
 * SummaryModal - 会话摘要生成对话框
 */
export const SummaryModal: React.FC<SummaryModalProps> = ({
    open,
    onOpenChange,
    messages,
    sessionStats,
    onCopySuccess,
    onOpenInNewSession,
}) => {
    // 状态
    const [engineConfig, setEngineConfig] = useState<ExecutionEngineConfig>({
        engine: 'claude',
    });
    const [progress, setProgress] = useState<GenerationProgress>({
        status: 'idle',
        percentage: 0,
    });
    const [result, setResult] = useState<SummaryResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showEngineConfig, setShowEngineConfig] = useState(false);
    const [savedConfig, setSavedConfig] = useState<SummaryAPIConfig | null>(null);

    // 加载保存的配置
    useEffect(() => {
        if (open) {
            const store = getSummaryConfigStore();
            store.loadConfig().then(config => {
                setSavedConfig(config);
                setEngineConfig(prev => ({
                    ...prev,
                    engine: config.engine,
                }));
            });
        }
    }, [open]);

    // 订阅进度更新
    useEffect(() => {
        const service = getSummaryGeneratorService();
        const unsubscribe = service.onProgress(setProgress);
        return unsubscribe;
    }, []);

    // 生成摘要
    const handleGenerate = useCallback(async () => {
        const service = getSummaryGeneratorService();
        const store = getSummaryConfigStore();

        // 从存储加载最新配置（确保使用用户保存的配置）
        const latestConfig = await store.loadConfig();

        // 更新 UI 显示的配置
        setSavedConfig(latestConfig);

        // 生成摘要（使用已保存的配置）
        const summaryResult = await service.generateSummary(messages, latestConfig);
        setResult(summaryResult);
    }, [messages]);

    // 复制到剪贴板
    const handleCopy = useCallback(async () => {
        if (!result?.summary) return;

        try {
            await navigator.clipboard.writeText(result.summary);
            setCopied(true);
            onCopySuccess?.();
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('复制失败:', error);
        }
    }, [result, onCopySuccess]);

    // 在新会话中打开
    const handleOpenInNewSession = useCallback(() => {
        if (!result?.summary) return;
        onOpenInNewSession?.(result.summary);
        onOpenChange(false);
    }, [result, onOpenInNewSession, onOpenChange]);

    // 重置状态
    const handleReset = useCallback(() => {
        setResult(null);
        setProgress({ status: 'idle', percentage: 0 });
    }, []);

    // 关闭时重置
    useEffect(() => {
        if (!open) {
            handleReset();
        }
    }, [open, handleReset]);

    const isGenerating = progress.status === 'generating' || progress.status === 'preparing';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>生成会话摘要</DialogTitle>
                    <DialogDescription>
                        生成当前会话的摘要，可复制到剪贴板或在新会话中继续
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    {/* 会话统计 */}
                    <div className="grid grid-cols-4 gap-3">
                        <StatCard
                            icon={<MessageSquare className="h-4 w-4" />}
                            label="消息数"
                            value={sessionStats.messageCount.toString()}
                        />
                        <StatCard
                            icon={<Clock className="h-4 w-4" />}
                            label="Token"
                            value={sessionStats.tokenCount.toLocaleString()}
                            subValue={`${(sessionStats.tokenPercentage * 100).toFixed(1)}%`}
                            warning={sessionStats.tokenPercentage >= 0.8}
                        />
                        <StatCard
                            icon={<Coins className="h-4 w-4" />}
                            label="预估费用"
                            value={`$${sessionStats.estimatedCost.toFixed(4)}`}
                        />
                        <StatCard
                            icon={<MessageSquare className="h-4 w-4" />}
                            label="用户/助手"
                            value={`${sessionStats.userMessageCount}/${sessionStats.assistantMessageCount}`}
                        />
                    </div>

                    <Separator />

                    {/* 当前引擎显示和配置入口 */}
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${ENGINE_DISPLAY_INFO[savedConfig?.engine || 'claude'].color}20` }}
                            >
                                <span
                                    className="text-sm font-bold"
                                    style={{ color: ENGINE_DISPLAY_INFO[savedConfig?.engine || 'claude'].color }}
                                >
                                    {ENGINE_DISPLAY_INFO[savedConfig?.engine || 'claude'].name.charAt(0)}
                                </span>
                            </div>
                            <div>
                                <div className="text-sm font-medium">
                                    {ENGINE_DISPLAY_INFO[savedConfig?.engine || 'claude'].name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {savedConfig?.model || '默认模型'}
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEngineConfig(true)}
                            className="h-8"
                        >
                            <Settings className="h-4 w-4 mr-1.5" />
                            配置引擎
                        </Button>
                    </div>

                    {/* 引擎配置对话框 */}
                    <SummaryEngineConfig
                        open={showEngineConfig}
                        onOpenChange={setShowEngineConfig}
                        onConfigSaved={(config) => {
                            setSavedConfig(config);
                            setEngineConfig(prev => ({
                                ...prev,
                                engine: config.engine,
                            }));
                        }}
                    />

                    {/* 生成进度 */}
                    {isGenerating && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>{progress.currentStep || '生成中...'}</span>
                                <span>{progress.percentage}%</span>
                            </div>
                            <Progress value={progress.percentage} />
                        </div>
                    )}

                    {/* 摘要预览 */}
                    {result && (
                        <div className="flex-1 min-h-0">
                            <Label className="text-sm font-medium mb-2 block">
                                {result.success ? '摘要预览' : '生成失败'}
                            </Label>
                            <ScrollArea className="h-[200px] border rounded-lg p-3 bg-muted/20">
                                {result.success ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {result.summary || ''}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>{result.error}</span>
                                    </div>
                                )}
                            </ScrollArea>

                            {/* 元数据 */}
                            {result.success && result.metadata && (
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>模型: {result.metadata.model}</span>
                                    <span>Token: {result.metadata.tokensUsed}</span>
                                    <span>耗时: {(result.metadata.generationTime / 1000).toFixed(1)}s</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-shrink-0 gap-2">
                    {!result ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                取消
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={isGenerating || messages.length === 0}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    '快速生成'
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={handleReset}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                重新生成
                            </Button>
                            {/* 一键复制按钮 - 醒目样式 */}
                            <Button
                                variant={copied ? "outline" : "default"}
                                onClick={handleCopy}
                                disabled={!result.success}
                                className={cn(
                                    "min-w-[120px]",
                                    copied && "bg-green-500/10 border-green-500/50 text-green-600"
                                )}
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4 mr-2 text-green-500" />
                                        已复制到剪贴板
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4 mr-2" />
                                        一键复制摘要
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleOpenInNewSession}
                                disabled={!result.success}
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                在新会话中打开
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// 统计卡片组件
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subValue?: string;
    warning?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, warning }) => (
    <div className={cn(
        'p-2 rounded-lg border bg-card',
        warning && 'border-amber-500/50 bg-amber-500/5'
    )}>
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            {icon}
            <span className="text-xs">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
            <span className={cn('text-sm font-medium', warning && 'text-amber-500')}>
                {value}
            </span>
            {subValue && (
                <span className="text-xs text-muted-foreground">{subValue}</span>
            )}
        </div>
    </div>
);

export default SummaryModal;

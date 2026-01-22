/**
 * SmartRecommendationBar - 智能推荐条 v3
 *
 * 改进点：
 * 1. 应用 Design System v3 - Glassmorphism 风格
 * 2. 更简洁的 UI - 单行显示，不遮挡内容
 * 3. 渐变边框和发光效果
 * 4. 平滑的动画过渡
 * 5. 类型颜色编码图标
 */

import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Network from 'lucide-react/dist/esm/icons/network'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Bot from 'lucide-react/dist/esm/icons/bot'
import Wrench from 'lucide-react/dist/esm/icons/wrench'
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Clock from 'lucide-react/dist/esm/icons/clock'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { notify } from '@/components/notifications';
import type { SmartRecommendation, RecommendationType } from '@/hooks/useSmartRecommendation';

interface SmartRecommendationBarProps {
    recommendations: SmartRecommendation[];
    onDismiss: (id: string) => void;
    onSnooze: (id: string) => void;
    onClearAll: () => void;
    onRefresh?: () => void;
    className?: string;
}

// 类型配置 - 使用设计系统颜色
const TYPE_CONFIG: Record<RecommendationType, {
    icon: typeof Network;
    colorClass: string;
    bgClass: string;
    glowColor: string;
    label: string;
}> = {
    mcp: {
        icon: Network,
        colorClass: 'text-[var(--ds-secondary-400)]',
        bgClass: 'bg-[var(--ds-secondary-500)]/10',
        glowColor: 'var(--ds-secondary-500)',
        label: 'MCP',
    },
    skill: {
        icon: Zap,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        glowColor: '#f59e0b',
        label: 'Skill',
    },
    agent: {
        icon: Bot,
        colorClass: 'text-[var(--ds-primary-400)]',
        bgClass: 'bg-[var(--ds-primary-500)]/10',
        glowColor: 'var(--ds-primary-500)',
        label: 'Agent',
    },
    tool: {
        icon: Wrench,
        colorClass: 'text-[var(--ds-success)]',
        bgClass: 'bg-[var(--ds-success)]/10',
        glowColor: 'var(--ds-success)',
        label: 'Tool',
    },
};

export function SmartRecommendationBar({
    recommendations,
    onDismiss,
    onSnooze,
    onClearAll,
    onRefresh,
    className,
}: SmartRecommendationBarProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [enabling, setEnabling] = useState(false);

    // 🔧 FIX: 使用 useEffect 处理索引重置，避免在渲染期间调用 setState
    useEffect(() => {
        if (currentIndex >= recommendations.length && recommendations.length > 0) {
            setCurrentIndex(0);
        }
    }, [currentIndex, recommendations.length]);

    const currentRec = recommendations[Math.min(currentIndex, recommendations.length - 1)] || recommendations[0];

    const handlePrev = useCallback(() => {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : recommendations.length - 1));
    }, [recommendations.length]);

    const handleNext = useCallback(() => {
        setCurrentIndex(prev => (prev < recommendations.length - 1 ? prev + 1 : 0));
    }, [recommendations.length]);

    const handleEnable = useCallback(async () => {
        if (!currentRec || enabling) return;

        setEnabling(true);
        try {
            if (currentRec.type === 'mcp') {
                const parts = currentRec.id.split(':');
                if (parts.length >= 3) {
                    const engine = parts[1] as 'claude' | 'codex' | 'gemini';
                    const serverId = parts.slice(2).join(':');

                    const servers = await api.mcpGetEngineServersWithStatus(engine);
                    const server = servers.find((s: any) => s.id === serverId || s.name === serverId);

                    if (server?.spec) {
                        await api.mcpToggleEngineServer(engine, serverId, server.spec, true);
                        notify.success(`已启用 ${currentRec.name}`, { duration: 2000 });
                        onDismiss(currentRec.id);
                        onRefresh?.();
                    } else {
                        throw new Error(`未找到 ${currentRec.name} 的配置`);
                    }
                }
            } else if (currentRec.type === 'skill') {
                const skillRef = `#${currentRec.id.replace('skill:', 'skills-')}`;
                await navigator.clipboard.writeText(skillRef);
                notify.success(`已复制 ${skillRef}，粘贴到输入框即可使用`, { duration: 3000 });
                onDismiss(currentRec.id);
            } else {
                notify.info(`${currentRec.type.toUpperCase()} 类型暂不支持一键启用`, { duration: 2000 });
            }
        } catch (error) {
            logger.error('SmartRecommendationBar', '[SmartRecommendationBar] Enable failed:', error);
            notify.error(`启用失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setEnabling(false);
        }
    }, [currentRec, enabling, onDismiss, onRefresh]);

    if (recommendations.length === 0) return null;

    const config = currentRec ? TYPE_CONFIG[currentRec.type] : null;
    const Icon = config?.icon || Sparkles;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={currentRec?.id}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{
                    duration: 0.2,
                    ease: [0.16, 1, 0.3, 1] // spring easing
                }}
                className={cn(
                    // Glassmorphism 基础
                    'ds-glass ds-glow-border',
                    // 布局
                    'flex items-center gap-3 px-4 py-2.5',
                    // 圆角
                    'rounded-xl',
                    // 渐变左边框
                    'border-l-[3px]',
                    className
                )}
                style={{
                    borderLeftColor: config?.glowColor || 'var(--ds-primary-500)',
                    boxShadow: `
                        0 4px 12px -2px var(--ds-shadow-color),
                        0 0 20px -5px ${config?.glowColor || 'var(--ds-primary-500)'}40
                    `
                }}
            >
                {/* 图标 - 带发光效果 */}
                <motion.div
                    className={cn(
                        'p-2 rounded-lg',
                        config?.bgClass,
                        'relative'
                    )}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.15 }}
                >
                    <Icon className={cn('h-4 w-4', config?.colorClass)} />
                    {/* 图标发光 */}
                    <div
                        className="absolute inset-0 rounded-lg opacity-50 blur-sm -z-10"
                        style={{ backgroundColor: config?.glowColor }}
                    />
                </motion.div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[var(--ds-text-primary)] truncate">
                            {currentRec?.name}
                        </span>
                        <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            config?.bgClass,
                            config?.colorClass
                        )}>
                            {config?.label}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--ds-text-muted)] truncate mt-0.5">
                        {currentRec?.reason}
                    </p>
                </div>

                {/* 翻页指示器 */}
                {recommendations.length > 1 && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePrev}
                            className="h-7 w-7 p-0 rounded-lg hover:bg-[var(--ds-hover-overlay)] transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4 text-[var(--ds-text-secondary)]" />
                        </Button>
                        <span className="text-xs text-[var(--ds-text-muted)] min-w-[2.5rem] text-center tabular-nums">
                            {currentIndex + 1} / {recommendations.length}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleNext}
                            className="h-7 w-7 p-0 rounded-lg hover:bg-[var(--ds-hover-overlay)] transition-colors"
                        >
                            <ChevronRight className="h-4 w-4 text-[var(--ds-text-secondary)]" />
                        </Button>
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-1.5">
                    {/* 启用按钮 - 渐变背景 */}
                    <motion.button
                        onClick={handleEnable}
                        disabled={enabling}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                            'h-8 px-4 rounded-lg text-xs font-medium',
                            'bg-[var(--ds-gradient-primary)] text-white',
                            'flex items-center gap-1.5',
                            'transition-all duration-200',
                            'hover:shadow-lg hover:shadow-[var(--ds-primary-500)]/25',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                    >
                        {enabling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Check className="h-3.5 w-3.5" />
                        )}
                        启用
                    </motion.button>

                    {/* 稍后提醒 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => currentRec && onSnooze(currentRec.id)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-[var(--ds-hover-overlay)] transition-colors"
                        title="30 分钟后再提醒"
                    >
                        <Clock className="h-4 w-4 text-[var(--ds-text-muted)]" />
                    </Button>

                    {/* 不再提示 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => currentRec && onDismiss(currentRec.id)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-[var(--ds-error)]/10 hover:text-[var(--ds-error)] transition-colors"
                        title="不再提示此工具"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

/**
 * 紧凑版推荐条 - 用于输入框上方
 */
export function SmartRecommendationCompact({
    recommendations,
    onDismiss,
    onSnooze,
    onRefresh,
    className,
}: Omit<SmartRecommendationBarProps, 'onClearAll'>) {
    const [enabling, setEnabling] = useState<string | null>(null);

    const handleEnable = useCallback(async (rec: SmartRecommendation) => {
        if (enabling) return;

        setEnabling(rec.id);
        try {
            if (rec.type === 'mcp') {
                const parts = rec.id.split(':');
                if (parts.length >= 3) {
                    const engine = parts[1] as 'claude' | 'codex' | 'gemini';
                    const serverId = parts.slice(2).join(':');

                    const servers = await api.mcpGetEngineServersWithStatus(engine);
                    const server = servers.find((s: any) => s.id === serverId || s.name === serverId);

                    if (server?.spec) {
                        await api.mcpToggleEngineServer(engine, serverId, server.spec, true);
                        notify.success(`已启用 ${rec.name}`, { duration: 2000 });
                        onDismiss(rec.id);
                        onRefresh?.();
                    }
                }
            } else if (rec.type === 'skill') {
                const skillRef = `#${rec.id.replace('skill:', 'skills-')}`;
                await navigator.clipboard.writeText(skillRef);
                notify.success(`已复制 ${skillRef}`, { duration: 2000 });
                onDismiss(rec.id);
            }
        } catch (error) {
            notify.error(`启用失败`);
        } finally {
            setEnabling(null);
        }
    }, [enabling, onDismiss, onRefresh]);

    if (recommendations.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className={cn(
                'flex items-center gap-2 flex-wrap',
                className
            )}
        >
            <div className="flex items-center gap-1.5 text-[var(--ds-text-muted)]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--ds-primary-400)]" />
                <span className="text-xs">推荐:</span>
            </div>

            <AnimatePresence mode="popLayout">
                {recommendations.map(rec => {
                    const config = TYPE_CONFIG[rec.type];
                    const Icon = config.icon;
                    const isEnabling = enabling === rec.id;

                    return (
                        <motion.div
                            key={rec.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className={cn(
                                // Glassmorphism 效果
                                'ds-glass-subtle',
                                // 布局
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full',
                                // 文字
                                'text-xs',
                                // 交互
                                'cursor-pointer transition-all duration-200',
                                'hover:bg-[var(--ds-glass-bg)]',
                                'hover:border-[var(--ds-border-default)]'
                            )}
                            style={{
                                borderLeft: `2px solid ${config.glowColor}`
                            }}
                        >
                            <Icon className={cn('h-3.5 w-3.5', config.colorClass)} />
                            <span className="font-medium text-[var(--ds-text-primary)]">{rec.name}</span>

                            {/* 快捷操作 */}
                            <div className="flex items-center gap-0.5 ml-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEnable(rec);
                                    }}
                                    disabled={isEnabling}
                                    className={cn(
                                        'p-1 rounded-full transition-colors',
                                        'hover:bg-[var(--ds-success)]/20',
                                        isEnabling && 'opacity-50'
                                    )}
                                    title="启用"
                                >
                                    {isEnabling ? (
                                        <Loader2 className="h-3 w-3 animate-spin text-[var(--ds-text-muted)]" />
                                    ) : (
                                        <Check className="h-3 w-3 text-[var(--ds-success)]" />
                                    )}
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSnooze(rec.id);
                                    }}
                                    className="p-1 rounded-full hover:bg-[var(--ds-hover-overlay)] transition-colors"
                                    title="稍后"
                                >
                                    <Clock className="h-3 w-3 text-[var(--ds-text-muted)]" />
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDismiss(rec.id);
                                    }}
                                    className="p-1 rounded-full hover:bg-[var(--ds-error)]/20 transition-colors"
                                    title="忽略"
                                >
                                    <X className="h-3 w-3 text-[var(--ds-text-muted)] hover:text-[var(--ds-error)]" />
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </motion.div>
    );
}

/**
 * ToolCallCompact - 紧凑版工具调用卡片 v3
 *
 * 设计规范：
 * 1. 收起状态：32px 高度，单行显示
 * 2. 展开状态：显示输入/输出详情，最大高度 200px
 * 3. 状态动画：Pending 脉冲，Running 旋转，Success/Error 静态
 * 4. Glassmorphism 风格
 */

import { logger } from '@/lib/logger';
import React, { memo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Check from 'lucide-react/dist/esm/icons/check';
import { cn } from '@/lib/utils';

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolCallCompactProps {
    /** 工具名称 */
    name: string;
    /** 工具 ID */
    id: string;
    /** 执行状态 */
    status: ToolCallStatus;
    /** 输入参数 */
    input?: Record<string, any>;
    /** 执行结果 */
    result?: {
        content?: any;
        is_error?: boolean;
    };
    /** 执行时间（毫秒） */
    duration?: number;
    /** 默认展开 */
    defaultExpanded?: boolean;
    /** 展开状态变化回调 */
    onToggle?: (expanded: boolean) => void;
    /** 自定义类名 */
    className?: string;
}

// 状态配置
const STATUS_CONFIG: Record<ToolCallStatus, {
    icon: typeof Loader2;
    colorClass: string;
    bgClass: string;
    label: string;
    animate?: boolean;
}> = {
    pending: {
        icon: Clock,
        colorClass: 'text-[var(--ds-text-muted)]',
        bgClass: 'bg-[var(--ds-text-muted)]/10',
        label: '等待中',
        animate: true,
    },
    running: {
        icon: Loader2,
        colorClass: 'text-[var(--ds-info)]',
        bgClass: 'bg-[var(--ds-info)]/10',
        label: '执行中',
        animate: true,
    },
    success: {
        icon: CheckCircle,
        colorClass: 'text-[var(--ds-success)]',
        bgClass: 'bg-[var(--ds-success)]/10',
        label: '成功',
    },
    error: {
        icon: AlertCircle,
        colorClass: 'text-[var(--ds-error)]',
        bgClass: 'bg-[var(--ds-error)]/10',
        label: '失败',
    },
};

const ToolCallCompactComponent: React.FC<ToolCallCompactProps> = ({
    name,
    status,
    input,
    result,
    duration,
    defaultExpanded = false,
    onToggle,
    className,
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [copied, setCopied] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const config = STATUS_CONFIG[status];
    const StatusIcon = config.icon;

    const toggleExpand = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        onToggle?.(newState);
    };

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            logger.error('ToolCallCompact', 'Copy failed:', error);
        }
    };

    // 格式化执行时间
    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    // 获取输入摘要
    const getInputSummary = () => {
        if (!input) return '';
        const keys = Object.keys(input);
        if (keys.length === 0) return '';

        // 优先显示 path 或 command
        if (input.path) return input.path;
        if (input.command) return input.command.slice(0, 50) + (input.command.length > 50 ? '...' : '');
        if (input.query) return input.query.slice(0, 50) + (input.query.length > 50 ? '...' : '');

        // 否则显示第一个参数
        const firstKey = keys[0];
        const firstValue = input[firstKey];
        if (typeof firstValue === 'string') {
            return firstValue.slice(0, 50) + (firstValue.length > 50 ? '...' : '');
        }
        return `${keys.length} 个参数`;
    };

    return (
        <div
            className={cn(
                // 基础样式
                'ds-tool-call-compact',
                // 展开时的样式
                isExpanded && 'h-auto',
                className
            )}
        >
            {/* 收起状态 - 32px 高度 */}
            <button
                onClick={toggleExpand}
                className={cn(
                    'w-full flex items-center gap-2 h-8 px-3',
                    'text-left transition-colors',
                    'hover:bg-[var(--ds-hover-overlay)]',
                    'rounded-md'
                )}
            >
                {/* 展开/收起图标 */}
                <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
                </motion.div>

                {/* 状态图标 */}
                <div className={cn('p-1 rounded', config.bgClass)}>
                    <StatusIcon
                        className={cn(
                            'h-3.5 w-3.5',
                            config.colorClass,
                            config.animate && status === 'pending' && 'ds-animate-pulse',
                            config.animate && status === 'running' && 'ds-animate-spin'
                        )}
                    />
                </div>

                {/* 工具名称 */}
                <span className="font-mono text-xs font-medium text-[var(--ds-text-primary)] truncate">
                    {name}
                </span>

                {/* 输入摘要 */}
                {!isExpanded && getInputSummary() && (
                    <span className="text-xs text-[var(--ds-text-muted)] truncate flex-1 min-w-0">
                        {getInputSummary()}
                    </span>
                )}

                {/* 执行时间 */}
                {duration !== undefined && (
                    <span className="text-[10px] text-[var(--ds-text-muted)] tabular-nums ml-auto">
                        {formatDuration(duration)}
                    </span>
                )}

                {/* 状态标签 */}
                <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    config.bgClass,
                    config.colorClass
                )}>
                    {config.label}
                </span>
            </button>

            {/* 展开内容 */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        ref={contentRef}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 pt-1 space-y-2">
                            {/* 输入参数 */}
                            {input && Object.keys(input).length > 0 && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-[var(--ds-text-muted)] uppercase tracking-wider">
                                            输入
                                        </span>
                                        <button
                                            onClick={() => handleCopy(JSON.stringify(input, null, 2))}
                                            className="p-1 rounded hover:bg-[var(--ds-hover-overlay)] transition-colors"
                                            title="复制"
                                        >
                                            {copied ? (
                                                <Check className="h-3 w-3 text-[var(--ds-success)]" />
                                            ) : (
                                                <Copy className="h-3 w-3 text-[var(--ds-text-muted)]" />
                                            )}
                                        </button>
                                    </div>
                                    <pre className={cn(
                                        'text-[10px] p-2 rounded-md overflow-auto',
                                        'bg-[var(--ds-bg-elevated)]',
                                        'border border-[var(--ds-border-subtle)]',
                                        'max-h-[100px]',
                                        'ds-scrollbar-thin'
                                    )}>
                                        {JSON.stringify(input, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* 执行结果 */}
                            {result && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className={cn(
                                            'text-[10px] font-medium uppercase tracking-wider',
                                            result.is_error ? 'text-[var(--ds-error)]' : 'text-[var(--ds-text-muted)]'
                                        )}>
                                            {result.is_error ? '错误' : '输出'}
                                        </span>
                                        <button
                                            onClick={() => handleCopy(
                                                typeof result.content === 'string'
                                                    ? result.content
                                                    : JSON.stringify(result.content, null, 2)
                                            )}
                                            className="p-1 rounded hover:bg-[var(--ds-hover-overlay)] transition-colors"
                                            title="复制"
                                        >
                                            <Copy className="h-3 w-3 text-[var(--ds-text-muted)]" />
                                        </button>
                                    </div>
                                    <pre className={cn(
                                        'text-[10px] p-2 rounded-md overflow-auto',
                                        'max-h-[100px]',
                                        'ds-scrollbar-thin',
                                        result.is_error
                                            ? 'bg-[var(--ds-error)]/10 border border-[var(--ds-error)]/20'
                                            : 'bg-[var(--ds-bg-elevated)] border border-[var(--ds-border-subtle)]'
                                    )}>
                                        {typeof result.content === 'string'
                                            ? result.content
                                            : JSON.stringify(result.content, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

ToolCallCompactComponent.displayName = 'ToolCallCompact';

export const ToolCallCompact = memo(ToolCallCompactComponent);

/**
 * 工具调用组 - 紧凑版
 */
export interface ToolCallsCompactGroupProps {
    tools: Array<{
        id: string;
        name: string;
        input?: Record<string, any>;
    }>;
    getResult: (id: string) => { content?: any; is_error?: boolean } | undefined;
    getStatus: (id: string) => ToolCallStatus;
    getDuration?: (id: string) => number | undefined;
    className?: string;
}

export const ToolCallsCompactGroup: React.FC<ToolCallsCompactGroupProps> = ({
    tools,
    getResult,
    getStatus,
    getDuration,
    className,
}) => {
    if (tools.length === 0) return null;

    return (
        <div className={cn('space-y-1', className)}>
            {tools.map((tool) => (
                <ToolCallCompact
                    key={tool.id}
                    id={tool.id}
                    name={tool.name}
                    input={tool.input}
                    status={getStatus(tool.id)}
                    result={getResult(tool.id)}
                    duration={getDuration?.(tool.id)}
                />
            ))}
        </div>
    );
};

export default ToolCallCompact;

/**
 * SummaryButton Component
 * 
 * 会话摘要生成按钮，集成 token 阈值监控
 * 80% 时显示警告指示器
 * 
 * Requirements: 5.1, 5.2
 */

import React from 'react';
import FileText from 'lucide-react/dist/esm/icons/file-text'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SummaryButtonProps {
    /** Token 使用百分比 (0-1) */
    tokenPercentage: number;
    /** 是否正在生成摘要 */
    isGenerating?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 点击回调 */
    onClick: () => void;
    /** 自定义类名 */
    className?: string;
}

/** 警告阈值 */
const WARNING_THRESHOLD = 0.8;
/** 危险阈值 */
const CRITICAL_THRESHOLD = 0.9;

/**
 * SummaryButton - 会话摘要生成按钮
 */
export const SummaryButton: React.FC<SummaryButtonProps> = ({
    tokenPercentage,
    isGenerating = false,
    disabled = false,
    onClick,
    className,
}) => {
    const isWarning = tokenPercentage >= WARNING_THRESHOLD;
    const isCritical = tokenPercentage >= CRITICAL_THRESHOLD;

    // 获取状态颜色
    const getStatusColor = () => {
        if (isCritical) return 'text-red-500';
        if (isWarning) return 'text-amber-500';
        return 'text-muted-foreground';
    };

    // 获取提示文本
    const getTooltipText = () => {
        if (isGenerating) return '正在生成摘要...';
        if (isCritical) return `Token 使用率 ${(tokenPercentage * 100).toFixed(0)}%，建议立即生成摘要`;
        if (isWarning) return `Token 使用率 ${(tokenPercentage * 100).toFixed(0)}%，建议生成摘要`;
        return '生成会话摘要';
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClick}
                        disabled={disabled || isGenerating}
                        className={cn(
                            'h-8 px-2 gap-1.5 relative',
                            isWarning && 'animate-pulse',
                            className
                        )}
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className={cn('h-4 w-4', getStatusColor())} />
                        )}
                        <span className="text-xs">摘要</span>

                        {/* 警告指示器 */}
                        {isWarning && !isGenerating && (
                            <span className={cn(
                                'absolute -top-1 -right-1 flex h-3 w-3',
                            )}>
                                <span className={cn(
                                    'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                                    isCritical ? 'bg-red-400' : 'bg-amber-400'
                                )} />
                                <AlertTriangle className={cn(
                                    'relative inline-flex h-3 w-3',
                                    isCritical ? 'text-red-500' : 'text-amber-500'
                                )} />
                            </span>
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>{getTooltipText()}</p>
                    {tokenPercentage > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                            当前 Token 使用: {(tokenPercentage * 100).toFixed(1)}%
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default SummaryButton;

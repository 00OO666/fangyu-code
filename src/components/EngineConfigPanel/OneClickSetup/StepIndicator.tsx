/**
 * 步骤指示器组件
 * 显示配置向导的步骤列表和当前进度
 */

import React from 'react';
import { Check, Circle, Loader2, AlertCircle, SkipForward } from 'lucide-react';
import type { SetupStep } from '../../../services/setupStateService';
import { cn } from '../../../lib/utils';

interface StepIndicatorProps {
    steps: SetupStep[];
    currentStep: number;
    className?: string;
}

const STATUS_ICONS: Record<SetupStep['status'], React.ComponentType<{ className?: string }>> = {
    pending: Circle,
    in_progress: Loader2,
    completed: Check,
    error: AlertCircle,
    skipped: SkipForward,
};

const STATUS_BG_COLORS: Record<SetupStep['status'], string> = {
    pending: 'bg-gray-100 dark:bg-gray-800',
    in_progress: 'bg-blue-100 dark:bg-blue-900/30',
    completed: 'bg-green-100 dark:bg-green-900/30',
    error: 'bg-red-100 dark:bg-red-900/30',
    skipped: 'bg-yellow-100 dark:bg-yellow-900/30',
};

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
    return (
        <div className={cn('space-y-2', className)}>
            {steps.map((step, index) => {
                const Icon = STATUS_ICONS[step.status];
                const isActive = index === currentStep;
                
                return (
                    <div
                        key={step.id}
                        className={cn(
                            'flex items-center gap-3 p-3 rounded-lg transition-all',
                            STATUS_BG_COLORS[step.status],
                            isActive && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                        )}
                    >
                        {/* 步骤图标 */}
                        <div
                            className={cn(
                                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                                step.status === 'completed' && 'bg-green-500',
                                step.status === 'error' && 'bg-red-500',
                                step.status === 'in_progress' && 'bg-blue-500',
                                step.status === 'skipped' && 'bg-yellow-500',
                                step.status === 'pending' && 'bg-gray-300 dark:bg-gray-600'
                            )}
                        >
                            <Icon
                                className={cn(
                                    'w-4 h-4',
                                    step.status === 'in_progress' && 'animate-spin',
                                    step.status === 'pending' ? 'text-gray-500 dark:text-gray-400' : 'text-white'
                                )}
                            />
                        </div>

                        {/* 步骤信息 */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'font-medium text-sm',
                                        step.status === 'pending'
                                            ? 'text-gray-500 dark:text-gray-400'
                                            : 'text-gray-900 dark:text-gray-100'
                                    )}
                                >
                                    {step.title}
                                </span>
                                {step.optional && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                        可选
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {step.description}
                            </p>
                            {step.errorMessage && (
                                <p className="text-xs text-red-500 mt-1">
                                    {step.errorMessage}
                                </p>
                            )}
                        </div>

                        {/* 步骤序号 */}
                        <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                            {index + 1}/{steps.length}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default StepIndicator;

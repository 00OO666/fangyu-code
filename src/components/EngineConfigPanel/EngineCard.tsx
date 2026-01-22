/**
 * 引擎卡片组件
 */

import React from 'react';
import Bot from 'lucide-react/dist/esm/icons/bot'
import FileCode from 'lucide-react/dist/esm/icons/file-code'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Cloud from 'lucide-react/dist/esm/icons/cloud'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Download from 'lucide-react/dist/esm/icons/download';
import type { EngineType, EngineStatusInfo } from '../../types/provider';
import { ENGINE_DISPLAY_NAMES, ENGINE_COLORS } from '../../types/provider';
import { cn } from '../../lib/utils';

interface EngineCardProps {
    engine: EngineType;
    status: EngineStatusInfo;
    isActive: boolean;
    onClick: () => void;
}

const ENGINE_ICON_MAP: Record<EngineType, React.ComponentType<{ className?: string }>> = {
    claude: Bot,
    codex: FileCode,
    gemini: Sparkles,
    siliconflow: Zap,
    kiro: Cloud,
};

function getStatusInfo(status: EngineStatusInfo): {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    text: string;
} {
    if (!status.installed) {
        return { icon: Download, color: 'text-gray-400', text: '未安装' };
    }
    if (!status.currentProvider) {
        return { icon: AlertCircle, color: 'text-yellow-500', text: '未配置' };
    }
    switch (status.connectionStatus) {
        case 'connected':
            return { icon: CheckCircle, color: 'text-green-500', text: '已连接' };
        case 'error':
            return { icon: XCircle, color: 'text-red-500', text: status.errorMessage || '错误' };
        default:
            return { icon: AlertCircle, color: 'text-gray-400', text: '未知' };
    }
}


export function EngineCard({ engine, status, isActive, onClick }: EngineCardProps) {
    const EngineIcon = ENGINE_ICON_MAP[engine];
    const statusInfo = getStatusInfo(status);
    const StatusIcon = statusInfo.icon;
    const engineColor = ENGINE_COLORS[engine];

    return (
        <button
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${ENGINE_DISPLAY_NAMES[engine]}, ${statusInfo.text}`}
            onClick={onClick}
            className={cn(
                'relative flex flex-col items-center justify-center p-4 rounded-xl',
                'border-2 transition-all duration-200 ease-out',
                'hover:shadow-lg hover:-translate-y-0.5',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                'min-h-[120px] w-full',
                isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            )}
        >
            {/* 激活指示器 */}
            {isActive && (
                <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"
                    aria-hidden="true"
                />
            )}

            {/* 引擎图标 */}
            <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
                style={{ backgroundColor: `${engineColor}20` }}
            >
                <EngineIcon
                    className="w-6 h-6"
                    style={{ color: engineColor }}
                />
            </div>

            {/* 引擎名称 */}
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                {ENGINE_DISPLAY_NAMES[engine]}
            </span>

            {/* 状态 */}
            <div className={cn('flex items-center gap-1 text-xs', statusInfo.color)}>
                <StatusIcon className="w-3 h-3" />
                <span>{statusInfo.text}</span>
            </div>

            {/* 当前代理商名称 */}
            {status.currentProvider && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-full px-2">
                    {status.currentProvider.name}
                </span>
            )}
        </button>
    );
}

export default EngineCard;

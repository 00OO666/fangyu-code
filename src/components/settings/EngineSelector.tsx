/**
 * EngineSelector - 引擎选择器组件
 * 
 * 用于在设置页面中切换不同引擎的配置
 * 支持 Claude Code、Codex、Gemini 三种引擎
 * 
 * Feature: settings-refactor
 * Task: 2.1, 2.2
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { EngineType, ENGINE_INFO } from '@/types/multiEngineSettings';
import { ClaudeEngineIcon, CodexEngineIcon, GeminiEngineIcon } from '@/components/icons/EngineIcons';

interface EngineSelectorProps {
    /** 当前选中的引擎 */
    selectedEngine: EngineType;
    /** 引擎切换回调 */
    onEngineChange: (engine: EngineType) => void;
    /** 自定义类名 */
    className?: string;
    /** 是否显示引擎描述 */
    showDescription?: boolean;
    /** 尺寸 */
    size?: 'sm' | 'md' | 'lg';
}

/** 引擎图标映射 */
const ENGINE_ICONS: Record<EngineType, React.FC<{ size?: number; className?: string }>> = {
    'claude-code': ClaudeEngineIcon,
    'codex': CodexEngineIcon,
    'gemini': GeminiEngineIcon,
};

/** 尺寸配置 */
const SIZE_CONFIG = {
    sm: { icon: 16, padding: 'px-2 py-1', text: 'text-xs', gap: 'gap-1' },
    md: { icon: 20, padding: 'px-3 py-2', text: 'text-sm', gap: 'gap-2' },
    lg: { icon: 24, padding: 'px-4 py-3', text: 'text-base', gap: 'gap-3' },
};

export const EngineSelector: React.FC<EngineSelectorProps> = ({
    selectedEngine,
    onEngineChange,
    className,
    showDescription = false,
    size = 'md',
}) => {
    const sizeConfig = SIZE_CONFIG[size];
    const engines: EngineType[] = ['claude-code', 'codex', 'gemini'];

    return (
        <div className={cn('flex items-center gap-1 p-1 bg-muted/50 rounded-lg', className)}>
            {engines.map((engine) => {
                const info = ENGINE_INFO[engine];
                const Icon = ENGINE_ICONS[engine];
                const isSelected = selectedEngine === engine;

                return (
                    <button
                        key={engine}
                        onClick={() => onEngineChange(engine)}
                        className={cn(
                            'flex items-center rounded-md transition-all duration-200',
                            sizeConfig.padding,
                            sizeConfig.gap,
                            isSelected
                                ? 'bg-background shadow-sm ring-1 ring-border'
                                : 'hover:bg-background/50'
                        )}
                        title={showDescription ? undefined : info.description}
                    >
                        <Icon
                            size={sizeConfig.icon}
                            className={cn(
                                'transition-opacity',
                                isSelected ? 'opacity-100' : 'opacity-60'
                            )}
                        />
                        <span
                            className={cn(
                                sizeConfig.text,
                                'font-medium transition-colors',
                                isSelected ? 'text-foreground' : 'text-muted-foreground'
                            )}
                        >
                            {info.shortName}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

/** 紧凑版引擎选择器（仅图标） */
export const EngineIconSelector: React.FC<Omit<EngineSelectorProps, 'showDescription'>> = ({
    selectedEngine,
    onEngineChange,
    className,
    size = 'md',
}) => {
    const sizeConfig = SIZE_CONFIG[size];
    const engines: EngineType[] = ['claude-code', 'codex', 'gemini'];

    return (
        <div className={cn('flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-md', className)}>
            {engines.map((engine) => {
                const info = ENGINE_INFO[engine];
                const Icon = ENGINE_ICONS[engine];
                const isSelected = selectedEngine === engine;

                return (
                    <button
                        key={engine}
                        onClick={() => onEngineChange(engine)}
                        className={cn(
                            'p-1.5 rounded transition-all duration-200',
                            isSelected
                                ? 'bg-background shadow-sm'
                                : 'hover:bg-background/50 opacity-50 hover:opacity-75'
                        )}
                        title={info.name}
                    >
                        <Icon size={sizeConfig.icon} />
                    </button>
                );
            })}
        </div>
    );
};

export default EngineSelector;

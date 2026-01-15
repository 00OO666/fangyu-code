/**
 * 引擎卡片网格组件
 */

import React, { useCallback, useState } from 'react';
import type { EngineType, EngineStatusInfo } from '../../types/provider';
import { EngineCard } from './EngineCard';
import { EngineInstaller } from './EngineInstaller';

interface EngineCardGridProps {
    engines: EngineStatusInfo[];
    currentEngine: EngineType;
    onEngineSelect: (engine: EngineType) => void;
    onRefreshStatus?: () => void;
}

const ALL_ENGINES: EngineType[] = ['claude', 'codex', 'gemini', 'siliconflow'];

export function EngineCardGrid({
    engines,
    currentEngine,
    onEngineSelect,
    onRefreshStatus,
}: EngineCardGridProps) {
    // 当前正在安装的引擎
    const [installingEngine, setInstallingEngine] = useState<EngineType | null>(null);

    // 键盘导航
    const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
        let nextIndex = currentIndex;

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                nextIndex = (currentIndex + 1) % ALL_ENGINES.length;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                nextIndex = (currentIndex - 1 + ALL_ENGINES.length) % ALL_ENGINES.length;
                break;
            case 'Home':
                e.preventDefault();
                nextIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                nextIndex = ALL_ENGINES.length - 1;
                break;
            default:
                return;
        }

        onEngineSelect(ALL_ENGINES[nextIndex]);
    }, [onEngineSelect]);

    // 处理安装按钮点击
    const handleInstallClick = useCallback((engine: EngineType, e: React.MouseEvent) => {
        e.stopPropagation();
        setInstallingEngine(engine);
    }, []);

    // 处理安装完成
    const handleInstallComplete = useCallback(() => {
        onRefreshStatus?.();
    }, [onRefreshStatus]);

    // 关闭安装面板
    const handleCloseInstaller = useCallback(() => {
        setInstallingEngine(null);
    }, []);

    return (
        <div className="space-y-4">
            <div
                role="radiogroup"
                aria-label="选择 AI 引擎"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
                {ALL_ENGINES.map((engine, index) => {
                    const status = engines.find(e => e.engine === engine) || {
                        engine,
                        installed: false,
                        connectionStatus: 'unknown' as const,
                    };
                    const isActive = engine === currentEngine;

                    return (
                        <div
                            key={engine}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            tabIndex={isActive ? 0 : -1}
                            className="relative"
                        >
                            <EngineCard
                                engine={engine}
                                status={status}
                                isActive={isActive}
                                onClick={() => onEngineSelect(engine)}
                            />
                            {/* 安装按钮 - 仅在未安装时显示 */}
                            {!status.installed && (
                                <button
                                    onClick={(e) => handleInstallClick(engine, e)}
                                    className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    aria-label={`安装 ${engine}`}
                                >
                                    安装
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 安装面板 */}
            {installingEngine && (
                <EngineInstaller
                    engine={installingEngine}
                    onInstallComplete={handleInstallComplete}
                    onClose={handleCloseInstaller}
                />
            )}
        </div>
    );
}

export default EngineCardGrid;

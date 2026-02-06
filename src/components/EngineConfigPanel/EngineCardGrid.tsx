/**
 * 引擎卡片网格组件
 */

import React, { useCallback, useState, useEffect } from 'react';
import type { EngineType, EngineStatusInfo } from '../../types/provider';
import { EngineCard } from './EngineCard';
import { EngineInstaller } from './EngineInstaller';
import { SetupWizard } from './OneClickSetup';
import { getEngineConfigStatus, type ConfigStatus } from '../../services/setupStateService';

interface EngineCardGridProps {
    engines: EngineStatusInfo[];
    currentEngine: EngineType;
    onEngineSelect: (engine: EngineType) => void;
    onRefreshStatus?: () => void;
}

const ALL_ENGINES: EngineType[] = ['claude', 'codex', 'gemini'];

export function EngineCardGrid({
    engines,
    currentEngine,
    onEngineSelect,
    onRefreshStatus,
}: EngineCardGridProps) {
    // 当前正在安装的引擎
    const [installingEngine, setInstallingEngine] = useState<EngineType | null>(null);
    // 当前正在配置的引擎（一键配置向导）
    const [configuringEngine, setConfiguringEngine] = useState<EngineType | null>(null);
    // 各引擎的配置状态
    const [configStatuses, setConfigStatuses] = useState<Record<EngineType, ConfigStatus>>({} as Record<EngineType, ConfigStatus>);

    // 加载配置状态
    useEffect(() => {
        const loadConfigStatuses = async () => {
            const statuses: Record<EngineType, ConfigStatus> = {} as Record<EngineType, ConfigStatus>;
            for (const engine of ALL_ENGINES) {
                statuses[engine] = await getEngineConfigStatus(engine);
            }
            setConfigStatuses(statuses);
        };
        loadConfigStatuses();
    }, []);

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

    // 处理一键配置按钮点击
    const handleSetupClick = useCallback((engine: EngineType, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfiguringEngine(engine);
    }, []);

    // 处理安装完成
    const handleInstallComplete = useCallback(() => {
        onRefreshStatus?.();
    }, [onRefreshStatus]);

    // 处理配置完成
    const handleSetupComplete = useCallback(async () => {
        setConfiguringEngine(null);
        // 刷新配置状态
        const statuses: Record<EngineType, ConfigStatus> = {} as Record<EngineType, ConfigStatus>;
        for (const engine of ALL_ENGINES) {
            statuses[engine] = await getEngineConfigStatus(engine);
        }
        setConfigStatuses(statuses);
        onRefreshStatus?.();
    }, [onRefreshStatus]);

    // 关闭安装面板
    const handleCloseInstaller = useCallback(() => {
        setInstallingEngine(null);
    }, []);

    // 关闭配置向导
    const handleCloseSetupWizard = useCallback(() => {
        setConfiguringEngine(null);
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
                    const configStatus = configStatuses[engine];
                    const isFullyConfigured = configStatus?.isFullyConfigured ?? false;

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
                            {/* 一键配置按钮 - 未完全配置时显示 */}
                            {!isFullyConfigured && (
                                <button
                                    onClick={(e) => handleSetupClick(engine, e)}
                                    className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                    aria-label={`一键配置 ${engine}`}
                                >
                                    一键配置
                                </button>
                            )}
                            {/* 已配置标记 */}
                            {isFullyConfigured && (
                                <span className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                                    已配置
                                </span>
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

            {/* 一键配置向导 */}
            {configuringEngine && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <SetupWizard
                            engine={configuringEngine}
                            onComplete={handleSetupComplete}
                            onCancel={handleCloseSetupWizard}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default EngineCardGrid;

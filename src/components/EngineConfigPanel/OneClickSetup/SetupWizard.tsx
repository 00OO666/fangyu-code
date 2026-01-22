/**
 * 配置向导主组件
 * 管理引擎一键配置的完整流程
 */

import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect, useMemo } from 'react';
import X from 'lucide-react/dist/esm/icons/x'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import type { EngineType } from '../../../types/provider';
import { ENGINE_DISPLAY_NAMES } from '../../../types/provider';
import {
    ENGINE_SETUP_STEPS,
    getSetupProgress,
    saveSetupProgress,
    resetSetupProgress,
    createInitialProgress,
    getStepDisplayStatus,
    type SetupStep,
    type EngineSetupProgress,
} from '../../../services/setupStateService';
import { StepIndicator } from './StepIndicator';
import { DependencyChecker, type DependencyStatus } from './DependencyChecker';
import { cn } from '../../../lib/utils';

// 懒加载引擎特定配置组件
import { ClaudeSetup } from './ClaudeSetup';
import { CodexSetup } from './CodexSetup';
import { GeminiSetup } from './GeminiSetup';
import { SiliconFlowSetup } from './SiliconFlowSetup';

interface SetupWizardProps {
    engine: EngineType;
    onComplete: () => void;
    onCancel: () => void;
}

export function SetupWizard({ engine, onComplete, onCancel }: SetupWizardProps) {
    const [progress, setProgress] = useState<EngineSetupProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null);

    // 获取当前引擎的步骤定义
    const stepDefinitions = useMemo(() => ENGINE_SETUP_STEPS[engine], [engine]);

    // 计算带状态的步骤列表
    const stepsWithStatus = useMemo((): SetupStep[] => {
        if (!progress) {
            return stepDefinitions.map((step, index) => ({
                ...step,
                status: index === 0 ? 'in_progress' : 'pending',
            }));
        }

        return stepDefinitions.map((step, index) => ({
            ...step,
            status: getStepDisplayStatus(
                step.id,
                progress.currentStep,
                progress.completedSteps,
                stepDefinitions
            ),
        }));
    }, [stepDefinitions, progress]);

    // 当前步骤索引
    const currentStepIndex = progress?.currentStep ?? 0;
    const currentStep = stepsWithStatus[currentStepIndex];

    // 加载配置进度
    useEffect(() => {
        const loadProgress = async () => {
            setIsLoading(true);
            try {
                const savedProgress = await getSetupProgress(engine);
                if (savedProgress) {
                    setProgress(savedProgress);
                    addLog(`恢复配置进度，当前步骤: ${savedProgress.currentStep + 1}`);
                } else {
                    const initial = createInitialProgress(engine);
                    initial.status = 'in_progress';
                    setProgress(initial);
                    addLog('开始新的配置流程');
                }
            } catch (error) {
                logger.error('SetupWizard', 'Failed to load progress:', error);
                const initial = createInitialProgress(engine);
                initial.status = 'in_progress';
                setProgress(initial);
            }
            setIsLoading(false);
        };

        loadProgress();
    }, [engine]);

    // 添加日志
    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    }, []);

    // 更新进度
    const updateProgress = useCallback(async (updates: Partial<EngineSetupProgress>) => {
        setProgress(prev => {
            if (!prev) return prev;
            const newProgress = { ...prev, ...updates, lastUpdated: Date.now() };
            saveSetupProgress(newProgress).catch(console.error);
            return newProgress;
        });
    }, []);

    // 完成当前步骤
    const completeCurrentStep = useCallback(async (configData?: Record<string, unknown>) => {
        if (!progress || !currentStep) return;

        const newCompletedSteps = [...progress.completedSteps];
        if (!newCompletedSteps.includes(currentStep.id)) {
            newCompletedSteps.push(currentStep.id);
        }

        const nextStepIndex = currentStepIndex + 1;
        const isLastStep = nextStepIndex >= stepDefinitions.length;

        await updateProgress({
            completedSteps: newCompletedSteps,
            currentStep: nextStepIndex,
            status: isLastStep ? 'completed' : 'in_progress',
            configData: configData ? { ...progress.configData, ...configData } : progress.configData,
        });

        addLog(`✓ 完成步骤: ${currentStep.title}`);

        if (isLastStep) {
            addLog('🎉 配置完成！');
            onComplete();
        }
    }, [progress, currentStep, currentStepIndex, stepDefinitions.length, updateProgress, addLog, onComplete]);

    // 跳过当前步骤（仅可选步骤）
    const skipCurrentStep = useCallback(async () => {
        if (!progress || !currentStep?.optional) return;

        const nextStepIndex = currentStepIndex + 1;
        const isLastStep = nextStepIndex >= stepDefinitions.length;

        await updateProgress({
            currentStep: nextStepIndex,
            status: isLastStep ? 'completed' : 'in_progress',
        });

        addLog(`⏭ 跳过步骤: ${currentStep.title}`);

        if (isLastStep) {
            addLog('🎉 配置完成！');
            onComplete();
        }
    }, [progress, currentStep, currentStepIndex, stepDefinitions.length, updateProgress, addLog, onComplete]);

    // 返回上一步
    const goToPreviousStep = useCallback(async () => {
        if (!progress || currentStepIndex <= 0) return;

        await updateProgress({
            currentStep: currentStepIndex - 1,
        });

        addLog(`← 返回步骤: ${stepDefinitions[currentStepIndex - 1].title}`);
    }, [progress, currentStepIndex, stepDefinitions, updateProgress, addLog]);

    // 重新开始
    const handleReset = useCallback(async () => {
        await resetSetupProgress(engine);
        const initial = createInitialProgress(engine);
        initial.status = 'in_progress';
        setProgress(initial);
        setLogs([]);
        setDependencyStatus(null);
        addLog('重新开始配置流程');
    }, [engine, addLog]);

    // 处理依赖检测完成
    const handleDependencyCheckComplete = useCallback((status: DependencyStatus) => {
        setDependencyStatus(status);
        
        // 检查是否满足要求
        const requiresCli = engine !== 'siliconflow';
        const depsOk = status.nodejs.installed && 
                       status.nodejs.meetsRequirement && 
                       status.npm.installed &&
                       (!requiresCli || status.cli.installed);

        if (depsOk) {
            addLog('✓ 环境检测通过');
        } else {
            addLog('⚠ 环境检测发现问题');
        }
    }, [engine, addLog]);

    // 渲染当前步骤的内容
    const renderStepContent = () => {
        if (!currentStep) return null;

        // 检查依赖步骤
        if (currentStep.id === 'check_deps') {
            return (
                <DependencyChecker
                    engine={engine}
                    onCheckComplete={handleDependencyCheckComplete}
                />
            );
        }

        // 根据引擎类型渲染对应的配置组件
        const commonProps = {
            currentStep: currentStep.id,
            dependencyStatus,
            onStepComplete: completeCurrentStep,
            onLog: addLog,
        };

        switch (engine) {
            case 'claude':
                return <ClaudeSetup {...commonProps} />;
            case 'codex':
                return <CodexSetup {...commonProps} />;
            case 'gemini':
                return <GeminiSetup {...commonProps} />;
            case 'siliconflow':
                return <SiliconFlowSetup {...commonProps} progress={progress} />;
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        配置 {ENGINE_DISPLAY_NAMES[engine]}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        步骤 {currentStepIndex + 1} / {stepDefinitions.length}
                    </p>
                </div>
                <button
                    onClick={onCancel}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex">
                {/* 左侧步骤指示器 */}
                <div className="w-64 p-4 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                    <StepIndicator
                        steps={stepsWithStatus}
                        currentStep={currentStepIndex}
                    />
                </div>

                {/* 右侧内容区 */}
                <div className="flex-1 p-6">
                    {/* 当前步骤标题 */}
                    <div className="mb-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {currentStep?.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {currentStep?.description}
                        </p>
                    </div>

                    {/* 步骤内容 */}
                    <div className="min-h-[200px]">
                        {renderStepContent()}
                    </div>

                    {/* 日志区域 */}
                    {logs.length > 0 && (
                        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <button
                                onClick={() => setShowLogs(!showLogs)}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {showLogs ? '隐藏日志' : '显示日志'} ({logs.length})
                            </button>
                            {showLogs && (
                                <div className="mt-2 max-h-32 overflow-y-auto p-2 bg-gray-900 rounded-lg">
                                    {logs.map((log, i) => (
                                        <div key={i} className="text-xs font-mono text-gray-300">
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 底部操作栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                        <RotateCcw className="w-4 h-4" />
                        重新开始
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* 上一步 */}
                    <button
                        onClick={goToPreviousStep}
                        disabled={currentStepIndex <= 0}
                        className={cn(
                            'flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                            currentStepIndex <= 0
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        )}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        上一步
                    </button>

                    {/* 跳过（仅可选步骤） */}
                    {currentStep?.optional && (
                        <button
                            onClick={skipCurrentStep}
                            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                        >
                            <SkipForward className="w-4 h-4" />
                            跳过
                        </button>
                    )}

                    {/* 下一步/完成 */}
                    <button
                        onClick={() => completeCurrentStep()}
                        disabled={currentStep?.id === 'check_deps' && (!dependencyStatus || !dependencyStatus.nodejs.meetsRequirement)}
                        className={cn(
                            'flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                            currentStep?.id === 'check_deps' && (!dependencyStatus || !dependencyStatus.nodejs.meetsRequirement)
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                        )}
                    >
                        {currentStepIndex >= stepDefinitions.length - 1 ? '完成' : '下一步'}
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SetupWizard;

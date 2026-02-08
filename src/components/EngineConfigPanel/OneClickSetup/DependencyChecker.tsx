/**
 * 依赖检查器组件
 * 检测 Node.js、npm 和 CLI 工具的安装状态
 */

import { useCallback, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import type { EngineType } from '../../../types/provider';
import { cn } from '../../../lib/utils';
import { checkBinary, executeCommand } from '../../../core/tauri/SuperAgentBridge';
import { getCliConfig, installCli } from '../../../lib/cliInstaller';
import {
    isDependenciesSatisfied,
    useDependencyStateMachine,
    type DependencyStatus,
} from '../../../hooks/useDependencyStateMachine';
import { parseNodeVersion, isNodeVersionValid } from '../EngineInstaller';
import {
    CheckingView,
    DoneView,
    ErrorView,
    InstallingView,
} from './StateViews';

interface DependencyCheckerProps {
    engine: EngineType;
    onCheckComplete: (status: DependencyStatus) => void;
    autoCheck?: boolean;
    requiresCli?: boolean;
}

const CHECK_TIMEOUT_MS = 10 * 1000;

const EMPTY_DEPENDENCIES: DependencyStatus = {
    nodejs: { installed: false, meetsRequirement: false },
    npm: { installed: false },
    cli: { installed: false },
};

export function DependencyChecker({
    engine,
    onCheckComplete,
    autoCheck = true,
    requiresCli = true,
}: DependencyCheckerProps) {
    const { state, actions, canRetry } = useDependencyStateMachine({ requiresCli });
    const cliConfig = useMemo(() => getCliConfig(engine), [engine]);

    const buildVersionCommand = useCallback((binaryPath: string, args: string) => {
        const trimmed = binaryPath.trim();
        if (!trimmed) return args;
        if (trimmed.includes(' ')) {
            return `"${trimmed}" ${args}`;
        }
        return `${trimmed} ${args}`;
    }, []);

    const resolveVersionFallback = useCallback(
        async (binaryPath: string, args: string) => {
            try {
                const result = await executeCommand(
                    buildVersionCommand(binaryPath, args),
                    { timeoutMs: CHECK_TIMEOUT_MS }
                );
                return result.success ? result.stdout.trim() : undefined;
            } catch {
                return undefined;
            }
        },
        [buildVersionCommand]
    );

    const checkNodejs = useCallback(async (): Promise<DependencyStatus['nodejs']> => {
        try {
            let binaryResult;
            try {
                binaryResult = await checkBinary('node');
            } catch {
                binaryResult = null;
            }

            if (binaryResult?.installed) {
                let version = binaryResult.version;
                if (!version && binaryResult.path) {
                    version = await resolveVersionFallback(binaryResult.path, '--version');
                }

                if (!version) {
                    const fallback = await executeCommand('node --version', {
                        timeoutMs: CHECK_TIMEOUT_MS,
                    });
                    if (fallback.success) {
                        version = fallback.stdout.trim();
                    }
                }

                const majorVersion = version ? parseNodeVersion(version) : null;

                return {
                    installed: true,
                    version,
                    meetsRequirement: majorVersion ? isNodeVersionValid(majorVersion) : true,
                };
            }

            const legacy = await executeCommand('node --version', {
                timeoutMs: CHECK_TIMEOUT_MS,
            });

            if (!legacy.success) {
                return { installed: false, meetsRequirement: false };
            }

            const version = legacy.stdout.trim();
            const majorVersion = parseNodeVersion(version);

            return {
                installed: true,
                version,
                meetsRequirement: majorVersion !== null && isNodeVersionValid(majorVersion),
            };
        } catch {
            return { installed: false, meetsRequirement: false };
        }
    }, [resolveVersionFallback]);

    const checkNpm = useCallback(async (): Promise<DependencyStatus['npm']> => {
        try {
            let binaryResult;
            try {
                binaryResult = await checkBinary('npm');
            } catch {
                binaryResult = null;
            }

            if (binaryResult?.installed) {
                let version = binaryResult.version;
                if (!version && binaryResult.path) {
                    version = await resolveVersionFallback(binaryResult.path, '--version');
                }

                if (!version) {
                    const fallback = await executeCommand('npm --version', {
                        timeoutMs: CHECK_TIMEOUT_MS,
                    });
                    if (fallback.success) {
                        version = fallback.stdout.trim();
                    }
                }

                return {
                    installed: true,
                    version,
                };
            }

            const legacy = await executeCommand('npm --version', {
                timeoutMs: CHECK_TIMEOUT_MS,
            });

            if (!legacy.success) {
                return { installed: false };
            }

            return {
                installed: true,
                version: legacy.stdout.trim(),
            };
        } catch {
            return { installed: false };
        }
    }, [resolveVersionFallback]);

    const checkCli = useCallback(async (): Promise<DependencyStatus['cli']> => {
        try {
            let binaryResult;
            try {
                binaryResult = await checkBinary(cliConfig.command);
            } catch {
                binaryResult = null;
            }

            if (binaryResult?.installed) {
                let version = binaryResult.version;
                if (!version && binaryResult.path) {
                    version = await resolveVersionFallback(binaryResult.path, cliConfig.versionArg);
                }

                if (!version) {
                    const fallback = await executeCommand(
                        `${cliConfig.command} ${cliConfig.versionArg}`,
                        { timeoutMs: CHECK_TIMEOUT_MS }
                    );
                    if (fallback.success) {
                        version = fallback.stdout.trim();
                    }
                }

                return {
                    installed: true,
                    version,
                    path: binaryResult.path,
                };
            }

            const result = await executeCommand(
                `${cliConfig.command} ${cliConfig.versionArg}`,
                { timeoutMs: CHECK_TIMEOUT_MS }
            );

            if (!result.success) {
                return { installed: false };
            }

            return {
                installed: true,
                version: result.stdout.trim(),
            };
        } catch {
            return { installed: false };
        }
    }, [cliConfig.command, cliConfig.versionArg, resolveVersionFallback]);

    const runCheck = useCallback(async () => {
        actions.startCheck();

        try {
            const [nodejs, npm, cli] = await Promise.all([
                checkNodejs(),
                checkNpm(),
                checkCli(),
            ]);

            const dependencies: DependencyStatus = { nodejs, npm, cli };
            actions.checkSuccess(dependencies);
            onCheckComplete(dependencies);
        } catch (error) {
            const message = error instanceof Error ? error.message : '检查失败';
            actions.checkFailure(message);
        }
    }, [actions, checkNodejs, checkNpm, checkCli, onCheckComplete]);

    useEffect(() => {
        if (autoCheck) {
            runCheck();
        }
    }, [autoCheck, runCheck]);

    useEffect(() => {
        if (state.phase !== 'INSTALLING' || !requiresCli) {
            return;
        }

        let cancelled = false;

        const runInstall = async () => {
            actions.clearLogs();

            const result = await installCli(engine, {
                onProgress: (progress) => {
                    actions.appendLog(progress.message);
                },
            });

            if (cancelled) {
                return;
            }

            if (result.success) {
                const cli = await checkCli();
                const baseDependencies = state.context.dependencies ?? EMPTY_DEPENDENCIES;
                const nextDependencies: DependencyStatus = {
                    ...baseDependencies,
                    cli,
                };

                actions.installSuccess(nextDependencies);
                onCheckComplete(nextDependencies);
                return;
            }

            actions.installFailure(result.error ?? '安装失败');
        };

        runInstall();

        return () => {
            cancelled = true;
        };
    }, [
        actions,
        checkCli,
        engine,
        onCheckComplete,
        requiresCli,
        state.context.dependencies,
        state.phase,
    ]);

    useEffect(() => {
        const isCheckError = state.phase === 'ERROR' && !state.context.dependencies;
        if (state.phase !== 'ERROR' || isCheckError || !canRetry) {
            return;
        }

        actions.retryInstall();
    }, [actions, canRetry, state.context.dependencies, state.phase]);

    const handleDownloadNode = useCallback(async () => {
        await open('https://nodejs.org/en/download/');
    }, []);

    const handleRetry = useCallback(() => {
        if (!state.context.dependencies) {
            runCheck();
            return;
        }

        actions.clearLogs();
        actions.retryInstall();
    }, [actions, runCheck, state.context.dependencies]);

    const handleManualRetry = useCallback(() => {
        actions.clearLogs();
        actions.manualRetry();
    }, [actions]);

    const handleSkip = useCallback(() => {
        actions.skipInstall();
        if (state.context.dependencies) {
            onCheckComplete(state.context.dependencies);
        }
    }, [actions, onCheckComplete, state.context.dependencies]);

    const isCheckError = useMemo(
        () => state.phase === 'ERROR' && !state.context.dependencies,
        [state.context.dependencies, state.phase]
    );
    const showManualRetry = useMemo(
        () => !isCheckError && !canRetry,
        [canRetry, isCheckError]
    );
    const showSkip = useMemo(
        () => !isCheckError && requiresCli,
        [isCheckError, requiresCli]
    );

    const dependencies = useMemo(
        () => state.context.dependencies ?? EMPTY_DEPENDENCIES,
        [state.context.dependencies]
    );
    const allSatisfied = useMemo(
        () => isDependenciesSatisfied(dependencies, requiresCli),
        [dependencies, requiresCli]
    );

    const renderContent = () => {
        switch (state.phase) {
            case 'CHECKING':
                return <CheckingView />;
            case 'INSTALLING':
                return <InstallingView logs={state.context.logs} />;
            case 'ERROR':
                return (
                    <ErrorView
                        error={state.context.error ?? '安装失败'}
                        logs={state.context.logs}
                        canRetry={canRetry}
                        onRetry={handleRetry}
                        onManualRetry={showManualRetry ? handleManualRetry : undefined}
                        onSkip={showSkip ? handleSkip : undefined}
                        retryLabel={isCheckError ? '重新检测' : '重试安装'}
                        retryCount={state.context.retryCount}
                        maxRetries={state.context.maxRetries}
                    />
                );
            case 'DONE':
                return (
                    <DoneView
                        dependencies={dependencies}
                        requiresCli={requiresCli}
                        cliName={cliConfig.name}
                        onDownloadNode={handleDownloadNode}
                        showSuccess={allSatisfied}
                    />
                );
            case 'IDLE':
            default:
                return <CheckingView message="等待检测..." />;
        }
    };

    return (
        <div className="space-y-4">
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    环境检测
                </h4>
                <button
                    onClick={runCheck}
                    disabled={state.phase === 'CHECKING'}
                    className={cn(
                        'flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600',
                        state.phase === 'CHECKING' && 'opacity-50 cursor-not-allowed'
                    )}
                >
                    <RefreshCw
                        className={cn(
                            'w-3 h-3',
                            state.phase === 'CHECKING' && 'animate-spin'
                        )}
                    />
                    重新检测
                </button>
            </div>

            {renderContent()}
        </div>
    );
}

export type { DependencyStatus };

export default DependencyChecker;

/**
 * 依赖检查器组件
 * 检测 Node.js、npm 和 CLI 工具的安装状态
 */

import { useState, useCallback, useEffect } from 'react';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import type { EngineType } from '../../../types/provider';
import { cn } from '../../../lib/utils';
import { parseNodeVersion, isNodeVersionValid } from '../EngineInstaller';

// 依赖状态接口
export interface DependencyStatus {
    nodejs: {
        installed: boolean;
        version?: string;
        meetsRequirement: boolean;
    };
    npm: {
        installed: boolean;
        version?: string;
    };
    cli: {
        installed: boolean;
        version?: string;
        path?: string;
    };
}

interface DependencyCheckerProps {
    engine: EngineType;
    onCheckComplete: (status: DependencyStatus) => void;
    autoCheck?: boolean;
}

// CLI 命令映射
const CLI_COMMANDS: Record<EngineType, { name: string; command: string; versionArg: string }> = {
    claude: { name: 'Claude Code', command: 'claude', versionArg: '--version' },
    codex: { name: 'Codex CLI', command: 'codex', versionArg: '--version' },
    gemini: { name: 'Gemini CLI', command: 'gemini', versionArg: '--version' },
    siliconflow: { name: 'SiliconFlow', command: '', versionArg: '' }, // 无需 CLI
};

type CheckStatus = 'idle' | 'checking' | 'done';

export function DependencyChecker({
    engine,
    onCheckComplete,
    autoCheck = true,
}: DependencyCheckerProps) {
    const [status, setStatus] = useState<CheckStatus>('idle');
    const [dependencies, setDependencies] = useState<DependencyStatus>({
        nodejs: { installed: false, meetsRequirement: false },
        npm: { installed: false },
        cli: { installed: false },
    });
    const [error, setError] = useState<string | null>(null);

    const cliInfo = CLI_COMMANDS[engine];
    const requiresCli = engine !== 'siliconflow';

    // 检查 Node.js
    const checkNodejs = useCallback(async (): Promise<DependencyStatus['nodejs']> => {
        try {
            const result = await invoke<string>('execute_command', {
                command: 'node',
                args: ['--version'],
            });
            const version = result.trim();
            const majorVersion = parseNodeVersion(version);
            
            return {
                installed: true,
                version,
                meetsRequirement: majorVersion !== null && isNodeVersionValid(majorVersion),
            };
        } catch {
            return { installed: false, meetsRequirement: false };
        }
    }, []);

    // 检查 npm
    const checkNpm = useCallback(async (): Promise<DependencyStatus['npm']> => {
        try {
            const result = await invoke<string>('execute_command', {
                command: 'npm',
                args: ['--version'],
            });
            return {
                installed: true,
                version: result.trim(),
            };
        } catch {
            return { installed: false };
        }
    }, []);

    // 检查 CLI 工具
    const checkCli = useCallback(async (): Promise<DependencyStatus['cli']> => {
        if (!requiresCli) {
            return { installed: true }; // SiliconFlow 不需要 CLI
        }

        try {
            const result = await invoke<string>('execute_command', {
                command: cliInfo.command,
                args: [cliInfo.versionArg],
            });
            return {
                installed: true,
                version: result.trim(),
            };
        } catch {
            return { installed: false };
        }
    }, [requiresCli, cliInfo]);

    // 执行完整检查
    const runCheck = useCallback(async () => {
        setStatus('checking');
        setError(null);

        try {
            const [nodejs, npm, cli] = await Promise.all([
                checkNodejs(),
                checkNpm(),
                checkCli(),
            ]);

            const newStatus: DependencyStatus = { nodejs, npm, cli };
            setDependencies(newStatus);
            setStatus('done');
            onCheckComplete(newStatus);
        } catch (err) {
            setError(err instanceof Error ? err.message : '检查失败');
            setStatus('done');
        }
    }, [checkNodejs, checkNpm, checkCli, onCheckComplete]);

    // 自动检查
    useEffect(() => {
        if (autoCheck) {
            runCheck();
        }
    }, [autoCheck, runCheck]);

    // 打开 Node.js 下载页面
    const handleDownloadNode = useCallback(async () => {
        await open('https://nodejs.org/en/download/');
    }, []);

    // 渲染依赖项状态
    const renderDependencyItem = (
        name: string,
        installed: boolean,
        version?: string,
        meetsRequirement?: boolean,
        requirementText?: string
    ) => {
        const isOk = installed && (meetsRequirement === undefined || meetsRequirement);
        
        return (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    {status === 'checking' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    ) : isOk ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {version && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {version}
                        </span>
                    )}
                    {!installed && (
                        <span className="text-xs text-red-500">未安装</span>
                    )}
                    {installed && meetsRequirement === false && (
                        <span className="text-xs text-yellow-500">
                            {requirementText || '版本不满足'}
                        </span>
                    )}
                </div>
            </div>
        );
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
                    disabled={status === 'checking'}
                    className={cn(
                        'flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600',
                        status === 'checking' && 'opacity-50 cursor-not-allowed'
                    )}
                >
                    <RefreshCw className={cn('w-3 h-3', status === 'checking' && 'animate-spin')} />
                    重新检测
                </button>
            </div>

            {/* 依赖列表 */}
            <div className="space-y-2">
                {renderDependencyItem(
                    'Node.js',
                    dependencies.nodejs.installed,
                    dependencies.nodejs.version,
                    dependencies.nodejs.meetsRequirement,
                    '需要 18+'
                )}
                {renderDependencyItem(
                    'npm',
                    dependencies.npm.installed,
                    dependencies.npm.version
                )}
                {requiresCli && renderDependencyItem(
                    cliInfo.name,
                    dependencies.cli.installed,
                    dependencies.cli.version
                )}
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {/* Node.js 未安装提示 */}
            {status === 'done' && !dependencies.nodejs.installed && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                未检测到 Node.js，请先安装 Node.js 18 或更高版本。
                            </p>
                            <button
                                onClick={handleDownloadNode}
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                            >
                                <ExternalLink className="w-3 h-3" />
                                下载 Node.js
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Node.js 版本过低提示 */}
            {status === 'done' && dependencies.nodejs.installed && !dependencies.nodejs.meetsRequirement && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Node.js 版本过低（当前 {dependencies.nodejs.version}），需要 18 或更高版本。
                            </p>
                            <button
                                onClick={handleDownloadNode}
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                            >
                                <ExternalLink className="w-3 h-3" />
                                升级 Node.js
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 全部通过提示 */}
            {status === 'done' &&
                dependencies.nodejs.installed &&
                dependencies.nodejs.meetsRequirement &&
                dependencies.npm.installed &&
                (dependencies.cli.installed || !requiresCli) && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <p className="text-sm text-green-700 dark:text-green-300">
                            环境检测通过，可以继续配置
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DependencyChecker;

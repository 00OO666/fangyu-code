/**
 * Codex CLI 配置组件
 * 处理 Codex CLI 的安装和 ChatGPT 登录
 */

import { useState, useCallback } from 'react';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import LogIn from 'lucide-react/dist/esm/icons/log-in';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import type { DependencyStatus } from './DependencyChecker';
import { EngineInstaller } from '../EngineInstaller';
import { cn } from '../../../lib/utils';

interface CodexSetupProps {
    currentStep: string;
    dependencyStatus: DependencyStatus | null;
    onStepComplete: (configData?: Record<string, unknown>) => void;
    onLog: (message: string) => void;
}

export function CodexSetup({
    currentStep,
    dependencyStatus,
    onStepComplete,
    onLog,
}: CodexSetupProps) {
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [showInstaller, setShowInstaller] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // 安装 CLI
    const handleInstallComplete = useCallback(() => {
        onLog('✓ Codex CLI 安装完成');
        setShowInstaller(false);
        onStepComplete();
    }, [onLog, onStepComplete]);

    // 验证安装
    const handleVerifyInstall = useCallback(async () => {
        setIsVerifying(true);
        setVerifyError(null);
        onLog('验证 Codex CLI...');

        try {
            const result = await invoke<string>('execute_command', {
                command: 'codex',
                args: ['--version'],
            });
            onLog(`✓ Codex 版本: ${result.trim()}`);
            onStepComplete();
        } catch (error) {
            const msg = error instanceof Error ? error.message : '验证失败';
            setVerifyError(msg);
            onLog(`✗ 验证失败: ${msg}`);
        } finally {
            setIsVerifying(false);
        }
    }, [onLog, onStepComplete]);

    // 执行登录
    const handleLogin = useCallback(async () => {
        setIsLoggingIn(true);
        setVerifyError(null);
        onLog('启动 ChatGPT 登录...');

        try {
            // 执行 codex auth 命令
            await invoke<string>('execute_command', {
                command: 'codex',
                args: ['auth'],
            });
            onLog('✓ 登录成功');
            onStepComplete();
        } catch (error) {
            const msg = error instanceof Error ? error.message : '登录失败';
            setVerifyError(msg);
            onLog(`⚠ 登录过程: ${msg}`);
            // 即使有错误也允许继续，因为登录可能在浏览器中完成
        } finally {
            setIsLoggingIn(false);
        }
    }, [onLog, onStepComplete]);

    // 打开 OpenAI 文档
    const handleOpenDocs = useCallback(async () => {
        await open('https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started');
    }, []);

    // 根据当前步骤渲染内容
    switch (currentStep) {
        case 'install_cli':
            return (
                <div className="space-y-4">
                    {!dependencyStatus?.cli.installed ? (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                需要安装 Codex CLI 才能继续。
                            </p>
                            {showInstaller ? (
                                <EngineInstaller
                                    engine="codex"
                                    onInstallComplete={handleInstallComplete}
                                    onClose={() => setShowInstaller(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowInstaller(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    开始安装
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <div>
                                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                    Codex CLI 已安装
                                </p>
                                {dependencyStatus.cli.version && (
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                        版本: {dependencyStatus.cli.version}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );

        case 'login':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        使用 ChatGPT 账号登录以使用 Codex CLI。
                    </p>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                            点击下方按钮将打开浏览器进行登录。登录完成后返回此页面继续。
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleLogin}
                                disabled={isLoggingIn}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    isLoggingIn
                                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                )}
                            >
                                {isLoggingIn ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <LogIn className="w-4 h-4" />
                                )}
                                登录 ChatGPT
                            </button>
                            <button
                                onClick={handleOpenDocs}
                                className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                            >
                                <ExternalLink className="w-4 h-4" />
                                查看文档
                            </button>
                        </div>
                    </div>
                    {verifyError && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            {verifyError}
                        </p>
                    )}
                    <button
                        onClick={() => onStepComplete()}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        已完成登录，继续下一步
                    </button>
                </div>
            );

        case 'verify':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        验证 Codex CLI 是否正常工作。
                    </p>
                    <button
                        onClick={handleVerifyInstall}
                        disabled={isVerifying}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            isVerifying
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                        )}
                    >
                        {isVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
                        验证安装
                    </button>
                    {verifyError && (
                        <p className="text-sm text-red-500">{verifyError}</p>
                    )}
                </div>
            );

        default:
            return null;
    }
}

export default CodexSetup;

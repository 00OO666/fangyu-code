/**
 * Claude Code 配置组件
 * 处理 Claude Code CLI 的安装和 API 配置
 */

import { useState, useCallback } from 'react';
import Key from 'lucide-react/dist/esm/icons/key'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Server from 'lucide-react/dist/esm/icons/server';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import type { DependencyStatus } from './DependencyChecker';
import { EngineInstaller } from '../EngineInstaller';
import { cn } from '../../../lib/utils';

interface ClaudeSetupProps {
    currentStep: string;
    dependencyStatus: DependencyStatus | null;
    onStepComplete: (configData?: Record<string, unknown>) => void;
    onLog: (message: string) => void;
}

type ApiKeySource = 'direct' | 'provider';

export function ClaudeSetup({
    currentStep,
    dependencyStatus,
    onStepComplete,
    onLog,
}: ClaudeSetupProps) {
    const [apiKeySource, setApiKeySource] = useState<ApiKeySource>('direct');
    const [apiKey, setApiKey] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [showInstaller, setShowInstaller] = useState(false);

    // 安装 CLI
    const handleInstallComplete = useCallback(() => {
        onLog('✓ Claude Code CLI 安装完成');
        setShowInstaller(false);
        onStepComplete();
    }, [onLog, onStepComplete]);

    // 验证安装
    const handleVerifyInstall = useCallback(async () => {
        setIsVerifying(true);
        setVerifyError(null);
        onLog('验证 Claude Code CLI...');

        try {
            const result = await invoke<string>('execute_command', {
                command: 'claude',
                args: ['--version'],
            });
            onLog(`✓ Claude Code 版本: ${result.trim()}`);
            onStepComplete();
        } catch (error) {
            const msg = error instanceof Error ? error.message : '验证失败';
            setVerifyError(msg);
            onLog(`✗ 验证失败: ${msg}`);
        } finally {
            setIsVerifying(false);
        }
    }, [onLog, onStepComplete]);

    // 保存 API Key
    const handleSaveApiKey = useCallback(async () => {
        if (!apiKey.trim()) {
            setVerifyError('请输入 API Key');
            return;
        }

        setIsVerifying(true);
        setVerifyError(null);
        onLog('保存 API Key...');

        try {
            // 保存到 Claude Code 配置
            await invoke('save_claude_api_key', { apiKey: apiKey.trim() });
            onLog('✓ API Key 已保存');
            onStepComplete({ apiKey: apiKey.trim(), apiKeySource: 'direct' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : '保存失败';
            setVerifyError(msg);
            onLog(`✗ 保存失败: ${msg}`);
        } finally {
            setIsVerifying(false);
        }
    }, [apiKey, onLog, onStepComplete]);

    // 打开 Anthropic 控制台
    const handleOpenConsole = useCallback(async () => {
        await open('https://console.anthropic.com/settings/keys');
    }, []);

    // 根据当前步骤渲染内容
    switch (currentStep) {
        case 'install_cli':
            return (
                <div className="space-y-4">
                    {!dependencyStatus?.cli.installed ? (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                需要安装 Claude Code CLI 才能继续。
                            </p>
                            {showInstaller ? (
                                <EngineInstaller
                                    engine="claude"
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
                                    Claude Code CLI 已安装
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

        case 'config_api':
            return (
                <div className="space-y-4">
                    {/* API Key 来源选择 */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setApiKeySource('direct')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                                apiKeySource === 'direct'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            )}
                        >
                            <Key className="w-4 h-4" />
                            <span className="text-sm font-medium">直接输入 API Key</span>
                        </button>
                        <button
                            onClick={() => setApiKeySource('provider')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                                apiKeySource === 'provider'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            )}
                        >
                            <Server className="w-4 h-4" />
                            <span className="text-sm font-medium">使用代理商</span>
                        </button>
                    </div>

                    {apiKeySource === 'direct' ? (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Anthropic API Key
                                </label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="sk-ant-..."
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={handleOpenConsole}
                                    className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    获取 API Key
                                </button>
                                <button
                                    onClick={handleSaveApiKey}
                                    disabled={isVerifying || !apiKey.trim()}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                        isVerifying || !apiKey.trim()
                                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-blue-500 text-white hover:bg-blue-600'
                                    )}
                                >
                                    {isVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
                                    保存
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                请在引擎配置面板中添加代理商，然后选择使用。
                            </p>
                            <button
                                onClick={() => onStepComplete({ apiKeySource: 'provider' })}
                                className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                            >
                                跳过此步骤
                            </button>
                        </div>
                    )}

                    {verifyError && (
                        <p className="text-sm text-red-500">{verifyError}</p>
                    )}
                </div>
            );

        case 'verify':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        验证 Claude Code CLI 是否正常工作。
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

        case 'select_model':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        选择默认使用的 Claude 模型（可选）。
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-5-20251101'].map(model => (
                            <button
                                key={model}
                                onClick={() => onStepComplete({ defaultModel: model })}
                                className="p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {model.split('-').slice(1, 3).join(' ')}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            );

        default:
            return null;
    }
}

export default ClaudeSetup;

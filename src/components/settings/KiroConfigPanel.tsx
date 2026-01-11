/**
 * KiroConfigPanel - Kiro CLI 配置面板
 * 
 * 配置和管理 Kiro CLI（第五引擎）
 * 特点：无需 API Key，使用 OAuth 认证
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    getKiroStatus,
    getKiroModels,
    openKiroLogin,
    KiroStatus,
    KiroModel,
} from '../../lib/kiroApi';

// =============================================================================
// 类型定义
// =============================================================================

interface KiroConfigPanelProps {
    className?: string;
    onStatusChange?: (status: KiroStatus) => void;
}

// =============================================================================
// 主组件
// =============================================================================

export const KiroConfigPanel: React.FC<KiroConfigPanelProps> = ({
    className = '',
    onStatusChange,
}) => {
    const [status, setStatus] = useState<KiroStatus | null>(null);
    const [models, setModels] = useState<KiroModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('auto');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 加载状态
    const loadStatus = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const newStatus = await getKiroStatus();
            setStatus(newStatus);
            onStatusChange?.(newStatus);

            if (newStatus.installed) {
                const modelList = await getKiroModels();
                setModels(modelList);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载状态失败');
        } finally {
            setIsLoading(false);
        }
    }, [onStatusChange]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    // 处理登录
    const handleLogin = async () => {
        setIsLoggingIn(true);
        setError(null);

        try {
            const message = await openKiroLogin();
            // 显示提示信息
            alert(message);
            // 等待用户完成登录后刷新状态
            setTimeout(() => {
                loadStatus();
            }, 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : '打开登录失败');
        } finally {
            setIsLoggingIn(false);
        }
    };

    // 保存模型选择
    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const model = e.target.value;
        setSelectedModel(model);
        localStorage.setItem('kiro-default-model', model);
    };

    // 加载保存的模型选择
    useEffect(() => {
        const saved = localStorage.getItem('kiro-default-model');
        if (saved) {
            setSelectedModel(saved);
        }
    }, []);

    if (isLoading) {
        return (
            <div className={`kiro-config-panel ${className}`}>
                <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">检查 Kiro CLI 状态...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`kiro-config-panel ${className}`}>
            {/* 标题 */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🚀</span>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Kiro CLI（第五引擎）
                    </h2>
                </div>
                <button
                    onClick={loadStatus}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                >
                    刷新状态
                </button>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">❌ {error}</p>
                </div>
            )}

            {/* 安装状态 */}
            <div className="mb-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">安装状态</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {status?.installed ? (
                                <>✅ 已安装 {status.version && `(${status.version})`}</>
                            ) : (
                                <>❌ 未安装</>
                            )}
                        </p>
                    </div>
                    {!status?.installed && (
                        <a
                            href="https://kiro.dev/cli/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                        >
                            安装指南
                        </a>
                    )}
                </div>

                {!status?.installed && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            💡 Kiro CLI 需要在 WSL (Ubuntu) 中安装：
                        </p>
                        <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                            curl -fsSL https://cli.kiro.dev/install | bash
                        </code>
                    </div>
                )}
            </div>

            {/* 登录状态 */}
            {status?.installed && (
                <div className="mb-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">登录状态</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {status.loggedIn ? (
                                    <>✅ 已登录 Builder ID</>
                                ) : (
                                    <>❌ 未登录</>
                                )}
                            </p>
                        </div>
                        {!status.loggedIn && (
                            <button
                                onClick={handleLogin}
                                disabled={isLoggingIn}
                                className={`
                  px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                  ${isLoggingIn
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'text-white bg-purple-600 hover:bg-purple-700'
                                    }
                `}
                            >
                                {isLoggingIn ? '打开中...' : '登录'}
                            </button>
                        )}
                    </div>

                    {!status.loggedIn && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                💡 点击登录按钮后，会在终端中打开登录流程，请在浏览器中完成认证。
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* 模型选择 */}
            {status?.installed && status.loggedIn && (
                <div className="mb-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">默认模型</h3>
                    <select
                        value={selectedModel}
                        onChange={handleModelChange}
                        className="w-full px-3 py-2 border rounded-md text-sm
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100"
                    >
                        {models.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name} ({model.multiplier}x) - {model.description}
                            </option>
                        ))}
                    </select>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {models.map((model) => (
                            <div
                                key={model.id}
                                className={`
                  p-2 rounded border text-sm cursor-pointer transition-colors
                  ${selectedModel === model.id
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                    }
                `}
                                onClick={() => {
                                    setSelectedModel(model.id);
                                    localStorage.setItem('kiro-default-model', model.id);
                                }}
                            >
                                <div className="font-medium">{model.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {model.multiplier}x · {model.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 特性说明 */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    🎯 Kiro CLI 特性
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>✅ 无需 API Key，使用 Builder ID 认证</li>
                    <li>✅ 支持 Claude Opus/Sonnet/Haiku 模型</li>
                    <li>✅ 官方工具，零封号风险</li>
                    <li>✅ 支持 MCP 协议</li>
                    <li>✅ Agentic 对话模式</li>
                </ul>
            </div>
        </div>
    );
};

export default KiroConfigPanel;

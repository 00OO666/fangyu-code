/**
 * 引擎安装器组件
 * 提供四种引擎的一键下载安装功能
 */

import { useState, useCallback } from 'react';
import {
    Download,
    Loader2,
    CheckCircle,
    XCircle,
    ExternalLink,
    Terminal,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import type { EngineType } from '../../types/provider';
import { cn } from '../../lib/utils';

interface EngineInstallInfo {
    name: string;
    command: string | null;
    requiresNodejs: boolean;
    postInstall: string;
    docsUrl: string;
    registrationUrl?: string;
    description: string;
}

interface InstallationState {
    status: 'idle' | 'checking' | 'installing' | 'success' | 'error';
    progress: number;
    logs: string[];
    error?: string;
}

interface EngineInstallerProps {
    engine: EngineType;
    onInstallComplete?: () => void;
    onClose: () => void;
}

// 引擎安装配置
const ENGINE_INSTALL_CONFIG: Record<EngineType, EngineInstallInfo> = {
    claude: {
        name: 'Claude Code',
        command: 'npm install -g @anthropic-ai/claude-code',
        requiresNodejs: true,
        postInstall: '安装完成后需要配置 API Key',
        docsUrl: 'https://code.claude.com/docs/en/setup',
        description: 'Anthropic 官方 CLI 工具，支持 Claude 模型的代码生成和对话',
    },
    codex: {
        name: 'Codex CLI',
        command: 'npm install -g @openai/codex',
        requiresNodejs: true,
        postInstall: '安装完成后需要登录 ChatGPT 账号',
        docsUrl: 'https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started',
        description: 'OpenAI 官方 CLI 工具，支持 GPT 模型的代码生成',
    },
    gemini: {
        name: 'Gemini CLI',
        command: 'npm install -g @google/gemini-cli',
        requiresNodejs: true,
        postInstall: '安装完成后需要登录 Google 账号',
        docsUrl: 'https://www.geminicli.net/en/blog/gemini-cli-npm-installation-guide',
        description: 'Google 官方 CLI 工具，支持 Gemini 模型的代码生成',
    },
    siliconflow: {
        name: 'SiliconFlow',
        command: null,
        requiresNodejs: false,
        postInstall: '注册账号并获取 API Key',
        docsUrl: 'https://docs.siliconflow.com/en/userguide/quickstart',
        registrationUrl: 'https://cloud.siliconflow.cn/account/ak',
        description: '国产 AI 模型聚合平台，提供 OpenAI 兼容 API，无需安装 CLI',
    },
};

// 解析 Node.js 版本
export function parseNodeVersion(versionString: string): number | null {
    const match = versionString.match(/v?(\d+)\.\d+\.\d+/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

// 检查 Node.js 版本是否满足要求
export function isNodeVersionValid(majorVersion: number): boolean {
    return majorVersion >= 18;
}

export function EngineInstaller({ engine, onInstallComplete, onClose }: EngineInstallerProps) {
    const config = ENGINE_INSTALL_CONFIG[engine];
    const [state, setState] = useState<InstallationState>({
        status: 'idle',
        progress: 0,
        logs: [],
    });
    const [showLogs, setShowLogs] = useState(false);

    // 添加日志
    const addLog = useCallback((message: string) => {
        setState(prev => ({
            ...prev,
            logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
        }));
    }, []);

    // 检查 Node.js 环境
    const checkNodejs = useCallback(async (): Promise<boolean> => {
        setState(prev => ({ ...prev, status: 'checking', progress: 10 }));
        addLog('检查 Node.js 环境...');

        try {
            const result = await invoke<string>('execute_command', {
                command: 'node',
                args: ['--version'],
            });

            const version = result.trim();
            addLog(`检测到 Node.js ${version}`);

            const majorVersion = parseNodeVersion(version);
            if (majorVersion === null) {
                addLog('⚠️ 无法解析 Node.js 版本');
                return false;
            }

            if (!isNodeVersionValid(majorVersion)) {
                addLog(`⚠️ Node.js 版本过低，需要 18+，当前 ${majorVersion}`);
                setState(prev => ({
                    ...prev,
                    status: 'error',
                    error: `Node.js 版本过低，需要 18+，当前 v${majorVersion}`,
                }));
                return false;
            }

            addLog('✓ Node.js 版本满足要求');
            setState(prev => ({ ...prev, progress: 30 }));
            return true;
        } catch (error) {
            addLog('✗ 未检测到 Node.js');
            setState(prev => ({
                ...prev,
                status: 'error',
                error: '未安装 Node.js，请先安装 Node.js 18+',
            }));
            return false;
        }
    }, [addLog]);

    // 执行安装
    const runInstall = useCallback(async () => {
        if (!config.command) return;

        setState(prev => ({ ...prev, status: 'installing', progress: 40 }));
        addLog(`执行安装命令: ${config.command}`);

        try {
            // 解析命令
            const parts = config.command.split(' ');
            const cmd = parts[0];
            const args = parts.slice(1);

            setState(prev => ({ ...prev, progress: 60 }));
            addLog('正在安装，请稍候...');

            const result = await invoke<string>('execute_command', {
                command: cmd,
                args,
            });

            addLog(result || '安装命令执行完成');
            setState(prev => ({ ...prev, progress: 90 }));

            // 验证安装
            addLog('验证安装...');
            const verifyCmd = engine === 'claude' ? 'claude' : engine === 'codex' ? 'codex' : 'gemini';
            try {
                await invoke<string>('execute_command', {
                    command: verifyCmd,
                    args: ['--version'],
                });
                addLog(`✓ ${config.name} 安装成功`);
            } catch {
                addLog(`⚠️ 安装可能成功，但无法验证版本`);
            }

            setState(prev => ({
                ...prev,
                status: 'success',
                progress: 100,
            }));

            onInstallComplete?.();
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            addLog(`✗ 安装失败: ${errorMsg}`);
            setState(prev => ({
                ...prev,
                status: 'error',
                error: errorMsg,
            }));
        }
    }, [config, engine, addLog, onInstallComplete]);

    // 开始安装流程
    const handleInstall = useCallback(async () => {
        setState({ status: 'idle', progress: 0, logs: [] });

        if (config.requiresNodejs) {
            const nodeOk = await checkNodejs();
            if (!nodeOk) return;
        }

        if (config.command) {
            await runInstall();
        } else if (config.registrationUrl) {
            // SiliconFlow 等无需安装的引擎
            addLog(`打开注册页面: ${config.registrationUrl}`);
            await open(config.registrationUrl);
            setState(prev => ({
                ...prev,
                status: 'success',
                progress: 100,
            }));
            addLog('✓ 已打开注册页面，请在浏览器中完成注册');
        }
    }, [config, checkNodejs, runInstall, addLog]);

    // 打开文档
    const handleOpenDocs = useCallback(async () => {
        await open(config.docsUrl);
    }, [config.docsUrl]);

    // 打开 Node.js 下载页面
    const handleDownloadNode = useCallback(async () => {
        await open('https://nodejs.org/en/download/');
    }, []);

    return (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
            {/* 头部 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-500" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        安装 {config.name}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    ✕
                </button>
            </div>

            {/* 描述 */}
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {config.description}
            </p>

            {/* 安装命令 */}
            {config.command && (
                <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm">
                    <Terminal className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <code className="text-gray-700 dark:text-gray-300 break-all">
                        {config.command}
                    </code>
                </div>
            )}

            {/* 进度条 */}
            {state.status !== 'idle' && (
                <div className="space-y-2">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                'h-full transition-all duration-300',
                                state.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                            )}
                            style={{ width: `${state.progress}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className={cn(
                            state.status === 'error' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
                        )}>
                            {state.status === 'checking' && '检查环境...'}
                            {state.status === 'installing' && '安装中...'}
                            {state.status === 'success' && '安装完成'}
                            {state.status === 'error' && '安装失败'}
                        </span>
                        <span className="text-gray-400">{state.progress}%</span>
                    </div>
                </div>
            )}

            {/* 错误信息 */}
            {state.status === 'error' && state.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                            <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
                            {state.error.includes('Node.js') && (
                                <button
                                    onClick={handleDownloadNode}
                                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    下载 Node.js
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 成功信息 */}
            {state.status === 'success' && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm text-green-700 dark:text-green-300">
                                {config.name} 安装成功！
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                                下一步：{config.postInstall}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 日志 */}
            {state.logs.length > 0 && (
                <div className="space-y-2">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showLogs ? '隐藏日志' : '显示日志'}
                    </button>
                    {showLogs && (
                        <div className="max-h-32 overflow-y-auto p-2 bg-gray-900 rounded-lg">
                            {state.logs.map((log, i) => (
                                <div key={i} className="text-xs font-mono text-gray-300">
                                    {log}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={handleOpenDocs}
                    className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                >
                    <ExternalLink className="w-4 h-4" />
                    查看文档
                </button>
                <button
                    onClick={handleInstall}
                    disabled={state.status === 'checking' || state.status === 'installing'}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        state.status === 'checking' || state.status === 'installing'
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                    )}
                >
                    {(state.status === 'checking' || state.status === 'installing') && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {state.status === 'idle' && <Download className="w-4 h-4" />}
                    {state.status === 'success' && <CheckCircle className="w-4 h-4" />}
                    {state.status === 'error' && <AlertTriangle className="w-4 h-4" />}
                    {state.status === 'idle' && (config.command ? '开始安装' : '打开注册页面')}
                    {state.status === 'checking' && '检查环境...'}
                    {state.status === 'installing' && '安装中...'}
                    {state.status === 'success' && '重新安装'}
                    {state.status === 'error' && '重试'}
                </button>
            </div>
        </div>
    );
}

export default EngineInstaller;

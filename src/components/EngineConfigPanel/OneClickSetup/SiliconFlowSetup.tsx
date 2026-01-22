/**
 * SiliconFlow 配置组件
 * 处理 SiliconFlow API Key 配置
 */

import { useState, useCallback } from 'react';
import Key from 'lucide-react/dist/esm/icons/key'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { open } from '@tauri-apps/plugin-shell';
import type { EngineSetupProgress } from '../../../services/setupStateService';
import { cn } from '../../../lib/utils';

interface SiliconFlowSetupProps {
    currentStep: string;
    progress: EngineSetupProgress | null;
    onStepComplete: (configData?: Record<string, unknown>) => void;
    onLog: (message: string) => void;
}

// SiliconFlow 可用模型
const SILICONFLOW_MODELS = [
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', description: '最新一代深度求索模型' },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', description: '通义千问大模型' },
    { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4 9B', description: '智谱 AI 对话模型' },
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', description: 'Meta 开源大模型' },
];

export function SiliconFlowSetup({
    currentStep,
    progress,
    onStepComplete,
    onLog,
}: SiliconFlowSetupProps) {
    const [apiKey, setApiKey] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);

    // 打开注册页面
    const handleOpenRegister = useCallback(async () => {
        onLog('打开 SiliconFlow 注册页面...');
        await open('https://cloud.siliconflow.cn/');
        onStepComplete();
    }, [onLog, onStepComplete]);

    // 打开 API Key 页面
    const handleOpenApiKeyPage = useCallback(async () => {
        await open('https://cloud.siliconflow.cn/account/ak');
    }, []);

    // 验证 API Key
    const handleVerifyApiKey = useCallback(async () => {
        if (!apiKey.trim()) {
            setVerifyError('请输入 API Key');
            return;
        }

        setIsVerifying(true);
        setVerifyError(null);
        onLog('验证 API Key...');

        try {
            // 调用 SiliconFlow API 验证
            const response = await fetch('https://api.siliconflow.cn/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                },
            });

            if (response.ok) {
                onLog('✓ API Key 验证成功');
                onStepComplete({ apiKey: apiKey.trim() });
            } else {
                const error = await response.text();
                throw new Error(error || '验证失败');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : '验证失败';
            setVerifyError(msg);
            onLog(`✗ 验证失败: ${msg}`);
        } finally {
            setIsVerifying(false);
        }
    }, [apiKey, onLog, onStepComplete]);

    // 选择模型
    const handleSelectModel = useCallback((modelId: string) => {
        setSelectedModel(modelId);
        onLog(`选择模型: ${modelId}`);
        onStepComplete({ defaultModel: modelId });
    }, [onLog, onStepComplete]);

    // 根据当前步骤渲染内容
    switch (currentStep) {
        case 'register':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        如果您还没有 SiliconFlow 账号，请先注册。
                    </p>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                    SiliconFlow 提供多种国产 AI 模型
                                </p>
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                    包括 DeepSeek、Qwen、GLM 等，新用户有免费额度
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenRegister}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                            打开注册页面
                        </button>
                        <button
                            onClick={() => onStepComplete()}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            已有账号，跳过
                        </button>
                    </div>
                </div>
            );

        case 'get_api_key':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        从 SiliconFlow 控制台获取 API Key。
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                SiliconFlow API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleOpenApiKeyPage}
                                className="flex items-center gap-1 text-sm text-purple-500 hover:text-purple-600"
                            >
                                <ExternalLink className="w-4 h-4" />
                                获取 API Key
                            </button>
                            <button
                                onClick={() => onStepComplete({ apiKey: apiKey.trim() })}
                                disabled={!apiKey.trim()}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    !apiKey.trim()
                                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-purple-500 text-white hover:bg-purple-600'
                                )}
                            >
                                <Key className="w-4 h-4" />
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            );

        case 'verify':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        验证 API Key 是否有效。
                    </p>
                    {progress?.configData?.apiKey ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <Key className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                    {String(progress.configData.apiKey).slice(0, 8)}...
                                </span>
                            </div>
                            <button
                                onClick={handleVerifyApiKey}
                                disabled={isVerifying}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    isVerifying
                                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-purple-500 text-white hover:bg-purple-600'
                                )}
                            >
                                {isVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
                                验证连接
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            请先在上一步输入 API Key
                        </p>
                    )}
                    {verifyError && (
                        <p className="text-sm text-red-500">{verifyError}</p>
                    )}
                </div>
            );

        case 'select_model':
            return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        选择默认使用的模型。
                    </p>
                    <div className="grid gap-2">
                        {SILICONFLOW_MODELS.map(model => (
                            <button
                                key={model.id}
                                onClick={() => handleSelectModel(model.id)}
                                className={cn(
                                    'p-3 text-left border rounded-lg transition-colors',
                                    selectedModel === model.id
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {model.name}
                                    </span>
                                    {selectedModel === model.id && (
                                        <CheckCircle className="w-4 h-4 text-purple-500" />
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {model.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            );

        default:
            return null;
    }
}

export default SiliconFlowSetup;

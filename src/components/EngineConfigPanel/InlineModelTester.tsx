/**
 * 内嵌模型测试组件 - 测试代理商支持的所有模型
 */

import { useState, useCallback, useEffect } from 'react';
import { Loader2, CheckCircle, AlertTriangle, XCircle, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export type APIProviderType = 'claude' | 'openai' | 'gemini';

interface ModelConfig {
    id: string;
    name: string;
    thinkingBudget?: number;
    isThinking?: boolean;
}

interface ModelTestResult {
    model: string;
    status: 'pending' | 'success' | 'replaced' | 'error';
    actualModel?: string;
    latency?: number;
    error?: string;
    isThinking?: boolean;
}

interface InlineModelTesterProps {
    provider: APIProviderType;
    apiKey: string;
    baseUrl: string;
    onClose: () => void;
    onTestComplete?: (results: ModelTestResult[]) => void;
    selectedModel?: string | null;
    onModelSelect?: (modelId: string) => void;
}

// Claude 官方模型（2026-01 更新）
const CLAUDE_MODELS = [
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
    { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5' },
    {
        id: 'claude-opus-4-5-20251101',
        name: 'Opus 4.5 Thinking',
        thinkingBudget: 31999,
        isThinking: true,
    },
];

// Gemini 官方模型（2026-01）
const GEMINI_MODELS = [
    { id: 'gemini-2.5-pro', name: '2.5 Pro' },
    { id: 'gemini-2.5-flash', name: '2.5 Flash' },
    { id: 'gemini-3-pro-preview', name: '3 Pro' },
    { id: 'gemini-3-flash-preview', name: '3 Flash' },
];

// OpenAI 官方模型（2026-01）
const OPENAI_MODELS = [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o1', name: 'o1' },
    { id: 'o3-mini', name: 'o3 Mini' },
];

const MODELS_BY_PROVIDER: Record<APIProviderType, ModelConfig[]> = {
    claude: CLAUDE_MODELS,
    openai: OPENAI_MODELS,
    gemini: GEMINI_MODELS,
};

async function testModel(
    modelConfig: ModelConfig,
    apiKey: string,
    baseUrl: string,
    provider: APIProviderType
): Promise<ModelTestResult> {
    const startTime = Date.now();
    const { id: modelId, thinkingBudget, isThinking } = modelConfig;

    try {
        // 统一使用 OpenAI 兼容格式（大多数代理商支持）
        const url = `${baseUrl}/v1/chat/completions`;

        // 构建请求体
        const requestBody: Record<string, unknown> = {
            model: modelId,
            max_tokens: isThinking ? 1024 : 20,
            messages: [{ role: 'user', content: isThinking ? 'Think step by step: what is 2+2?' : 'hi' }],
        };

        // 如果是 thinking 模式，添加 thinking 参数
        if (isThinking && thinkingBudget) {
            requestBody.thinking = {
                type: 'enabled',
                budget_tokens: thinkingBudget,
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        const latency = Date.now() - startTime;
        const data = await response.json();

        if (data.choices) {
            const actualModel = data.model;
            return {
                model: modelId,
                status: modelId === actualModel ? 'success' : 'replaced',
                actualModel,
                latency,
                isThinking,
            };
        }

        // 如果 OpenAI 格式失败且是 Claude，尝试 Anthropic 原生格式
        if (provider === 'claude' && data.error) {
            const anthropicUrl = `${baseUrl}/v1/messages`;

            const anthropicBody: Record<string, unknown> = {
                model: modelId,
                max_tokens: isThinking ? 1024 : 20,
                messages: [{ role: 'user', content: isThinking ? 'Think step by step: what is 2+2?' : 'hi' }],
            };

            // Anthropic 原生格式的 thinking 参数
            if (isThinking && thinkingBudget) {
                anthropicBody.thinking = {
                    type: 'enabled',
                    budget_tokens: thinkingBudget,
                };
            }

            const anthropicResponse = await fetch(anthropicUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify(anthropicBody),
            });

            const anthropicData = await anthropicResponse.json();
            const anthropicLatency = Date.now() - startTime;

            if (anthropicData.content) {
                return {
                    model: modelId,
                    status: modelId === anthropicData.model ? 'success' : 'replaced',
                    actualModel: anthropicData.model,
                    latency: anthropicLatency,
                    isThinking,
                };
            }
        }

        return {
            model: modelId,
            status: 'error',
            error: data.error?.message?.slice(0, 40) || '未知错误',
            latency,
            isThinking,
        };
    } catch (error) {
        return {
            model: modelId,
            status: 'error',
            error: error instanceof Error ? error.message.slice(0, 40) : '网络错误',
            latency: Date.now() - startTime,
            isThinking,
        };
    }
}

export function InlineModelTester({
    provider,
    apiKey,
    baseUrl,
    onClose,
    onTestComplete,
    selectedModel,
    onModelSelect,
}: InlineModelTesterProps) {
    const [results, setResults] = useState<ModelTestResult[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const models = MODELS_BY_PROVIDER[provider];

    const runTests = useCallback(async () => {
        setIsTesting(true);
        setResults([]);
        setCurrentIndex(0);

        const newResults: ModelTestResult[] = [];

        for (let i = 0; i < models.length; i++) {
            setCurrentIndex(i);
            const model = models[i];

            // 先设置 pending 状态
            setResults(prev => [...prev, { model: model.id, status: 'pending', isThinking: model.isThinking }]);

            const result = await testModel(model, apiKey, baseUrl, provider);
            newResults.push(result);
            setResults([...newResults]);

            // 间隔 300ms
            if (i < models.length - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        setIsTesting(false);

        // 测试完成后回调
        if (onTestComplete) {
            onTestComplete(newResults);
        }
    }, [models, apiKey, baseUrl, provider, onTestComplete]);

    // 自动开始测试 - 只在组件挂载时执行一次
    useEffect(() => {
        runTests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stats = {
        success: results.filter(r => r.status === 'success').length,
        replaced: results.filter(r => r.status === 'replaced').length,
        error: results.filter(r => r.status === 'error').length,
    };

    const getStatusIcon = (status: ModelTestResult['status']) => {
        switch (status) {
            case 'pending': return <Loader2 className="w-3 h-3 animate-spin text-gray-400" />;
            case 'success': return <CheckCircle className="w-3 h-3 text-green-500" />;
            case 'replaced': return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
            case 'error': return <XCircle className="w-3 h-3 text-red-500" />;
        }
    };

    return (
        <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    测试 {provider.toUpperCase()} 官方模型
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>
            </div>

            {/* 进度 */}
            {isTesting && (
                <div className="mb-3">
                    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${((currentIndex + 1) / models.length) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 结果列表 */}
            <div className="space-y-1.5">
                {models.map((model, index) => {
                    const result = results[index];
                    const uniqueKey = model.isThinking ? `${model.id}-thinking` : model.id;
                    const isSelectable = result?.status === 'success' || result?.status === 'replaced';
                    const displayModelId = result?.status === 'replaced' ? result.actualModel : model.id;
                    const isSelected = selectedModel === displayModelId;

                    return (
                        <div
                            key={uniqueKey}
                            onClick={() => {
                                if (isSelectable && onModelSelect && displayModelId) {
                                    onModelSelect(displayModelId);
                                }
                            }}
                            className={cn(
                                'flex items-center justify-between px-2 py-1.5 rounded text-xs',
                                result?.status === 'success' && 'bg-green-50 dark:bg-green-900/20',
                                result?.status === 'replaced' && 'bg-yellow-50 dark:bg-yellow-900/20',
                                result?.status === 'error' && 'bg-red-50 dark:bg-red-900/20',
                                !result && 'bg-gray-50 dark:bg-gray-800',
                                isSelectable && 'cursor-pointer hover:ring-2 hover:ring-blue-400',
                                isSelected && 'ring-2 ring-blue-500'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                {result ? getStatusIcon(result.status) : <div className="w-3 h-3" />}
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {model.name}
                                    {model.isThinking && (
                                        <span className="ml-1 text-purple-500 dark:text-purple-400">🧠</span>
                                    )}
                                </span>
                                {isSelected && (
                                    <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">
                                        默认
                                    </span>
                                )}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                                {result?.status === 'pending' && '测试中...'}
                                {result?.status === 'success' && `${result.latency}ms`}
                                {result?.status === 'replaced' && (
                                    <span className="text-yellow-600 dark:text-yellow-400">
                                        → {result.actualModel?.slice(0, 20)}
                                    </span>
                                )}
                                {result?.status === 'error' && (
                                    <span className="text-red-500">{result.error}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 统计 */}
            {!isTesting && results.length > 0 && (
                <div className="space-y-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-green-600 dark:text-green-400">✓ {stats.success}</span>
                        <span className="text-yellow-600 dark:text-yellow-400">⚠ {stats.replaced}</span>
                        <span className="text-red-500">✗ {stats.error}</span>
                        <button
                            onClick={runTests}
                            className="ml-auto text-blue-500 hover:text-blue-600"
                        >
                            重新测试
                        </button>
                    </div>
                    {onModelSelect && (stats.success > 0 || stats.replaced > 0) && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            💡 点击可用模型设为默认（全局应用到 Claude Code）
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default InlineModelTester;

/**
 * Summary Model Tester Service
 *
 * 测试摘要引擎的模型可用性
 * 复用 InlineAPITester 的测试逻辑，支持四引擎
 */

import { invoke } from '@tauri-apps/api/core';
import type { SummaryEngine, ModelInfo } from '@/types/summary';
import { ENGINE_MODELS } from '@/types/summary';

// =============================================================================
// 类型定义
// =============================================================================

export interface ModelTestResult {
    /** 请求的模型 ID */
    modelId: string;
    /** 测试状态 */
    status: 'pending' | 'success' | 'replaced' | 'error';
    /** 实际返回的模型（可能被替换） */
    actualModel?: string;
    /** 响应延迟（毫秒） */
    latency?: number;
    /** 错误信息 */
    error?: string;
}

export interface EngineTestResult {
    /** 引擎类型 */
    engine: SummaryEngine;
    /** 测试时间戳 */
    testedAt: number;
    /** 各模型测试结果 */
    results: ModelTestResult[];
    /** 可用模型列表 */
    availableModels: ModelInfo[];
}

export interface TestProgress {
    /** 当前测试的模型索引 */
    current: number;
    /** 总模型数 */
    total: number;
    /** 当前模型名称 */
    currentModel: string;
}

type ProgressCallback = (progress: TestProgress) => void;

// =============================================================================
// API 测试函数
// =============================================================================

async function testClaudeModel(
    modelId: string,
    _apiKey: string,
    _baseUrl: string
): Promise<ModelTestResult> {
    const startTime = Date.now();
    try {
        // 映射模型 ID 到 Tauri 后端支持的简称
        const modelMap: Record<string, string> = {
            'claude-opus-4-20250514': 'opus',
            'claude-sonnet-4-20250514': 'sonnet',
            'claude-3-5-haiku-20241022': 'haiku',
            'claude-3-5-sonnet-20241022': 'sonnet',
            'claude-3-haiku-20240307': 'haiku',
            'claude-3-sonnet-20240229': 'sonnet',
            'claude-3-opus-20240229': 'opus',
        };

        const model = modelMap[modelId] || modelId;

        // 实际调用 Tauri 后端测试模型
        await invoke<string>('generate_text_with_llm', {
            prompt: 'Say "OK" in one word.',
            model,
        });

        return {
            modelId,
            status: 'success',
            actualModel: modelId,
            latency: Date.now() - startTime,
        };
    } catch (error) {
        return {
            modelId,
            status: 'error',
            error: error instanceof Error ? error.message.slice(0, 50) : '未知错误',
            latency: Date.now() - startTime,
        };
    }
}

async function testOpenAIModel(
    modelId: string,
    apiKey: string,
    baseUrl: string
): Promise<ModelTestResult> {
    const startTime = Date.now();
    try {
        const endpoint = baseUrl || 'https://api.openai.com';
        const response = await fetch(`${endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                max_tokens: 5,
                messages: [{ role: 'user', content: 'hi' }],
            }),
        });
        const latency = Date.now() - startTime;
        const data = await response.json();

        if (data.choices) {
            const actualModel = data.model;
            const isMatch = actualModel?.startsWith(modelId) || modelId === actualModel;
            return {
                modelId,
                status: isMatch ? 'success' : 'replaced',
                actualModel,
                latency,
            };
        }
        return {
            modelId,
            status: 'error',
            error: data.error?.message?.slice(0, 50) || '未知错误',
            latency,
        };
    } catch (error) {
        return {
            modelId,
            status: 'error',
            error: error instanceof Error ? error.message.slice(0, 50) : '网络错误',
            latency: Date.now() - startTime,
        };
    }
}

async function testGeminiModel(
    modelId: string,
    apiKey: string,
    _baseUrl: string
): Promise<ModelTestResult> {
    const startTime = Date.now();
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'hi' }] }],
                generationConfig: { maxOutputTokens: 5 },
            }),
        });
        const latency = Date.now() - startTime;
        const data = await response.json();

        if (data.candidates) {
            return {
                modelId,
                status: 'success',
                actualModel: modelId,
                latency,
            };
        }
        return {
            modelId,
            status: 'error',
            error: data.error?.message?.slice(0, 50) || '未知错误',
            latency,
        };
    } catch (error) {
        return {
            modelId,
            status: 'error',
            error: error instanceof Error ? error.message.slice(0, 50) : '网络错误',
            latency: Date.now() - startTime,
        };
    }
}

async function testSiliconFlowModel(
    modelId: string,
    apiKey: string,
    baseUrl: string
): Promise<ModelTestResult> {
    const startTime = Date.now();
    try {
        const endpoint = baseUrl || 'https://api.siliconflow.cn';
        const response = await fetch(`${endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                max_tokens: 5,
                messages: [{ role: 'user', content: 'hi' }],
            }),
        });
        const latency = Date.now() - startTime;
        const data = await response.json();

        if (data.choices) {
            return {
                modelId,
                status: 'success',
                actualModel: data.model || modelId,
                latency,
            };
        }
        return {
            modelId,
            status: 'error',
            error: data.error?.message?.slice(0, 50) || data.message?.slice(0, 50) || '未知错误',
            latency,
        };
    } catch (error) {
        return {
            modelId,
            status: 'error',
            error: error instanceof Error ? error.message.slice(0, 50) : '网络错误',
            latency: Date.now() - startTime,
        };
    }
}

// 测试函数映射
const TEST_FUNCTIONS: Record<SummaryEngine, typeof testClaudeModel> = {
    claude: testClaudeModel,
    codex: testOpenAIModel,
    gemini: testGeminiModel,
    siliconflow: testSiliconFlowModel,
};

// =============================================================================
// 主测试服务
// =============================================================================

/**
 * 测试指定引擎的所有模型
 */
export async function testEngineModels(
    engine: SummaryEngine,
    apiKey: string,
    baseUrl: string = '',
    onProgress?: ProgressCallback
): Promise<EngineTestResult> {
    const models = ENGINE_MODELS[engine];
    const testFn = TEST_FUNCTIONS[engine];
    const results: ModelTestResult[] = [];

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        
        // 报告进度
        onProgress?.({
            current: i + 1,
            total: models.length,
            currentModel: model.name,
        });

        // 执行测试
        const result = await testFn(model.id, apiKey, baseUrl);
        results.push(result);

        // 短暂延迟避免 rate limit
        if (i < models.length - 1) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    // 筛选可用模型
    const availableModels = models.filter(model => {
        const result = results.find(r => r.modelId === model.id);
        return result?.status === 'success' || result?.status === 'replaced';
    });

    return {
        engine,
        testedAt: Date.now(),
        results,
        availableModels,
    };
}

/**
 * 快速测试单个模型
 */
export async function testSingleModel(
    engine: SummaryEngine,
    modelId: string,
    apiKey: string,
    baseUrl: string = ''
): Promise<ModelTestResult> {
    const testFn = TEST_FUNCTIONS[engine];
    return testFn(modelId, apiKey, baseUrl);
}

// =============================================================================
// 缓存管理
// =============================================================================

const CACHE_KEY = 'fangyu-summary-model-test-cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 小时

interface CachedTestResults {
    [engine: string]: EngineTestResult;
}

/**
 * 获取缓存的测试结果
 */
export function getCachedTestResults(): CachedTestResults {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return {};
        
        const data = JSON.parse(cached) as CachedTestResults;
        const now = Date.now();
        
        // 过滤过期的结果
        const valid: CachedTestResults = {};
        for (const [engine, result] of Object.entries(data)) {
            if (now - result.testedAt < CACHE_EXPIRY) {
                valid[engine] = result;
            }
        }
        return valid;
    } catch {
        return {};
    }
}

/**
 * 保存测试结果到缓存
 */
export function cacheTestResult(result: EngineTestResult): void {
    try {
        const cached = getCachedTestResults();
        cached[result.engine] = result;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch (e) {
        console.warn('Failed to cache test results:', e);
    }
}

/**
 * 清除测试缓存
 */
export function clearTestCache(): void {
    localStorage.removeItem(CACHE_KEY);
}

/**
 * 获取引擎的可用模型（优先使用缓存）
 */
export function getAvailableModelsForEngine(engine: SummaryEngine): ModelInfo[] | null {
    const cached = getCachedTestResults();
    const result = cached[engine];
    
    if (result && result.availableModels.length > 0) {
        return result.availableModels;
    }
    
    return null; // 没有缓存，需要测试
}

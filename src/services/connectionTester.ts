/**
 * 连接测试服务 - 验证 API 配置是否有效
 * 
 * 使用 Tauri HTTP 插件绕过 CORS 限制
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { EngineType } from '../types/provider';
import { KiroEngine } from './kiro';

export interface TestConfig {
    engine: EngineType;
    baseUrl: string;
    apiKey: string;
    model?: string;
    timeout?: number;
}

export interface ConnectionTestResult {
    success: boolean;
    timestamp: number;
    latencyMs?: number;
    errorCode?: string;
    errorMessage?: string;
    modelInfo?: {
        name: string;
        contextWindow?: number;
    };
}

const DEFAULT_TIMEOUT = 10000;

// 错误消息映射
const ERROR_MESSAGES: Record<string, string> = {
    'NETWORK_ERROR': '网络连接失败，请检查网络设置',
    'TIMEOUT': '请求超时，请稍后重试',
    'INVALID_API_KEY': 'API Key 无效，请检查后重试',
    'UNAUTHORIZED': '认证失败，请检查 API Key 是否正确',
    'RATE_LIMITED': '请求过于频繁，请稍后重试',
    'INVALID_URL': 'API 端点格式无效',
    'SERVER_ERROR': '服务器错误，请稍后重试',
    'UNKNOWN': '未知错误',
};

/**
 * 获取友好的错误消息
 */
function getErrorMessage(code: string): string {
    return ERROR_MESSAGES[code] || ERROR_MESSAGES['UNKNOWN'];
}


/**
 * 解析 HTTP 错误响应
 */
function parseErrorResponse(status: number, body: any): { code: string; message: string } {
    if (status === 401 || status === 403) {
        return { code: 'UNAUTHORIZED', message: getErrorMessage('UNAUTHORIZED') };
    }
    if (status === 429) {
        return { code: 'RATE_LIMITED', message: getErrorMessage('RATE_LIMITED') };
    }
    if (status >= 500) {
        return { code: 'SERVER_ERROR', message: getErrorMessage('SERVER_ERROR') };
    }

    // 尝试从响应体中提取错误信息
    if (body?.error?.type) {
        return { code: body.error.type, message: body.error.message || getErrorMessage('UNKNOWN') };
    }
    if (body?.error?.code) {
        return { code: body.error.code, message: body.error.message || getErrorMessage('UNKNOWN') };
    }

    return { code: 'UNKNOWN', message: getErrorMessage('UNKNOWN') };
}

/**
 * 测试 Claude API 连接
 */
async function testClaudeConnection(config: TestConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const url = `${config.baseUrl.replace(/\/$/, '')}/v1/messages`;

    try {
        const response = await tauriFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: config.model || 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }],
            }),
            signal: AbortSignal.timeout(config.timeout || DEFAULT_TIMEOUT),
        });

        const latencyMs = Date.now() - startTime;

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                timestamp: Date.now(),
                latencyMs,
                modelInfo: {
                    name: data.model || config.model || 'unknown',
                },
            };
        }

        const errorBody = await response.json().catch(() => ({}));
        const { code, message } = parseErrorResponse(response.status, errorBody);

        return {
            success: false,
            timestamp: Date.now(),
            latencyMs,
            errorCode: code,
            errorMessage: message,
        };
    } catch (error) {
        return handleFetchError(error, startTime);
    }
}


/**
 * 测试 OpenAI/Codex API 连接
 */
async function testCodexConnection(config: TestConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const url = `${config.baseUrl.replace(/\/$/, '')}/models`;

    try {
        const response = await tauriFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
            },
            signal: AbortSignal.timeout(config.timeout || DEFAULT_TIMEOUT),
        });

        const latencyMs = Date.now() - startTime;

        if (response.ok) {
            const data = await response.json();
            const models = data.data || [];
            const targetModel = config.model ? models.find((m: any) => m.id === config.model) : models[0];

            return {
                success: true,
                timestamp: Date.now(),
                latencyMs,
                modelInfo: targetModel ? {
                    name: targetModel.id,
                    contextWindow: targetModel.context_window,
                } : undefined,
            };
        }

        const errorBody = await response.json().catch(() => ({}));
        const { code, message } = parseErrorResponse(response.status, errorBody);

        return {
            success: false,
            timestamp: Date.now(),
            latencyMs,
            errorCode: code,
            errorMessage: message,
        };
    } catch (error) {
        return handleFetchError(error, startTime);
    }
}

/**
 * 测试 Gemini API 连接
 */
async function testGeminiConnection(config: TestConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
    const url = `${baseUrl.replace(/\/$/, '')}/v1/models?key=${config.apiKey}`;

    try {
        const response = await tauriFetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(config.timeout || DEFAULT_TIMEOUT),
        });

        const latencyMs = Date.now() - startTime;

        if (response.ok) {
            const data = await response.json();
            const models = data.models || [];
            const targetModel = config.model
                ? models.find((m: any) => m.name?.includes(config.model))
                : models[0];

            return {
                success: true,
                timestamp: Date.now(),
                latencyMs,
                modelInfo: targetModel ? {
                    name: targetModel.displayName || targetModel.name,
                    contextWindow: targetModel.inputTokenLimit,
                } : undefined,
            };
        }

        const errorBody = await response.json().catch(() => ({}));
        const { code, message } = parseErrorResponse(response.status, errorBody);

        return {
            success: false,
            timestamp: Date.now(),
            latencyMs,
            errorCode: code,
            errorMessage: message,
        };
    } catch (error) {
        return handleFetchError(error, startTime);
    }
}


/**
 * 测试 SiliconFlow API 连接
 */
async function testSiliconFlowConnection(config: TestConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const url = `${config.baseUrl.replace(/\/$/, '')}/models`;

    try {
        const response = await tauriFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
            },
            signal: AbortSignal.timeout(config.timeout || DEFAULT_TIMEOUT),
        });

        const latencyMs = Date.now() - startTime;

        if (response.ok) {
            const data = await response.json();
            const models = data.data || [];

            return {
                success: true,
                timestamp: Date.now(),
                latencyMs,
                modelInfo: models.length > 0 ? {
                    name: config.model || models[0]?.id || 'unknown',
                } : undefined,
            };
        }

        const errorBody = await response.json().catch(() => ({}));
        const { code, message } = parseErrorResponse(response.status, errorBody);

        return {
            success: false,
            timestamp: Date.now(),
            latencyMs,
            errorCode: code,
            errorMessage: message,
        };
    } catch (error) {
        return handleFetchError(error, startTime);
    }
}

/**
 * 测试 Kiro 连接
 */
async function testKiroConnection(config: TestConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
        const engine = new KiroEngine({
            tokenPath: config.baseUrl || undefined,
            modelId: config.model,
        });
        const validation = await engine.validateConfig();
        const latencyMs = Date.now() - startTime;

        if (validation.valid) {
            return {
                success: true,
                timestamp: Date.now(),
                latencyMs,
                modelInfo: config.model
                    ? {
                        name: config.model,
                    }
                    : undefined,
            };
        }

        return {
            success: false,
            timestamp: Date.now(),
            latencyMs,
            errorCode: 'UNAUTHORIZED',
            errorMessage: validation.error || 'Kiro 登录态无效',
        };
    } catch (error) {
        return handleFetchError(error, startTime);
    }
}

/**
 * 处理 fetch 错误
 */
function handleFetchError(error: unknown, startTime: number): ConnectionTestResult {
    const latencyMs = Date.now() - startTime;

    if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return {
                success: false,
                timestamp: Date.now(),
                latencyMs,
                errorCode: 'TIMEOUT',
                errorMessage: getErrorMessage('TIMEOUT'),
            };
        }

        if (error.message.includes('fetch') || error.message.includes('network')) {
            return {
                success: false,
                timestamp: Date.now(),
                latencyMs,
                errorCode: 'NETWORK_ERROR',
                errorMessage: getErrorMessage('NETWORK_ERROR'),
            };
        }
    }

    return {
        success: false,
        timestamp: Date.now(),
        latencyMs,
        errorCode: 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : getErrorMessage('UNKNOWN'),
    };
}

/**
 * 引擎测试器映射
 */
const ENGINE_TESTERS: Record<EngineType, (config: TestConfig) => Promise<ConnectionTestResult>> = {
    claude: testClaudeConnection,
    codex: testCodexConnection,
    gemini: testGeminiConnection,
    siliconflow: testSiliconFlowConnection,
    kiro: testKiroConnection,
};

/**
 * 测试连接
 */
export async function testConnection(config: TestConfig): Promise<ConnectionTestResult> {
    // 验证 URL 格式
    try {
        new URL(config.baseUrl);
    } catch {
        return {
            success: false,
            timestamp: Date.now(),
            errorCode: 'INVALID_URL',
            errorMessage: getErrorMessage('INVALID_URL'),
        };
    }

    const tester = ENGINE_TESTERS[config.engine];
    if (!tester) {
        return {
            success: false,
            timestamp: Date.now(),
            errorCode: 'UNKNOWN',
            errorMessage: `不支持的引擎类型: ${config.engine}`,
        };
    }

    return tester(config);
}

// 导出类接口（兼容设计文档）
export class ConnectionTester {
    async test(config: TestConfig): Promise<ConnectionTestResult> {
        return testConnection(config);
    }

    async testConnection(config: TestConfig | any): Promise<ConnectionTestResult> {
        // Support both TestConfig and UnifiedProviderConfig
        const testConfig: TestConfig = {
            engine: config.engine,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            model: config.model,
            timeout: config.timeout,
        };
        return testConnection(testConfig);
    }
}

export default new ConnectionTester();

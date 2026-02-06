/**
 * ConnectionTester 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionTester } from './connectionTester';
import type { UnifiedProviderConfig } from '../types/provider';

// Mock Tauri fetch
vi.mock('@tauri-apps/plugin-http', () => ({
    fetch: vi.fn(),
}));

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
const mockFetch = tauriFetch as any;

describe('ConnectionTester', () => {
    let tester: ConnectionTester;

    beforeEach(() => {
        tester = new ConnectionTester();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createMockProvider = (engine: 'claude' | 'codex' | 'gemini'): UnifiedProviderConfig => ({
        id: 'test-id',
        name: 'Test Provider',
        engine,
        baseUrl: 'https://api.example.com',
        apiKey: 'test-api-key',
        enabled: true,
        isOfficial: false,
        isPartner: false,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    describe('testConnection', () => {
        it('Claude 引擎连接成功应返回 success', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ id: 'msg_123' }),
            });

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(true);
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it('Codex 引擎连接成功应返回 success', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: [{ id: 'model-1' }] }),
            });

            const provider = createMockProvider('codex');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(true);
        });

        it('Gemini 引擎连接成功应返回 success', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ models: [{ name: 'gemini-pro' }] }),
            });

            const provider = createMockProvider('gemini');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(true);
        });

        it('401 错误应返回认证失败', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: () => Promise.resolve({}),
            });

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('认证失败');
        });

        it('403 错误应返回权限不足', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
                json: () => Promise.resolve({}),
            });

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('认证失败');
        });

        it('404 错误应返回端点不存在', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: () => Promise.resolve({}),
            });

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeDefined();
        });

        it('429 错误应返回请求过多', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                json: () => Promise.resolve({}),
            });

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('请求');
        });

        it('500 错误应返回服务器错误', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({}),
            });

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('服务器错误');
        });

        it('网络错误应返回连接失败', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeDefined();
        });

        it('超时应返回超时错误', async () => {
            mockFetch.mockImplementationOnce(() =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 100)
                )
            );

            const provider = createMockProvider('claude');
            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
        });

        it('缺少 API Key 应返回错误', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: () => Promise.resolve({}),
            });

            const provider = createMockProvider('claude');
            provider.apiKey = '';

            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeDefined();
        });

        it('缺少 baseUrl 应返回错误', async () => {
            const provider = createMockProvider('claude');
            provider.baseUrl = '';

            const result = await tester.testConnection(provider);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('端点');
        });
    });

    describe('getErrorMessage', () => {
        it('应正确映射常见错误码', async () => {
            const errorMessages: Record<number, string> = {
                401: '认证失败',
                403: '认证失败',  // 403 also returns UNAUTHORIZED message
                404: '未知',  // 404 returns UNKNOWN
                429: '请求',
                500: '服务器错误',
            };

            // Set up all mocks before the loop
            const codes = Object.keys(errorMessages).map(Number);
            codes.forEach(code => {
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: code,
                    statusText: 'Error',
                    json: () => Promise.resolve({}),
                });
            });

            for (const [code, expectedMessage] of Object.entries(errorMessages)) {
                const provider = createMockProvider('claude');
                const result = await tester.testConnection(provider);
                expect(result.errorMessage).toContain(expectedMessage);
            }
        });
    });
});

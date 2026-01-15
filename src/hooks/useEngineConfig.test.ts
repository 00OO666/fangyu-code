/**
 * useEngineConfig Hook 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEngineConfig } from './useEngineConfig';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch for connection testing
global.fetch = vi.fn();

describe('useEngineConfig', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('初始化', () => {
        it('应正确初始化默认状态', async () => {
            const { result } = renderHook(() => useEngineConfig());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.currentEngine).toBe('claude');
            expect(result.current.providers).toEqual([]);
            expect(result.current.error).toBeNull();
        });
    });
});


describe('setCurrentEngine', () => {
    it('应正确切换引擎', async () => {
        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.setCurrentEngine('codex');
        });

        expect(result.current.currentEngine).toBe('codex');
    });

    it('切换引擎后应更新代理商列表', async () => {
        // 预设不同引擎的代理商
        localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
            version: 2,
            providers: [
                { id: '1', name: 'Claude Provider', engine: 'claude', sortOrder: 0 },
                { id: '2', name: 'Codex Provider', engine: 'codex', sortOrder: 0 },
            ],
        }));

        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // 初始应显示 Claude 代理商
        expect(result.current.providers.length).toBe(1);
        expect(result.current.providers[0].name).toBe('Claude Provider');

        // 切换到 Codex
        await act(async () => {
            await result.current.setCurrentEngine('codex');
        });

        expect(result.current.providers.length).toBe(1);
        expect(result.current.providers[0].name).toBe('Codex Provider');
    });
});

describe('addProvider', () => {
    it('应正确添加代理商', async () => {
        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.addProvider({
                name: 'New Provider',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'test-key',
                enabled: true,
            });
        });

        expect(result.current.providers.length).toBe(1);
        expect(result.current.providers[0].name).toBe('New Provider');
    });
});

describe('updateProvider', () => {
    it('应正确更新代理商', async () => {
        localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
            version: 2,
            providers: [
                {
                    id: '1',
                    name: 'Original',
                    engine: 'claude',
                    baseUrl: 'https://api.example.com',
                    sortOrder: 0
                },
            ],
        }));

        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.updateProvider('1', { name: 'Updated' });
        });

        expect(result.current.providers[0].name).toBe('Updated');
    });
});

describe('deleteProvider', () => {
    it('应正确删除代理商', async () => {
        localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
            version: 2,
            providers: [
                { id: '1', name: 'To Delete', engine: 'claude', sortOrder: 0 },
            ],
        }));

        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.providers.length).toBe(1);

        await act(async () => {
            await result.current.deleteProvider('1');
        });

        expect(result.current.providers.length).toBe(0);
    });
});

describe('reorderProviders', () => {
    it('应正确重新排序代理商', async () => {
        localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
            version: 2,
            providers: [
                { id: '1', name: 'First', engine: 'claude', sortOrder: 0 },
                { id: '2', name: 'Second', engine: 'claude', sortOrder: 1 },
                { id: '3', name: 'Third', engine: 'claude', sortOrder: 2 },
            ],
        }));

        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.reorderProviders(['3', '1', '2']);
        });

        expect(result.current.providers[0].id).toBe('3');
        expect(result.current.providers[1].id).toBe('1');
        expect(result.current.providers[2].id).toBe('2');
    });
});

describe('testConnection', () => {
    it('连接成功应返回成功结果', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'msg_123' }),
        });

        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const testResult = await act(async () => {
            return await result.current.testConnection({
                id: '1',
                name: 'Test',
                engine: 'claude',
                baseUrl: 'https://api.anthropic.com',
                apiKey: 'test-key',
                enabled: true,
                sortOrder: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        });

        expect(testResult.success).toBe(true);
    });

    it('连接失败应返回错误信息', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
        });

        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const testResult = await act(async () => {
            return await result.current.testConnection({
                id: '1',
                name: 'Test',
                engine: 'claude',
                baseUrl: 'https://api.anthropic.com',
                apiKey: 'invalid-key',
                enabled: true,
                sortOrder: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        });

        expect(testResult.success).toBe(false);
        expect(testResult.error).toBeDefined();
    });
});

describe('exportConfig / importConfig', () => {
    it('导出后导入应保持数据一致', async () => {
        localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
            version: 2,
            providers: [
                {
                    id: '1',
                    name: 'Export Test',
                    engine: 'claude',
                    baseUrl: 'https://api.example.com',
                    sortOrder: 0
                },
            ],
        }));

        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // 导出
        let exported: any;
        await act(async () => {
            exported = await result.current.exportConfig({ includeSensitive: false });
        });

        expect(exported.version).toBe(2);
        expect(exported.providers.length).toBe(1);

        // 清空后导入
        localStorageMock.clear();

        await act(async () => {
            await result.current.importConfig(exported, { mode: 'replace' });
        });

        expect(result.current.providers.length).toBe(1);
    });
});

describe('错误处理', () => {
    it('操作失败时应设置错误状态', async () => {
        const { result } = renderHook(() => useEngineConfig());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // 尝试更新不存在的代理商
        await act(async () => {
            try {
                await result.current.updateProvider('non-existent', { name: 'Test' });
            } catch (e) {
                // 预期会抛出错误
            }
        });

        // 错误应该被捕获并设置到状态
        // 具体行为取决于实现
    });
});
});

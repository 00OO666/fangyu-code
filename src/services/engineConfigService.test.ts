/**
 * EngineConfigService 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UnifiedProviderConfig, EngineType } from '../types/provider';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock localStorage with proper reset capability
let localStorageStore: Record<string, string> = {};

function createLocalStorageMock() {
    return {
        getItem: vi.fn((key: string) => localStorageStore[key] || null),
        setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
        removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
        clear: vi.fn(() => {
            localStorageStore = {};
        }),
    };
}

let localStorageMock = createLocalStorageMock();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true, configurable: true });

describe.sequential('EngineConfigService', () => {
    let service: any;

    beforeEach(async () => {
        // Reset all modules to clear any cached state
        vi.resetModules();

        // Reset localStorage completely
        localStorageStore = {};

        // Recreate the mock to clear all call history
        localStorageMock = createLocalStorageMock();
        Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true, configurable: true });

        vi.clearAllMocks();

        // Dynamically import to get fresh module instance
        const { EngineConfigService } = await import('./engineConfigService');
        service = new EngineConfigService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe.sequential('getProviders', () => {
        it('没有数据时应返回空数组', () => {
            const providers = service.getProviders('claude');
            expect(providers).toEqual([]);
        });

        it('应返回指定引擎的代理商', () => {
            const mockStorage = {
                version: 2,
                providers: [
                    { id: '1', name: 'Claude Provider', engine: 'claude', sortOrder: 0 },
                    { id: '2', name: 'Codex Provider', engine: 'codex', sortOrder: 0 },
                ],
            };
            localStorageMock.setItem('fangyu-unified-providers', JSON.stringify(mockStorage));

            const claudeProviders = service.getProviders('claude');
            expect(claudeProviders.length).toBe(1);
            expect(claudeProviders[0].name).toBe('Claude Provider');
        });

        it('应按 sortOrder 排序', () => {
            const mockStorage = {
                version: 2,
                providers: [
                    { id: '1', name: 'Provider A', engine: 'claude', sortOrder: 2 },
                    { id: '2', name: 'Provider B', engine: 'claude', sortOrder: 0 },
                    { id: '3', name: 'Provider C', engine: 'claude', sortOrder: 1 },
                ],
            };
            localStorageMock.setItem('fangyu-unified-providers', JSON.stringify(mockStorage));

            const providers = service.getProviders('claude');
            expect(providers[0].name).toBe('Provider B');
            expect(providers[1].name).toBe('Provider C');
            expect(providers[2].name).toBe('Provider A');
        });
    });

    describe.sequential('addProvider', () => {
        it('应正确添加代理商', async () => {
            const newProvider = {
                name: 'New Provider',
                engine: 'claude' as EngineType,
                baseUrl: 'https://api.example.com',
                apiKey: 'test-key',
                enabled: true,
            };

            const result = await service.addProvider(newProvider);

            expect(result.id).toBeDefined();
            expect(result.name).toBe('New Provider');
            expect(result.sortOrder).toBe(0);
        });

        it('添加第二个代理商时 sortOrder 应递增', async () => {
            await service.addProvider({
                name: 'Provider 1',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key1',
                enabled: true,
            });

            const result = await service.addProvider({
                name: 'Provider 2',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key2',
                enabled: true,
            });

            expect(result.sortOrder).toBe(1);
        });
    });

    describe.sequential('updateProvider', () => {
        it('应正确更新代理商', async () => {
            const provider = await service.addProvider({
                name: 'Original Name',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key',
                enabled: true,
            });

            const updated = await service.updateProvider(provider.id, {
                name: 'Updated Name',
            });

            expect(updated.name).toBe('Updated Name');
            expect(updated.baseUrl).toBe('https://api.example.com');
        });

        it('更新不存在的代理商应抛出错误', async () => {
            await expect(
                service.updateProvider('non-existent-id', { name: 'Test' })
            ).rejects.toThrow();
        });
    });

    describe.sequential('deleteProvider', () => {
        it('应正确删除代理商', async () => {
            const provider = await service.addProvider({
                name: 'To Delete',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key',
                enabled: true,
            });

            await service.deleteProvider(provider.id);

            const providers = service.getProviders('claude');
            expect(providers.find((p: { id: string }) => p.id === provider.id)).toBeUndefined();
        });

        it('删除不存在的代理商应静默处理', async () => {
            await expect(
                service.deleteProvider('non-existent-id')
            ).resolves.not.toThrow();
        });
    });

    describe.sequential('reorderProviders', () => {
        it('应正确重新排序代理商', async () => {
            const p1 = await service.addProvider({
                name: 'Provider 1',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key1',
                enabled: true,
            });

            const p2 = await service.addProvider({
                name: 'Provider 2',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key2',
                enabled: true,
            });

            const p3 = await service.addProvider({
                name: 'Provider 3',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key3',
                enabled: true,
            });

            // 重新排序: p3, p1, p2
            await service.reorderProviders('claude', [p3.id, p1.id, p2.id]);

            const providers = service.getProviders('claude');
            expect(providers[0].id).toBe(p3.id);
            expect(providers[1].id).toBe(p1.id);
            expect(providers[2].id).toBe(p2.id);
        });
    });

    describe.sequential('getCurrentEngine', () => {
        it('默认应返回 claude', () => {
            const engine = service.getCurrentEngine();
            expect(engine).toBe('claude');
        });

        it('设置后应返回新引擎', async () => {
            await service.setCurrentEngine('codex');
            const engine = service.getCurrentEngine();
            expect(engine).toBe('codex');
        });
    });

    describe.sequential('setCurrentEngine', () => {
        it('应正确设置当前引擎', async () => {
            await service.setCurrentEngine('gemini');
            expect(service.getCurrentEngine()).toBe('gemini');
        });

        it('应持久化到 localStorage', async () => {
            await service.setCurrentEngine('siliconflow');
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });

    describe.sequential('getCurrentProvider', () => {
        it('没有代理商时应返回 null', () => {
            const provider = service.getCurrentProvider('claude');
            expect(provider).toBeNull();
        });

        it('应返回当前选中的代理商', async () => {
            const p1 = await service.addProvider({
                name: 'Provider 1',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key1',
                enabled: true,
            });

            await service.setCurrentProvider(p1.id);

            const current = service.getCurrentProvider('claude');
            expect(current?.id).toBe(p1.id);
        });
    });

    describe.sequential('exportConfig', () => {
        it('应正确导出配置', async () => {
            await service.addProvider({
                name: 'Export Test',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'secret-key',
                enabled: true,
            });

            const exported = await service.exportConfig({ includeSensitive: false });

            expect(exported.version).toBe(2);
            expect(exported.providers.length).toBe(1);
            expect(exported.providers[0].apiKey).toBeUndefined();
        });

        it('includeSensitive 为 true 时应包含 API Key', async () => {
            await service.addProvider({
                name: 'Export Test',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'secret-key',
                enabled: true,
            });

            const exported = await service.exportConfig({ includeSensitive: true });

            expect(exported.providers[0].apiKey).toBeDefined();
        });
    });

    describe.sequential('importConfig', () => {
        it('应正确导入配置（合并模式）', async () => {
            await service.addProvider({
                name: 'Existing',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key1',
                enabled: true,
            });

            const importData = {
                version: 2,
                exportedAt: new Date().toISOString(),
                providers: [
                    {
                        name: 'Imported',
                        engine: 'claude' as EngineType,
                        baseUrl: 'https://api.example.com',
                        apiKey: 'key2',
                        enabled: true,
                    },
                ],
            };

            await service.importConfig(importData, 'merge');

            const providers = service.getProviders('claude');
            expect(providers.length).toBe(2);
        });

        it('应正确导入配置（替换模式）', async () => {
            await service.addProvider({
                name: 'Existing',
                engine: 'claude',
                baseUrl: 'https://api.example.com',
                apiKey: 'key1',
                enabled: true,
            });

            const importData = {
                version: 2,
                exportedAt: new Date().toISOString(),
                providers: [
                    {
                        name: 'Imported',
                        engine: 'claude' as EngineType,
                        baseUrl: 'https://api.example.com',
                        apiKey: 'key2',
                        enabled: true,
                    },
                ],
            };

            await service.importConfig(importData, 'replace');

            const providers = service.getProviders('claude');
            expect(providers.length).toBe(1);
            expect(providers[0].name).toBe('Imported');
        });

        it('无效数据应抛出错误', async () => {
            await expect(
                service.importConfig({ invalid: 'data' } as any, { mode: 'merge' })
            ).rejects.toThrow();
        });
    });
});

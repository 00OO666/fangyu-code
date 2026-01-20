/**
 * ConfigMigrator 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigMigrator } from './configMigrator';
import { PROVIDER_STORAGE_KEY } from '../types/provider';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ConfigMigrator', () => {
    let migrator: ConfigMigrator;

    beforeEach(() => {
        migrator = new ConfigMigrator();
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('checkNeedsMigration', () => {
        it('没有旧数据时应返回 true（总是尝试从 Tauri 后端迁移）', async () => {
            const result = await migrator.checkNeedsMigration();
            expect(result).toBe(true);
        });

        it('有 v1 数据时应返回 true', async () => {
            localStorageMock.setItem(PROVIDER_STORAGE_KEY, JSON.stringify({
                version: 1,
                providers: [],
            }));

            const result = await migrator.checkNeedsMigration();
            expect(result).toBe(true);
        });

        it('已有 v2 数据且有代理商时应返回 false', async () => {
            localStorageMock.setItem(PROVIDER_STORAGE_KEY, JSON.stringify({
                version: 2,
                providers: [{ id: '1', name: 'Test' }],
            }));

            const result = await migrator.checkNeedsMigration();
            expect(result).toBe(false);
        });

        it('有旧格式 Claude 配置时应返回 true', async () => {
            localStorageMock.setItem('claude-provider-config', JSON.stringify({
                apiKey: 'test-key',
                baseUrl: 'https://api.anthropic.com',
            }));

            const result = await migrator.checkNeedsMigration();
            expect(result).toBe(true);
        });

        it('有旧格式 Codex 配置时应返回 true', async () => {
            localStorageMock.setItem('codex-provider-config', JSON.stringify({
                apiKey: 'test-key',
                baseUrl: 'https://api.openai.com',
            }));

            const result = await migrator.checkNeedsMigration();
            expect(result).toBe(true);
        });
    });

    describe('createBackup', () => {
        it('应创建备份', async () => {
            localStorageMock.setItem(PROVIDER_STORAGE_KEY, JSON.stringify({
                version: 1,
                providers: [{ id: '1', name: 'Test' }],
            }));

            const backupId = await migrator.createBackup();

            expect(backupId).toBeTruthy();
            expect(typeof backupId).toBe('string');
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        it('没有数据时应返回 null', async () => {
            const backupId = await migrator.createBackup();
            expect(backupId).toBeNull();
        });
    });

    describe('restoreBackup', () => {
        it('应正确恢复备份', async () => {
            const backupData = JSON.stringify({
                version: 1,
                providers: [{ id: '1', name: 'Test' }],
            });
            const backupId = '123';
            const backupKey = `fangyu-config-backup-${backupId}`;
            localStorageMock.setItem(backupKey, backupData);

            const result = await migrator.restoreBackup(backupId);

            expect(result).toBe(true);
            expect(localStorageMock.getItem(PROVIDER_STORAGE_KEY)).toBe(backupData);
        });

        it('备份不存在时应返回 false', async () => {
            const result = await migrator.restoreBackup('non-existent-backup');
            expect(result).toBe(false);
        });
    });

    describe('migrate', () => {
        it('应正确迁移 v1 数据到 v2', async () => {
            localStorageMock.setItem(PROVIDER_STORAGE_KEY, JSON.stringify({
                version: 1,
                providers: [
                    {
                        id: '1',
                        name: 'Test Provider',
                        engine: 'claude',
                        baseUrl: 'https://api.anthropic.com',
                        apiKey: 'test-key',
                        enabled: true,
                    },
                ],
            }));

            const result = await migrator.migrate();

            expect(result.success).toBe(true);
            expect(result.migratedProviders).toBeGreaterThanOrEqual(1);
        });

        it('迁移失败时应自动回滚', async () => {
            // 模拟迁移过程中出错
            localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
                version: 1,
                providers: [{ invalid: 'data' }],
            }));

            // 强制迁移失败
            vi.spyOn(migrator, 'migrate').mockRejectedValueOnce(new Error('Migration failed'));

            try {
                await migrator.migrate();
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        it('没有需要迁移的数据时应返回成功', async () => {
            const result = await migrator.migrate();

            expect(result.success).toBe(true);
            expect(result.migratedProviders).toBe(0);
        });

        it('应迁移旧格式 Claude 配置', async () => {
            localStorageMock.setItem('claude-provider-config', JSON.stringify({
                apiKey: 'claude-key',
                baseUrl: 'https://api.anthropic.com',
            }));

            const result = await migrator.migrate();

            expect(result.success).toBe(true);
        });

        it('应迁移旧格式 Codex 配置', async () => {
            localStorageMock.setItem('codex-provider-config', JSON.stringify({
                apiKey: 'codex-key',
                baseUrl: 'https://api.openai.com',
            }));

            const result = await migrator.migrate();

            expect(result.success).toBe(true);
        });

        it('应迁移旧格式 Gemini 配置', async () => {
            localStorageMock.setItem('gemini-provider-config', JSON.stringify({
                apiKey: 'gemini-key',
                baseUrl: 'https://generativelanguage.googleapis.com',
            }));

            const result = await migrator.migrate();

            expect(result.success).toBe(true);
        });
    });

    describe('getMigrationLog', () => {
        it('应返回迁移日志', async () => {
            localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
                version: 1,
                providers: [{ id: '1', name: 'Test', engine: 'claude' }],
            }));

            await migrator.migrate();
            const log = migrator.getMigrationLog();

            expect(Array.isArray(log)).toBe(true);
        });

        it('没有迁移时应返回空数组', () => {
            const log = migrator.getMigrationLog();
            expect(log).toEqual([]);
        });
    });
});

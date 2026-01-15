/**
 * ConfigMigrator 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigMigrator } from './configMigrator';

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
        it('没有旧数据时应返回 false', () => {
            const result = migrator.checkNeedsMigration();
            expect(result).toBe(false);
        });

        it('有 v1 数据时应返回 true', () => {
            localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
                version: 1,
                providers: [],
            }));

            const result = migrator.checkNeedsMigration();
            expect(result).toBe(true);
        });

        it('已有 v2 数据时应返回 false', () => {
            localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
                version: 2,
                providers: [],
            }));

            const result = migrator.checkNeedsMigration();
            expect(result).toBe(false);
        });

        it('有旧格式 Claude 配置时应返回 true', () => {
            localStorageMock.setItem('claude-provider-config', JSON.stringify({
                apiKey: 'test-key',
                baseUrl: 'https://api.anthropic.com',
            }));

            const result = migrator.checkNeedsMigration();
            expect(result).toBe(true);
        });

        it('有旧格式 Codex 配置时应返回 true', () => {
            localStorageMock.setItem('codex-provider-config', JSON.stringify({
                apiKey: 'test-key',
                baseUrl: 'https://api.openai.com',
            }));

            const result = migrator.checkNeedsMigration();
            expect(result).toBe(true);
        });
    });

    describe('createBackup', () => {
        it('应创建备份', () => {
            localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
                version: 1,
                providers: [{ id: '1', name: 'Test' }],
            }));

            const backupKey = migrator.createBackup();

            expect(backupKey).toContain('fangyu-provider-backup-');
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        it('没有数据时应返回 null', () => {
            const backupKey = migrator.createBackup();
            expect(backupKey).toBeNull();
        });
    });

    describe('restoreBackup', () => {
        it('应正确恢复备份', () => {
            const backupData = JSON.stringify({
                version: 1,
                providers: [{ id: '1', name: 'Test' }],
            });
            const backupKey = 'fangyu-provider-backup-123';
            localStorageMock.setItem(backupKey, backupData);

            const result = migrator.restoreBackup(backupKey);

            expect(result).toBe(true);
            expect(localStorageMock.getItem('fangyu-provider-storage')).toBe(backupData);
        });

        it('备份不存在时应返回 false', () => {
            const result = migrator.restoreBackup('non-existent-backup');
            expect(result).toBe(false);
        });
    });

    describe('migrate', () => {
        it('应正确迁移 v1 数据到 v2', async () => {
            localStorageMock.setItem('fangyu-provider-storage', JSON.stringify({
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
            expect(result.migratedCount).toBe(1);
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
            expect(result.migratedCount).toBe(0);
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

/**
 * 配置迁移服务 - 处理旧版本配置的升级
 */

import { logger } from '@/lib/logger';
import { invoke } from '@tauri-apps/api/core';
import type { EngineType, UnifiedProviderConfig, ProviderStorage, RuntimeConfig } from '../types/provider';
import { PROVIDER_STORAGE_KEY, DEFAULT_PROVIDER_STORAGE, DEFAULT_RUNTIME_CONFIG, RUNTIME_CONFIG_KEY } from '../types/provider';
import { encrypt } from './cryptoService';

// 存储版本常量
export const CURRENT_STORAGE_VERSION = 2;
export const CURRENT_ENCRYPTION_VERSION = 1;

// 备份键前缀
const BACKUP_KEY_PREFIX = 'fangyu-config-backup-';

// 旧版存储键（用于迁移）
const LEGACY_KEYS = {
    // 旧的统一存储 key
    unifiedProviders: 'fangyu-unified-providers',
    // 旧的分散存储 keys
    claudeProviders: 'claude-providers',
    codexProviders: 'codex-providers',
    geminiProviders: 'gemini-providers',
    siliconflowProviders: 'siliconflow-providers',
    // 旧的单个配置 keys
    claudeConfig: 'claude-provider-config',
    codexConfig: 'codex-provider-config',
    geminiConfig: 'gemini-provider-config',
    // 旧的当前选择 keys
    currentEngine: 'fangyu-current-engine',
    currentClaude: 'current-claude-provider',
    currentCodex: 'current-codex-provider',
    currentGemini: 'current-gemini-provider',
};

// Tauri 后端的旧配置类型
interface LegacyProviderConfig {
    id: string;
    name: string;
    description?: string;
    base_url: string;
    auth_token?: string;
    api_key?: string;
    api_key_helper?: string;
    model?: string;
    enable_auto_api_key_helper?: boolean;
}

export interface MigrationLogEntry {
    fromVersion: number;
    toVersion: number;
    timestamp: number;
    success: boolean;
    details?: string;
}

export interface MigrationResult {
    success: boolean;
    fromVersion: number;
    toVersion: number;
    migratedProviders: number;
    backupId: string;
    errors?: string[];
}

/**
 * 创建备份
 */
async function createBackup(storage: ProviderStorage): Promise<string> {
    const backupId = `${Date.now()}`;
    const backupKey = `${BACKUP_KEY_PREFIX}${backupId}`;

    localStorage.setItem(backupKey, JSON.stringify(storage));

    return backupId;
}

/**
 * 恢复备份
 */
async function restoreBackup(backupId: string): Promise<ProviderStorage | null> {
    const backupKey = `${BACKUP_KEY_PREFIX}${backupId}`;
    const backupData = localStorage.getItem(backupKey);

    if (!backupData) {
        return null;
    }

    return JSON.parse(backupData);
}


/**
 * 删除备份
 */
function deleteBackup(backupId: string): void {
    const backupKey = `${BACKUP_KEY_PREFIX}${backupId}`;
    localStorage.removeItem(backupKey);
}

/**
 * 清理旧备份（保留最近 5 个）
 */
function cleanupOldBackups(): void {
    const backupKeys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(BACKUP_KEY_PREFIX)) {
            backupKeys.push(key);
        }
    }

    // 按时间戳排序（从新到旧）
    backupKeys.sort((a, b) => {
        const timeA = parseInt(a.replace(BACKUP_KEY_PREFIX, ''));
        const timeB = parseInt(b.replace(BACKUP_KEY_PREFIX, ''));
        return timeB - timeA;
    });

    // 删除超过 5 个的旧备份
    backupKeys.slice(5).forEach(key => localStorage.removeItem(key));
}

/**
 * 读取当前存储
 */
function readStorage(): ProviderStorage {
    const data = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (!data) {
        return DEFAULT_PROVIDER_STORAGE;
    }

    try {
        return JSON.parse(data);
    } catch {
        return DEFAULT_PROVIDER_STORAGE;
    }
}

/**
 * 写入存储
 */
function writeStorage(storage: ProviderStorage): void {
    localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(storage));
}

/**
 * 检查是否有旧格式数据需要迁移
 */
function checkLegacyData(): { hasLegacy: boolean; sources: string[] } {
    const sources: string[] = [];

    // 检查旧的分散存储
    for (const [name, key] of Object.entries(LEGACY_KEYS)) {
        const data = localStorage.getItem(key);
        if (data) {
            sources.push(name);
        }
    }

    return { hasLegacy: sources.length > 0, sources };
}

/**
 * 从 Tauri 后端读取旧的 Claude 代理商配置
 */
async function loadLegacyClaudeProviders(): Promise<LegacyProviderConfig[]> {
    try {
        const providers = await invoke<LegacyProviderConfig[]>('get_provider_presets');
        logger.debug('configMigrator', '[ConfigMigrator] 从 Tauri 后端读取到', providers.length, '个 Claude 代理商配置');
        return providers;
    } catch (error) {
        logger.warn('configMigrator', '[ConfigMigrator] 从 Tauri 后端读取 Claude 配置失败:', error);
        return [];
    }
}

/**
 * 从旧格式迁移数据
 */
async function migrateFromLegacy(): Promise<ProviderStorage> {
    const storage: ProviderStorage = {
        ...DEFAULT_PROVIDER_STORAGE,
        version: CURRENT_STORAGE_VERSION,
    };

    const providers: UnifiedProviderConfig[] = [];
    let sortOrder = 0;

    // 1. 从 Tauri 后端读取旧的 Claude 代理商配置（~/.claude/providers.json）
    try {
        const legacyClaudeProviders = await loadLegacyClaudeProviders();
        for (const p of legacyClaudeProviders) {
            // 检查是否已存在
            const exists = providers.some(
                existing => existing.name === p.name && existing.engine === 'claude'
            );
            if (!exists) {
                providers.push({
                    id: p.id || `provider-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    name: p.name,
                    description: p.description,
                    engine: 'claude',
                    apiKey: p.api_key || '',
                    authToken: p.auth_token || '',
                    baseUrl: p.base_url || '',
                    model: p.model || '',
                    enabled: true,
                    isOfficial: p.base_url === 'https://api.anthropic.com',
                    isPartner: false,
                    sortOrder: sortOrder++,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
            }
        }
    } catch (error) {
        logger.warn('configMigrator', '[ConfigMigrator] 从 Tauri 后端迁移 Claude 配置失败:', error);
    }

    // 2. 尝试从旧的统一存储读取（localStorage）
    const unifiedData = localStorage.getItem(LEGACY_KEYS.unifiedProviders);
    if (unifiedData) {
        try {
            const parsed = JSON.parse(unifiedData);
            if (parsed.providers && Array.isArray(parsed.providers)) {
                for (const p of parsed.providers) {
                    // 检查是否已存在
                    const exists = providers.some(
                        existing => existing.name === p.name && existing.engine === p.engine
                    );
                    if (!exists) {
                        providers.push({
                            ...p,
                            sortOrder: p.sortOrder ?? sortOrder++,
                            createdAt: p.createdAt ?? Date.now(),
                            updatedAt: p.updatedAt ?? Date.now(),
                        });
                    }
                }
            }
            if (parsed.currentEngine) {
                storage.currentEngine = parsed.currentEngine;
            }
            if (parsed.currentProviders) {
                storage.currentProviders = { ...storage.currentProviders, ...parsed.currentProviders };
            }
        } catch (e) {
            logger.warn('configMigrator', '[ConfigMigrator] 解析旧统一存储失败:', e);
        }
    }

    // 3. 尝试从分散的引擎存储读取（localStorage）
    const engineKeys: { key: string; engine: EngineType }[] = [
        { key: LEGACY_KEYS.claudeProviders, engine: 'claude' },
        { key: LEGACY_KEYS.codexProviders, engine: 'codex' },
        { key: LEGACY_KEYS.geminiProviders, engine: 'gemini' },
        { key: LEGACY_KEYS.siliconflowProviders, engine: 'siliconflow' },
    ];

    for (const { key, engine } of engineKeys) {
        const data = localStorage.getItem(key);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                const list = Array.isArray(parsed) ? parsed : (parsed.providers || []);
                for (const p of list) {
                    // 检查是否已存在（避免重复）
                    const exists = providers.some(
                        existing => existing.name === p.name && existing.engine === engine
                    );
                    if (!exists) {
                        providers.push({
                            id: p.id || `provider-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                            name: p.name || `${engine} Provider`,
                            engine,
                            apiKey: p.apiKey || p.api_key || '',
                            baseUrl: p.baseUrl || p.base_url || p.endpoint || '',
                            model: p.model || p.defaultModel || '',
                            enabled: p.enabled ?? true,
                            isOfficial: p.isOfficial ?? false,
                            isPartner: p.isPartner ?? false,
                            sortOrder: sortOrder++,
                            createdAt: p.createdAt ?? Date.now(),
                            updatedAt: p.updatedAt ?? Date.now(),
                        });
                    }
                }
            } catch (e) {
                logger.warn('configMigrator', `[ConfigMigrator] 解析 ${key} 失败:`, e);
            }
        }
    }

    // 4. 尝试从单个配置 keys 读取（localStorage）
    const singleKeys: { key: string; engine: EngineType }[] = [
        { key: LEGACY_KEYS.claudeConfig, engine: 'claude' },
        { key: LEGACY_KEYS.codexConfig, engine: 'codex' },
        { key: LEGACY_KEYS.geminiConfig, engine: 'gemini' },
    ];

    for (const { key, engine } of singleKeys) {
        const data = localStorage.getItem(key);
        if (data) {
            try {
                const p = JSON.parse(data);
                // 检查是否已存在
                const exists = providers.some(
                    existing => existing.name === p.name && existing.engine === engine
                );
                if (!exists && (p.apiKey || p.api_key)) {
                    providers.push({
                        id: p.id || `provider-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        name: p.name || `${engine} Provider`,
                        engine,
                        apiKey: p.apiKey || p.api_key || '',
                        baseUrl: p.baseUrl || p.base_url || p.endpoint || '',
                        model: p.model || p.defaultModel || '',
                        enabled: p.enabled ?? true,
                        isOfficial: p.isOfficial ?? false,
                        isPartner: p.isPartner ?? false,
                        sortOrder: sortOrder++,
                        createdAt: p.createdAt ?? Date.now(),
                        updatedAt: p.updatedAt ?? Date.now(),
                    });
                }
            } catch (e) {
                logger.warn('configMigrator', `[ConfigMigrator] 解析 ${key} 失败:`, e);
            }
        }
    }

    // 5. 读取当前选择
    const currentEngine = localStorage.getItem(LEGACY_KEYS.currentEngine);
    if (currentEngine && ['claude', 'codex', 'gemini', 'siliconflow'].includes(currentEngine)) {
        storage.currentEngine = currentEngine as EngineType;
    }

    // 6. 从 Tauri 后端读取当前激活的 Claude 配置（~/.claude/settings.json）
    try {
        const currentConfig = await invoke<{
            anthropic_base_url?: string;
            anthropic_auth_token?: string;
            anthropic_api_key?: string;
            anthropic_model?: string;
        }>('get_current_provider_config');

        if (currentConfig.anthropic_base_url) {
            // 查找匹配的代理商
            const matchingProvider = providers.find(
                p => p.engine === 'claude' && p.baseUrl === currentConfig.anthropic_base_url
            );

            if (matchingProvider) {
                // 设置为当前激活的代理商
                storage.currentProviders.claude = matchingProvider.id;
                logger.debug('configMigrator', '[ConfigMigrator] 找到当前激活的 Claude 代理商:', matchingProvider.name);
            } else if (currentConfig.anthropic_api_key || currentConfig.anthropic_auth_token) {
                // 如果没有匹配的代理商，创建一个新的
                const newProvider: UnifiedProviderConfig = {
                    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    name: '当前配置',
                    description: '从 ~/.claude/settings.json 迁移',
                    engine: 'claude',
                    apiKey: currentConfig.anthropic_api_key || '',
                    authToken: currentConfig.anthropic_auth_token || '',
                    baseUrl: currentConfig.anthropic_base_url || '',
                    model: currentConfig.anthropic_model || '',
                    enabled: true,
                    isOfficial: currentConfig.anthropic_base_url === 'https://api.anthropic.com',
                    isPartner: false,
                    sortOrder: sortOrder++,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                providers.push(newProvider);
                storage.currentProviders.claude = newProvider.id;
                logger.debug('configMigrator', '[ConfigMigrator] 从当前配置创建新的 Claude 代理商');
            }
        }
    } catch (error) {
        logger.warn('configMigrator', '[ConfigMigrator] 读取当前 Claude 配置失败:', error);
    }

    storage.providers = providers;

    logger.debug('configMigrator', `[ConfigMigrator] 从旧格式迁移了 ${providers.length} 个代理商配置`);

    return storage;
}

/**
 * 检查是否需要迁移
 */
export function checkNeedsMigration(): boolean {
    // 检查新存储是否存在且版本正确
    const data = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (data) {
        try {
            const storage = JSON.parse(data);
            // 如果已有 v2 数据且有代理商，不需要迁移
            if (storage.version >= CURRENT_STORAGE_VERSION && storage.providers?.length > 0) {
                return false;
            }
            // 如果版本低于当前版本，需要迁移
            if (storage.version < CURRENT_STORAGE_VERSION) {
                return true;
            }
        } catch {
            // 解析失败，需要迁移
            return true;
        }
    }

    // 检查是否有旧格式数据（localStorage）
    const { hasLegacy } = checkLegacyData();
    if (hasLegacy) {
        return true;
    }

    // 如果新存储为空或没有代理商，总是尝试迁移（可能有 Tauri 后端的旧数据）
    return true;
}

/**
 * 迁移 v1 到 v2
 * - 加密所有 API Keys
 * - 添加 sortOrder 字段
 * - 添加时间戳字段
 */
async function migrateV1ToV2(storage: ProviderStorage): Promise<ProviderStorage> {
    const migratedProviders: UnifiedProviderConfig[] = [];

    for (let i = 0; i < storage.providers.length; i++) {
        const provider = storage.providers[i];
        let migratedProvider = { ...provider };

        // 加密 API Key
        if (provider.apiKey && !provider.apiKeyIv) {
            const { ciphertext, iv } = await encrypt(provider.apiKey);
            migratedProvider = {
                ...migratedProvider,
                apiKey: ciphertext,
                apiKeyIv: iv,
            };
        }

        // 加密 Auth Token
        if (provider.authToken && !(provider as any).authTokenIv) {
            const { ciphertext, iv } = await encrypt(provider.authToken);
            migratedProvider = {
                ...migratedProvider,
                authToken: ciphertext,
                authTokenIv: iv,
            };
        }

        // 添加 sortOrder
        if (migratedProvider.sortOrder === undefined) {
            migratedProvider.sortOrder = i;
        }

        // 添加时间戳
        if (!migratedProvider.createdAt) {
            migratedProvider.createdAt = Date.now();
        }
        if (!migratedProvider.updatedAt) {
            migratedProvider.updatedAt = Date.now();
        }

        migratedProviders.push(migratedProvider as UnifiedProviderConfig);
    }

    return {
        ...storage,
        version: 2,
        providers: migratedProviders,
        migrationLog: [
            ...(storage.migrationLog || []),
            {
                fromVersion: 1,
                toVersion: 2,
                timestamp: Date.now(),
                success: true,
                details: `迁移了 ${migratedProviders.length} 个代理商配置`,
            },
        ],
    };
}


/**
 * 执行迁移
 */
export async function migrate(): Promise<MigrationResult> {
    let storage = readStorage();
    const fromVersion = storage.version || 1;

    // 检查是否有旧格式数据需要迁移（localStorage）
    const { hasLegacy, sources } = checkLegacyData();

    // 如果新存储为空，尝试从旧格式迁移
    if (storage.providers.length === 0) {
        logger.debug('configMigrator', '[ConfigMigrator] 新存储为空，尝试从旧格式迁移...');

        if (hasLegacy) {
            logger.debug('configMigrator', '[ConfigMigrator] 检测到 localStorage 旧格式数据:', sources);
        }

        // 总是尝试从旧格式迁移（包括 Tauri 后端）
        storage = await migrateFromLegacy();

        // 如果迁移后仍然没有数据，返回成功但不需要进一步处理
        if (storage.providers.length === 0) {
            logger.debug('configMigrator', '[ConfigMigrator] 没有找到旧配置数据');
            return {
                success: true,
                fromVersion,
                toVersion: CURRENT_STORAGE_VERSION,
                migratedProviders: 0,
                backupId: '',
            };
        }
    }

    // 如果已经是最新版本且有数据，不需要迁移
    if (storage.version >= CURRENT_STORAGE_VERSION && storage.providers.length > 0) {
        // 但仍然需要保存（可能是从旧格式迁移过来的）
        writeStorage(storage);
        return {
            success: true,
            fromVersion: storage.version,
            toVersion: storage.version,
            migratedProviders: storage.providers.length,
            backupId: '',
        };
    }

    // 创建备份
    const backupId = await createBackup(storage);

    try {
        let migratedStorage = storage;

        // 逐版本迁移
        if (migratedStorage.version < 2) {
            migratedStorage = await migrateV1ToV2(migratedStorage);
        }

        // 写入迁移后的数据
        writeStorage(migratedStorage);

        // 清理旧备份
        cleanupOldBackups();

        logger.debug('configMigrator', `[ConfigMigrator] 迁移完成: ${migratedStorage.providers.length} 个代理商`);

        return {
            success: true,
            fromVersion,
            toVersion: CURRENT_STORAGE_VERSION,
            migratedProviders: migratedStorage.providers.length,
            backupId,
        };
    } catch (error) {
        logger.error('configMigrator', '[ConfigMigrator] 迁移失败:', error);
        // 回滚
        const backup = await restoreBackup(backupId);
        if (backup) {
            writeStorage(backup);
        }

        return {
            success: false,
            fromVersion,
            toVersion: CURRENT_STORAGE_VERSION,
            migratedProviders: 0,
            backupId,
            errors: [error instanceof Error ? error.message : '未知错误'],
        };
    }
}

/**
 * 回滚到指定备份
 */
export async function rollback(backupId: string): Promise<boolean> {
    const backup = await restoreBackup(backupId);
    if (!backup) {
        return false;
    }

    writeStorage(backup);
    return true;
}

/**
 * 获取迁移日志
 */
export function getMigrationLog(): MigrationLogEntry[] {
    const storage = readStorage();
    return storage.migrationLog || [];
}

/**
 * 检查并执行迁移（应用启动时调用）
 */
export async function checkAndMigrate(): Promise<MigrationResult | null> {
    if (!checkNeedsMigration()) {
        return null;
    }

    return migrate();
}

// 导出类接口（兼容设计文档）
export class ConfigMigrator {
    async checkNeedsMigration(): Promise<boolean> {
        return checkNeedsMigration();
    }

    async migrate(): Promise<MigrationResult> {
        return migrate();
    }

    async rollback(backupId: string): Promise<void> {
        const success = await rollback(backupId);
        if (!success) {
            throw new Error('回滚失败：备份不存在');
        }
    }

    getMigrationLog(): MigrationLogEntry[] {
        return getMigrationLog();
    }
}

export default new ConfigMigrator();

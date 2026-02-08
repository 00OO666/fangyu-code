/**
 * 引擎配置服务 - 统一管理引擎和代理商配置
 * 
 * 架构说明：
 * - 前端使用 localStorage 存储统一配置（支持多引擎）
 * - Claude 引擎需要同步到 Tauri 后端（~/.claude/settings.json 和 providers.json）
 * - 其他引擎（Codex、Gemini）仅使用前端存储
 */

import { logger } from '@/lib/logger';
import { invoke } from '@tauri-apps/api/core';
import type {
    EngineType,
    UnifiedProviderConfig,
    ProviderStorage,
    RuntimeConfig,
    ExportedConfig,
} from '../types/provider';
import {
    PROVIDER_STORAGE_KEY,
    CURRENT_ENGINE_KEY,
    CURRENT_PROVIDERS_KEY,
    RUNTIME_CONFIG_KEY,
    DEFAULT_PROVIDER_STORAGE,
    DEFAULT_RUNTIME_CONFIG,
} from '../types/provider';
import { encrypt, decrypt, maskApiKey } from './cryptoService';
import { testConnection, type ConnectionTestResult, type TestConfig } from './connectionTester';
import { checkAndMigrate, CURRENT_STORAGE_VERSION } from './configMigrator';

// Tauri 后端的 Provider 配置类型（用于 Claude 引擎同步）
interface TauriProviderConfig {
    id: string;
    name: string;
    description: string;
    base_url: string;
    auth_token?: string;
    api_key?: string;
    api_key_helper?: string;
    model?: string;
    enable_auto_api_key_helper?: boolean;
}

// 导出选项
export interface ExportOptions {
    includeSensitive: boolean;
    sensitiveDataMode?: 'encrypted' | 'masked' | 'excluded';
    exportPassword?: string;
}

// 导入结果
export interface ImportResult {
    success: boolean;
    importedProviders: number;
    errors?: string[];
    warnings?: string[];
}

// 验证结果
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * 读取存储
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
 * 读取运行时配置
 */
function readRuntimeConfig(): RuntimeConfig {
    const data = localStorage.getItem(RUNTIME_CONFIG_KEY);
    if (!data) {
        return DEFAULT_RUNTIME_CONFIG;
    }
    try {
        return JSON.parse(data);
    } catch {
        return DEFAULT_RUNTIME_CONFIG;
    }
}

/**
 * 写入运行时配置
 */
function writeRuntimeConfig(config: RuntimeConfig): void {
    localStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify(config));
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
    return `provider-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 验证代理商配置
 */
export function validateProviderConfig(
    config: Partial<UnifiedProviderConfig>
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.name?.trim()) {
        errors.push('name');
    }

    if (!config.apiKey?.trim()) {
        errors.push('apiKey');
    }

    if (config.baseUrl) {
        try {
            new URL(config.baseUrl);
        } catch {
            errors.push('baseUrl');
        }
    }

    if (!config.model?.trim()) {
        warnings.push('model');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// ==================== Tauri 后端同步（Claude 引擎专用）====================

/**
 * 将 UnifiedProviderConfig 转换为 Tauri 后端格式
 */
function toTauriConfig(config: UnifiedProviderConfig, decryptedApiKey?: string, decryptedAuthToken?: string): TauriProviderConfig {
    return {
        id: config.id,
        name: config.name,
        description: config.description || '',
        base_url: config.baseUrl || '',
        auth_token: decryptedAuthToken || config.authToken || undefined,
        api_key: decryptedApiKey || config.apiKey || undefined,
        model: config.model || undefined,
    };
}

/**
 * 同步 Claude 代理商到 Tauri 后端（~/.claude/providers.json）
 */
async function syncClaudeProviderToBackend(config: UnifiedProviderConfig, action: 'add' | 'update' | 'delete'): Promise<void> {
    if (config.engine !== 'claude') return;

    try {
        // 解密 API Key 和 Auth Token
        let decryptedApiKey = config.apiKey;
        let decryptedAuthToken = config.authToken;

        if (config.apiKeyIv && config.apiKey) {
            try {
                decryptedApiKey = await decrypt(config.apiKey, config.apiKeyIv);
            } catch (e) {
                logger.warn('engineConfigService', '[EngineConfigService] 解密 API Key 失败:', e);
            }
        }

        if (config.authTokenIv && config.authToken) {
            try {
                decryptedAuthToken = await decrypt(config.authToken, config.authTokenIv);
            } catch (e) {
                logger.warn('engineConfigService', '[EngineConfigService] 解密 Auth Token 失败:', e);
            }
        }

        const tauriConfig = toTauriConfig(config, decryptedApiKey, decryptedAuthToken);

        if (action === 'add') {
            await invoke('add_provider_config', { config: tauriConfig });
            logger.debug('engineConfigService', '[EngineConfigService] 已同步添加 Claude 代理商到后端:', config.name);
        } else if (action === 'update') {
            await invoke('update_provider_config', { config: tauriConfig });
            logger.debug('engineConfigService', '[EngineConfigService] 已同步更新 Claude 代理商到后端:', config.name);
        } else if (action === 'delete') {
            await invoke('delete_provider_config', { id: config.id });
            logger.debug('engineConfigService', '[EngineConfigService] 已同步删除 Claude 代理商从后端:', config.name);
        }
    } catch (error) {
        logger.error('engineConfigService', '[EngineConfigService] 同步 Claude 代理商到后端失败:', error);
        // 不抛出错误，允许前端继续工作
    }
}

/**
 * 激活 Claude 代理商配置（写入 ~/.claude/settings.json）
 */
async function activateClaudeProvider(config: UnifiedProviderConfig): Promise<void> {
    if (config.engine !== 'claude') return;

    try {
        // 解密 API Key 和 Auth Token
        let decryptedApiKey = config.apiKey;
        let decryptedAuthToken = config.authToken;

        if (config.apiKeyIv && config.apiKey) {
            try {
                decryptedApiKey = await decrypt(config.apiKey, config.apiKeyIv);
            } catch (e) {
                logger.warn('engineConfigService', '[EngineConfigService] 解密 API Key 失败:', e);
            }
        }

        if (config.authTokenIv && config.authToken) {
            try {
                decryptedAuthToken = await decrypt(config.authToken, config.authTokenIv);
            } catch (e) {
                logger.warn('engineConfigService', '[EngineConfigService] 解密 Auth Token 失败:', e);
            }
        }

        const tauriConfig = toTauriConfig(config, decryptedApiKey, decryptedAuthToken);
        await invoke('switch_provider_config', { config: tauriConfig });
        logger.debug('engineConfigService', '[EngineConfigService] 已激活 Claude 代理商:', config.name);
    } catch (error) {
        logger.error('engineConfigService', '[EngineConfigService] 激活 Claude 代理商失败:', error);
        throw error;
    }
}

/**
 * 清除 Claude 代理商配置（清理 ~/.claude/settings.json 中的环境变量）
 */
async function deactivateClaudeProvider(): Promise<void> {
    try {
        await invoke('clear_provider_config');
        logger.debug('engineConfigService', '[EngineConfigService] 已清除 Claude 代理商配置');
    } catch (error) {
        logger.error('engineConfigService', '[EngineConfigService] 清除 Claude 代理商配置失败:', error);
        // 不抛出错误
    }
}

// ==================== 代理商 CRUD ====================

/**
 * 创建代理商
 */
export async function createProvider(
    config: Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>
): Promise<UnifiedProviderConfig> {
    const storage = readStorage();

    // 加密 API Key
    let encryptedApiKey = config.apiKey;
    let apiKeyIv: string | undefined;
    if (config.apiKey) {
        const result = await encrypt(config.apiKey);
        encryptedApiKey = result.ciphertext;
        apiKeyIv = result.iv;
    }

    // 加密 Auth Token
    let encryptedAuthToken = config.authToken;
    let authTokenIv: string | undefined;
    if (config.authToken) {
        const result = await encrypt(config.authToken);
        encryptedAuthToken = result.ciphertext;
        authTokenIv = result.iv;
    }

    // 计算 sortOrder
    const engineProviders = storage.providers.filter(p => p.engine === config.engine);
    const maxSortOrder = engineProviders.reduce((max, p) => Math.max(max, p.sortOrder || 0), -1);

    const newProvider: UnifiedProviderConfig = {
        ...config,
        id: generateId(),
        apiKey: encryptedApiKey,
        apiKeyIv,
        authToken: encryptedAuthToken,
        authTokenIv,
        sortOrder: maxSortOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    storage.providers.push(newProvider);
    writeStorage(storage);

    // 同步到 Tauri 后端（Claude 引擎）
    // 注意：需要传递原始未加密的 API Key
    const providerWithPlainKey = {
        ...newProvider,
        apiKey: config.apiKey,
        apiKeyIv: undefined,
        authToken: config.authToken,
        authTokenIv: undefined,
    };
    await syncClaudeProviderToBackend(providerWithPlainKey as UnifiedProviderConfig, 'add');

    return newProvider;
}


/**
 * 更新代理商
 */
export async function updateProvider(
    id: string,
    updates: Partial<UnifiedProviderConfig>
): Promise<UnifiedProviderConfig> {
    const storage = readStorage();
    const index = storage.providers.findIndex(p => p.id === id);

    if (index === -1) {
        throw new Error(`代理商不存在: ${id}`);
    }

    const existing = storage.providers[index];
    let updatedProvider = { ...existing, ...updates, updatedAt: Date.now() };

    // 记录原始未加密的值（用于同步到后端）

    // 如果更新了 API Key，需要重新加密
    if (updates.apiKey && updates.apiKey !== existing.apiKey) {
        const result = await encrypt(updates.apiKey);
        updatedProvider.apiKey = result.ciphertext;
        updatedProvider.apiKeyIv = result.iv;
    }

    // 如果更新了 Auth Token，需要重新加密
    if (updates.authToken && updates.authToken !== existing.authToken) {
        const result = await encrypt(updates.authToken);
        updatedProvider.authToken = result.ciphertext;
        updatedProvider.authTokenIv = result.iv;
    }

    storage.providers[index] = updatedProvider;
    writeStorage(storage);

    // 同步到 Tauri 后端（Claude 引擎）
    // 需要解密后同步
    await syncClaudeProviderToBackend(updatedProvider, 'update');

    return updatedProvider;
}

/**
 * 删除代理商
 */
export async function deleteProvider(id: string): Promise<void> {
    const storage = readStorage();
    const index = storage.providers.findIndex(p => p.id === id);

    if (index === -1) {
        return; // 已经不存在，静默返回
    }

    const provider = storage.providers[index];
    storage.providers.splice(index, 1);

    // 如果删除的是当前代理商，清除引用
    if (storage.currentProviders[provider.engine] === id) {
        storage.currentProviders[provider.engine] = null;

        // 如果是 Claude 引擎，清除后端配置
        if (provider.engine === 'claude') {
            await deactivateClaudeProvider();
        }
    }

    writeStorage(storage);

    // 同步删除到 Tauri 后端（Claude 引擎）
    await syncClaudeProviderToBackend(provider, 'delete');
}

/**
 * 获取代理商
 */
export function getProvider(id: string): UnifiedProviderConfig | null {
    const storage = readStorage();
    return storage.providers.find(p => p.id === id) || null;
}

/**
 * 获取指定引擎的所有代理商
 */
export function getProvidersByEngine(engine: EngineType): UnifiedProviderConfig[] {
    const storage = readStorage();
    return storage.providers
        .filter(p => p.engine === engine)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/**
 * 获取所有代理商
 */
export function getAllProviders(): UnifiedProviderConfig[] {
    const storage = readStorage();
    return storage.providers;
}

// ==================== 排序 ====================

/**
 * 重新排序代理商
 */
export async function reorderProviders(
    engine: EngineType,
    orderedIds: string[]
): Promise<void> {
    const storage = readStorage();

    // 更新 sortOrder
    orderedIds.forEach((id, index) => {
        const provider = storage.providers.find(p => p.id === id);
        if (provider && provider.engine === engine) {
            provider.sortOrder = index;
            provider.updatedAt = Date.now();
        }
    });

    writeStorage(storage);
}


// ==================== 引擎切换 ====================

/**
 * 获取当前引擎
 */
export function getCurrentEngine(): EngineType {
    const storage = readStorage();
    return storage.currentEngine;
}

/**
 * 设置当前引擎
 */
export async function setCurrentEngine(engine: EngineType): Promise<void> {
    const storage = readStorage();
    storage.currentEngine = engine;
    writeStorage(storage);
}

/**
 * 获取当前代理商 ID
 */
export function getCurrentProviderId(engine: EngineType): string | null {
    const storage = readStorage();
    return storage.currentProviders[engine] || null;
}

/**
 * 获取当前代理商
 */
export function getCurrentProvider(engine: EngineType): UnifiedProviderConfig | null {
    const providerId = getCurrentProviderId(engine);
    if (!providerId) return null;
    return getProvider(providerId);
}

/**
 * 设置当前代理商
 */
export async function setCurrentProvider(
    engine: EngineType,
    providerId: string | null
): Promise<void> {
    const storage = readStorage();
    storage.currentProviders[engine] = providerId;
    writeStorage(storage);

    // 如果是 Claude 引擎，激活或清除后端配置
    if (engine === 'claude') {
        if (providerId) {
            const provider = getProvider(providerId);
            if (provider) {
                await activateClaudeProvider(provider);
            }
        } else {
            await deactivateClaudeProvider();
        }
    }
}

// ==================== 连接测试 ====================

/**
 * 测试代理商连接
 */
export async function testProviderConnection(
    config: Partial<UnifiedProviderConfig>
): Promise<ConnectionTestResult> {
    if (!config.engine || !config.baseUrl || !config.apiKey) {
        return {
            success: false,
            timestamp: Date.now(),
            errorCode: 'INVALID_CONFIG',
            errorMessage: '配置不完整',
        };
    }

    // 如果 API Key 是加密的，先解密
    let apiKey = config.apiKey;
    if (config.apiKeyIv) {
        try {
            apiKey = await decrypt(config.apiKey, config.apiKeyIv);
        } catch {
            return {
                success: false,
                timestamp: Date.now(),
                errorCode: 'DECRYPTION_FAILED',
                errorMessage: '解密 API Key 失败',
            };
        }
    }

    const testConfig: TestConfig = {
        engine: config.engine,
        baseUrl: config.baseUrl,
        apiKey,
        model: config.model,
    };

    return testConnection(testConfig);
}

/**
 * 解密 API Key（临时使用）
 */
export async function decryptApiKey(providerId: string): Promise<string> {
    const provider = getProvider(providerId);
    if (!provider || !provider.apiKey) {
        throw new Error('代理商不存在或没有 API Key');
    }

    if (!provider.apiKeyIv) {
        // 未加密的旧数据
        return provider.apiKey;
    }

    return decrypt(provider.apiKey, provider.apiKeyIv);
}


// ==================== 导入导出 ====================

/**
 * 导出配置
 */
export async function exportConfig(options: ExportOptions): Promise<ExportedConfig> {
    const storage = readStorage();
    const runtimeConfig = readRuntimeConfig();

    const exportedProviders: any[] = [];

    for (const provider of storage.providers) {
        const exportedProvider: any = {
            id: provider.id,
            name: provider.name,
            engine: provider.engine,
            baseUrl: provider.baseUrl,
            model: provider.model,
            isOfficial: provider.isOfficial,
            isPartner: provider.isPartner,
            category: provider.category,
            sortOrder: provider.sortOrder,
            enabled: provider.enabled,
        };

        if (options.includeSensitive) {
            const mode = options.sensitiveDataMode || 'masked';

            if (mode === 'excluded') {
                // 不包含敏感数据
            } else if (mode === 'masked') {
                // 掩码显示
                if (provider.apiKey) {
                    const decrypted = provider.apiKeyIv
                        ? await decrypt(provider.apiKey, provider.apiKeyIv)
                        : provider.apiKey;
                    exportedProvider.apiKey = maskApiKey(decrypted);
                }
            } else if (mode === 'encrypted') {
                // 保持加密状态导出
                exportedProvider.apiKey = provider.apiKey;
                exportedProvider.apiKeyIv = provider.apiKeyIv;
                exportedProvider.authToken = provider.authToken;
                exportedProvider.authTokenIv = provider.authTokenIv;
            }
        }

        exportedProviders.push(exportedProvider);
    }

    return {
        version: CURRENT_STORAGE_VERSION,
        exportedAt: Date.now(),
        exportedFrom: '2.6.0', // 应用版本
        includesSensitiveData: options.includeSensitive,
        sensitiveDataMode: options.sensitiveDataMode || 'excluded',
        providers: exportedProviders,
        currentEngine: storage.currentEngine,
        currentProviders: storage.currentProviders,
        runtimeConfig,
    };
}

/**
 * 验证导入配置
 */
function validateImportConfig(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
        errors.push('无效的配置格式');
        return { valid: false, errors, warnings };
    }

    if (!data.version || data.version > CURRENT_STORAGE_VERSION) {
        errors.push('配置版本不兼容');
    }

    if (!Array.isArray(data.providers)) {
        errors.push('缺少代理商列表');
    } else {
        data.providers.forEach((p: any, i: number) => {
            if (!p.name) warnings.push(`代理商 ${i + 1} 缺少名称`);
            if (!p.engine) errors.push(`代理商 ${i + 1} 缺少引擎类型`);
        });
    }

    return { valid: errors.length === 0, errors, warnings };
}


/**
 * 导入配置
 */
export async function importConfig(
    data: ExportedConfig,
    mode: 'merge' | 'replace'
): Promise<ImportResult> {
    const validation = validateImportConfig(data);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    const storage = readStorage();
    let importedCount = 0;

    try {
        if (mode === 'replace') {
            // 替换模式：清空现有配置
            storage.providers = [];
            storage.currentProviders = {
                claude: null,
                codex: null,
                gemini: null,
            };
        }

        // 导入代理商
        for (const importedProvider of data.providers) {
            // 检查是否已存在（按 ID 或名称+引擎）
            const existingIndex = storage.providers.findIndex(
                p => p.id === importedProvider.id ||
                    (p.name === importedProvider.name && p.engine === importedProvider.engine)
            );

            const newProvider: UnifiedProviderConfig = {
                id: importedProvider.id || generateId(),
                name: importedProvider.name,
                engine: importedProvider.engine,
                baseUrl: importedProvider.baseUrl,
                model: importedProvider.model,
                apiKey: importedProvider.apiKey,
                apiKeyIv: importedProvider.apiKeyIv,
                authToken: importedProvider.authToken,
                authTokenIv: importedProvider.authTokenIv,
                isOfficial: importedProvider.isOfficial,
                isPartner: importedProvider.isPartner,
                category: importedProvider.category,
                sortOrder: importedProvider.sortOrder ?? storage.providers.length,
                enabled: importedProvider.enabled ?? true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            if (existingIndex >= 0 && mode === 'merge') {
                // 合并模式：更新现有配置
                storage.providers[existingIndex] = {
                    ...storage.providers[existingIndex],
                    ...newProvider,
                    id: storage.providers[existingIndex].id, // 保持原 ID
                    createdAt: storage.providers[existingIndex].createdAt,
                };
            } else {
                storage.providers.push(newProvider);
            }

            importedCount++;
        }

        // 更新当前引擎和代理商
        if (data.currentEngine) {
            storage.currentEngine = data.currentEngine;
        }
        if (data.currentProviders) {
            Object.assign(storage.currentProviders, data.currentProviders);
        }

        // 更新运行时配置
        if (data.runtimeConfig) {
            writeRuntimeConfig(data.runtimeConfig);
        }

        writeStorage(storage);

        return {
            success: true,
            importedProviders: importedCount,
            warnings: validation.warnings,
        };
    } catch (error) {
        return {
            success: false,
            importedProviders: 0,
            errors: [error instanceof Error ? error.message : '导入失败'],
        };
    }
}

// ==================== 运行时配置 ====================

/**
 * 获取运行时配置
 */
export function getRuntimeConfig(): RuntimeConfig {
    return readRuntimeConfig();
}

/**
 * 更新运行时配置
 */
export async function updateRuntimeConfig(updates: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
    const config = readRuntimeConfig();
    const updated = { ...config, ...updates };
    writeRuntimeConfig(updated);

    // 如果更新了 Claude 环境变量，同步到 Tauri 后端
    if (updates.claudeEnvVars) {
        await syncClaudeEnvVarsToBackend(updated.claudeEnvVars);
    }

    return updated;
}

/**
 * 同步 Claude 环境变量到 Tauri 后端（~/.claude/settings.json）
 * 
 * 注意：这个函数会将前端设置的环境变量同步到 ~/.claude/settings.json
 * - 有值的字段会被设置
 * - 空值或 false 的字段会被移除（通过发送 false 值让后端处理）
 */
async function syncClaudeEnvVarsToBackend(envVars?: RuntimeConfig['claudeEnvVars']): Promise<void> {
    if (!envVars) return;

    try {
        // 构建环境变量对象
        // 注意：需要发送所有字段，包括空值和 false，让后端决定是设置还是移除
        const envConfig: Record<string, string | number | boolean> = {};

        // 字符串类型：有值则设置，空值则发送空字符串让后端移除
        envConfig.ANTHROPIC_API_KEY = envVars.ANTHROPIC_API_KEY || '';
        envConfig.ANTHROPIC_BASE_URL = envVars.ANTHROPIC_BASE_URL || '';
        envConfig.ANTHROPIC_AUTH_TOKEN = envVars.ANTHROPIC_AUTH_TOKEN || '';
        envConfig.ANTHROPIC_MODEL = envVars.ANTHROPIC_MODEL || '';

        // 数字类型：有值则设置，否则发送 0 让后端移除
        envConfig.API_TIMEOUT_MS = envVars.API_TIMEOUT_MS || 0;
        envConfig.MAX_THINKING_TOKENS = envVars.MAX_THINKING_TOKENS || 0;
        envConfig.CLAUDE_CODE_MAX_OUTPUT_TOKENS = envVars.CLAUDE_CODE_MAX_OUTPUT_TOKENS || 0;

        // 布尔类型：直接发送布尔值，后端会根据 true/false 决定设置或移除
        envConfig.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = !!envVars.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC;
        envConfig.CLAUDE_CODE_DISABLE_TELEMETRY = !!envVars.CLAUDE_CODE_DISABLE_TELEMETRY;
        envConfig.CLAUDE_CODE_USE_BEDROCK = !!envVars.CLAUDE_CODE_USE_BEDROCK;

        // 调用 Tauri 后端保存环境变量
        await invoke('save_claude_env_vars', { envVars: envConfig });
        logger.debug('engineConfigService', '[EngineConfigService] 已同步 Claude 环境变量到后端');
    } catch (error) {
        logger.error('engineConfigService', '[EngineConfigService] 同步 Claude 环境变量失败:', error);
        // 不抛出错误，允许前端继续工作
    }
}

// ==================== 初始化 ====================

/**
 * 应用模型到 Claude Code 配置（全局）
 * 更新当前 Claude 代理商的默认模型，并同步到后端
 */
export async function applyModelToClaudeCode(
    providerId: string,
    modelId: string
): Promise<void> {
    const provider = getProvider(providerId);
    if (!provider) {
        throw new Error(`代理商不存在: ${providerId}`);
    }

    if (provider.engine !== 'claude') {
        throw new Error('只能为 Claude 引擎设置模型');
    }

    // 更新代理商的默认模型
    await updateProvider(providerId, { model: modelId });

    // 如果是当前激活的代理商，同步到后端
    const currentProviderId = getCurrentProviderId('claude');
    if (currentProviderId === providerId) {
        const updatedProvider = getProvider(providerId);
        if (updatedProvider) {
            await activateClaudeProvider(updatedProvider);
        }
    }

    // 同时更新运行时配置中的 ANTHROPIC_MODEL
    const runtimeConfig = readRuntimeConfig();
    if (runtimeConfig.claudeEnvVars) {
        runtimeConfig.claudeEnvVars.ANTHROPIC_MODEL = modelId;
        writeRuntimeConfig(runtimeConfig);
        await syncClaudeEnvVarsToBackend(runtimeConfig.claudeEnvVars);
    }

    logger.debug('engineConfigService', '[EngineConfigService] 已全局应用模型到 Claude Code:', modelId);
}

/**
 * 从 Tauri 后端读取 Claude 环境变量并同步到前端 localStorage
 * 确保前端显示的配置与 ~/.claude/settings.json 一致
 */
async function syncClaudeEnvVarsFromBackend(): Promise<void> {
    try {
        // 调用 Tauri 后端获取当前配置
        const currentConfig = await invoke<{
            anthropic_base_url?: string;
            anthropic_auth_token?: string;
            anthropic_api_key?: string;
            anthropic_model?: string;
            anthropic_small_fast_model?: string;
            api_timeout_ms?: string;
            max_thinking_tokens?: string;
            claude_code_max_output_tokens?: string;
            claude_code_disable_nonessential_traffic?: string;
            claude_code_disable_telemetry?: string;
            claude_code_use_bedrock?: string;
        }>('get_current_provider_config');

        if (!currentConfig) {
            logger.debug('engineConfigService', '[EngineConfigService] 后端没有 Claude 环境变量配置');
            return;
        }

        // 读取当前前端配置
        const runtimeConfig = readRuntimeConfig();
        const currentEnvVars = runtimeConfig.claudeEnvVars || {};

        // 合并后端配置到前端（后端优先）
        const mergedEnvVars: RuntimeConfig['claudeEnvVars'] = {
            ...currentEnvVars,
        };

        // 字符串类型
        if (currentConfig.anthropic_api_key) {
            mergedEnvVars.ANTHROPIC_API_KEY = currentConfig.anthropic_api_key;
        }
        if (currentConfig.anthropic_base_url) {
            mergedEnvVars.ANTHROPIC_BASE_URL = currentConfig.anthropic_base_url;
        }
        if (currentConfig.anthropic_auth_token) {
            mergedEnvVars.ANTHROPIC_AUTH_TOKEN = currentConfig.anthropic_auth_token;
        }
        if (currentConfig.anthropic_model) {
            mergedEnvVars.ANTHROPIC_MODEL = currentConfig.anthropic_model;
        }

        // 数字类型
        if (currentConfig.api_timeout_ms) {
            mergedEnvVars.API_TIMEOUT_MS = parseInt(currentConfig.api_timeout_ms, 10) || undefined;
        }
        if (currentConfig.max_thinking_tokens) {
            mergedEnvVars.MAX_THINKING_TOKENS = parseInt(currentConfig.max_thinking_tokens, 10) || undefined;
        }
        if (currentConfig.claude_code_max_output_tokens) {
            mergedEnvVars.CLAUDE_CODE_MAX_OUTPUT_TOKENS = parseInt(currentConfig.claude_code_max_output_tokens, 10) || undefined;
        }

        // 布尔类型
        if (currentConfig.claude_code_disable_nonessential_traffic === '1' || 
            currentConfig.claude_code_disable_nonessential_traffic === 'true') {
            mergedEnvVars.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = true;
        }
        if (currentConfig.claude_code_disable_telemetry === '1' || 
            currentConfig.claude_code_disable_telemetry === 'true') {
            mergedEnvVars.CLAUDE_CODE_DISABLE_TELEMETRY = true;
        }
        if (currentConfig.claude_code_use_bedrock === '1' || 
            currentConfig.claude_code_use_bedrock === 'true') {
            mergedEnvVars.CLAUDE_CODE_USE_BEDROCK = true;
        }

        // 更新前端配置
        const updatedConfig: RuntimeConfig = {
            ...runtimeConfig,
            claudeEnvVars: mergedEnvVars,
        };
        writeRuntimeConfig(updatedConfig);

        logger.debug('engineConfigService', '[EngineConfigService] 已从后端同步 Claude 环境变量到前端');
    } catch (error) {
        logger.warn('engineConfigService', '[EngineConfigService] 从后端同步 Claude 环境变量失败:', error);
        // 不抛出错误，允许应用继续启动
    }
}

/**
 * 从后端 CLI 配置自动导入 Provider（仅当该引擎尚无 Provider）
 * - Claude: 读取 ~/.claude/settings.json 的 env
 * - Codex: 读取 ~/.codex/auth.json + config.toml（通过后端命令）
 */
async function syncProvidersFromBackend(): Promise<void> {
    try {
        const hasEngineProvider = (engine: EngineType) =>
            readStorage().providers.some(p => p.engine === engine);

        // Claude: 从当前配置导入
        if (!hasEngineProvider('claude')) {
            const currentConfig = await invoke<{
                anthropic_base_url?: string;
                anthropic_auth_token?: string;
                anthropic_api_key?: string;
                anthropic_model?: string;
            }>('get_current_provider_config');

            const baseUrl = currentConfig.anthropic_base_url || 'https://api.anthropic.com';
            const apiKey = currentConfig.anthropic_api_key || '';
            const authToken = currentConfig.anthropic_auth_token || '';

            if (apiKey || authToken) {
                await createProvider({
                    engine: 'claude',
                    name: '当前配置',
                    description: '自动从 ~/.claude/settings.json 导入',
                    baseUrl,
                    apiKey: apiKey || undefined,
                    authToken: authToken || undefined,
                    model: currentConfig.anthropic_model || undefined,
                    enabled: true,
                    isOfficial: baseUrl === 'https://api.anthropic.com',
                    isPartner: false,
                });
                logger.debug('engineConfigService', '[EngineConfigService] 已自动导入 Claude Provider');
            }
        }

        // Codex: 从当前配置导入（需要 API Key）
        if (!hasEngineProvider('codex')) {
            const currentCodex = await invoke<{
                api_key?: string | null;
                base_url?: string | null;
                model?: string | null;
            }>('get_current_codex_config');

            const apiKey = currentCodex.api_key || '';
            if (apiKey) {
                const baseUrl = currentCodex.base_url || 'https://api.openai.com/v1';
                await createProvider({
                    engine: 'codex',
                    name: '当前配置',
                    description: '自动从 ~/.codex 导入',
                    baseUrl,
                    apiKey,
                    model: currentCodex.model || undefined,
                    enabled: true,
                    isOfficial: baseUrl === 'https://api.openai.com/v1',
                    isPartner: false,
                });
                logger.debug('engineConfigService', '[EngineConfigService] 已自动导入 Codex Provider');
            }
        }
    } catch (error) {
        logger.warn('engineConfigService', '[EngineConfigService] 自动导入 Provider 失败:', error);
    }
}

/**
 * 初始化服务（应用启动时调用）
 */
export async function initializeService(): Promise<void> {
    // 检查并执行迁移
    const migrationResult = await checkAndMigrate();
    if (migrationResult && !migrationResult.success) {
        logger.error('engineConfigService', '配置迁移失败:', migrationResult.errors);
    }

    // 从后端同步 Claude 环境变量到前端
    // 确保前端显示的配置与 ~/.claude/settings.json 一致
    await syncClaudeEnvVarsFromBackend();

    // 从后端自动导入 Provider（仅当该引擎尚无 Provider）
    await syncProvidersFromBackend();
}

// 导出类接口（兼容设计文档）
export class EngineConfigService {
    async createProvider(config: Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt'>) {
        return createProvider(config);
    }
    async addProvider(config: Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt'>) {
        return createProvider(config);
    }
    async updateProvider(id: string, updates: Partial<UnifiedProviderConfig>) {
        return updateProvider(id, updates);
    }
    async deleteProvider(id: string) {
        return deleteProvider(id);
    }
    getProvider(id: string) {
        return getProvider(id);
    }
    getProviders(engine: EngineType) {
        return getProvidersByEngine(engine);
    }
    getProvidersByEngine(engine: EngineType) {
        return getProvidersByEngine(engine);
    }
    async reorderProviders(engine: EngineType, orderedIds: string[]) {
        return reorderProviders(engine, orderedIds);
    }
    getCurrentEngine() {
        return getCurrentEngine();
    }
    async setCurrentEngine(engine: EngineType) {
        return setCurrentEngine(engine);
    }
    getCurrentProvider(engine: EngineType) {
        return getCurrentProvider(engine);
    }
    async setCurrentProvider(engineOrProviderId: EngineType | string, providerId?: string | null) {
        // Support both signatures: setCurrentProvider(providerId) and setCurrentProvider(engine, providerId)
        if (typeof engineOrProviderId === 'string' && providerId === undefined) {
            // Called with just providerId - infer engine from provider
            const provider = getProvider(engineOrProviderId);
            if (!provider) {
                throw new Error(`Provider not found: ${engineOrProviderId}`);
            }
            return setCurrentProvider(provider.engine, engineOrProviderId);
        } else {
            // Called with engine and providerId
            return setCurrentProvider(engineOrProviderId as EngineType, providerId ?? null);
        }
    }
    async testConnection(config: Partial<UnifiedProviderConfig>) {
        return testProviderConnection(config);
    }
    async exportConfig(options: ExportOptions) {
        return exportConfig(options);
    }
    async importConfig(data: ExportedConfig, mode: 'merge' | 'replace') {
        return importConfig(data, mode);
    }
    async checkAndMigrate() {
        return checkAndMigrate();
    }
}

export default new EngineConfigService();

/**
 * 统一引擎配置 Hook
 * 替代 useProviderConfig 和 useEngineStatus
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
    EngineType,
    UnifiedProviderConfig,
    EngineStatusInfo,
    RuntimeConfig,
    ExportedConfig,
} from '../types/provider';
import {
    createProvider,
    updateProvider,
    deleteProvider,
    getProvidersByEngine,
    reorderProviders,
    getCurrentEngine,
    setCurrentEngine as setEngine,
    getCurrentProvider,
    setCurrentProvider as setProvider,
    testProviderConnection,
    decryptApiKey,
    exportConfig,
    importConfig,
    getRuntimeConfig,
    updateRuntimeConfig,
    initializeService,
    validateProviderConfig,
    type ExportOptions,
    type ImportResult,
} from '../services/engineConfigService';
import type { ConnectionTestResult } from '../services/connectionTester';

export interface UseEngineConfigReturn {
    // 状态
    currentEngine: EngineType;
    engines: EngineStatusInfo[];
    providers: UnifiedProviderConfig[];
    currentProvider: UnifiedProviderConfig | null;
    runtimeConfig: RuntimeConfig;
    isLoading: boolean;
    error: Error | null;

    // 引擎操作
    setCurrentEngine: (engine: EngineType) => Promise<void>;
    refreshEngineStatus: () => Promise<void>;


    // 代理商操作
    addProvider: (config: Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>) => Promise<UnifiedProviderConfig>;
    updateProvider: (id: string, updates: Partial<UnifiedProviderConfig>) => Promise<void>;
    deleteProvider: (id: string) => Promise<void>;
    setCurrentProvider: (providerId: string | null) => Promise<void>;
    reorderProviders: (orderedIds: string[]) => Promise<void>;

    // 连接测试
    testConnection: (config: Partial<UnifiedProviderConfig>) => Promise<ConnectionTestResult>;

    // 导入导出
    exportConfig: (options: ExportOptions) => Promise<ExportedConfig>;
    importConfig: (data: ExportedConfig, mode: 'merge' | 'replace') => Promise<ImportResult>;

    // 解密 API Key
    decryptApiKey: (providerId: string) => Promise<string>;

    // 验证
    validateProvider: (config: Partial<UnifiedProviderConfig>) => { valid: boolean; errors: string[]; warnings: string[] };

    // 运行时配置
    updateRuntimeConfig: (updates: Partial<RuntimeConfig>) => Promise<void>;
}

interface EngineConfigState {
    currentEngine: EngineType;
    providers: UnifiedProviderConfig[];
    currentProviderId: string | null;
    runtimeConfig: RuntimeConfig;
    isLoading: boolean;
    error: Error | null;
}

const ALL_ENGINES: EngineType[] = ['claude', 'codex', 'gemini'];

export function useEngineConfig(): UseEngineConfigReturn {
    const [state, setState] = useState<EngineConfigState>({
        currentEngine: 'claude',
        providers: [],
        currentProviderId: null,
        runtimeConfig: getRuntimeConfig(),
        isLoading: true,
        error: null,
    });

    const initializedRef = useRef(false);

    // 加载初始状态
    const loadState = useCallback(async () => {
        try {
            const engine = getCurrentEngine();
            const providers = getProvidersByEngine(engine);
            const currentProvider = getCurrentProvider(engine);
            const runtimeConfig = getRuntimeConfig();

            setState(prev => ({
                ...prev,
                currentEngine: engine,
                providers,
                currentProviderId: currentProvider?.id || null,
                runtimeConfig,
                isLoading: false,
                error: null,
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error : new Error('加载配置失败'),
            }));
        }
    }, []);

    // 初始化
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        initializeService().then(() => {
            loadState();
        });
    }, [loadState]);


    // 计算引擎状态列表 - 使用 useMemo 避免每次渲染都重新创建
    // 注意：不在 useMemo 内部调用 getCurrentProvider，避免每次都读取 localStorage
    const engines: EngineStatusInfo[] = useMemo(() => {
        return ALL_ENGINES.map(engine => {
            // 从 state.providers 中查找当前引擎的 provider
            const engineProviders = state.providers.filter(p => p.engine === engine);
            // 查找当前选中的 provider（通过遍历 providers 而不是调用 getCurrentProvider）
            const currentProvId = engine === state.currentEngine ? state.currentProviderId : null;
            const currentProv = currentProvId
                ? engineProviders.find(p => p.id === currentProvId)
                : engineProviders[0]; // 默认取第一个

            return {
                engine,
                installed: true, // TODO: 实际检测安装状态
                connectionStatus: currentProv ? 'connected' : 'unknown',
                currentProvider: currentProv || undefined,
            };
        });
    }, [state.providers, state.currentProviderId, state.currentEngine]);

    // 当前代理商 - 使用 useMemo 避免每次渲染都重新计算
    // 直接从 state.providers 中查找，避免调用 getProvider 读取 localStorage
    const currentProvider = useMemo(() => {
        return state.currentProviderId
            ? state.providers.find(p => p.id === state.currentProviderId) || null
            : null;
    }, [state.currentProviderId, state.providers]);

    // 切换引擎
    const handleSetCurrentEngine = useCallback(async (engine: EngineType) => {
        try {
            await setEngine(engine);
            const providers = getProvidersByEngine(engine);
            const currentProv = getCurrentProvider(engine);

            setState(prev => ({
                ...prev,
                currentEngine: engine,
                providers,
                currentProviderId: currentProv?.id || null,
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error : new Error('切换引擎失败'),
            }));
        }
    }, []);

    // 刷新引擎状态
    const refreshEngineStatus = useCallback(async () => {
        await loadState();
    }, [loadState]);

    // 添加代理商
    const handleAddProvider = useCallback(async (
        config: Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>
    ) => {
        const newProvider = await createProvider({
            ...config,
            sortOrder: state.providers.length,
        });

        setState(prev => ({
            ...prev,
            providers: [...prev.providers, newProvider],
        }));

        return newProvider;
    }, [state.providers.length]);

    // 更新代理商
    const handleUpdateProvider = useCallback(async (
        id: string,
        updates: Partial<UnifiedProviderConfig>
    ) => {
        const previousProviders = state.providers;

        // 乐观更新
        setState(prev => ({
            ...prev,
            providers: prev.providers.map(p =>
                p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
            ),
        }));

        try {
            await updateProvider(id, updates);
        } catch (error) {
            // 回滚
            setState(prev => ({
                ...prev,
                providers: previousProviders,
                error: error instanceof Error ? error : new Error('更新失败'),
            }));
            throw error;
        }
    }, [state.providers]);


    // 删除代理商
    const handleDeleteProvider = useCallback(async (id: string) => {
        const previousProviders = state.providers;
        const previousCurrentId = state.currentProviderId;

        // 乐观更新
        setState(prev => ({
            ...prev,
            providers: prev.providers.filter(p => p.id !== id),
            currentProviderId: prev.currentProviderId === id ? null : prev.currentProviderId,
        }));

        try {
            await deleteProvider(id);
        } catch (error) {
            // 回滚
            setState(prev => ({
                ...prev,
                providers: previousProviders,
                currentProviderId: previousCurrentId,
                error: error instanceof Error ? error : new Error('删除失败'),
            }));
            throw error;
        }
    }, [state.providers, state.currentProviderId]);

    // 设置当前代理商
    const handleSetCurrentProvider = useCallback(async (providerId: string | null) => {
        try {
            await setProvider(state.currentEngine, providerId);
            setState(prev => ({
                ...prev,
                currentProviderId: providerId,
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error : new Error('设置当前代理商失败'),
            }));
            throw error;
        }
    }, [state.currentEngine]);

    // 重新排序代理商
    const handleReorderProviders = useCallback(async (orderedIds: string[]) => {
        const previousProviders = state.providers;

        // 乐观更新
        const reorderedProviders = orderedIds
            .map((id, index) => {
                const provider = state.providers.find(p => p.id === id);
                return provider ? { ...provider, sortOrder: index } : null;
            })
            .filter((p): p is UnifiedProviderConfig => p !== null);

        setState(prev => ({
            ...prev,
            providers: reorderedProviders,
        }));

        try {
            await reorderProviders(state.currentEngine, orderedIds);
        } catch (error) {
            // 回滚
            setState(prev => ({
                ...prev,
                providers: previousProviders,
                error: error instanceof Error ? error : new Error('排序失败'),
            }));
            throw error;
        }
    }, [state.providers, state.currentEngine]);

    // 测试连接
    const handleTestConnection = useCallback(async (
        config: Partial<UnifiedProviderConfig>
    ): Promise<ConnectionTestResult> => {
        return testProviderConnection({
            ...config,
            engine: config.engine || state.currentEngine,
        });
    }, [state.currentEngine]);

    // 导出配置
    const handleExportConfig = useCallback(async (options: ExportOptions) => {
        return exportConfig(options);
    }, []);

    // 导入配置
    const handleImportConfig = useCallback(async (
        data: ExportedConfig,
        mode: 'merge' | 'replace'
    ) => {
        const result = await importConfig(data, mode);
        if (result.success) {
            await loadState();
        }
        return result;
    }, [loadState]);

    // 解密 API Key
    const handleDecryptApiKey = useCallback(async (providerId: string) => {
        return decryptApiKey(providerId);
    }, []);

    // 验证代理商配置
    const handleValidateProvider = useCallback((config: Partial<UnifiedProviderConfig>) => {
        return validateProviderConfig(config);
    }, []);

    // 更新运行时配置
    const handleUpdateRuntimeConfig = useCallback(async (updates: Partial<RuntimeConfig>) => {
        const updated = await updateRuntimeConfig(updates);
        setState(prev => ({
            ...prev,
            runtimeConfig: updated,
        }));
    }, []);

    return {
        // 状态
        currentEngine: state.currentEngine,
        engines,
        providers: state.providers,
        currentProvider,
        runtimeConfig: state.runtimeConfig,
        isLoading: state.isLoading,
        error: state.error,

        // 引擎操作
        setCurrentEngine: handleSetCurrentEngine,
        refreshEngineStatus,

        // 代理商操作
        addProvider: handleAddProvider,
        updateProvider: handleUpdateProvider,
        deleteProvider: handleDeleteProvider,
        setCurrentProvider: handleSetCurrentProvider,
        reorderProviders: handleReorderProviders,

        // 连接测试
        testConnection: handleTestConnection,

        // 导入导出
        exportConfig: handleExportConfig,
        importConfig: handleImportConfig,

        // 解密
        decryptApiKey: handleDecryptApiKey,

        // 验证
        validateProvider: handleValidateProvider,

        // 运行时配置
        updateRuntimeConfig: handleUpdateRuntimeConfig,
    };
}

export default useEngineConfig;

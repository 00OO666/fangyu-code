/**
 * useMultiEngineSettings - 多引擎设置管理 Hook
 * 
 * 提供多引擎设置的加载、保存、切换功能
 * 
 * Feature: settings-refactor
 * Task: 1.2, 3.2, 4.2, 5.2
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import {
    EngineType,
    EngineSettings,
    MultiEngineSettingsStore,
    PermissionRules,
    DEFAULT_ENGINE_SETTINGS,
    createDefaultMultiEngineSettings,
    isLegacySettings,
} from '@/types/multiEngineSettings';

const STORAGE_KEY = 'fangyu-multi-engine-settings';
const LEGACY_STORAGE_KEY = 'fangyu-claude-settings';

interface UseMultiEngineSettingsReturn {
    /** 当前选中的引擎 */
    activeEngine: EngineType;
    /** 切换引擎 */
    setActiveEngine: (engine: EngineType) => void;
    /** 获取指定引擎的设置 */
    getEngineSettings: (engine: EngineType) => EngineSettings;
    /** 更新指定引擎的权限 */
    updateEnginePermissions: (engine: EngineType, permissions: PermissionRules) => void;
    /** 更新指定引擎的环境变量 */
    updateEngineEnv: (engine: EngineType, env: Record<string, string>) => void;
    /** 保存所有设置 */
    saveSettings: () => Promise<void>;
    /** 重新加载设置 */
    loadSettings: () => void;
    /** 是否正在加载 */
    loading: boolean;
    /** 是否有未保存的更改 */
    hasChanges: boolean;
    /** 完整的设置存储 */
    settings: MultiEngineSettingsStore;
}

export function useMultiEngineSettings(): UseMultiEngineSettingsReturn {
    const [settings, setSettings] = useState<MultiEngineSettingsStore>(createDefaultMultiEngineSettings);
    const [loading, setLoading] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);

    // 加载设置
    const loadSettings = useCallback(() => {
        setLoading(true);
        try {
            // 尝试加载新格式
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === 2) {
                    setSettings(parsed);
                    setLoading(false);
                    return;
                }
            }

            // 尝试迁移旧格式
            const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacyStored) {
                const legacy = JSON.parse(legacyStored);
                if (isLegacySettings(legacy)) {
                    const migrated = migrateFromLegacy(legacy);
                    setSettings(migrated);
                    // 保存迁移后的设置
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                    setLoading(false);
                    return;
                }
            }

            // 使用默认设置
            const defaultSettings = createDefaultMultiEngineSettings();
            setSettings(defaultSettings);
        } catch (error) {
            logger.error('useMultiEngineSettings', 'Failed to load multi-engine settings:', error);
            setSettings(createDefaultMultiEngineSettings());
        } finally {
            setLoading(false);
        }
    }, []);

    // 初始加载
    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // 切换引擎
    const setActiveEngine = useCallback((engine: EngineType) => {
        setSettings(prev => ({
            ...prev,
            activeEngine: engine,
            lastUpdated: Date.now(),
        }));
        setHasChanges(true);
    }, []);

    // 获取引擎设置
    const getEngineSettings = useCallback((engine: EngineType): EngineSettings => {
        return settings.engines[engine] || DEFAULT_ENGINE_SETTINGS[engine];
    }, [settings]);

    // 更新引擎权限
    const updateEnginePermissions = useCallback((engine: EngineType, permissions: PermissionRules) => {
        setSettings(prev => ({
            ...prev,
            engines: {
                ...prev.engines,
                [engine]: {
                    ...prev.engines[engine],
                    permissions,
                },
            },
            lastUpdated: Date.now(),
        }));
        setHasChanges(true);
    }, []);

    // 更新引擎环境变量
    const updateEngineEnv = useCallback((engine: EngineType, env: Record<string, string>) => {
        setSettings(prev => ({
            ...prev,
            engines: {
                ...prev.engines,
                [engine]: {
                    ...prev.engines[engine],
                    env,
                },
            },
            lastUpdated: Date.now(),
        }));
        setHasChanges(true);
    }, []);

    // 保存设置
    const saveSettings = useCallback(async () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            setHasChanges(false);
        } catch (error) {
            logger.error('useMultiEngineSettings', 'Failed to save multi-engine settings:', error);
            throw error;
        }
    }, [settings]);

    return {
        activeEngine: settings.activeEngine,
        setActiveEngine,
        getEngineSettings,
        updateEnginePermissions,
        updateEngineEnv,
        saveSettings,
        loadSettings,
        loading,
        hasChanges,
        settings,
    };
}

/**
 * 从旧格式迁移到新格式
 */
function migrateFromLegacy(legacy: any): MultiEngineSettingsStore {
    const newSettings = createDefaultMultiEngineSettings();

    // 迁移权限
    if (legacy.permissions) {
        newSettings.engines['claude-code'].permissions = {
            allow: Array.isArray(legacy.permissions.allow) ? legacy.permissions.allow : [],
            deny: Array.isArray(legacy.permissions.deny) ? legacy.permissions.deny : [],
        };
    }

    // 迁移环境变量
    if (legacy.env && typeof legacy.env === 'object') {
        newSettings.engines['claude-code'].env = {
            ...DEFAULT_ENGINE_SETTINGS['claude-code'].env,
            ...legacy.env,
        };
    }

    // 迁移通用设置
    if (legacy.language) {
        newSettings.general.language = legacy.language;
    }
    if (typeof legacy.showSystemInitialization === 'boolean') {
        newSettings.general.showSystemInitialization = legacy.showSystemInitialization;
    }
    if (typeof legacy.verbose === 'boolean') {
        newSettings.general.verbose = legacy.verbose;
    }

    return newSettings;
}

export default useMultiEngineSettings;

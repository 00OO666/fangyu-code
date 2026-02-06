/**
 * useTabPersistence - 标签页持久化逻辑
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 从 useTabs.tsx 拆分出持久化逻辑
 * - 负责 localStorage 读写和数据迁移
 *
 * _Requirements: 1.1_
 */

import { logger } from '@/lib/logger';
import { useEffect, useCallback, useRef } from 'react';
import type { Tab, PersistedTabState } from './types';
import { TAB_STORAGE_KEY } from './types';
import { getDefaultTheme, getSessionThemePreference } from '@/lib/themePreferences';

interface UseTabPersistenceOptions {
    tabs: Tab[];
    activeTabId: string | null;
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * 标签页持久化 Hook
 */
export function useTabPersistence({
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
}: UseTabPersistenceOptions) {
    /**
     * 从 localStorage 加载持久化状态
     */
    const loadPersistedState = useCallback(() => {
        try {
            const persistedState = localStorage.getItem(TAB_STORAGE_KEY);
            if (!persistedState) return;

            const { tabs: savedTabs, activeTabId: savedActiveTabId }: PersistedTabState =
                JSON.parse(persistedState);

            if (!Array.isArray(savedTabs)) return;

            // 🔧 FIX: 检测旧占位符标签页，如果发现任何旧占位符，直接清除整个 localStorage 重新开始
            const hasOldPlaceholder = savedTabs.some(
                (tab) =>
                    tab.title === 'NEW PROJECT' ||
                    tab.title === '_NEW_PROJECT_' ||
                    tab.projectPath === '_NEW_PROJECT_' ||
                    tab.projectPath === '__NEW_PROJECT__'
            );

            if (hasOldPlaceholder) {
                logger.debug('useTabPersistence', '[useTabPersistence] Detected old placeholder tabs, clearing for migration');
                localStorage.removeItem(TAB_STORAGE_KEY);
                return;
            }

            // Validate and filter tabs
            const validTabs = savedTabs
                .filter((tab) => {
                    if (!tab.id || !tab.title) {
                        logger.warn('useTabPersistence', '[useTabPersistence] Skipping invalid tab:', tab);
                        return false;
                    }
                    return true;
                })
                .map((tab) => {
                    const themeName =
                        tab.themeName ||
                        getSessionThemePreference({
                            sessionId: tab.session?.id,
                            projectPath: tab.projectPath,
                        }) ||
                        getDefaultTheme();
                    return {
                        ...tab,
                        type: tab.type || (tab.session ? 'session' : 'new'),
                        state: tab.state || 'idle',
                        hasUnsavedChanges: tab.hasUnsavedChanges ?? false,
                        smartMode: tab.smartMode ?? false,
                        themeName,
                    };
                }) as Tab[];

            // Validate activeTabId
            const validActiveTabId = validTabs.find((t) => t.id === savedActiveTabId)
                ? savedActiveTabId
                : validTabs[0]?.id || null;

            setTabs(validTabs);
            setActiveTabId(validActiveTabId);
        } catch (error) {
            logger.error('useTabPersistence', '[useTabPersistence] Failed to restore tabs:', error);
            localStorage.removeItem(TAB_STORAGE_KEY);
        }
    }, [setTabs, setActiveTabId]);

    /**
     * 保存状态到 localStorage
     */
    const saveState = useCallback(() => {
        try {
            const state: PersistedTabState = { tabs, activeTabId };
            localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            logger.error('useTabPersistence', '[useTabPersistence] Failed to persist tabs:', error);
        }
    }, [tabs, activeTabId]);

    // 初始化时加载持久化状态
    useEffect(() => {
        loadPersistedState();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 状态变化时保存 - 使用 ref 避免 saveState 变化导致不必要的 effect 触发
    const saveStateRef = useRef(saveState);
    saveStateRef.current = saveState;

    useEffect(() => {
        saveStateRef.current();
    }, [tabs, activeTabId]); // 直接依赖原始值

    return {
        loadPersistedState,
        saveState,
    };
}

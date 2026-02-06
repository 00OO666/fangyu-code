/**
 * useMultiWindow - 多窗口支持
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 从 useTabs.tsx 拆分出多窗口逻辑
 * - 负责标签页分离、窗口同步等功能
 *
 * _Requirements: 1.1_
 */

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef } from 'react';
import type { Tab } from './types';
import type { Session } from '@/lib/api';
import {
    createSessionWindow,
    emitWindowSyncEvent,
    isSessionWindow,
    onWindowSyncEvent,
} from '@/lib/windowManager';
import { getDefaultTheme, getSessionThemePreference } from '@/lib/themePreferences';

interface UseMultiWindowOptions {
    tabs: Tab[];
    activeTabId: string | null;
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
    forceCloseTab: (tabId: string) => Promise<void>;
    generateTabId: () => string;
}

/**
 * 多窗口支持 Hook
 */
export function useMultiWindow({
    tabs,
    setTabs,
    setActiveTabId,
    forceCloseTab,
    generateTabId,
}: UseMultiWindowOptions) {
    // Track detached tabs
    const detachedTabsRef = useRef<Set<string>>(new Set());

    // Listen for window sync events
    useEffect(() => {
        if (isSessionWindow()) return;

        let unlisten: (() => void) | null = null;

        const setupListener = async () => {
            unlisten = await onWindowSyncEvent((event) => {
                if (event.type === 'tab_attached') {
                    detachedTabsRef.current.delete(event.tabId);

                    const session = event.data?.session as Session | undefined;
                    const projectPath = event.projectPath;
                    const themeName =
                        event.themeName ||
                        getSessionThemePreference({
                            sessionId: session?.id,
                            projectPath: projectPath,
                        }) ||
                        getDefaultTheme();

                    if (session) {
                        setTabs((prev) => {
                            if (prev.some((t) => t.session?.id === session.id)) {
                                return prev;
                            }

                            const newTab: Tab = {
                                id: `tab-${Date.now()}-attached`,
                                title: projectPath?.split(/[/\\]/).pop() || session.id.slice(0, 8),
                                type: 'session',
                                projectPath: projectPath || session.project_path,
                                session,
                                themeName,
                                state: 'idle',
                                hasUnsavedChanges: false,
                                createdAt: Date.now(),
                                lastActiveAt: Date.now(),
                            };

                            return [...prev, newTab];
                        });

                        setActiveTabId(`tab-${Date.now()}-attached`);
                    } else if (projectPath) {
                        setTabs((prev) => {
                            const newTab: Tab = {
                                id: `tab-${Date.now()}-attached`,
                                title: projectPath.split(/[/\\]/).pop() || '新会话',
                                type: 'new',
                                projectPath,
                                themeName,
                                state: 'idle',
                                hasUnsavedChanges: false,
                                createdAt: Date.now(),
                                lastActiveAt: Date.now(),
                            };

                            return [...prev, newTab];
                        });

                        setActiveTabId(`tab-${Date.now()}-attached`);
                    }
                }
            });
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, [setTabs, setActiveTabId]);

    /**
     * 分离标签页到新窗口
     */
    const detachTab = useCallback(
        async (tabId: string): Promise<string | null> => {
            const tab = tabs.find((t) => t.id === tabId);
            if (!tab) {
                logger.error('useMultiWindow', '[useMultiWindow] Cannot detach: tab not found:', tabId);
                return null;
            }

            if (detachedTabsRef.current.has(tabId)) {
                logger.warn('useMultiWindow', '[useMultiWindow] Tab already detached:', tabId);
                return null;
            }

            try {
                const windowLabel = await createSessionWindow({
                    tabId: tab.id,
                    sessionId: tab.session?.id,
                    projectPath: tab.projectPath,
                    title: `${tab.title} - Fangyu Code`,
                    engine: tab.session?.engine,
                    themeName: tab.themeName,
                });

                detachedTabsRef.current.add(tabId);

                await emitWindowSyncEvent({
                    type: 'tab_detached',
                    tabId,
                    sessionId: tab.session?.id,
                    projectPath: tab.projectPath,
                });

                await forceCloseTab(tabId);
                return windowLabel;
            } catch (error) {
                logger.error('useMultiWindow', '[useMultiWindow] Failed to detach tab:', error);
                return null;
            }
        },
        [tabs, forceCloseTab]
    );

    /**
     * 检查标签页是否已分离
     */
    const isTabDetached = useCallback((tabId: string): boolean => {
        return detachedTabsRef.current.has(tabId);
    }, []);

    /**
     * 获取所有已分离的标签页 ID
     */
    const getDetachedTabs = useCallback((): string[] => {
        return Array.from(detachedTabsRef.current);
    }, []);

    /**
     * 直接创建新窗口（不创建标签页）
     */
    const createNewTabAsWindow = useCallback(
        async (session?: Session, projectPath?: string): Promise<string | null> => {
            try {
                const newTabId = generateTabId();
                const themeName =
                    getSessionThemePreference({
                        sessionId: session?.id,
                        projectPath: projectPath || session?.project_path,
                    }) ||
                    getDefaultTheme();
                const title = session
                    ? projectPath?.split(/[/\\]/).pop() ||
                    session.project_path?.split(/[/\\]/).pop() ||
                    '新会话'
                    : projectPath?.split(/[/\\]/).pop() || '新会话';

                const windowLabel = await createSessionWindow({
                    tabId: newTabId,
                    sessionId: session?.id,
                    projectPath: projectPath || session?.project_path,
                    title: `${title} - Fangyu Code`,
                    engine: session?.engine,
                    themeName,
                });

                detachedTabsRef.current.add(newTabId);

                await emitWindowSyncEvent({
                    type: 'tab_detached',
                    tabId: newTabId,
                    sessionId: session?.id,
                    projectPath: projectPath || session?.project_path,
                });

                return windowLabel;
            } catch (error) {
                logger.error('useMultiWindow', '[useMultiWindow] Failed to create new session as window:', error);
                return null;
            }
        },
        [generateTabId]
    );

    return {
        detachTab,
        isTabDetached,
        getDetachedTabs,
        createNewTabAsWindow,
    };
}

/**
 * useTabState - 基础标签页状态管理
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 从 useTabs.tsx 拆分出核心状态管理逻辑
 * - 负责标签页的 CRUD 操作
 *
 * _Requirements: 1.1_
 */

import { logger } from '@/lib/logger';
import { useState, useCallback, useRef, useMemo } from 'react';
import type { Tab, TabSession } from './types';
import type { Session } from '@/lib/api';
import { api } from '@/lib/api';

/**
 * 基础标签页状态管理 Hook
 */
export function useTabState() {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const nextTabId = useRef(1);
    const cleanupCallbacksRef = useRef<Map<string, () => Promise<void> | void>>(new Map());

    /**
     * 生成唯一的标签页 ID
     */
    const generateTabId = useCallback(() => {
        return `tab-${Date.now()}-${nextTabId.current++}`;
    }, []);

    /**
     * 从路径提取项目名称
     */
    const extractProjectName = useCallback((path: string): string => {
        if (!path) return '';
        const isWindowsPath = path.includes('\\');
        const separator = isWindowsPath ? '\\' : '/';
        const segments = path.split(separator);
        const projectName = segments[segments.length - 1] || '';
        return projectName
            .replace(/^(my-|test-|demo-)/, '')
            .replace(/[-_]/g, ' ')
            .trim();
    }, []);

    /**
     * 生成标签页标题
     */
    const generateTabTitle = useCallback(
        (session?: Session, projectPath?: string) => {
            if (session) {
                const projectName = extractProjectName(session.project_path);
                return projectName || '未命名会话';
            }
            if (projectPath) {
                const projectName = extractProjectName(projectPath);
                return projectName || '新会话';
            }
            return '新会话';
        },
        [extractProjectName]
    );

    /**
     * 计算带 isActive 标记的标签页列表
     * 🔧 FIX (v2.7.6): 使用 useMemo 缓存，避免每次渲染都创建新数组
     */
    const tabsWithActive: TabSession[] = useMemo(() =>
        tabs.map((tab) => ({
            ...tab,
            isActive: tab.id === activeTabId,
        })),
        [tabs, activeTabId]
    );

    /**
     * 创建新标签页
     */
    const createNewTab = useCallback(
        (session?: Session, projectPath?: string, activate: boolean = true): string => {
            const newTabId = generateTabId();
            const newTab: Tab = {
                id: newTabId,
                title: generateTabTitle(session, projectPath),
                type: session ? 'session' : 'new',
                projectPath: projectPath || session?.project_path,
                session,
                engine: session?.engine,
                state: 'idle',
                hasUnsavedChanges: false,
                createdAt: Date.now(),
                lastActiveAt: Date.now(),
            };

            setTabs((prev) => [...prev, newTab]);

            if (activate) {
                setActiveTabId(newTabId);
            }

            return newTabId;
        },
        [generateTabId, generateTabTitle]
    );

    /**
     * 创建智能会话标签页
     */
    const createSmartTab = useCallback(
        (activate: boolean = true): string => {
            const newTabId = generateTabId();
            const newTab: Tab = {
                id: newTabId,
                title: '新会话',
                type: 'new',
                smartMode: true,
                projectPath: undefined,
                engine: 'claude',
                state: 'idle',
                hasUnsavedChanges: false,
                createdAt: Date.now(),
                lastActiveAt: Date.now(),
            };

            setTabs((prev) => [...prev, newTab]);

            if (activate) {
                setActiveTabId(newTabId);
            }

            logger.debug('useTabState', '[useTabState] Created smart tab:', newTabId);
            return newTabId;
        },
        [generateTabId]
    );

    /**
     * 切换到指定标签页
     */
    const switchToTab = useCallback((tabId: string) => {
        setTabs((prev) =>
            prev.map((tab) => (tab.id === tabId ? { ...tab, lastActiveAt: Date.now() } : tab))
        );
        setActiveTabId(tabId);
    }, []);

    /**
     * 检查标签页是否可以关闭
     */
    const canCloseTab = useCallback(
        (tabId: string) => {
            const tab = tabs.find((t) => t.id === tabId);
            return {
                canClose: !tab?.hasUnsavedChanges,
                hasUnsavedChanges: Boolean(tab?.hasUnsavedChanges),
            };
        },
        [tabs]
    );

    /**
     * 强制关闭标签页
     */
    const forceCloseTab = useCallback(
        async (tabId: string) => {
            const cleanup = cleanupCallbacksRef.current.get(tabId);
            if (cleanup) {
                try {
                    await cleanup();
                } catch (error) {
                    logger.error('useTabState', `[useTabState] Cleanup failed for tab ${tabId}:`, error);
                }
                cleanupCallbacksRef.current.delete(tabId);
            }

            setTabs((prev) => {
                const remaining = prev.filter((t) => t.id !== tabId);

                if (activeTabId === tabId && remaining.length > 0) {
                    const lastActiveTab = remaining.reduce((latest, current) =>
                        current.lastActiveAt > latest.lastActiveAt ? current : latest
                    );
                    setActiveTabId(lastActiveTab.id);
                } else if (remaining.length === 0) {
                    setActiveTabId(null);
                }

                return remaining;
            });
        },
        [activeTabId]
    );

    /**
     * 关闭标签页（带确认）
     */
    const closeTab = useCallback(
        async (
            tabId: string,
            force = false
        ): Promise<{ needsConfirmation?: boolean; tabId?: string } | void> => {
            if (force) {
                return forceCloseTab(tabId);
            }

            const { canClose, hasUnsavedChanges } = canCloseTab(tabId);

            if (!canClose && hasUnsavedChanges) {
                return { needsConfirmation: true, tabId };
            }

            return forceCloseTab(tabId);
        },
        [canCloseTab, forceCloseTab]
    );

    /**
     * 更新标签页状态
     */
    const updateTabState = useCallback(
        (tabId: string, state: Tab['state'], errorMessage?: string) => {
            setTabs((prev) =>
                prev.map((tab) =>
                    tab.id === tabId ? { ...tab, state, errorMessage, lastActiveAt: Date.now() } : tab
                )
            );
        },
        []
    );

    /**
     * 更新标签页变更状态
     */
    const updateTabChanges = useCallback((tabId: string, hasChanges: boolean) => {
        setTabs((prev) =>
            prev.map((tab) => (tab.id === tabId ? { ...tab, hasUnsavedChanges: hasChanges } : tab))
        );
    }, []);

    /**
     * 更新标签页标题
     */
    const updateTabTitle = useCallback((tabId: string, title: string) => {
        setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)));
    }, []);

    /**
     * 更新标签页引擎
     */
    const updateTabEngine = useCallback(
        (tabId: string, engine: 'claude' | 'codex' | 'gemini' | 'siliconflow') => {
            setTabs((prev) =>
                prev.map((tab) => {
                    if (tab.id !== tabId) return tab;
                    const updatedSession = tab.session ? { ...tab.session, engine } : tab.session;
                    return { ...tab, engine, session: updatedSession };
                })
            );
        },
        []
    );

    /**
     * 更新标签页会话信息
     */
    const updateTabSession = useCallback(
        (
            tabId: string,
            sessionInfo: {
                sessionId: string;
                projectId: string;
                projectPath: string;
                engine?: 'claude' | 'codex' | 'gemini' | 'siliconflow' | 'kiro';
            }
        ) => {
            setTabs((prev) =>
                prev.map((tab) => {
                    if (tab.id !== tabId) return tab;
                    if (tab.session?.id === sessionInfo.sessionId) return tab;

                    const newSession: Session = {
                        id: sessionInfo.sessionId,
                        project_id: sessionInfo.projectId,
                        project_path: sessionInfo.projectPath,
                        created_at: tab.createdAt,
                        engine: sessionInfo.engine || tab.engine,
                    };

                    logger.debug('useTabState', '[useTabState] Updating tab session:', { tabId, sessionInfo });

                    return {
                        ...tab,
                        type: 'session' as const,
                        session: newSession,
                        projectPath: sessionInfo.projectPath,
                        engine: sessionInfo.engine || tab.engine,
                        lastActiveAt: Date.now(),
                    };
                })
            );
        },
        []
    );

    /**
     * 升级智能会话
     */
    const upgradeSmartSession = useCallback(
        async (
            tabId: string,
            firstMessage: string
        ): Promise<{ projectPath: string; title: string } | null> => {
            console.log('[useTabState] upgradeSmartSession called', {
                tabId,
                messageLength: firstMessage?.length,
            });

            const tab = tabs.find((t) => t.id === tabId);

            if (!tab || !tab.smartMode) {
                console.warn('[useTabState] Cannot upgrade: not a smart tab', {
                    tabId,
                    tabFound: !!tab,
                    smartMode: tab?.smartMode,
                });
                return null;
            }

            const withTimeout = <T>(promise: Promise<T>, ms: number, operation: string): Promise<T> => {
                return Promise.race([
                    promise,
                    new Promise<T>((_, reject) =>
                        setTimeout(() => reject(new Error(`${operation} 超时 (${ms / 1000}秒)`)), ms)
                    ),
                ]);
            };

            try {
                // 1. 生成会话标题
                logger.debug('useTabState', '[useTabState] Step 1: Generating session title...');
                let title: string;
                try {
                    title = await withTimeout(api.generateSessionTitle(firstMessage), 15000, '生成标题');
                } catch (titleError) {
                    logger.warn('useTabState', '[useTabState] Title generation failed, using fallback:', titleError);
                    title = firstMessage.slice(0, 30).trim() || '新会话';
                }

                // 2. 创建智能项目文件夹
                logger.debug('useTabState', '[useTabState] Step 2: Creating smart project folder...');
                const result = await withTimeout(api.createSmartProject(title), 30000, '创建项目文件夹');

                if (!result.success) {
                    logger.error('useTabState', '[useTabState] Failed to create smart project:', result.error);
                    setTabs((prev) =>
                        prev.map((t) =>
                            t.id === tabId
                                ? { ...t, state: 'error' as const, errorMessage: result.error || '创建项目失败' }
                                : t
                        )
                    );
                    return null;
                }

                // 3. 创建项目级 CLAUDE.md
                logger.debug('useTabState', '[useTabState] Step 3: Creating project CLAUDE.md...');
                try {
                    await withTimeout(
                        api.createProjectClaudeMd(result.project_path, title),
                        10000,
                        '创建 CLAUDE.md'
                    );
                } catch (error) {
                    logger.error('useTabState', '[useTabState] Failed to create CLAUDE.md (non-blocking);:', error);
                }

                // 4. 更新标签页信息
                logger.debug('useTabState', '[useTabState] Step 4: Updating tab info...');
                setTabs((prev) =>
                    prev.map((t) =>
                        t.id === tabId
                            ? {
                                ...t,
                                title: result.project_name,
                                projectPath: result.project_path,
                                smartMode: false,
                                state: 'idle' as const,
                                errorMessage: undefined,
                                lastActiveAt: Date.now(),
                            }
                            : t
                    )
                );

                return {
                    projectPath: result.project_path,
                    title: result.project_name,
                };
            } catch (error) {
                logger.error('useTabState', '[useTabState] Failed to upgrade smart session:', error);
                setTabs((prev) =>
                    prev.map((t) =>
                        t.id === tabId
                            ? {
                                ...t,
                                state: 'error' as const,
                                errorMessage: error instanceof Error ? error.message : '智能会话升级失败',
                            }
                            : t
                    )
                );
                return null;
            }
        },
        [tabs]
    );

    /**
     * 根据 ID 获取标签页
     */
    const getTabById = useCallback(
        (tabId: string): TabSession | undefined => {
            const tab = tabs.find((t) => t.id === tabId);
            if (!tab) return undefined;
            return { ...tab, isActive: tab.id === activeTabId };
        },
        [tabs, activeTabId]
    );

    /**
     * 获取当前活跃标签页
     */
    const getActiveTab = useCallback((): TabSession | undefined => {
        if (!activeTabId) return undefined;
        return getTabById(activeTabId);
    }, [activeTabId, getTabById]);

    /**
     * 在后台打开会话
     */
    const openSessionInBackground = useCallback(
        (session: Session): { tabId: string; isNew: boolean } => {
            const existingTab = tabs.find((tab) => tab.session?.id === session.id);
            if (existingTab) {
                return { tabId: existingTab.id, isNew: false };
            }
            const newTabId = createNewTab(session, undefined, false);
            return { tabId: newTabId, isNew: true };
        },
        [tabs, createNewTab]
    );

    /**
     * 获取标签页统计信息
     */
    const getTabStats = useCallback(() => {
        return {
            total: tabs.length,
            active: tabs.filter((tab) => tab.state === 'streaming').length,
            hasChanges: tabs.filter((tab) => tab.hasUnsavedChanges).length,
        };
    }, [tabs]);

    /**
     * 注册清理回调
     */
    const registerTabCleanup = useCallback((tabId: string, cleanup: () => Promise<void> | void) => {
        cleanupCallbacksRef.current.set(tabId, cleanup);
    }, []);

    /**
     * 重新排序标签页
     */
    const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;

        setTabs((prev) => {
            const newTabs = [...prev];
            const [removed] = newTabs.splice(fromIndex, 1);
            newTabs.splice(toIndex, 0, removed);
            return newTabs;
        });
    }, []);

    // 向后兼容的别名
    const updateTabStreamingStatus = useCallback(
        (tabId: string, isStreaming: boolean, _sessionId: string | null) => {
            updateTabState(tabId, isStreaming ? 'streaming' : 'idle');
        },
        [updateTabState]
    );

    const clearTabError = useCallback(
        (tabId: string) => {
            updateTabState(tabId, 'idle');
        },
        [updateTabState]
    );

    return {
        // State
        tabs,
        activeTabId,
        tabsWithActive,
        setTabs,
        setActiveTabId,

        // Generators
        generateTabId,
        generateTabTitle,

        // CRUD operations
        createNewTab,
        createSmartTab,
        switchToTab,
        closeTab,
        forceCloseTab,
        canCloseTab,

        // Updates
        updateTabState,
        updateTabChanges,
        updateTabTitle,
        updateTabEngine,
        updateTabSession,
        upgradeSmartSession,

        // Queries
        getTabById,
        getActiveTab,
        openSessionInBackground,
        getTabStats,

        // Utilities
        registerTabCleanup,
        reorderTabs,

        // Backward compatibility
        updateTabStreamingStatus,
        clearTabError,
    };
}

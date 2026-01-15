/**
 * UI Store - 全局 UI 状态管理
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 统一管理 UI 相关的全局状态
 * - 减少 Context 重渲染
 *
 * _Requirements: 1.4_
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
    // 侧边栏状态
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setSidebarWidth: (width: number) => void;
    toggleSidebar: () => void;

    // 命令面板
    commandPaletteOpen: boolean;
    setCommandPaletteOpen: (open: boolean) => void;
    toggleCommandPalette: () => void;

    // 通知
    notifications: UINotification[];
    addNotification: (notification: Omit<UINotification, 'id' | 'timestamp'>) => void;
    removeNotification: (id: string) => void;
    clearNotifications: () => void;

    // 全局加载状态
    globalLoading: boolean;
    globalLoadingMessage: string | null;
    setGlobalLoading: (loading: boolean, message?: string) => void;
}

interface UINotification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
    timestamp: number;
    duration?: number; // 自动消失时间（毫秒），0 表示不自动消失
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            // 侧边栏
            sidebarCollapsed: false,
            sidebarWidth: 280,
            setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
            setSidebarWidth: (width) => set({ sidebarWidth: width }),
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

            // 命令面板
            commandPaletteOpen: false,
            setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
            toggleCommandPalette: () =>
                set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

            // 通知
            notifications: [],
            addNotification: (notification) =>
                set((state) => ({
                    notifications: [
                        ...state.notifications,
                        {
                            ...notification,
                            id: `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            timestamp: Date.now(),
                        },
                    ],
                })),
            removeNotification: (id) =>
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                })),
            clearNotifications: () => set({ notifications: [] }),

            // 全局加载
            globalLoading: false,
            globalLoadingMessage: null,
            setGlobalLoading: (loading, message) =>
                set({
                    globalLoading: loading,
                    globalLoadingMessage: loading ? message || null : null,
                }),
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({
                sidebarCollapsed: state.sidebarCollapsed,
                sidebarWidth: state.sidebarWidth,
            }),
        }
    )
);

// 选择器 Hooks
export const useSidebarState = () =>
    useUIStore((state) => ({
        collapsed: state.sidebarCollapsed,
        width: state.sidebarWidth,
    }));

export const useSidebarActions = () =>
    useUIStore((state) => ({
        setCollapsed: state.setSidebarCollapsed,
        setWidth: state.setSidebarWidth,
        toggle: state.toggleSidebar,
    }));

export const useCommandPalette = () =>
    useUIStore((state) => ({
        open: state.commandPaletteOpen,
        setOpen: state.setCommandPaletteOpen,
        toggle: state.toggleCommandPalette,
    }));

export const useNotifications = () =>
    useUIStore((state) => ({
        notifications: state.notifications,
        add: state.addNotification,
        remove: state.removeNotification,
        clear: state.clearNotifications,
    }));

export const useGlobalLoading = () =>
    useUIStore((state) => ({
        loading: state.globalLoading,
        message: state.globalLoadingMessage,
        setLoading: state.setGlobalLoading,
    }));

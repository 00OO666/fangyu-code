/**
 * CLI 监控 Store - CLI 会话监控状态管理
 *
 * 功能：
 * - 管理所有 CLI 会话的状态
 * - 提供会话过滤、排序、搜索功能
 * - 管理视图模式切换（normal / cli-monitor）
 * - 管理网格视图配置
 * - 管理会话颜色标识
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CliSession,
  ProcessInfo,
  GridViewConfig,
  SessionFilter,
  SessionSortBy,
  SortDirection,
  ViewMode,
  SessionColor,
} from "@/types/cli-monitor";
import {
  scanCliSessions,
  getRunningProcesses,
  watchSessions,
  filterSessions,
  sortSessions,
} from "@/lib/api/cli-monitor";
import { logger } from "@/lib/logger";

interface CliMonitorStore {
  // 会话数据
  sessions: CliSession[];
  processes: ProcessInfo[];
  lastScanned: number | null;
  isScanning: boolean;
  isWatching: boolean;

  // 视图模式
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;

  // 网格视图配置
  gridConfig: GridViewConfig;
  setGridConfig: (config: Partial<GridViewConfig>) => void;

  // 过滤和排序
  filter: SessionFilter;
  sortBy: SessionSortBy;
  sortDirection: SortDirection;
  setFilter: (filter: Partial<SessionFilter>) => void;
  setSorting: (sortBy: SessionSortBy, direction?: SortDirection) => void;

  // 选中的会话
  selectedSessionId: string | null;
  setSelectedSession: (sessionId: string | null) => void;

  // 会话颜色标识
  sessionColors: SessionColor[];
  setSessionColor: (sessionId: string, color: string) => void;
  getSessionColor: (sessionId: string) => string | null;

  // 操作方法
  scan: () => Promise<void>;
  startWatch: () => Promise<void>;
  stopWatch: () => void;
  refreshProcesses: () => Promise<void>;

  // 计算属性（通过 getter 实现）
  getFilteredSessions: () => CliSession[];
  getActiveSessions: () => CliSession[];
  getInactiveSessions: () => CliSession[];
}

// 默认网格配置
const DEFAULT_GRID_CONFIG: GridViewConfig = {
  rows: 3,
  cols: 3,
  mode: "comfortable",
};

// 默认过滤器
const DEFAULT_FILTER: SessionFilter = {
  keyword: "",
  activeOnly: false,
};

// 预定义的颜色方案（Tailwind 颜色）
const COLOR_PALETTE = [
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
  "pink",
  "indigo",
  "cyan",
  "teal",
  "orange",
  "lime",
  "emerald",
  "sky",
  "violet",
  "fuchsia",
  "rose",
  "amber",
  "slate",
];

// 监听取消函数
let unwatchFn: (() => void) | null = null;

export const useCliMonitorStore = create<CliMonitorStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      sessions: [],
      processes: [],
      lastScanned: null,
      isScanning: false,
      isWatching: false,

      viewMode: "normal",
      gridConfig: DEFAULT_GRID_CONFIG,
      filter: DEFAULT_FILTER,
      sortBy: "modified",
      sortDirection: "desc",
      selectedSessionId: null,
      sessionColors: [],

      // 视图模式
      setViewMode: (mode) => {
        logger.info("CLI Monitor Store", `Setting view mode to: ${mode}`);
        set({ viewMode: mode });
      },

      toggleViewMode: () => {
        const currentMode = get().viewMode;
        const newMode = currentMode === "normal" ? "cli-monitor" : "normal";
        logger.info("CLI Monitor Store", `Toggling view mode: ${currentMode} -> ${newMode}`);
        set({ viewMode: newMode });
      },

      // 网格配置
      setGridConfig: (config) => {
        logger.info("CLI Monitor Store", `Updating grid config: ${config}`);
        set((state) => ({
          gridConfig: { ...state.gridConfig, ...config },
        }));
      },

      // 过滤和排序
      setFilter: (filter) => {
        logger.info("CLI Monitor Store", `Updating filter: ${filter}`);
        set((state) => ({
          filter: { ...state.filter, ...filter },
        }));
      },

      setSorting: (sortBy, direction) => {
        logger.info("CLI Monitor Store", `Setting sort: ${sortBy} ${direction || "desc"}`);
        set({
          sortBy,
          sortDirection: direction || get().sortDirection,
        });
      },

      // 选中会话
      setSelectedSession: (sessionId) => {
        logger.info("CLI Monitor Store", `Selected session: ${sessionId}`);
        set({ selectedSessionId: sessionId });
      },

      // 会话颜色
      setSessionColor: (sessionId, color) => {
        set((state) => {
          const existing = state.sessionColors.find((sc) => sc.session_id === sessionId);
          if (existing) {
            return {
              sessionColors: state.sessionColors.map((sc) =>
                sc.session_id === sessionId ? { ...sc, color } : sc
              ),
            };
          } else {
            return {
              sessionColors: [...state.sessionColors, { session_id: sessionId, color }],
            };
          }
        });
      },

      getSessionColor: (sessionId) => {
        const sessionColor = get().sessionColors.find((sc) => sc.session_id === sessionId);
        if (sessionColor) {
          return sessionColor.color;
        }

        // 自动分配颜色
        const sessions = get().sessions;
        const sessionIndex = sessions.findIndex((s) => s.session_id === sessionId);
        if (sessionIndex !== -1) {
          const color = COLOR_PALETTE[sessionIndex % COLOR_PALETTE.length];
          get().setSessionColor(sessionId, color);
          return color;
        }

        return null;
      },

      // 扫描会话
      scan: async () => {
        if (get().isScanning) {
          logger.warn("CLI Monitor Store", "Scan already in progress");
          return;
        }

        set({ isScanning: true });
        try {
          logger.info("CLI Monitor Store", "Starting scan...");
          const result = await scanCliSessions();
          const processes = await getRunningProcesses();

          set({
            sessions: result.sessions,
            processes,
            lastScanned: result.scanned_at,
            isScanning: false,
          });

          logger.info("CLI Monitor Store", `Scan complete: ${result.sessions.length} sessions found`);
        } catch (error) {
          logger.error("CLI Monitor Store", `Scan failed: ${error}`);
          set({ isScanning: false });
          throw error;
        }
      },

      // 开始监听
      startWatch: async () => {
        if (get().isWatching) {
          logger.warn("CLI Monitor Store", "Watch already started");
          return;
        }

        try {
          logger.info("CLI Monitor Store", "Starting watch...");
          unwatchFn = await watchSessions((sessions) => {
            set({ sessions, lastScanned: Date.now() / 1000 });
          });
          set({ isWatching: true });
          logger.info("CLI Monitor Store", "Watch started");
        } catch (error) {
          logger.error("CLI Monitor Store", `Failed to start watch: ${error}`);
          throw error;
        }
      },

      // 停止监听
      stopWatch: () => {
        if (!get().isWatching) {
          logger.warn("CLI Monitor Store", "Watch not started");
          return;
        }

        logger.info("CLI Monitor Store", "Stopping watch...");
        if (unwatchFn) {
          unwatchFn();
          unwatchFn = null;
        }
        set({ isWatching: false });
        logger.info("CLI Monitor Store", "Watch stopped");
      },

      // 刷新进程列表
      refreshProcesses: async () => {
        try {
          logger.info("CLI Monitor Store", "Refreshing processes...");
          const processes = await getRunningProcesses();
          set({ processes });
          logger.info("CLI Monitor Store", `Processes refreshed: ${processes.length} found`);
        } catch (error) {
          logger.error("CLI Monitor Store", `Failed to refresh processes: ${error}`);
          throw error;
        }
      },

      // 计算属性
      getFilteredSessions: () => {
        const { sessions, filter, sortBy, sortDirection } = get();
        let filtered = filterSessions(sessions, filter.keyword, filter.activeOnly);
        filtered = sortSessions(filtered, sortBy, sortDirection);
        return filtered;
      },

      getActiveSessions: () => {
        return get().sessions.filter((s) => s.is_active);
      },

      getInactiveSessions: () => {
        return get().sessions.filter((s) => !s.is_active);
      },
    }),
    {
      name: "cli-monitor-storage",
      partialize: (state) => ({
        viewMode: state.viewMode,
        gridConfig: state.gridConfig,
        filter: state.filter,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        sessionColors: state.sessionColors,
      }),
    }
  )
);

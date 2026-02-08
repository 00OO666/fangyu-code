/**
 * 视图模式切换按钮
 * 在 normal 和 cli-monitor 模式之间切换
 */

import React from "react";
import { cn } from "@/lib/utils";
import { useCliMonitorStore } from "@/stores/cliMonitorStore";

interface ViewModeToggleProps {
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ className }) => {
  const { viewMode, toggleViewMode } = useCliMonitorStore();
  const isCliMonitorMode = viewMode === "cli-monitor";

  return (
    <button
      onClick={toggleViewMode}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
        "hover:scale-105 active:scale-95",
        isCliMonitorMode
          ? "bg-blue-600 text-white shadow-lg"
          : "bg-gray-200 text-gray-700 hover:bg-gray-300",
        className
      )}
      title={isCliMonitorMode ? "切换到普通模式" : "切换到 CLI 监控模式"}
    >
      {/* 图标 */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {isCliMonitorMode ? (
          // CLI 监控模式图标（网格）
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        ) : (
          // 普通模式图标（单窗口）
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        )}
      </svg>

      {/* 文本 */}
      <span>{isCliMonitorMode ? "CLI 监控" : "普通模式"}</span>

      {/* 活跃会话数量徽章 */}
      {isCliMonitorMode && <ActiveSessionsBadge />}
    </button>
  );
};

/**
 * 活跃会话数量徽章
 */
const ActiveSessionsBadge: React.FC = () => {
  const getActiveSessions = useCliMonitorStore((state) => state.getActiveSessions);
  const activeSessions = getActiveSessions();
  const count = activeSessions.length;

  if (count === 0) return null;

  return (
    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-white text-blue-600 text-xs font-bold rounded-full">
      {count}
    </span>
  );
};

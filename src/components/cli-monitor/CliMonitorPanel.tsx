/**
 * CLI 监控面板组件
 * 集成窗口扫描、窗口切换、会话管理等功能
 */

import React, { useState, useEffect } from "react";
import { Monitor, RefreshCw, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WindowDropdown } from "./WindowDropdown";
import { scanWindows, scanCliSessions } from "@/lib/api/cli-monitor";
import type { WindowInfo, CliSession } from "@/types/cli-monitor";
import { logger } from "@/lib/logger";

interface CliMonitorPanelProps {
  className?: string;
}

export const CliMonitorPanel: React.FC<CliMonitorPanelProps> = ({
  className,
}) => {
  const getWindowLabel = (window: WindowInfo) =>
    window.session_summary || window.project_path || window.title;
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [sessions, setSessions] = useState<CliSession[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // 刷新所有数据
  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      const [windowResult, sessionResult] = await Promise.all([
        scanWindows(),
        scanCliSessions(),
      ]);

      setWindows(windowResult.windows);
      setSessions(sessionResult.sessions);
      setLastRefresh(new Date());

      logger.info(
        `[CliMonitorPanel] Refreshed: ${windowResult.windows.length} windows, ${sessionResult.sessions.length} sessions`
      );
    } catch (error) {
      logger.error("[CliMonitorPanel] Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 组件挂载时刷新
  useEffect(() => {
    refreshAll();
  }, []);

  // 自动刷新（每 30 秒）
  useEffect(() => {
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-6",
        "bg-[#0a0e1a] min-h-screen",
        className
      )}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30">
            <Monitor className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">CLI 监控中心</h1>
            <p className="text-sm text-gray-400">
              管理和切换 Claude CLI 窗口
            </p>
          </div>
        </div>

        <button
          onClick={refreshAll}
          disabled={isRefreshing}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-[#141824] border border-white/10",
            "text-sm text-white",
            "hover:border-blue-500/50 hover:bg-blue-500/10",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <RefreshCw
            className={cn("w-4 h-4", isRefreshing && "animate-spin")}
          />
          <span>{isRefreshing ? "刷新中..." : "刷新"}</span>
        </button>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={cn(
            "p-4 rounded-lg",
            "bg-[#141824] backdrop-blur-xl",
            "border border-white/10",
            "shadow-lg shadow-black/20"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">活跃窗口</span>
          </div>
          <div className="text-2xl font-bold text-white">{windows.length}</div>
        </div>

        <div
          className={cn(
            "p-4 rounded-lg",
            "bg-[#141824] backdrop-blur-xl",
            "border border-white/10",
            "shadow-lg shadow-black/20"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Grid3x3 className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">活跃会话</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {sessions.filter((s) => s.is_active).length}
          </div>
        </div>
      </div>

      {/* 窗口切换器 */}
      <div
        className={cn(
          "p-6 rounded-lg",
          "bg-[#141824] backdrop-blur-xl",
          "border border-white/10",
          "shadow-lg shadow-black/20"
        )}
      >
        <h2 className="text-lg font-semibold text-white mb-4">窗口切换</h2>
        <WindowDropdown
          onSelect={(window) => {
            logger.info(
              `[CliMonitorPanel] Window selected: ${getWindowLabel(window)}`
            );
          }}
        />
      </div>

      {/* 窗口列表 */}
      <div
        className={cn(
          "p-6 rounded-lg",
          "bg-[#141824] backdrop-blur-xl",
          "border border-white/10",
          "shadow-lg shadow-black/20"
        )}
      >
        <h2 className="text-lg font-semibold text-white mb-4">
          窗口列表 ({windows.length})
        </h2>

        {windows.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            未找到 Claude CLI 窗口
          </div>
        ) : (
          <div className="space-y-2">
            {windows.map((window) => (
              <div
                key={window.hwnd}
                className={cn(
                  "p-4 rounded-lg",
                  "bg-[#0a0e1a] border border-white/5",
                  "hover:border-blue-500/30 hover:bg-blue-500/5",
                  "transition-all duration-200",
                  "cursor-pointer"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {getWindowLabel(window)}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      <span>PID: {window.process_id}</span>
                      {window.session_id && (
                        <>
                          <span>•</span>
                          <span className="truncate">
                            Session: {window.session_id.slice(0, 8)}
                          </span>
                        </>
                      )}
                      {window.project_path && (
                        <>
                          <span>•</span>
                          <span className="truncate">{window.project_path}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 最后刷新时间 */}
      {lastRefresh && (
        <div className="text-xs text-gray-500 text-center">
          最后刷新: {lastRefresh.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

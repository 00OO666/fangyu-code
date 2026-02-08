/**
 * CLI 会话网格视图组件
 * 以网格布局显示所有 CLI 会话
 */

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCliMonitorStore } from "@/stores/cliMonitorStore";
import { SessionCard } from "./SessionCard";
import { logger } from "@/lib/logger";

interface SessionGridViewProps {
  className?: string;
}

export const SessionGridView: React.FC<SessionGridViewProps> = ({ className }) => {
  const {
    gridConfig,
    selectedSessionId,
    setSelectedSession,
    getFilteredSessions,
    scan,
    startWatch,
    stopWatch,
    isScanning,
    isWatching,
  } = useCliMonitorStore();

  const sessions = getFilteredSessions();

  // 组件挂载时开始扫描和监听
  useEffect(() => {
    logger.info("SessionGridView", "Component mounted, starting scan and watch");
    scan().catch((error) => {
      logger.error("SessionGridView", "Failed to scan", error);
    });

    startWatch().catch((error) => {
      logger.error("SessionGridView", "Failed to start watch", error);
    });

    // 组件卸载时停止监听
    return () => {
      logger.info("SessionGridView", "Component unmounting, stopping watch");
      stopWatch();
    };
  }, []);

  // 计算网格样式
  const gridStyle = {
    gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`,
    gridTemplateRows: `repeat(${gridConfig.rows}, 1fr)`,
  };

  // 根据模式计算卡片大小
  const cardSizeClass = {
    compact: "min-h-[120px]",
    comfortable: "min-h-[160px]",
    spacious: "min-h-[200px]",
  }[gridConfig.mode];

  // 处理会话点击
  const handleSessionClick = (sessionId: string) => {
    logger.info("SessionGridView", `Session clicked: ${sessionId}`);
    setSelectedSession(sessionId === selectedSessionId ? null : sessionId);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">CLI 会话监控</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>共 {sessions.length} 个会话</span>
            <span className="text-gray-400">|</span>
            <span className="text-green-600">
              {sessions.filter((s) => s.is_active).length} 个运行中
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 扫描状态 */}
          {isScanning && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>扫描中...</span>
            </div>
          )}

          {/* 监听状态 */}
          {isWatching && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              <span>实时监听</span>
            </div>
          )}
        </div>
      </div>

      {/* 网格容器 */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg">未找到 CLI 会话</p>
            <p className="text-sm mt-2">请确保已启动 Claude Code CLI</p>
          </div>
        ) : (
          <div className="grid gap-4 auto-rows-fr" style={gridStyle}>
            {sessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                onClick={() => handleSessionClick(session.session_id)}
                isSelected={session.session_id === selectedSessionId}
                className={cardSizeClass}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

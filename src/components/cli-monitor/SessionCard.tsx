/**
 * CLI 会话卡片组件
 * 显示单个 CLI 会话的信息卡片
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { CliSession } from "@/types/cli-monitor";
import { useCliMonitorStore } from "@/stores/cliMonitorStore";

interface SessionCardProps {
  session: CliSession;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onClick,
  isSelected = false,
  className,
}) => {
  const getSessionColor = useCliMonitorStore((state) => state.getSessionColor);
  const color = getSessionColor(session.session_id);

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return "刚刚";
  };

  // 提取项目名称
  const projectName = session.project_path.split(/[/\\]/).pop() || "未知项目";

  // 颜色类名映射
  const colorClasses = {
    border: `border-${color}-500`,
    bg: `bg-${color}-500/10`,
    text: `text-${color}-600`,
    dot: `bg-${color}-500`,
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.02]",
        isSelected && "ring-2 ring-blue-500 ring-offset-2",
        session.is_active ? colorClasses.border : "border-gray-300",
        session.is_active ? colorClasses.bg : "bg-gray-50",
        className
      )}
      onClick={onClick}
    >
      {/* 活跃状态指示器 */}
      {session.is_active && (
        <div className="absolute top-2 right-2">
          <div className={cn("w-3 h-3 rounded-full animate-pulse", colorClasses.dot)} />
        </div>
      )}

      {/* 项目名称 */}
      <div className="font-semibold text-lg mb-2 truncate" title={projectName}>
        {projectName}
      </div>

      {/* 会话摘要 */}
      <div className="text-sm text-gray-600 mb-3 line-clamp-2" title={session.summary}>
        {session.summary || "无摘要"}
      </div>

      {/* Git 分支 */}
      {session.git_branch && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
          <span className="truncate">{session.git_branch}</span>
        </div>
      )}

      {/* 底部信息栏 */}
      <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-3">
          {/* 消息数量 */}
          <div className="flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span>{session.message_count}</span>
          </div>

          {/* 状态 */}
          <div className={cn("font-medium", session.is_active ? colorClasses.text : "text-gray-400")}>
            {session.is_active ? "运行中" : "已停止"}
          </div>
        </div>

        {/* 修改时间 */}
        <div>{formatTime(session.modified)}</div>
      </div>

      {/* 会话 ID（悬停显示） */}
      <div className="absolute bottom-1 left-1 text-[10px] text-gray-400 opacity-0 hover:opacity-100 transition-opacity">
        {session.session_id.slice(0, 8)}
      </div>
    </div>
  );
};

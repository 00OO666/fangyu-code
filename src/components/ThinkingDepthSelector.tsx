/**
 * ThinkingDepthSelector - 思考深度选择器组件
 *
 * 功能:
 * - 快速切换思考深度级别
 * - 显示当前思考状态
 * - 可视化思考过程
 * - 展示思考统计信息
 *
 * 来源: Claude Extended Thinking UI
 */

import { useState, useEffect, useRef } from "react";
import {
  useExtendedThinking,
  type ThinkingDepth,
  type ThinkingSession,
} from "@/hooks/useExtendedThinking";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  Brain,
  Zap,
  Sparkles,
  Loader2,
  Clock,
  BarChart2,
  ChevronDown,
  X,
  Check,
  Info,
  Settings,
  History,
} from "lucide-react";

// ============================================================
// 组件
// ============================================================

interface ThinkingDepthSelectorProps {
  /** 思考开始回调 */
  onThinkingStart?: (session: ThinkingSession) => void;
  /** 思考结束回调 */
  onThinkingEnd?: (session: ThinkingSession) => void;
  /** 是否紧凑模式 */
  compact?: boolean;
}

export function ThinkingDepthSelector({
  onThinkingStart,
  onThinkingEnd,
  compact = false,
}: ThinkingDepthSelectorProps) {
  const thinking = useExtendedThinking({
    onThinkingStart,
    onThinkingEnd,
  });

  const {
    config,
    currentSession,
    isThinking,
    sessionHistory,
    setDepth,
    getStats,
    getDepthDescription,
    getProgress,
    cancelThinking,
    updateConfig,
  } = thinking;

  // UI 状态
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState(0);

  // 更新进度
  useEffect(() => {
    if (isThinking) {
      progressRef.current = setInterval(() => {
        setProgress(getProgress());
      }, 100);
    } else {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
      setProgress(0);
    }

    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
      }
    };
  }, [isThinking, getProgress]);

  // 深度选项配置
  const depthOptions: Array<{
    value: ThinkingDepth;
    label: string;
    icon: any;
    color: string;
    bgColor: string;
  }> = [
    {
      value: "normal",
      label: "正常",
      icon: Zap,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      value: "deep",
      label: "深度",
      icon: Brain,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      value: "ultra",
      label: "超深度",
      icon: Sparkles,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  const currentOption = depthOptions.find((opt) => opt.value === config.depth);

  // 格式化时间
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // 统计信息
  const stats = getStats();

  return (
    <div className="flex items-center gap-2">
      {/* 深度选择器 */}
      <div className="relative">
        <Button
          variant={isThinking ? "default" : "outline"}
          size={compact ? "sm" : "default"}
          onClick={() => !isThinking && setShowMenu(!showMenu)}
          disabled={isThinking}
          className={`flex items-center gap-2 ${isThinking ? "animate-pulse" : ""}`}
        >
          {isThinking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">思考中...</span>
            </>
          ) : (
            <>
              {currentOption && <currentOption.icon className={`w-4 h-4 ${currentOption.color}`} />}
              {!compact && <span className="text-sm">{currentOption?.label}</span>}
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </Button>

        {/* 下拉菜单 */}
        {showMenu && !isThinking && (
          <div className="absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-50 min-w-[220px]">
            {depthOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setDepth(option.value);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <div className={`p-1.5 rounded ${option.bgColor}`}>
                  <option.icon className={`w-4 h-4 ${option.color}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {getDepthDescription(option.value)}
                  </div>
                </div>
                {config.depth === option.value && <Check className="w-4 h-4 text-green-500" />}
              </button>
            ))}

            <div className="border-t border-[var(--border-primary)] mt-1 pt-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowSettings(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                <Settings className="w-4 h-4" />
                <span>设置</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 思考进度条 */}
      {isThinking && (
        <div className="flex items-center gap-2">
          {/* 进度条 */}
          <div className="w-24 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 时间显示 */}
          <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <Clock className="w-3 h-3" />
            <span>
              {currentSession ? formatDuration(Date.now() - currentSession.startTime) : "0s"}
            </span>
          </div>

          {/* 取消按钮 */}
          <Button variant="ghost" size="sm" onClick={cancelThinking}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 统计按钮 */}
      {!compact && sessionHistory.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(true)}
          title={`${stats.totalCount} 次思考`}
        >
          <BarChart2 className="w-4 h-4" />
        </Button>
      )}

      {/* 设置对话框 */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              思考模式设置
            </DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>配置思考深度的自动检测、显示选项和触发关键词</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 自动检测开关 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">自动检测</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  根据关键词自动切换思考深度
                </div>
              </div>
              <button
                onClick={() => updateConfig({ autoDetect: !config.autoDetect })}
                className={`w-10 h-6 rounded-full transition-colors ${
                  config.autoDetect ? "bg-green-500" : "bg-[var(--bg-tertiary)]"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    config.autoDetect ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* 显示思考过程 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">显示思考过程</div>
                <div className="text-xs text-[var(--text-tertiary)]">展示 AI 的推理步骤</div>
              </div>
              <button
                onClick={() => updateConfig({ showProcess: !config.showProcess })}
                className={`w-10 h-6 rounded-full transition-colors ${
                  config.showProcess ? "bg-green-500" : "bg-[var(--bg-tertiary)]"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    config.showProcess ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* 最大思考时间 */}
            <div>
              <div className="font-medium text-sm mb-2">最大思考时间</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="30"
                  max="300"
                  value={config.maxThinkingTime}
                  onChange={(e) => updateConfig({ maxThinkingTime: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm text-[var(--text-secondary)] w-12">
                  {config.maxThinkingTime}s
                </span>
              </div>
            </div>

            {/* 触发关键词 */}
            <div>
              <div className="font-medium text-sm mb-2">触发关键词</div>
              <div className="flex flex-wrap gap-1">
                {config.triggerKeywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* 提示信息 */}
            <div className="flex items-start gap-2 p-3 rounded bg-blue-500/10 text-sm text-blue-400">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>输入包含触发关键词（如 "ultrathink"）时将自动启用对应深度的思考模式</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 历史记录对话框 */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              思考历史统计
            </DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>查看思考模式的使用统计和历史记录</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* 统计概览 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                <div className="text-2xl font-bold">{stats.totalCount}</div>
                <div className="text-xs text-[var(--text-tertiary)]">总次数</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                <div className="text-2xl font-bold">{formatDuration(stats.avgTime)}</div>
                <div className="text-xs text-[var(--text-tertiary)]">平均时间</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                <div className="text-2xl font-bold">{formatDuration(stats.totalTime)}</div>
                <div className="text-xs text-[var(--text-tertiary)]">总时间</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                <div className="text-2xl font-bold">{stats.depthUsage.ultra}</div>
                <div className="text-xs text-[var(--text-tertiary)]">超深度次数</div>
              </div>
            </div>

            {/* 深度使用分布 */}
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
              <div className="text-sm font-medium mb-3">深度使用分布</div>
              <div className="space-y-2">
                {depthOptions.map((option) => {
                  const count = stats.depthUsage[option.value];
                  const percentage =
                    stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : 0;

                  return (
                    <div key={option.value} className="flex items-center gap-2">
                      <option.icon className={`w-4 h-4 ${option.color}`} />
                      <span className="w-16 text-sm">{option.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                        <div
                          className={`h-full ${option.bgColor.replace("/10", "")} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm text-[var(--text-secondary)]">
                        {count} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 最近会话 */}
            <div>
              <div className="text-sm font-medium mb-2">最近会话</div>
              <ScrollArea className="h-48 border border-[var(--border-primary)] rounded-lg">
                <div className="p-2 space-y-2">
                  {sessionHistory.length === 0 ? (
                    <div className="text-center py-4 text-[var(--text-tertiary)]">暂无思考记录</div>
                  ) : (
                    sessionHistory
                      .slice()
                      .reverse()
                      .map((session) => {
                        const option = depthOptions.find((o) => o.value === session.depth);
                        return (
                          <div key={session.id} className="p-2 rounded bg-[var(--bg-primary)]">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {option && <option.icon className={`w-3 h-3 ${option.color}`} />}
                                <span className="text-xs text-[var(--text-tertiary)]">
                                  {new Date(session.startTime).toLocaleString()}
                                </span>
                              </div>
                              <span className="text-xs text-[var(--text-secondary)]">
                                {session.duration ? formatDuration(session.duration) : "-"}
                              </span>
                            </div>
                            <div className="text-sm truncate">
                              {session.prompt.slice(0, 100)}
                              {session.prompt.length > 100 && "..."}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ThinkingDepthSelector;

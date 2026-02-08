import { logger } from "@/lib/logger";
import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  List,
  X,
  Search,
  LayoutList,
  LayoutGrid,
  Hash,
  ChevronUp,
  ChevronDown,
  Zap,
  Wrench,
  Brain,
  Gauge,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCost as formatCostUtil } from "@/lib/pricing";
import { calculatePromptCostSummary } from "@/lib/promptCostCalculator";
import type { PromptCostItem } from "@/lib/promptCostTypes";
import type { ClaudeStreamMessage } from "@/types/claude";

interface PromptNavigatorProps {
  /** 所有消息列表 */
  messages: ClaudeStreamMessage[];
  /** 预计算的提示词列表（可选） */
  promptItems?: PromptCostItem[];
  /** 预计算的提示词总费用（可选） */
  promptsTotalCost?: number;
  /** 预计算的会话总费用（可选） */
  sessionTotalCost?: number;
  /** 是否显示导航面板 */
  isOpen: boolean;
  /** 关闭面板回调 */
  onClose: () => void;
  /** 点击提示词回调 */
  onPromptClick: (promptIndex: number) => void;
}

/**
 * 截断文本为摘要
 */
const truncateText = (text: string, maxLength: number = 80): string => {
  // 移除多余的换行符和空格
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength) + "...";
};

/**
 * 高亮搜索关键词
 */
const highlightText = (text: string, keyword: string): React.ReactNode => {
  if (!keyword.trim()) return text;

  try {
    const parts = text.split(
      new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    );

    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  } catch (error) {
    logger.warn("PromptNavigator", "[PromptNavigator] Failed to highlight text:", error);
    return text;
  }
};

/**
 * 格式化 token 数量为易读形式
 */
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
};

/**
 * 提示词快速导航组件
 *
 * 功能特性：
 * - 搜索/过滤提示词
 * - 紧凑/标准模式切换
 * - 快速跳转到指定提示词
 * - 键盘导航支持
 */
export const PromptNavigator: React.FC<PromptNavigatorProps> = ({
  messages,
  promptItems,
  promptsTotalCost: promptsTotalCostProp,
  sessionTotalCost: sessionTotalCostProp,
  isOpen,
  onClose,
  onPromptClick,
}) => {
  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState("");
  // 紧凑模式
  const [isCompact, setIsCompact] = useState(false);
  // 快速跳转输入
  const [jumpInput, setJumpInput] = useState("");
  // 显示快速跳转
  const [showJumpInput, setShowJumpInput] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const hasExternalSummary =
    promptItems !== undefined ||
    promptsTotalCostProp !== undefined ||
    sessionTotalCostProp !== undefined;

  const fallbackSummary = useMemo(() => {
    if (hasExternalSummary) return null;
    if (messages.length === 0) return null;
    return calculatePromptCostSummary(messages);
  }, [hasExternalSummary, messages]);

  const prompts = useMemo<PromptCostItem[]>(() => {
    if (promptItems) return promptItems;
    return fallbackSummary?.items ?? [];
  }, [promptItems, fallbackSummary]);

  const promptsTotalCost = useMemo(() => {
    if (typeof promptsTotalCostProp === "number") return promptsTotalCostProp;
    if (promptItems) {
      return promptItems.reduce((sum, item) => sum + (item.cost || 0), 0);
    }
    return fallbackSummary?.promptsTotalCost ?? 0;
  }, [promptsTotalCostProp, promptItems, fallbackSummary]);

  const sessionTotalCost = useMemo(() => {
    if (typeof sessionTotalCostProp === "number") return sessionTotalCostProp;
    return fallbackSummary?.sessionTotalCost ?? 0;
  }, [sessionTotalCostProp, fallbackSummary]);

  // 过滤后的提示词
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return prompts;

    const query = searchQuery.toLowerCase();
    return prompts.filter(
      (prompt) =>
        prompt.content.toLowerCase().includes(query) || `#${prompt.promptIndex + 1}`.includes(query)
    );
  }, [prompts, searchQuery]);

  // 快速跳转处理
  const handleJump = useCallback(() => {
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= prompts.length) {
      onPromptClick(num - 1);
      setJumpInput("");
      setShowJumpInput(false);
    }
  }, [jumpInput, prompts.length, onPromptClick]);

  // 键盘快捷键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + F 聚焦搜索
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + G 快速跳转
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        setShowJumpInput(true);
        setTimeout(() => jumpInputRef.current?.focus(), 0);
      }
      // Escape 关闭
      if (e.key === "Escape") {
        if (showJumpInput) {
          setShowJumpInput(false);
        } else if (searchQuery) {
          setSearchQuery("");
        } else {
          onClose();
        }
      }
    },
    [showJumpInput, searchQuery, onClose]
  );

  // 滚动到顶部/底部
  const scrollToTop = useCallback(() => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollAreaRef.current?.scrollTo({
      top: scrollAreaRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 自动切换紧凑模式（提示词超过20条时）
  useEffect(() => {
    if (prompts.length > 20 && !isCompact) {
      setIsCompact(true);
    }
  }, [prompts.length]);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "h-full bg-background flex flex-col transition-all duration-300 ease-in-out",
          isOpen ? "w-80 border-l shadow-lg" : "w-0"
        )}
        style={{ overflow: "hidden" }}
        onKeyDown={handleKeyDown}
      >
        {isOpen && (
          <>
            {/* 头部 */}
            <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4" />
                <h3 className="font-semibold text-sm">提示词导航</h3>
                <span className="text-xs text-muted-foreground">
                  ({filteredPrompts.length}/{prompts.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* 紧凑模式切换 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCompact(!isCompact)}
                      className={cn("h-7 w-7 p-0", isCompact && "bg-accent")}
                    >
                      {isCompact ? (
                        <LayoutList className="h-3.5 w-3.5" />
                      ) : (
                        <LayoutGrid className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isCompact ? "标准模式" : "紧凑模式"}
                  </TooltipContent>
                </Tooltip>

                {/* 快速跳转 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowJumpInput(!showJumpInput);
                        setTimeout(() => jumpInputRef.current?.focus(), 0);
                      }}
                      className={cn("h-7 w-7 p-0", showJumpInput && "bg-accent")}
                    >
                      <Hash className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">快速跳转 (Ctrl+G)</TooltipContent>
                </Tooltip>

                {/* 关闭按钮 */}
                <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* 搜索框 */}
            <div className="p-2 border-b flex-shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="搜索提示词... (Ctrl+F)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-8 text-sm"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* 快速跳转输入 */}
              {showJumpInput && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">跳转到:</span>
                  <Input
                    ref={jumpInputRef}
                    type="number"
                    min={1}
                    max={prompts.length}
                    placeholder={`1-${prompts.length}`}
                    value={jumpInput}
                    onChange={(e) => setJumpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleJump();
                      }
                    }}
                    className="h-7 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleJump}
                    disabled={
                      !jumpInput || parseInt(jumpInput) < 1 || parseInt(jumpInput) > prompts.length
                    }
                    className="h-7 px-2 text-xs"
                  >
                    跳转
                  </Button>
                </div>
              )}
            </div>

            {/* 列表 */}
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className={cn("p-2", isCompact ? "space-y-0.5" : "space-y-1")}>
                {filteredPrompts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {searchQuery ? "未找到匹配的提示词" : "暂无提示词"}
                  </div>
                ) : (
                  filteredPrompts.map((prompt) => (
                    <div
                      key={prompt.promptIndex}
                      onClick={() => {
                        logger.debug("PromptNavigator", `点击提示词 #${prompt.promptIndex + 1}:`, {
                          promptIndex: prompt.promptIndex,
                          content: prompt.content.substring(0, 50) + "...",
                          timestamp: prompt.timestamp,
                        });
                        onPromptClick(prompt.promptIndex);
                      }}
                      className={cn(
                        "rounded-lg border cursor-pointer transition-all",
                        "hover:bg-accent hover:border-primary/50",
                        "active:scale-[0.99]",
                        isCompact ? "p-2" : "p-3 space-y-1.5"
                      )}
                    >
                      {isCompact ? (
                        /* 紧凑模式 - 单行显示 */
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            #{prompt.promptIndex + 1}
                          </span>
                          <span className="text-xs truncate flex-1 text-muted-foreground">
                            {highlightText(truncateText(prompt.content, 40), searchQuery)}
                          </span>
                          {prompt.cost !== undefined && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">
                                  <Zap className="h-2.5 w-2.5" />
                                  {formatCostUtil(prompt.cost)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs max-w-md">
                                <div className="space-y-2">
                                  {/* 费用明细 */}
                                  {prompt.costDetails && prompt.costDetails.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="text-muted-foreground font-medium border-b pb-1">
                                        费用明细 (总计: {formatCostUtil(prompt.cost || 0)})
                                      </div>
                                      {prompt.costDetails.map((detail, idx) => (
                                        <div
                                          key={idx}
                                          className="flex justify-between items-start gap-3 py-0.5 border-b border-border/30 last:border-0"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-foreground text-[11px]">
                                              {detail.description}
                                            </div>
                                            {detail.tokens && (
                                              <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                                                {detail.tokens.input}/{detail.tokens.output}
                                                {detail.tokens.cacheRead > 0 &&
                                                  ` (缓存:${detail.tokens.cacheRead})`}
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-amber-500 dark:text-amber-400 font-mono font-medium whitespace-nowrap text-[11px]">
                                            ${formatCostUtil(detail.cost)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Token 消耗组 */}
                                  <div className="space-y-0.5 border-t pt-1.5">
                                    <div className="text-muted-foreground font-medium">
                                      Token 消耗
                                    </div>
                                    <div>输入: {formatTokens(prompt.tokens?.input || 0)}</div>
                                    <div>输出: {formatTokens(prompt.tokens?.output || 0)}</div>
                                    {(prompt.tokens?.cacheRead || 0) > 0 && (
                                      <div>
                                        缓存读取: {formatTokens(prompt.tokens?.cacheRead || 0)}
                                      </div>
                                    )}
                                    {(prompt.tokens?.cacheWrite || 0) > 0 && (
                                      <div>
                                        缓存写入: {formatTokens(prompt.tokens?.cacheWrite || 0)}
                                      </div>
                                    )}
                                    <div className="font-semibold border-t pt-0.5">
                                      总计: {formatTokens(prompt.tokens?.total || 0)}
                                    </div>
                                  </div>

                                  {/* 工具调用组 */}
                                  {prompt.toolCalls && prompt.toolCalls.total > 0 && (
                                    <div className="space-y-0.5 border-t pt-1.5">
                                      <div className="text-muted-foreground font-medium flex items-center gap-1">
                                        <Wrench className="h-3 w-3" />
                                        工具调用 ({prompt.toolCalls.total})
                                      </div>
                                      {Object.entries(prompt.toolCalls.byType).map(
                                        ([tool, count]) => (
                                          <div key={tool} className="flex justify-between gap-3">
                                            <span className="text-muted-foreground">{tool}:</span>
                                            <span className="font-medium">{count}</span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}

                                  {/* 思考统计组 */}
                                  {prompt.thinking && prompt.thinking.count > 0 && (
                                    <div className="space-y-0.5 border-t pt-1.5">
                                      <div className="text-muted-foreground font-medium flex items-center gap-1">
                                        <Brain className="h-3 w-3" />
                                        思考统计
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">次数:</span>
                                        <span className="font-medium">{prompt.thinking.count}</span>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">Token:</span>
                                        <span className="font-medium">
                                          {formatTokens(prompt.thinking.tokens)}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* 缓存命中率 */}
                                  {prompt.cacheHitRate !== undefined && (
                                    <div className="border-t pt-1.5">
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <Gauge className="h-3 w-3" />
                                          缓存命中率:
                                        </span>
                                        <span
                                          className={cn(
                                            "font-medium",
                                            prompt.cacheHitRate > 50
                                              ? "text-green-600 dark:text-green-400"
                                              : "text-yellow-600 dark:text-yellow-400"
                                          )}
                                        >
                                          {prompt.cacheHitRate}%
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* 引擎和模型 */}
                                  {prompt.engine && (
                                    <div className="border-t pt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                                      <Cpu className="h-3 w-3" />
                                      {prompt.engine} · {prompt.model || "unknown"}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        /* 标准模式 - 多行显示 */
                        <>
                          <div className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
                                #{prompt.promptIndex + 1}
                              </div>
                              {prompt.timestamp && (
                                <div className="text-xs text-muted-foreground flex-shrink-0">
                                  {new Date(prompt.timestamp).toLocaleString("zh-CN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                    hour12: false,
                                  })}
                                </div>
                              )}
                            </div>
                            {prompt.cost !== undefined && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex-shrink-0">
                                    <Zap className="h-3 w-3" />
                                    <span className="font-medium">
                                      {formatCostUtil(prompt.cost)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs max-w-md">
                                  <div className="space-y-2">
                                    {/* 费用明细 */}
                                    {prompt.costDetails && prompt.costDetails.length > 0 && (
                                      <div className="space-y-1">
                                        <div className="text-muted-foreground font-medium border-b pb-1">
                                          费用明细 (总计: {formatCostUtil(prompt.cost || 0)})
                                        </div>
                                        {prompt.costDetails.map((detail, idx) => (
                                          <div
                                            key={idx}
                                            className="flex justify-between items-start gap-3 py-1 border-b border-border/30 last:border-0"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-foreground">
                                                {detail.description}
                                              </div>
                                              {detail.tokens && (
                                                <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                                                  {detail.tokens.input}/{detail.tokens.output}
                                                  {detail.tokens.cacheRead > 0 &&
                                                    ` (缓存:${detail.tokens.cacheRead})`}
                                                </div>
                                              )}
                                              {detail.model && (
                                                <div className="text-muted-foreground mt-0.5 text-[10px]">
                                                  {detail.model}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-amber-500 dark:text-amber-400 font-mono font-medium whitespace-nowrap">
                                              ${formatCostUtil(detail.cost)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Token 消耗组 */}
                                    <div className="space-y-1 border-t pt-1.5">
                                      <div className="text-muted-foreground font-medium">
                                        Token 消耗
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">输入:</span>
                                        <span className="font-medium">
                                          {formatTokens(prompt.tokens?.input || 0)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">输出:</span>
                                        <span className="font-medium">
                                          {formatTokens(prompt.tokens?.output || 0)}
                                        </span>
                                      </div>
                                      {(prompt.tokens?.cacheRead || 0) > 0 && (
                                        <div className="flex justify-between gap-3">
                                          <span className="text-muted-foreground">缓存读取:</span>
                                          <span className="font-medium">
                                            {formatTokens(prompt.tokens?.cacheRead || 0)}
                                          </span>
                                        </div>
                                      )}
                                      {(prompt.tokens?.cacheWrite || 0) > 0 && (
                                        <div className="flex justify-between gap-3">
                                          <span className="text-muted-foreground">缓存写入:</span>
                                          <span className="font-medium">
                                            {formatTokens(prompt.tokens?.cacheWrite || 0)}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex justify-between gap-3 border-t pt-1">
                                        <span className="text-muted-foreground">总计:</span>
                                        <span className="font-semibold">
                                          {formatTokens(prompt.tokens?.total || 0)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* 工具调用组 */}
                                    {prompt.toolCalls && prompt.toolCalls.total > 0 && (
                                      <div className="space-y-1 border-t pt-1.5">
                                        <div className="text-muted-foreground font-medium flex items-center gap-1">
                                          <Wrench className="h-3 w-3" />
                                          工具调用 ({prompt.toolCalls.total})
                                        </div>
                                        {Object.entries(prompt.toolCalls.byType).map(
                                          ([tool, count]) => (
                                            <div key={tool} className="flex justify-between gap-3">
                                              <span className="text-muted-foreground">{tool}:</span>
                                              <span className="font-medium">{count}</span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}

                                    {/* 思考统计组 */}
                                    {prompt.thinking && prompt.thinking.count > 0 && (
                                      <div className="space-y-1 border-t pt-1.5">
                                        <div className="text-muted-foreground font-medium flex items-center gap-1">
                                          <Brain className="h-3 w-3" />
                                          思考统计
                                        </div>
                                        <div className="flex justify-between gap-3">
                                          <span className="text-muted-foreground">次数:</span>
                                          <span className="font-medium">
                                            {prompt.thinking.count}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                          <span className="text-muted-foreground">Token:</span>
                                          <span className="font-medium">
                                            {formatTokens(prompt.thinking.tokens)}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* 缓存命中率 */}
                                    {prompt.cacheHitRate !== undefined && (
                                      <div className="border-t pt-1.5">
                                        <div className="flex justify-between gap-3">
                                          <span className="text-muted-foreground flex items-center gap-1">
                                            <Gauge className="h-3 w-3" />
                                            缓存命中率:
                                          </span>
                                          <span
                                            className={cn(
                                              "font-medium",
                                              prompt.cacheHitRate > 50
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-yellow-600 dark:text-yellow-400"
                                            )}
                                          >
                                            {prompt.cacheHitRate}%
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* 引擎和模型 */}
                                    {prompt.engine && (
                                      <div className="border-t pt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                                        <Cpu className="h-3 w-3" />
                                        {prompt.engine} · {prompt.model || "unknown"}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="text-sm leading-relaxed line-clamp-2">
                            {highlightText(truncateText(prompt.content, 80), searchQuery)}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* 底部工具栏 */}
            <div className="p-2 border-t bg-muted/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                {/* 快速滚动按钮 */}
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={scrollToTop}
                        className="h-6 w-6 p-0"
                        disabled={filteredPrompts.length === 0}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">滚动到顶部</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={scrollToBottom}
                        className="h-6 w-6 p-0"
                        disabled={filteredPrompts.length === 0}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">滚动到底部</TooltipContent>
                  </Tooltip>
                </div>

                {/* 统计信息 */}
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  {searchQuery ? (
                    <span>找到 {filteredPrompts.length} 条</span>
                  ) : (
                    <>
                      <span>共 {prompts.length} 个提示词</span>
                      <span>提示词 ${promptsTotalCost.toFixed(4)}</span>
                      <span>会话 ${sessionTotalCost.toFixed(4)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { List, X, Search, LayoutList, LayoutGrid, Hash, ChevronUp, ChevronDown, Zap, Wrench, Brain, Gauge, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { calculateMessageCost, formatCost as formatCostUtil } from "@/lib/pricing";
import { tokenExtractor } from "@/lib/tokenExtractor";
import type { ClaudeStreamMessage } from "@/types/claude";

interface PromptNavigatorProps {
  /** 所有消息列表 */
  messages: ClaudeStreamMessage[];
  /** 是否显示导航面板 */
  isOpen: boolean;
  /** 关闭面板回调 */
  onClose: () => void;
  /** 点击提示词回调 */
  onPromptClick: (promptIndex: number) => void;
}

interface PromptItem {
  promptIndex: number;
  content: string;
  timestamp?: string;
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost?: number;
  /** 工具调用统计 */
  toolCalls?: {
    total: number;
    byType: Record<string, number>;
  };
  /** 思考统计 */
  thinking?: {
    count: number;
    tokens: number;
  };
  /** 缓存命中率百分比 (0-100) */
  cacheHitRate?: number;
  /** 引擎 */
  engine?: string;
  /** 模型 */
  model?: string;
}

/**
 * 提取用户消息的纯文本内容
 */
const extractUserText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';

  const content = message.message.content;
  let text = '';

  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text || '')
      .join('\n');
  }

  // 处理转义字符
  if (text.includes('\\')) {
    text = text
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\r/g, '\r')
      .replace(/\\\\t/g, '\t')
      .replace(/\\\\"/g, '"')
      .replace(/\\\\'/g, "'")
      .replace(/\\\\\\\\/g, '\\');
  }

  return text;
};

/**
 * 截断文本为摘要
 */
const truncateText = (text: string, maxLength: number = 80): string => {
  // 移除多余的换行符和空格
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength) + '...';
};

/**
 * 高亮搜索关键词
 */
const highlightText = (text: string, keyword: string): React.ReactNode => {
  if (!keyword.trim()) return text;

  try {
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
        : part
    );
  } catch (error) {
    console.warn('[PromptNavigator] Failed to highlight text:', error);
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
  isOpen,
  onClose,
  onPromptClick
}) => {
  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState('');
  // 紧凑模式
  const [isCompact, setIsCompact] = useState(false);
  // 快速跳转输入
  const [jumpInput, setJumpInput] = useState('');
  // 显示快速跳转
  const [showJumpInput, setShowJumpInput] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 🔧 FIX: 强制追踪最新消息的费用变化
  // 问题：messages 数组引用不变时，useMemo 不会重新执行
  // 解决：提取最后几条消息的 costUSD 作为独立依赖
  const lastMessagesCostSignal = useMemo(() => {
    // 追踪最后 5 条消息的费用（足以覆盖最新指令的所有响应）
    const lastMessages = messages.slice(-5);
    return lastMessages.map(msg => {
      const cost = (msg as any).costUSD ?? (msg as any).totalCostUSD ?? (msg as any).cost_usd ?? (msg as any).total_cost_usd ?? 0;
      const id = (msg as any)?.message?.id || (msg as any).id || (msg as any).uuid;
      return `${id}:${cost}`;
    }).join('|');
  }, [messages]);

  // 提取所有用户提示词（按时间倒序，最新在最上方）
  const prompts = useMemo<PromptItem[]>(() => {
    let promptIndex = 0;
    const items: PromptItem[] = [];

    // 🔧 DEBUG: 诊断费用差异
    console.log('[PromptNavigator] 💰 开始费用诊断...');
    console.log(`[PromptNavigator] 总消息数: ${messages.length}`);

    // 🔧 FIX: 从 system:init 消息中提取会话级别的默认模型
    // 这样即使单条消息没有模型信息，也能使用正确的定价
    let sessionDefaultModel: string | undefined;
    for (const msg of messages) {
      if ((msg as any).type === 'system' && (msg as any).subtype === 'init') {
        sessionDefaultModel = (msg as any).model;
        if (sessionDefaultModel) {
          console.log(`[PromptNavigator] 📌 从 system:init 检测到会话模型: ${sessionDefaultModel}`);
          break;
        }
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const messageType = (message as any).type || (message.message as any)?.role;

      if (messageType === 'user') {
        const text = extractUserText(message);
        if (text) {
          // 计算该指令的 token 消耗和费用（使用与会话统计相同的逻辑）
          let tokens: PromptItem['tokens'] = undefined;
          let cost: number = 0;
          let totalInput = 0;
          let totalOutput = 0;
          let totalCacheRead = 0;
          let totalCacheWrite = 0;

          // 新增：工具调用统计
          const toolCallsMap: Record<string, number> = {};
          let totalToolCalls = 0;

          // 新增：思考统计
          let thinkingCount = 0;
          let thinkingTokens = 0;

          // 新增：引擎和模型（用于显示，取第一个消息的值）
          let displayEngine: string | undefined;
          let displayModel: string | undefined;
          // 🔧 FIX: 记录所有使用的模型（用于诊断多模型场景）
          const modelsUsed = new Set<string>();

          // 🔧 FIX: 使用 Map 去重，避免流式传输过程中重复计费
          // 注意：每条消息使用自己的模型计费，而不是统一模型！
          // 🔧 FIX: 添加 actualCost 字段以存储 Claude CLI 返回的准确费用
          const messageMap = new Map<string, { tokens: any; engine: string; model: string | undefined; actualCost: number | undefined }>();

          // 向后查找该指令对应的所有 assistant/system 消息，直到遇到下一个 user 消息
          let messagesProcessedForThisPrompt = 0;
          for (let j = i + 1; j < messages.length; j++) {
            const nextMessage = messages[j];
            const nextType = (nextMessage as any).type || (nextMessage.message as any)?.role;

            // 遇到下一个用户消息，停止统计
            if (nextType === 'user') {
              console.log(`[PromptNavigator] Prompt #${promptIndex + 1}: 处理了 ${messagesProcessedForThisPrompt} 条消息 (终止原因: 遇到下一个 user 消息)`);
              break;
            }

            // 只处理 assistant 和 system 消息（与 aggregateSessionCost 逻辑一致）
            if (nextType === 'assistant' || nextType === 'system') {
              messagesProcessedForThisPrompt++;

              // 🔧 FIX: 生成去重 key（与 sessionCost.ts 逻辑一致）
              const messageId = (nextMessage as any)?.message?.id || (nextMessage as any).id || (nextMessage as any).uuid;
              const key = messageId || `index:${j}`;

              // 使用 tokenExtractor 提取完整的 token 信息（包括缓存 token）
              const extractedTokens = tokenExtractor.extract(nextMessage);
              const msgEngine = (nextMessage as any).engine || 'claude';
              // 🔧 FIX: 使用会话默认模型作为回退（优先级：消息模型 > 会话模型 > undefined）
              const msgModel = (nextMessage as any).model || (nextMessage as any)?.message?.model || sessionDefaultModel;
              // 🔧 FIX: 提取 Claude CLI 返回的准确费用（包含完整 Extended Thinking tokens 计费）
              // 注意：Claude CLI 使用驼峰命名 costUSD/totalCostUSD
              const msgCostUsd = (nextMessage as any).costUSD ?? (nextMessage as any).totalCostUSD ?? (nextMessage as any).cost_usd ?? (nextMessage as any).total_cost_usd;

              // 🔧 FIX: 只保留最新版本（相同 key 的消息，保留 token 更多的版本）
              const existing = messageMap.get(key);
              const totalTokenCount = extractedTokens.input_tokens + extractedTokens.output_tokens + extractedTokens.cache_read_tokens + extractedTokens.cache_creation_tokens;
              const existingTokenCount = existing ? (existing.tokens.input_tokens + existing.tokens.output_tokens + existing.tokens.cache_read_tokens + existing.tokens.cache_creation_tokens) : 0;

              if (!existing || totalTokenCount > existingTokenCount) {
                messageMap.set(key, { tokens: extractedTokens, engine: msgEngine, model: msgModel, actualCost: msgCostUsd });
              }

              // 记录引擎和模型（使用第一个消息的信息，用于 UI 显示）
              if (!displayEngine) displayEngine = msgEngine;
              if (!displayModel) displayModel = msgModel;
              // 🔧 FIX: 记录所有使用的模型（用于诊断）
              if (msgModel) modelsUsed.add(msgModel);

              // 提取工具调用信息
              if (nextMessage.message?.content) {
                const content = Array.isArray(nextMessage.message.content)
                  ? nextMessage.message.content
                  : [nextMessage.message.content];

                content.forEach((block: any) => {
                  // 统计工具调用
                  if (block.type === 'tool_use') {
                    totalToolCalls++;
                    const toolName = block.name || 'unknown';
                    toolCallsMap[toolName] = (toolCallsMap[toolName] || 0) + 1;
                  }

                  // 统计思考
                  if (block.type === 'thinking') {
                    thinkingCount++;
                    thinkingTokens += block.thinking_tokens || 0;
                  }
                });
              }
            }
          }

          // 🔧 FIX: 从去重后的 messageMap 计算总费用和 token
          // 优先使用 Claude CLI 返回的 cost_usd（包含完整 Extended Thinking tokens 计费）
          for (const entry of messageMap.values()) {
            totalInput += entry.tokens.input_tokens;
            totalOutput += entry.tokens.output_tokens;
            totalCacheRead += entry.tokens.cache_read_tokens;
            totalCacheWrite += entry.tokens.cache_creation_tokens;
            // 优先使用 cost_usd，回退到自行计算
            const actualCostUsd = entry.actualCost;
            if (typeof actualCostUsd === 'number' && actualCostUsd > 0) {
              cost += actualCostUsd;
            } else {
              cost += calculateMessageCost(entry.tokens, entry.model, entry.engine);
            }
          }

          const totalTokens = totalInput + totalOutput + totalCacheRead + totalCacheWrite;
          if (totalTokens > 0) {
            tokens = {
              input: totalInput,
              output: totalOutput,
              cacheRead: totalCacheRead,
              cacheWrite: totalCacheWrite,
              total: totalTokens
            };
          }

          // 计算缓存命中率
          const cacheHitRate = totalInput > 0
            ? Math.round((totalCacheRead / totalInput) * 100)
            : undefined;

          // 🔧 DEBUG: 记录每个 prompt 的详细信息（包括多模型诊断）
          const modelsInfo = modelsUsed.size > 0 ? Array.from(modelsUsed).join(', ') : 'unknown (default pricing used!)';
          console.log(`[PromptNavigator] Prompt #${promptIndex + 1}: 💰 $${cost.toFixed(4)}, 🎯 models=[${modelsInfo}], 📊 消息数=${messagesProcessedForThisPrompt}, tokens=${totalTokens}`);
          if (modelsUsed.size === 0) {
            console.warn(`[PromptNavigator] ⚠️ Prompt #${promptIndex + 1}: 所有消息都没有模型信息，使用了默认 Sonnet 定价！`);
          } else if (modelsUsed.size > 1) {
            console.log(`[PromptNavigator] 📊 Prompt #${promptIndex + 1}: 检测到多模型场景 (${modelsUsed.size} 个不同模型)`);
          }

          items.push({
            promptIndex,
            content: text,
            timestamp: (message as any).sentAt || (message as any).timestamp,
            tokens,
            cost: totalTokens > 0 ? cost : undefined,
            toolCalls: totalToolCalls > 0 ? { total: totalToolCalls, byType: toolCallsMap } : undefined,
            thinking: thinkingCount > 0 ? { count: thinkingCount, tokens: thinkingTokens } : undefined,
            cacheHitRate,
            engine: displayEngine,
            model: displayModel
          });
          promptIndex++;
        }
      }
    }

    // 🔧 DEBUG: 打印总费用统计
    const navigatorTotalCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);
    console.log(`[PromptNavigator] 📊 统计汇总:`);
    console.log(`  - 总 prompt 数: ${items.length}`);
    console.log(`  - PromptNavigator 计算总费用: $${navigatorTotalCost.toFixed(4)}`);
    console.log(`  - 提示：如果与 SessionCost 差异大，可能是模型识别错误或遗漏消息`);

    // 倒序排列：最新的指令排在最上方
    return items.reverse();
  }, [messages, lastMessagesCostSignal]);  // 🔧 FIX: 使用 lastMessagesCostSignal 追踪最新消息费用变化

  // 过滤后的提示词
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return prompts;

    const query = searchQuery.toLowerCase();
    return prompts.filter(prompt =>
      prompt.content.toLowerCase().includes(query) ||
      `#${prompt.promptIndex + 1}`.includes(query)
    );
  }, [prompts, searchQuery]);

  // 快速跳转处理
  const handleJump = useCallback(() => {
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= prompts.length) {
      onPromptClick(num - 1);
      setJumpInput('');
      setShowJumpInput(false);
    }
  }, [jumpInput, prompts.length, onPromptClick]);

  // 键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + F 聚焦搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    // Ctrl/Cmd + G 快速跳转
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      setShowJumpInput(true);
      setTimeout(() => jumpInputRef.current?.focus(), 0);
    }
    // Escape 关闭
    if (e.key === 'Escape') {
      if (showJumpInput) {
        setShowJumpInput(false);
      } else if (searchQuery) {
        setSearchQuery('');
      } else {
        onClose();
      }
    }
  }, [showJumpInput, searchQuery, onClose]);

  // 滚动到顶部/底部
  const scrollToTop = useCallback(() => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
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
        style={{ overflow: 'hidden' }}
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
                    {isCompact ? <LayoutList className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isCompact ? '标准模式' : '紧凑模式'}
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
                <TooltipContent side="bottom">
                  快速跳转 (Ctrl+G)
                </TooltipContent>
              </Tooltip>

              {/* 关闭按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
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
                  onClick={() => setSearchQuery('')}
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
                    if (e.key === 'Enter') {
                      handleJump();
                    }
                  }}
                  className="h-7 text-sm flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleJump}
                  disabled={!jumpInput || parseInt(jumpInput) < 1 || parseInt(jumpInput) > prompts.length}
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
                  {searchQuery ? '未找到匹配的提示词' : '暂无提示词'}
                </div>
              ) : (
                filteredPrompts.map((prompt) => (
                  <div
                    key={prompt.promptIndex}
                    onClick={() => onPromptClick(prompt.promptIndex)}
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
                            <TooltipContent side="left" className="text-xs max-w-xs">
                              <div className="space-y-2">
                                {/* Token 消耗组 */}
                                <div className="space-y-0.5">
                                  <div className="text-muted-foreground font-medium">Token 消耗</div>
                                  <div>输入: {formatTokens(prompt.tokens?.input || 0)}</div>
                                  <div>输出: {formatTokens(prompt.tokens?.output || 0)}</div>
                                  {(prompt.tokens?.cacheRead || 0) > 0 && (
                                    <div>缓存读取: {formatTokens(prompt.tokens?.cacheRead || 0)}</div>
                                  )}
                                  {(prompt.tokens?.cacheWrite || 0) > 0 && (
                                    <div>缓存写入: {formatTokens(prompt.tokens?.cacheWrite || 0)}</div>
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
                                    {Object.entries(prompt.toolCalls.byType).map(([tool, count]) => (
                                      <div key={tool} className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">{tool}:</span>
                                        <span className="font-medium">{count}</span>
                                      </div>
                                    ))}
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
                                      <span className="font-medium">{formatTokens(prompt.thinking.tokens)}</span>
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
                                      <span className={cn(
                                        "font-medium",
                                        prompt.cacheHitRate > 50 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
                                      )}>
                                        {prompt.cacheHitRate}%
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* 引擎和模型 */}
                                {prompt.engine && (
                                  <div className="border-t pt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Cpu className="h-3 w-3" />
                                    {prompt.engine} · {prompt.model || 'unknown'}
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
                                {new Date(prompt.timestamp).toLocaleString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                })}
                              </div>
                            )}
                          </div>
                          {prompt.cost !== undefined && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex-shrink-0">
                                  <Zap className="h-3 w-3" />
                                  <span className="font-medium">{formatCostUtil(prompt.cost)}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs max-w-xs">
                                <div className="space-y-2">
                                  {/* Token 消耗组 */}
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground font-medium">Token 消耗</div>
                                    <div className="flex justify-between gap-3">
                                      <span className="text-muted-foreground">输入:</span>
                                      <span className="font-medium">{formatTokens(prompt.tokens?.input || 0)}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <span className="text-muted-foreground">输出:</span>
                                      <span className="font-medium">{formatTokens(prompt.tokens?.output || 0)}</span>
                                    </div>
                                    {(prompt.tokens?.cacheRead || 0) > 0 && (
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">缓存读取:</span>
                                        <span className="font-medium">{formatTokens(prompt.tokens?.cacheRead || 0)}</span>
                                      </div>
                                    )}
                                    {(prompt.tokens?.cacheWrite || 0) > 0 && (
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">缓存写入:</span>
                                        <span className="font-medium">{formatTokens(prompt.tokens?.cacheWrite || 0)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between gap-3 border-t pt-1">
                                      <span className="text-muted-foreground">总计:</span>
                                      <span className="font-semibold">{formatTokens(prompt.tokens?.total || 0)}</span>
                                    </div>
                                  </div>

                                  {/* 工具调用组 */}
                                  {prompt.toolCalls && prompt.toolCalls.total > 0 && (
                                    <div className="space-y-1 border-t pt-1.5">
                                      <div className="text-muted-foreground font-medium flex items-center gap-1">
                                        <Wrench className="h-3 w-3" />
                                        工具调用 ({prompt.toolCalls.total})
                                      </div>
                                      {Object.entries(prompt.toolCalls.byType).map(([tool, count]) => (
                                        <div key={tool} className="flex justify-between gap-3">
                                          <span className="text-muted-foreground">{tool}:</span>
                                          <span className="font-medium">{count}</span>
                                        </div>
                                      ))}
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
                                        <span className="font-medium">{prompt.thinking.count}</span>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">Token:</span>
                                        <span className="font-medium">{formatTokens(prompt.thinking.tokens)}</span>
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
                                        <span className={cn(
                                          "font-medium",
                                          prompt.cacheHitRate > 50 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
                                        )}>
                                          {prompt.cacheHitRate}%
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* 引擎和模型 */}
                                  {prompt.engine && (
                                    <div className="border-t pt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                                      <Cpu className="h-3 w-3" />
                                      {prompt.engine} · {prompt.model || 'unknown'}
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
              <div className="text-xs text-muted-foreground">
                {searchQuery ? (
                  <span>找到 {filteredPrompts.length} 条</span>
                ) : (
                  <span>共 {prompts.length} 个提示词</span>
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

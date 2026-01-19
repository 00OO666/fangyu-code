import React, { useImperativeHandle, forwardRef, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { StreamMessageV2 } from "@/components/message";
import type { MessageGroup } from "@/lib/subagentGrouping";
import { useSession } from "@/contexts/SessionContext";
import { CliProcessingIndicator } from "./CliProcessingIndicator";

/**
 * ✅ SessionMessages v3.4 - 修复 flushSync 警告
 *
 * 🔧 重大变更：
 * - v3.4: 使用 queueMicrotask 延迟 measureElement，避免渲染期间调用 flushSync
 * - v3.3: 使用 isUserScrolling ref 追踪用户滚动状态
 * - 用户滚动时禁用位置调整，程序滚动时启用
 * - 增加 overscan 减少滚动时的测量
 */

export interface SessionMessagesRef {
  scrollToPrompt: (promptIndex: number) => void;
  /** 滚动到底部（使用虚拟列表的 scrollToIndex，解决消息过多时滚动不到底的问题） */
  scrollToBottom: () => void;
}

interface SessionMessagesProps {
  messageGroups: MessageGroup[];
  isLoading: boolean;
  error?: string | null;
  parentRef: React.RefObject<HTMLDivElement>;
  /** 取消执行回调 - 用于CLI风格处理指示器 */
  onCancel?: () => void;
}

export const SessionMessages = forwardRef<SessionMessagesRef, SessionMessagesProps>(({
  messageGroups,
  isLoading,
  error,
  parentRef,
  onCancel
}, ref) => {
  // ✅ 从 SessionContext 获取配置和回调，避免 Props Drilling
  const { settings, sessionId, projectId, projectPath, onLinkDetected, onRevert, getPromptIndexForMessage, displayableToMessagesIndexMap } = useSession();

  // 使用 useRef 存储 messageGroups，避免 useVirtualizer 配置函数重新创建
  const messageGroupsRef = useRef(messageGroups);
  messageGroupsRef.current = messageGroups;

  // 🆕 v3.3: 追踪用户是否正在主动滚动
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 监听用户滚动事件
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleUserScroll = () => {
      isUserScrollingRef.current = true;

      // 清除之前的超时
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }

      // 500ms 后重置状态（用户停止滚动后）
      userScrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 500);
    };

    scrollElement.addEventListener('wheel', handleUserScroll, { passive: true });
    scrollElement.addEventListener('touchmove', handleUserScroll, { passive: true });
    scrollElement.addEventListener('pointerdown', handleUserScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('wheel', handleUserScroll);
      scrollElement.removeEventListener('touchmove', handleUserScroll);
      scrollElement.removeEventListener('pointerdown', handleUserScroll);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [parentRef]);

  /**
   * ✅ v3.0: 优化 estimateSize，使估算更接近实际值
   * 官方建议：估算最大可能的尺寸，以确保 smooth-scrolling 正常工作
   */
  const estimateSize = React.useCallback((index: number) => {
    const messageGroup = messageGroupsRef.current[index];
    if (!messageGroup) return 300;

    // subagent 消息通常较大
    if (messageGroup.type === 'subagent') {
      const subagentCount = messageGroup.group?.subagentMessages?.length ?? 1;
      return 200 + subagentCount * 150;
    }

    // aggregated 消息根据内容估算
    if (messageGroup.type === 'aggregated') {
      let height = 120;
      messageGroup.messages.forEach(msg => {
        if (msg.type === 'thinking') {
          height += 100;
        }
        if (msg.message?.content && Array.isArray(msg.message.content)) {
          const toolCalls = msg.message.content.filter((c: any) => c.type === 'tool_use');
          height += toolCalls.length * 80;
          const toolResults = msg.message.content.filter((c: any) => c.type === 'tool_result');
          height += toolResults.length * 60;
        }
      });
      return Math.max(height, 150);
    }

    // 普通消息
    const message = messageGroup.message;
    if (!message) return 300;

    if (message.type === 'system') return 120;
    if (message.type === 'user') {
      const content = typeof message.content === 'string' ? message.content : '';
      const lineCount = Math.ceil(content.length / 60);
      return Math.max(100 + lineCount * 24, 150);
    }
    if (message.type === 'assistant') {
      const content = typeof message.content === 'string' ? message.content : '';
      const hasCodeBlock = content.includes('```');
      const lineCount = Math.ceil(content.length / 60);
      let height = 120 + lineCount * 24;
      if (hasCodeBlock) height += 200;
      return Math.min(Math.max(height, 200), 1200);
    }

    return 300;
  }, []);

  const getItemKey = React.useCallback((index: number) => {
    return messageGroupsRef.current[index]?.id ?? `msg-${index}`;
  }, []);

  /**
   * ✅ v3.3: 使用官方推荐的 useVirtualizer 配置
   */
  const rowVirtualizer = useVirtualizer({
    count: messageGroups.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    getItemKey,
    overscan: 10, // 增加 overscan 减少滚动时的测量

    /**
     * 🔧 v3.3: 智能滚动位置调整
     * - 用户主动滚动时：禁用调整，避免干扰用户操作
     * - 程序滚动时：启用调整，保持视觉连续性
     */
    shouldAdjustScrollPositionOnItemSizeChange: () => {
      // 用户正在滚动时，不调整位置
      return !isUserScrollingRef.current;
    },
  });

  /**
   * 🔧 v3.4: 使用 queueMicrotask 延迟测量
   * 避免在 React 渲染期间调用 flushSync
   */
  const measureElementRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      queueMicrotask(() => {
        rowVirtualizer.measureElement(node);
      });
    }
  }, [rowVirtualizer]);

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (messageGroups.length === 0) return;

      rowVirtualizer.scrollToIndex(messageGroups.length - 1, {
        align: 'end',
        behavior: 'auto',
      });

      // 额外保障：等待虚拟列表渲染后再次滚动
      setTimeout(() => {
        if (parentRef.current) {
          parentRef.current.scrollTo({
            top: parentRef.current.scrollHeight,
            behavior: 'auto',
          });
        }
      }, 100);
    },
    scrollToPrompt: (promptIndex: number) => {
      let targetGroupIndex = -1;
      let currentPromptIndex = 0;

      for (let i = 0; i < messageGroups.length; i++) {
        const group = messageGroups[i];

        if (group.type === 'normal') {
          const message = group.message;
          const messageType = (message as any).type || (message.message as any)?.role;

          if (messageType === 'user') {
            const content = message.message?.content;
            let hasText = false;

            if (typeof content === 'string') {
              hasText = content.trim().length > 0;
            } else if (Array.isArray(content)) {
              hasText = content.some((item: any) =>
                item.type === 'text' && item.text?.trim()
              );
            }

            if (hasText) {
              if (currentPromptIndex === promptIndex) {
                targetGroupIndex = i;
                break;
              }
              currentPromptIndex++;
            }
          }
        }
      }

      if (targetGroupIndex === -1) {
        console.warn(`[scrollToPrompt] ❌ 未找到 promptIndex=${promptIndex}`);
        return;
      }

      rowVirtualizer.scrollToIndex(targetGroupIndex, {
        align: 'start',
        behavior: 'auto',
      });

      requestAnimationFrame(() => {
        setTimeout(() => {
          const promptElement = document.querySelector(`[data-prompt-index="${promptIndex}"]`);
          if (promptElement) {
            promptElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest'
            });
            requestAnimationFrame(() => {
              if (parentRef.current) {
                parentRef.current.scrollTop = Math.max(0, parentRef.current.scrollTop - 60);
              }
            });
          }
        }, 50);
      });
    }
  }));

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto relative"
      data-virtual-list="true"
    >
      <div
        className="relative w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[85%] mx-auto px-4 pt-8 pb-4"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          minHeight: '100px',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const messageGroup = messageGroups[virtualItem.index];

          if (!messageGroup) {
            console.warn('[SessionMessages] messageGroup is undefined for index:', virtualItem.index);
            return null;
          }

          const message = messageGroup.type === 'normal' ? messageGroup.message : null;
          const originalIndex = messageGroup.type === 'normal' ? messageGroup.index : undefined;
          const messagesIndex = originalIndex !== undefined && displayableToMessagesIndexMap
            ? displayableToMessagesIndexMap.get(originalIndex)
            : undefined;
          const promptIndex = message && message.type === 'user' && messagesIndex !== undefined && getPromptIndexForMessage
            ? getPromptIndexForMessage(messagesIndex)
            : undefined;

          const isStreaming = virtualItem.index === messageGroups.length - 1 && isLoading;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={measureElementRef}
              className="absolute inset-x-4"
              style={{
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <StreamMessageV2
                messageGroup={messageGroup}
                onLinkDetected={onLinkDetected}
                claudeSettings={settings}
                isStreaming={isStreaming}
                promptIndex={promptIndex}
                sessionId={sessionId ?? undefined}
                projectId={projectId ?? undefined}
                projectPath={projectPath}
                onRevert={onRevert}
              />
            </div>
          );
        })}
      </div>

      {/* Error indicator */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive w-full max-w-5xl mx-auto mb-4"
        >
          {error}
        </motion.div>
      )}

      {/* CLI风格的处理状态指示器 */}
      <div className="sticky bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <CliProcessingIndicator
            isProcessing={isLoading}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
});

SessionMessages.displayName = "SessionMessages";

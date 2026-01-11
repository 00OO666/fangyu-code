import React, { useImperativeHandle, forwardRef, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { StreamMessageV2 } from "@/components/message";
import type { MessageGroup } from "@/lib/subagentGrouping";
import { useSession } from "@/contexts/SessionContext";
import { CliProcessingIndicator } from "./CliProcessingIndicator";

/**
 * ✅ MeasurableItem: 自动监听高度变化的虚拟列表项
 *
 * 使用 ResizeObserver 并在内容变化时自动通知虚拟列表重新测量。
 * 仅对正在流式输出的消息进行防抖，历史消息立即更新以防止滚动抖动。
 *
 * 🔧 FIX: 只对新消息启用动画，历史消息禁用动画以提升性能
 */
const MeasurableItem = ({ virtualItem, measureElement, isStreaming, isNewMessage, children, ...props }: any) => {
  const elRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef(measureElement);

  // 保持 measureElement 引用最新
  useEffect(() => {
    measureRef.current = measureElement;
  }, [measureElement]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // 初始测量 - 立即执行确保占位准确
    measureRef.current(el);

    let frameId: number;

    // 创建观察者
    const observer = new ResizeObserver(() => {
      if (isStreaming) {
        // ✅ 流式消息：使用防抖，避免每帧重绘导致的性能问题
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          if (elRef.current) {
            measureRef.current(elRef.current);
          }
        });
      } else {
        // ✅ 历史消息：立即响应（通过 rAF 避免 Loop 错误），确保向上滚动时高度修正及时，减少抖动
        requestAnimationFrame(() => {
          if (elRef.current) {
            measureRef.current(elRef.current);
          }
        });
      }
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [isStreaming]); // 添加 isStreaming 依赖

  // 🔧 FIX: 只对新消息启用动画，历史消息直接渲染
  if (!isNewMessage) {
    return (
      <div
        {...props}
        ref={elRef}
        data-index={virtualItem.index}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      {...props}
      ref={elRef}
      data-index={virtualItem.index}
    >
      {children}
    </motion.div>
  );
};

export interface SessionMessagesRef {
  scrollToPrompt: (promptIndex: number) => void;
  /** 滚动到底部（使用虚拟列表的 scrollToIndex，解决消息过多时滚动不到底的问题） */
  scrollToBottom: () => void;
}

/**
 * ✅ 架构优化: 简化 Props 接口，移除可从 SessionContext 获取的数据
 *
 * 优化前: 10+ 个 props，包含配置、回调和会话数据
 * 优化后: 只保留核心渲染相关的 props
 *
 * 从 SessionContext 获取:
 * - claudeSettings → settings
 * - effectiveSession → session, sessionId, projectId, projectPath
 * - handleLinkDetected → onLinkDetected
 * - handleRevert → onRevert
 * - getPromptIndexForMessage → getPromptIndexForMessage
 */
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
  /**
   * ✅ OPTIMIZED: Virtual list configuration for improved performance
   */
  const rowVirtualizer = useVirtualizer({
    count: messageGroups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // ✅ Dynamic height estimation based on message group type
      const messageGroup = messageGroups[index];
      if (!messageGroup) return 250; // 增加默认高度

      // For subagent groups, estimate larger height
      if (messageGroup.type === 'subagent') {
        return 450; // 增加 subagent 组高度估算
      }

      // For aggregated groups, estimate height based on content
      if (messageGroup.type === 'aggregated') {
        // Base height for bubble padding etc (增加基础高度)
        let height = 80;
        messageGroup.messages.forEach(msg => {
            // Add height for thinking blocks
            if (msg.type === 'thinking' || (msg.message?.content && Array.isArray(msg.message.content) && msg.message.content.some((c:any) => c.type === 'thinking'))) {
                height += 120; // 增加 thinking 块高度估算
            }
            // Add height for tool calls
            if (msg.message?.content && Array.isArray(msg.message.content)) {
                const toolCalls = msg.message.content.filter((c:any) => c.type === 'tool_use');
                height += toolCalls.length * 80; // 增加工具调用高度估算

                // Add height for tool results (if visible)
                const toolResults = msg.message.content.filter((c:any) => c.type === 'tool_result');
                height += toolResults.length * 60; // 增加工具结果高度估算
            }
        });
        return Math.max(height, 120); // 增加最小高度
      }

      // For normal messages, estimate based on message type
      const message = messageGroup.message;
      if (!message) return 250; // 增加默认高度

      // Estimate different heights for different message types
      if (message.type === 'system') return 100;  // 增加 system 消息高度
      if (message.type === 'user') return 180;   // 增加 user 消息高度
      if (message.type === 'assistant') {
        // Assistant messages with code blocks are larger
        const hasCodeBlock = message.content && typeof message.content === 'string' &&
                            message.content.includes('```');
        return hasCodeBlock ? 350 : 250; // 增加 assistant 消息高度
      }
      return 250; // 增加默认高度
    },
    overscan: 3, // 🔧 FIX: 从 12 降到 3，减少不必要的渲染，提升性能
    measureElement: (element) => {
      // Ensure element is fully rendered before measurement
      return element?.getBoundingClientRect().height ?? 200;
    },
  });

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (messageGroups.length === 0) return;

      // 🔧 优化：瞬间滚动到底部（用户反馈需要快速跳转）
      rowVirtualizer.scrollToIndex(messageGroups.length - 1, {
        align: 'end',
        behavior: 'auto', // 改为 auto 实现瞬间跳转
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
      console.log(`[scrollToPrompt] 🎯 直接通过 DOM 查找 promptIndex=${promptIndex}`);

      // 🔧 NEW APPROACH: 直接通过 data-prompt-index 查找 DOM 元素
      // 不再遍历 messageGroups，避免索引不匹配问题
      const promptElement = document.querySelector(`[data-prompt-index="${promptIndex}"]`);

      if (promptElement) {
        console.log(`[scrollToPrompt] ✅ 找到 DOM 元素，开始滚动`);

        // 使用 scrollIntoView 滚动到元素
        promptElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });

        // 增加偏移量，确保标题和上方留白完全可见
        setTimeout(() => {
          if (parentRef.current) {
            parentRef.current.scrollTop = Math.max(0, parentRef.current.scrollTop - 60);
          }
        }, 300);
      } else {
        console.warn(`[scrollToPrompt] ❌ 未找到 DOM 元素 [data-prompt-index="${promptIndex}"]`);
        console.log(`[scrollToPrompt] 💡 元素可能在虚拟列表之外，尝试通过 messageGroups 查找...`);

        // 回退方案：遍历 messageGroups 查找对应的消息
        let currentPromptIndex = 0;
        let targetGroupIndex = -1;

        for (let i = 0; i < messageGroups.length; i++) {
          const group = messageGroups[i];

          if (group.type === 'normal') {
            const message = group.message;
            const messageType = (message as any).type || (message.message as any)?.role;

            if (messageType === 'user') {
              const content = message.message?.content;
              let text = '';

              if (typeof content === 'string') {
                text = content;
              } else if (Array.isArray(content)) {
                text = content
                  .filter((item: any) => item.type === 'text')
                  .map((item: any) => item.text || '')
                  .join('\n');
              }

              if (text.includes('\\')) {
                text = text
                  .replace(/\\\\n/g, '\n')
                  .replace(/\\\\r/g, '\r')
                  .replace(/\\\\t/g, '\t')
                  .replace(/\\\\"/g, '"')
                  .replace(/\\\\'/g, "'")
                  .replace(/\\\\\\\\/g, '\\');
              }

              if (text.trim()) {
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
          console.error(`[scrollToPrompt] ❌ 在 messageGroups 中也未找到 promptIndex=${promptIndex}`);
          return;
        }

        console.log(`[scrollToPrompt] 📍 找到 targetGroupIndex=${targetGroupIndex}，滚动到虚拟列表位置`);

        // 滚动到虚拟列表位置
        rowVirtualizer.scrollToIndex(targetGroupIndex, {
          align: 'start',
          behavior: 'auto',
        });

        // 等待渲染后再次尝试查找 DOM 元素
        setTimeout(() => {
          const element = document.querySelector(`[data-prompt-index="${promptIndex}"]`);
          if (element) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest'
            });
            setTimeout(() => {
              if (parentRef.current) {
                parentRef.current.scrollTop = Math.max(0, parentRef.current.scrollTop - 60);
              }
            }, 50);
          }
        }, 300);
      }
    }
  }));

  return (
    // ✅ 重构布局: 移除固定 paddingBottom，因为输入框不再使用 fixed 定位
    // 消息区域现在是 Flex 容器的一部分，自然与输入区域分离
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto relative"
      style={{
        paddingTop: '20px',
        paddingBottom: '24px', // 底部留一点间距即可
      }}
    >
      <div
        className="relative w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[85%] mx-auto px-4 pt-8 pb-4"
        style={{
          height: `${Math.max(rowVirtualizer.getTotalSize(), 100)}px`,
          minHeight: '100px',
        }}
      >
        <AnimatePresence>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const messageGroup = messageGroups[virtualItem.index];

            // 防御性检查：确保 messageGroup 存在
            if (!messageGroup) {
              console.warn('[SessionMessages] messageGroup is undefined for index:', virtualItem.index);
              return null;
            }

            const message = messageGroup.type === 'normal' ? messageGroup.message : null;
            const originalIndex = messageGroup.type === 'normal' ? messageGroup.index : undefined;
            // 🔧 FIX: 将 displayableMessages 的索引转换为 messages 的索引
            const messagesIndex = originalIndex !== undefined && displayableToMessagesIndexMap
              ? displayableToMessagesIndexMap.get(originalIndex)
              : undefined;
            const promptIndex = message && message.type === 'user' && messagesIndex !== undefined && getPromptIndexForMessage
              ? getPromptIndexForMessage(messagesIndex)
              : undefined;

            const isStreaming = virtualItem.index === messageGroups.length - 1 && isLoading;
            // 🔧 FIX: 只对最后一条消息启用动画，提升性能
            const isNewMessage = virtualItem.index === messageGroups.length - 1;

            return (
              <MeasurableItem
                key={messageGroup.id}
                virtualItem={virtualItem}
                measureElement={rowVirtualizer.measureElement}
                isStreaming={isStreaming}
                isNewMessage={isNewMessage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-x-4"
                style={{
                  top: virtualItem.start,
                }}
              >
                {/* ✅ 架构优化: StreamMessageV2 现在从 SessionContext 获取数据 */}
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
              </MeasurableItem>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Error indicator - 移除固定 marginBottom，因为输入框不再是 fixed 定位 */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive w-full max-w-5xl mx-auto mb-4"
        >
          {error}
        </motion.div>
      )}

      {/* CLI风格的处理状态指示器 - 固定在底部，不随滚动消失 */}
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

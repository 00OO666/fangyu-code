/**
 * MessageBubble - 消息气泡组件 v3
 *
 * 设计规范：
 * 1. 用户消息：渐变背景，右对齐
 * 2. AI 消息：轻薄 glass 效果，左对齐
 * 3. 消息间距：同发送者 4px，不同发送者 12px，工具调用 8px
 * 4. 优化文字渲染（行高、段落间距）
 */

import React, { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  /** 消息类型：用户或AI */
  variant: "user" | "assistant";
  /** 子内容 */
  children: React.ReactNode;
  /** 自定义容器类名 */
  className?: string;
  /** 自定义气泡类名 */
  bubbleClassName?: string;
  /** 气泡侧边内容 (显示在气泡外侧，用户消息在左侧，AI消息在右侧) */
  sideContent?: React.ReactNode;
  /** 是否与上一条消息来自同一发送者 */
  isSameSender?: boolean;
  /** 是否紧跟工具调用 */
  followsToolCall?: boolean;
}

/**
 * 消息气泡容器组件
 *
 * 用户消息：渐变背景，右对齐气泡样式
 * AI消息：Glassmorphism 效果，左对齐卡片样式
 */
const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  variant,
  children,
  className,
  bubbleClassName,
  sideContent,
  isSameSender = false,
  followsToolCall = false,
}) => {
  const isUser = variant === "user";

  // 计算消息间距
  const getMarginTop = () => {
    if (followsToolCall) return "mt-2"; // 8px - 工具调用后
    if (isSameSender) return "mt-1"; // 4px - 同发送者
    return "mt-3"; // 12px - 不同发送者
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1], // spring easing
      }}
      className={cn(
        "flex w-full motion-reduce:transition-none",
        getMarginTop(),
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      {isUser ? (
        // User Message: 渐变背景气泡
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%]">
          <div className="flex items-center gap-1.5 justify-end w-full">
            {sideContent}
            <div
              className={cn(
                // 使用设计系统的用户消息样式
                "ds-message-user",
                // 文字优化
                "text-sm leading-relaxed",
                // 溢出处理
                "break-words overflow-hidden",
                bubbleClassName
              )}
              style={{
                overflowWrap: "break-word",
                wordBreak: "normal",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      ) : (
        // AI Message: Glassmorphism 卡片
        <div className="flex flex-col w-full max-w-full overflow-hidden">
          <div
            className={cn(
              // 使用设计系统的 AI 消息样式
              "ds-message-assistant",
              // 文字优化
              "text-sm leading-relaxed",
              // 溢出处理
              "w-full pr-4 overflow-hidden",
              bubbleClassName
            )}
            style={{
              overflowWrap: "break-word",
              wordBreak: "normal",
            }}
          >
            {children}
          </div>
        </div>
      )}
    </motion.div>
  );
};

MessageBubbleComponent.displayName = "MessageBubble";

export const MessageBubble = memo(MessageBubbleComponent);

/**
 * 消息间距工具类
 * 用于在消息列表中计算正确的间距
 */
export const getMessageSpacing = (
  currentSender: "user" | "assistant",
  previousSender?: "user" | "assistant" | "tool"
): string => {
  if (!previousSender) return ""; // 第一条消息
  if (previousSender === "tool") return "ds-message-gap-tool"; // 8px
  if (previousSender === currentSender) return "ds-message-gap-same"; // 4px
  return "ds-message-gap-different"; // 12px
};

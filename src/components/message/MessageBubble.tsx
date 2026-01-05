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
}

/**
 * 消息气泡容器组件
 * 
 * 用户消息：右对齐气泡样式
 * AI消息：左对齐卡片样式
 */
const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  variant,
  children,
  className,
  bubbleClassName,
  sideContent
}) => {
  const isUser = variant === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.25,
        ease: [0, 0, 0.2, 1] // ease-out for entering
      }}
      className={cn(
        "flex w-full mb-1.5 motion-reduce:transition-none", // 极小间距 mb-1.5 (6px)
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      {isUser ? (
        // User Message: Modern Bubble
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
          <div className="flex items-center gap-1.5 justify-end w-full">
            {sideContent}
            <div
              className={cn(
                "rounded-xl px-4 py-3", // 优化圆角，更专业
                "text-foreground border shadow-md", // 更明显的边框和阴影
                "break-words text-sm leading-relaxed overflow-hidden", // 统一字体大小
                "transition-colors duration-200", // 增强悬停效果
                bubbleClassName
              )}
              style={{
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 20%, transparent)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 15%, transparent)'}
            >
              {children}
            </div>
          </div>
        </div>
      ) : (
        // AI Message: Subtle Card Style
        <div className="flex flex-col w-full max-w-full overflow-hidden">
          <div
            className={cn(
              "w-full pr-4 overflow-hidden",
              bubbleClassName
            )}
            style={{
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
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

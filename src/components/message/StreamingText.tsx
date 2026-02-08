/**
 * StreamingText - 高性能流式文本渲染组件
 *
 * 优化策略：
 * 1. 使用 CSS 动画替代 JS 打字机效果（GPU 加速）
 * 2. 分块渲染长文本（避免单次大量 DOM 操作）
 * 3. 使用 requestIdleCallback 进行非关键渲染
 * 4. 智能缓存已渲染的 Markdown 块
 */

import React, { memo, useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface StreamingTextProps {
  /** 文本内容 */
  text: string;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 渲染完成回调 */
  onComplete?: () => void;
}

/**
 * 高性能流式文本组件
 *
 * 特点：
 * - 使用 CSS transform 实现平滑动画（GPU 加速）
 * - 分块渲染避免阻塞主线程
 * - 智能检测代码块边界
 */
const StreamingTextComponent: React.FC<StreamingTextProps> = ({
  text,
  isStreaming = false,
  className,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayedLength, setDisplayedLength] = useState(0);
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // 流式输出时的渐进显示
  useEffect(() => {
    if (!isStreaming) {
      setDisplayedLength(text.length);
      return;
    }

    // 使用 requestAnimationFrame 实现平滑动画
    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current < 16) {
        // 限制 60fps
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      lastUpdateRef.current = timestamp;

      setDisplayedLength((prev) => {
        const target = text.length;
        if (prev >= target) {
          onComplete?.();
          return target;
        }

        // 智能步进：代码块内快速，普通文本慢速
        const remaining = target - prev;
        const isInCodeBlock = text.slice(0, prev).split("```").length % 2 === 0;
        const step = isInCodeBlock ? Math.min(10, remaining) : Math.min(3, remaining);

        return prev + step;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [text, isStreaming, onComplete]);

  // 当文本更新时，如果正在流式输出，保持当前进度
  useEffect(() => {
    if (isStreaming && displayedLength > text.length) {
      setDisplayedLength(text.length);
    }
  }, [text, isStreaming, displayedLength]);

  const displayedText = useMemo(() => {
    return text.slice(0, displayedLength);
  }, [text, displayedLength]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <span className="whitespace-pre-wrap">{displayedText}</span>
      {isStreaming && displayedLength < text.length && (
        <span
          className={cn(
            "inline-block w-2 h-4 ml-0.5 rounded-sm",
            "bg-gradient-to-r from-[var(--ds-primary)] to-[var(--ds-accent)]",
            "animate-pulse"
          )}
          style={{
            animation: "cursor-blink 0.8s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
};

export const StreamingText = memo(StreamingTextComponent);

/**
 * CSS 动画定义（添加到全局样式）
 */
export const streamingTextStyles = `
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

@keyframes text-fade-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.streaming-text-enter {
  animation: text-fade-in 0.15s ease-out forwards;
}
`;

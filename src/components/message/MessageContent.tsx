import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OptimizedMarkdown } from "./OptimizedMarkdown";

interface MessageContentProps {
  /** Markdown内容 */
  content: string;
  /** 自定义类名 */
  className?: string;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 是否启用打字机效果（已废弃，保留兼容性） */
  enableTypewriter?: boolean;
  /** 打字机速度（已废弃） */
  typewriterSpeed?: number;
  /** 打字机效果完成回调（已废弃） */
  onTypewriterComplete?: () => void;
}

/**
 * 消息内容渲染组件 v2.2
 * 使用 OptimizedMarkdown 实现高性能渲染
 *
 * 🔧 FIX v2.2: 完全移除打字机效果相关代码
 * - Claude Desktop 不使用打字机效果，直接渲染流式内容
 * - 移除 useTypewriter hook 调用，减少不必要的状态更新
 */
const MessageContentComponent: React.FC<MessageContentProps> = ({
  content,
  className,
  isStreaming = false,
}) => {
  return (
    <div className={cn("relative", className)}>
      <ErrorBoundary
        onError={(error) => {
          console.error('[MessageContent] Markdown rendering error:', error);
        }}
        fallback={(error) => (
          <div className="p-4 rounded-md border border-destructive/20 bg-destructive/5 my-2">
            <p className="text-sm font-medium text-destructive mb-2">
              渲染内容时出错 (Markdown/Syntax Highlighting)
            </p>
            <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground bg-background/50 p-2 rounded max-h-[200px] overflow-y-auto" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {content}
            </pre>
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                错误详情
              </summary>
              <p className="text-xs text-destructive mt-1 font-mono">
                {error.message}
              </p>
            </details>
          </div>
        )}
      >
        <OptimizedMarkdown
          content={content}
          isStreaming={isStreaming}
          className={className}
        />
      </ErrorBoundary>
    </div>
  );
};

MessageContentComponent.displayName = "MessageContent";

export const MessageContent = memo(MessageContentComponent);

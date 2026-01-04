import React, { useState, useCallback } from "react";
import { BrainCircuit, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useTranslation } from "@/hooks/useTranslation";
import { MessageContent } from "./MessageContent";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  autoCollapseDelay?: number;
  typewriterSpeed?: number;
  // 🆕 受控组件 props
  messageId?: string;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isStreaming = false,
  autoCollapseDelay = 2500,
  typewriterSpeed = 5,
  messageId,
  isOpen: controlledIsOpen,
  onToggle
}) => {
  const { t } = useTranslation();

  // 🆕 支持受控和非受控模式
  const [localIsOpen, setLocalIsOpen] = useState(true);
  const isControlled = controlledIsOpen !== undefined && onToggle !== undefined;
  const isOpen = isControlled ? controlledIsOpen : localIsOpen;

  // 🔧 DEBUG: 监控状态变化
  if (import.meta.env.DEV) {
    console.log('[ThinkingBlock] Render:', {
      messageId,
      isControlled,
      isOpen,
      controlledIsOpen,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    });
  }

  const handleToggle = useCallback(() => {
    const newState = !isOpen;
    if (isControlled) {
      onToggle?.(newState);
    } else {
      setLocalIsOpen(newState);
    }
  }, [isOpen, isControlled, onToggle]);

  const handleTypewriterComplete = useCallback(() => {}, []);

  const { displayedText, isTyping, skipToEnd } = useTypewriter(content, {
    enabled: isStreaming,
    speed: typewriterSpeed,
    isStreaming,
    onComplete: handleTypewriterComplete
  });

  const textToDisplay = isStreaming ? displayedText : content;

  const renderContent = () => {
    const parts = textToDisplay.split('---divider---');

    if (parts.length === 1) {
      return (
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <MessageContent content={textToDisplay} isStreaming={false} enableTypewriter={false} />
          {isTyping && <span className="inline-block w-1 h-3 ml-0.5 bg-amber-500 animate-pulse rounded-sm" />}
        </div>
      );
    }

    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {index > 0 && (
          <div className="flex items-center gap-2 my-3 opacity-50 select-none">
            <div className="h-px bg-amber-500/30 flex-1" />
            <div className="text-[10px] text-amber-700/50 dark:text-amber-300/50 font-mono">STEP {index + 1}</div>
            <div className="h-px bg-amber-500/30 flex-1" />
          </div>
        )}
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <MessageContent content={part.trim()} isStreaming={false} enableTypewriter={false} />
        </div>
        {index === parts.length - 1 && isTyping && (
          <span className="inline-block w-1 h-3 ml-0.5 bg-amber-500 animate-pulse rounded-sm" />
        )}
      </React.Fragment>
    ));
  };

  const handleDoubleClick = useCallback(() => { if (isTyping) skipToEnd(); }, [isTyping, skipToEnd]);

  if (!content) return null;

  return (
    <div
      className="border-l-2 rounded-md overflow-hidden my-2 shadow-sm"
      style={{
        borderLeftColor: 'color-mix(in srgb, rgb(245 158 11) 40%, transparent)',
        background: 'linear-gradient(to right, color-mix(in srgb, rgb(245 158 11) 8%, transparent), transparent)'
      }}
    >
      <button
        onClick={handleToggle}
        className="w-full cursor-pointer px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 font-medium transition-all duration-200 select-none flex items-center gap-2 outline-none text-left"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, rgb(245 158 11) 15%, transparent)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <BrainCircuit className="w-3.5 h-3.5 opacity-80" />
        <span className="font-semibold">Thinking Process</span>
        {isTyping && <span className="inline-block w-1.5 h-3 bg-amber-500 animate-pulse rounded-full" />}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[10px] opacity-70 font-mono">{content.length} chars</span>
          <ChevronDown className={cn("w-3.5 h-3.5 opacity-70 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
        </span>
      </button>
      <div className={cn("overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none", isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0")}>
        <div className="px-3 pb-3 pt-1" onDoubleClick={handleDoubleClick} title={isTyping ? t('thinking.doubleClickSkip') : undefined}>
          <div className="text-xs leading-relaxed max-h-[400px] overflow-y-auto scrollbar-thin">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingBlock;

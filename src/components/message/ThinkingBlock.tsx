import React, { useState, useCallback } from "react";
import BrainCircuit from 'lucide-react/dist/esm/icons/brain-circuit'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import { cn } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useTranslation } from "@/hooks/useTranslation";
import { MessageContent } from "./MessageContent";
import { getGlobalOutputDisplaySettings } from "@/hooks/useOutputDisplaySettings";

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
  autoCollapseDelay: _autoCollapseDelay = 2500,
  typewriterSpeed = 5,
  messageId: _messageId,
  isOpen: controlledIsOpen,
  onToggle
}) => {
  const { t } = useTranslation();

  // 🆕 获取全局设置，控制默认展开状态
  const globalSettings = getGlobalOutputDisplaySettings();

  // 🆕 支持受控和非受控模式，默认展开状态由全局设置控制
  const [localIsOpen, setLocalIsOpen] = useState(globalSettings.defaultExpandThinking);
  const isControlled = controlledIsOpen !== undefined && onToggle !== undefined;
  const isOpen = isControlled ? controlledIsOpen : localIsOpen;

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
      className="inline-block border-l-2 rounded-md overflow-hidden shadow-sm"
      style={{
        borderLeftColor: 'color-mix(in srgb, rgb(245 158 11) 40%, transparent)'
      }}
    >
      <button
        onClick={handleToggle}
        className="cursor-pointer px-1.5 py-1 text-[10px] text-amber-700 dark:text-amber-300 font-medium transition-all duration-200 select-none flex items-center gap-1 outline-none text-left rounded-md"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, rgb(245 158 11) 15%, transparent)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <BrainCircuit className="w-3 h-3 opacity-80" />
        <span className="font-medium">Thinking Process</span>
        {isTyping && (
          <span className="inline-flex gap-0.5">
            <span className="inline-block w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="inline-block w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="inline-block w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
        <span className="text-[9px] opacity-70 font-mono">{content.length} chars</span>
        <ChevronDown className={cn("w-3 h-3 opacity-70 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
      </button>
      <div className={cn("overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none", isOpen ? "max-h-none opacity-100" : "max-h-0 opacity-0")}>
        <div
          className="px-1.5 pb-1.5 pt-0.5"
          style={{
            background: 'linear-gradient(to right, color-mix(in srgb, rgb(245 158 11) 8%, transparent), transparent)'
          }}
          onDoubleClick={handleDoubleClick}
          title={isTyping ? t('thinking.doubleClickSkip') : undefined}
        >
          <div className="text-[10px] leading-[1.3] overflow-y-auto scrollbar-thin">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingBlock;

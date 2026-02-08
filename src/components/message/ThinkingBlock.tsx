import React, { useState, useCallback } from "react";
import { BrainCircuit, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useTranslation } from "@/hooks/useTranslation";
import { MessageContent } from "./MessageContent";
import { getGlobalOutputDisplaySettings } from "@/hooks/useOutputDisplaySettings";
import { useTheme } from "@/contexts/ThemeContext";

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
  onToggle,
}) => {
  const { t } = useTranslation();
  const { themeName } = useTheme();
  const isSciFi = themeName === "deep-glass-scifi";

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
    onComplete: handleTypewriterComplete,
  });

  const textToDisplay = isStreaming ? displayedText : content;

  const renderContent = () => {
    const parts = textToDisplay.split("---divider---");

    if (parts.length === 1) {
      return (
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <MessageContent content={textToDisplay} isStreaming={false} enableTypewriter={false} />
          {isTyping && (
            <span
              className={cn(
                "inline-block w-1 h-3 ml-0.5 animate-pulse rounded-sm",
                isSciFi ? "bg-amber-500" : "bg-amber-500"
              )}
            />
          )}
        </div>
      );
    }

    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {index > 0 && (
          <div className="flex items-center gap-2 my-3 opacity-50 select-none">
            <div className={cn("h-px flex-1", isSciFi ? "bg-amber-500/30" : "bg-amber-500/30")} />
            <div
              className={cn(
                "text-[10px] font-mono",
                isSciFi ? "text-amber-300/50" : "text-amber-700/50 dark:text-amber-300/50"
              )}
            >
              STEP {index + 1}
            </div>
            <div className={cn("h-px flex-1", isSciFi ? "bg-amber-500/30" : "bg-amber-500/30")} />
          </div>
        )}
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <MessageContent content={part.trim()} isStreaming={false} enableTypewriter={false} />
        </div>
        {index === parts.length - 1 && isTyping && (
          <span
            className={cn(
              "inline-block w-1 h-3 ml-0.5 animate-pulse rounded-sm",
              isSciFi ? "bg-amber-500" : "bg-amber-500"
            )}
          />
        )}
      </React.Fragment>
    ));
  };

  const handleDoubleClick = useCallback(() => {
    if (isTyping) skipToEnd();
  }, [isTyping, skipToEnd]);

  if (!content) return null;

  // 根据主题选择颜色
  const borderColor = isSciFi ? "rgba(245, 158, 11, 0.4)" : "rgba(59, 130, 246, 0.4)";
  const hoverBgColor = isSciFi ? "rgba(245, 158, 11, 0.1)" : "rgba(59, 130, 246, 0.1)";
  const textHoverColor = isSciFi ? "hover:text-amber-400" : "hover:text-blue-400";
  const dotColor = isSciFi ? "bg-amber-400" : "bg-blue-400";
  const bgGradient = isSciFi
    ? "linear-gradient(to right, rgba(245, 158, 11, 0.15), transparent)"
    : "linear-gradient(to right, rgba(59, 130, 246, 0.15), transparent)";

  return (
    <div
      className={cn(
        "inline-block border-l-2 rounded-md overflow-hidden shadow-sm",
        isSciFi && "glowing-border-amber"
      )}
      style={{
        borderLeftColor: borderColor,
      }}
    >
      <button
        onClick={handleToggle}
        className={cn(
          "cursor-pointer px-1.5 py-1 text-[10px] text-white/70 font-medium transition-all duration-200 select-none flex items-center gap-1 outline-none text-left rounded-md",
          textHoverColor
        )}
        style={{ backgroundColor: "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBgColor)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <BrainCircuit className="w-3 h-3 opacity-80" />
        <span className="font-medium">Thinking Process</span>
        {isTyping && (
          <span className="inline-flex gap-0.5">
            <span
              className={cn("inline-block w-1 h-1 rounded-full animate-bounce", dotColor)}
              style={{ animationDelay: "0ms" }}
            />
            <span
              className={cn("inline-block w-1 h-1 rounded-full animate-bounce", dotColor)}
              style={{ animationDelay: "150ms" }}
            />
            <span
              className={cn("inline-block w-1 h-1 rounded-full animate-bounce", dotColor)}
              style={{ animationDelay: "300ms" }}
            />
          </span>
        )}
        <span className="text-[9px] opacity-50 font-mono">{content.length} chars</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 opacity-70 transition-transform duration-300",
            isOpen ? "rotate-180" : ""
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none",
          isOpen ? "max-h-none opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div
          className="px-1.5 pb-1.5 pt-0.5"
          style={{
            background: bgGradient,
          }}
          onDoubleClick={handleDoubleClick}
          title={isTyping ? t("thinking.doubleClickSkip") : undefined}
        >
          <div className="text-[10px] leading-[1.3] overflow-y-auto scrollbar-thin">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingBlock;

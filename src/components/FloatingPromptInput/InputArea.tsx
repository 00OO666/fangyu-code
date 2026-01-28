import React, { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2';
import { cn } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import { FilePicker } from "../FilePicker";
import { SuggestionOverlay } from "./components/SuggestionOverlay";
import { SlashCommandMenu } from "./SlashCommandMenu";
import type { PromptSuggestion } from "./hooks/usePromptSuggestion";
import type { SlashCommand } from "./slashCommands";
import { useTheme } from "@/contexts/ThemeContext";

/** 执行引擎类型 */
type ExecutionEngine = 'claude' | 'gemini' | 'codex' | 'siliconflow';

interface InputAreaProps {
  prompt: string;
  disabled?: boolean;
  dragActive: boolean;
  showFilePicker: boolean;
  projectPath?: string;
  filePickerQuery: string;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onExpand: () => void;
  onFileSelect: (file: any) => void;
  onFilePickerClose: () => void;
  // 🔧 Mac 输入法兼容：composition 事件
  onCompositionStart?: () => void;
  onCompositionEnd?: () => void;
  // 🆕 Prompt Suggestions
  suggestion?: PromptSuggestion | null;
  isSuggestionLoading?: boolean;
  /** 是否启用 Prompt Suggestions（启用时隐藏 placeholder） */
  enableSuggestion?: boolean;
  // 🆕 斜杠命令菜单
  /** 是否显示斜杠命令菜单 */
  showSlashCommandMenu?: boolean;
  /** 斜杠命令搜索查询 */
  slashCommandQuery?: string;
  /** 斜杠命令菜单选中索引 */
  slashCommandSelectedIndex?: number;
  /** 选择斜杠命令时的回调 */
  onSlashCommandSelect?: (command: SlashCommand) => void;
  /** 关闭斜杠命令菜单 */
  onSlashCommandMenuClose?: () => void;
  /** 更新选中索引 */
  onSlashCommandSelectedIndexChange?: (index: number) => void;
  /** 自定义斜杠命令 */
  customSlashCommands?: SlashCommand[];
  /** 执行引擎类型 (默认 claude) */
  engine?: ExecutionEngine;
}

export const InputArea = forwardRef<HTMLTextAreaElement, InputAreaProps>(({
  prompt,
  disabled,
  dragActive,
  showFilePicker,
  projectPath,
  filePickerQuery,
  onTextChange,
  onKeyDown,
  onPaste,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onExpand,
  onFileSelect,
  onFilePickerClose,
  onCompositionStart,
  onCompositionEnd,
  suggestion,
  isSuggestionLoading,
  enableSuggestion = true,
  // 🆕 斜杠命令菜单
  showSlashCommandMenu = false,
  slashCommandQuery = '',
  slashCommandSelectedIndex = 0,
  onSlashCommandSelect,
  onSlashCommandMenuClose,
  onSlashCommandSelectedIndexChange,
  customSlashCommands = [],
  engine = 'claude',
}, ref) => {
  const { t } = useTranslation();
  const { themeName } = useTheme();
  const isSciFi = themeName === 'deep-glass-scifi';

  // 当启用 Prompt Suggestions 时，完全隐藏 placeholder
  // 让 AI 建议作为智能 placeholder 替代
  const getPlaceholder = () => {
    // 如果启用了建议功能，不显示 placeholder（由 SuggestionOverlay 替代）
    if (enableSuggestion) {
      return '';
    }
    // 否则显示默认 placeholder
    return dragActive ? t('promptInput.placeholderDragActive') : t('promptInput.placeholder');
  };

  return (
    <div className="relative">
      {/* 🆕 建议叠加层 */}
      <SuggestionOverlay
        suggestion={suggestion ?? null}
        currentPrompt={prompt}
        isLoading={isSuggestionLoading}
      />

      <Textarea
        ref={ref}
        value={prompt}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        // 🔧 Mac 输入法兼容：监听 composition 事件
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        // 🆕 启用建议时隐藏 placeholder，由 SuggestionOverlay 替代
        placeholder={getPlaceholder()}
        disabled={disabled}
        className={cn(
          "min-h-[56px] max-h-[300px] resize-none pr-10 overflow-y-auto",
          "bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50 focus:ring-primary/20",
          dragActive && "border-primary ring-2 ring-primary/20",
          // 🆕 建议存在时文字颜色正常，让叠加层可见
          suggestion && "caret-primary",
          // 🆕 Sci-Fi 主题下添加发光效果
          isSciFi && "input-glass"
        )}
        rows={1}
        style={{ height: 'auto' }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={onExpand}
        disabled={disabled}
        className="absolute right-1 bottom-1 h-8 w-8 text-muted-foreground hover:text-foreground"
        aria-label={t('promptInput.expandInput')}
      >
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* File Picker */}
      <AnimatePresence>
        {showFilePicker && projectPath && projectPath.trim() && (
          <FilePicker
            basePath={projectPath.trim()}
            onSelect={onFileSelect}
            onClose={onFilePickerClose}
            initialQuery={filePickerQuery}
          />
        )}
      </AnimatePresence>

      {/* 🆕 斜杠命令菜单 */}
      {onSlashCommandSelect && onSlashCommandMenuClose && onSlashCommandSelectedIndexChange && (
        <SlashCommandMenu
          isOpen={showSlashCommandMenu}
          query={slashCommandQuery}
          selectedIndex={slashCommandSelectedIndex}
          onSelect={onSlashCommandSelect}
          onClose={onSlashCommandMenuClose}
          onSelectedIndexChange={onSlashCommandSelectedIndexChange}
          customCommands={customSlashCommands}
          nonInteractiveOnly={true}
          engine={engine}
        />
      )}
    </div>
  );
});

InputArea.displayName = "InputArea";
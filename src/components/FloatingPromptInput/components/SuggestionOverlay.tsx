/**
 * SuggestionOverlay Component
 *
 * 在输入框中显示建议文字叠加层
 * 样式与 placeholder 一致，作为智能 placeholder 替代方案
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { PromptSuggestion } from '../hooks/usePromptSuggestion';

interface SuggestionOverlayProps {
  /** 当前建议 */
  suggestion: PromptSuggestion | null;
  /** 用户当前输入 */
  currentPrompt: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 计算建议中应该显示的补全部分
 */
function getCompletionText(suggestion: string, currentPrompt: string): string {
  const trimmedPrompt = currentPrompt.trim();

  // 如果用户没有输入，显示完整建议
  if (!trimmedPrompt) {
    return suggestion;
  }

  // 如果建议以用户输入开头（不区分大小写），显示剩余部分
  const suggestionLower = suggestion.toLowerCase();
  const promptLower = trimmedPrompt.toLowerCase();

  if (suggestionLower.startsWith(promptLower)) {
    return suggestion.slice(trimmedPrompt.length);
  }

  // 否则显示完整建议（作为替代）
  return suggestion;
}

/**
 * SuggestionOverlay - 建议文字叠加层
 * 使用与 placeholder 相同的样式
 */
export const SuggestionOverlay: React.FC<SuggestionOverlayProps> = ({
  suggestion,
  currentPrompt,
  isLoading = false,
  className,
}) => {
  // 如果没有建议或正在加载，不显示
  if (!suggestion || isLoading) {
    return null;
  }

  const completionText = getCompletionText(suggestion.text, currentPrompt);

  // 如果没有补全文本，不显示
  if (!completionText) {
    return null;
  }

  // 判断是否为完整替代（用户输入与建议不匹配）
  const isFullReplacement = completionText === suggestion.text && currentPrompt.trim().length > 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-start",
        "overflow-hidden",
        "z-10",
        className
      )}
      aria-hidden="true"
      style={{
        // 精确匹配 textarea 的内边距
        padding: '9px 40px 9px 12px',
      }}
    >
      {/* 占位：与用户输入等宽的透明区域 */}
      {!isFullReplacement && currentPrompt && (
        <span className="invisible whitespace-pre-wrap break-words text-sm">
          {currentPrompt}
        </span>
      )}

      {/* 建议文本 - 使用 placeholder 样式 */}
      <span
        className={cn(
          "whitespace-pre-wrap break-words text-sm",
          // 使用与 placeholder 相同的颜色
          "text-muted-foreground",
        )}
      >
        {completionText}
        {/* Tab 提示内联显示，类似官方 CLI */}
        <span className="text-muted-foreground/50 ml-2 text-xs">
          (tab to accept)
        </span>
      </span>
    </div>
  );
};

export default SuggestionOverlay;

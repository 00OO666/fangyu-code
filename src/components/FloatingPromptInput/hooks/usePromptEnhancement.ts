import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { callEnhancementAPI, getProvider } from "@/lib/promptEnhancementService";
import { enhancePromptWithDualAPI } from "@/lib/dualAPIEnhancement";
import { loadContextConfig } from "@/lib/promptContextConfig";
import { ClaudeStreamMessage } from "@/types/claude";
import {
  getDualApiEnhancementEnabled,
  setDualApiEnhancementEnabled,
  subscribeDualApiEnhancementToggle,
} from "@/lib/contextExtractionToggle";

// acemcp 结果整理的触发阈值（与 dualAPIEnhancement.ts 保持一致）
const ACEMCP_REFINEMENT_THRESHOLDS = {
  minSnippetCount: 5,
  minContentLength: 3000,
};

export interface UsePromptEnhancementOptions {
  prompt: string;
  isExpanded: boolean;
  onPromptChange: (newPrompt: string) => void;
  getConversationContext?: () => string[];
  messages?: ClaudeStreamMessage[]; // 🆕 完整的消息列表（用于双 API）
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  expandedTextareaRef: React.RefObject<HTMLTextAreaElement>;
  projectPath?: string;
  sessionId?: string; // 🆕 会话 ID（用于历史上下文）
  projectId?: string; // 🆕 项目 ID（用于历史上下文）
  enableProjectContext: boolean;
  enableMultiRound?: boolean; // 🆕 启用多轮搜索
}

/**
 * 以可撤销的方式更新 textarea 内容
 * 使用 document.execCommand 确保操作可以被 Ctrl+Z 撤销
 */
function updateTextareaWithUndo(textarea: HTMLTextAreaElement, newText: string) {
  // 保存当前焦点状态
  const hadFocus = document.activeElement === textarea;

  // 确保 textarea 获得焦点（execCommand 需要）
  if (!hadFocus) {
    textarea.focus();
  }

  // 选中全部文本
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  // 使用 execCommand 插入新文本（这会创建一个可撤销的历史记录）
  // 注意：execCommand 已被标记为废弃，但目前仍是唯一支持 undo 的方法
  const success = document.execCommand("insertText", false, newText);

  if (!success) {
    // 如果 execCommand 失败（某些浏览器可能不支持），使用备用方案
    // 虽然这不会创建 undo 历史，但至少能正常工作
    textarea.value = newText;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // 将光标移到末尾
  textarea.setSelectionRange(newText.length, newText.length);

  // 触发 input 事件以更新 React 状态
  textarea.dispatchEvent(new Event("input", { bubbles: true }));

  // 恢复焦点状态
  if (hadFocus) {
    textarea.focus();
  }
}

export function usePromptEnhancement({
  prompt,
  isExpanded,
  onPromptChange,
  getConversationContext,
  messages, // 🆕 完整消息列表
  textareaRef,
  expandedTextareaRef,
  projectPath,
  sessionId, // 🆕
  projectId, // 🆕
  enableProjectContext,
  enableMultiRound = true, // 🆕 默认启用多轮搜索
}: UsePromptEnhancementOptions) {
  const [isEnhancing, setIsEnhancing] = useState(false);

  // 🆕 智能上下文提取开关（默认启用）
  const [enableDualAPI, setEnableDualAPI] = useState(() => {
    return getDualApiEnhancementEnabled();
  });

  // Keep in sync with settings page / other UI surfaces.
  useEffect(() => subscribeDualApiEnhancementToggle(setEnableDualAPI), []);

  /**
   * 获取项目上下文（如果启用）
   * 🆕 v2: 支持历史上下文感知和多轮搜索
   */
  const getProjectContext = async (): Promise<string | null> => {
    if (!enableProjectContext || !projectPath) {
      return null;
    }

    try {
      // 🆕 传递会话信息以启用历史上下文感知
      const result = await api.enhancePromptWithContext(
        prompt.trim(),
        projectPath,
        sessionId, // 🆕 传递会话 ID
        projectId, // 🆕 传递项目 ID
        3000,
        enableMultiRound // 🆕 启用多轮搜索
      );

      if (result.acemcpUsed && result.contextCount > 0) {
        // 只返回上下文部分（不包括原提示词）
        const contextMatch = result.enhancedPrompt.match(/--- 项目上下文.*?---\n([\s\S]*)/);

        if (contextMatch) {
          const extractedContext = contextMatch[0];
          return extractedContext;
        } else {
          logger.warn(
            "usePromptEnhancement",
            "[getProjectContext] Failed to extract context with regex"
          );
          return null;
        }
      }

      return null;
    } catch (error) {
      logger.error("usePromptEnhancement", "[getProjectContext] Failed:", error);
      return null;
    }
  };

  const handleEnhancePromptWithAPI = async (providerId: string) => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      onPromptChange("请描述您想要完成的任务");
      return;
    }

    // 获取提供商配置
    const provider = getProvider(providerId);
    if (!provider) {
      onPromptChange(trimmedPrompt + "\n\n❌ 提供商配置未找到");
      return;
    }

    if (!provider.enabled) {
      onPromptChange(trimmedPrompt + "\n\n❌ 提供商已禁用，请在设置中启用");
      return;
    }

    setIsEnhancing(true);

    try {
      // 获取项目上下文（如果启用）
      const projectContext = await getProjectContext();

      let result: string;

      // 🆕 加载配置的阈值
      const config = loadContextConfig();

      // 🆕 判断是否需要使用双 API 方案（混合策略）
      const needsAcemcpRefinement =
        projectContext &&
        ((projectContext.match(/Path:|### 文件:/g) || []).length >
          ACEMCP_REFINEMENT_THRESHOLDS.minSnippetCount ||
          projectContext.length > ACEMCP_REFINEMENT_THRESHOLDS.minContentLength);
      const needsHistoryFiltering = messages && messages.length > config.maxMessages;
      const shouldUseDualAPI = enableDualAPI && (needsAcemcpRefinement || needsHistoryFiltering);

      if (shouldUseDualAPI) {
        // ✨ 使用双 API 方案（混合策略：acemcp 整理 或 历史筛选）
        result = await enhancePromptWithDualAPI(
          messages || [],
          trimmedPrompt,
          provider,
          projectContext || undefined
        );
      } else {
        // 使用传统单次调用方案
        // 获取对话上下文
        let context = getConversationContext ? getConversationContext() : undefined;

        // 如果有项目上下文，附加到 context 数组
        if (projectContext) {
          context = context ? [...context, projectContext] : [projectContext];
        }

        result = await callEnhancementAPI(provider, trimmedPrompt, context);
      }

      if (result && result.trim()) {
        // 使用可撤销的方式更新文本
        const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
        if (target) {
          updateTextareaWithUndo(target, result.trim());
        }
      } else {
        const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
        if (target) {
          updateTextareaWithUndo(target, trimmedPrompt + "\n\n⚠️ API返回空结果，请重试");
        }
      }
    } catch (error) {
      logger.error("usePromptEnhancement", "[handleEnhancePromptWithAPI] Failed:", error);
      let errorMessage = "未知错误";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
      if (target) {
        updateTextareaWithUndo(target, trimmedPrompt + `\n\n❌ ${provider.name}: ${errorMessage}`);
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  return {
    isEnhancing,
    handleEnhancePromptWithAPI,
    enableDualAPI, // 🆕 暴露智能上下文开关状态
    setEnableDualAPI: (enabled: boolean) => {
      setDualApiEnhancementEnabled(enabled);
      setEnableDualAPI(enabled);
    }, // 🆕 暴露开关控制函数（全局同步）
  };
}

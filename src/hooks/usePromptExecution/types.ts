/**
 * usePromptExecution 类型定义
 *
 * 🔧 v2.2.6: 从 usePromptExecution.ts 提取，降低代码复杂度
 */

import type { UnlistenFn } from "@tauri-apps/api/event";
import type { ModelType } from "@/components/FloatingPromptInput/types";
import type { Session } from "@/lib/api";
import type { TranslationResult } from "@/lib/translationMiddleware";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { CodexExecutionMode, CodexRateLimits } from "@/types/codex";

// Extend window object for Codex/Gemini pending prompt tracking
declare global {
  interface Window {
    __codexPendingPrompt?: {
      sessionId: string;
      projectPath: string;
      promptIndex: number;
      promptText: string;
    };
    __geminiPendingPrompt?: {
      sessionId: string;
      projectPath: string;
      promptIndex: number;
      promptText: string;
    };
    __geminiPendingSession?: {
      sessionId: string;
      projectPath: string;
    };
  }
}

export interface QueuedPrompt {
  id: string;
  prompt: string;
  model: ModelType;
}

export interface UsePromptExecutionConfig {
  // State
  projectPath: string;
  isLoading: boolean;
  claudeSessionId: string | null;
  effectiveSession: Session | null;
  isPlanMode: boolean;
  lastTranslationResult: TranslationResult | null;
  isActive: boolean;
  isFirstPrompt: boolean;
  extractedSessionInfo: { sessionId: string; projectId: string } | null;

  // Execution Engine Integration
  executionEngine?: "claude" | "codex" | "gemini" | "siliconflow" | "kiro";
  codexMode?: CodexExecutionMode;
  codexModel?: string;
  geminiModel?: string;
  geminiApprovalMode?: "auto_edit" | "yolo" | "default";
  kiroModel?: string; // Kiro 模型 (e.g., 'claude-opus-4.5')

  // Refs
  hasActiveSessionRef: React.MutableRefObject<boolean>;
  unlistenRefs: React.MutableRefObject<UnlistenFn[]>;
  isMountedRef: React.MutableRefObject<boolean>;
  isListeningRef: React.MutableRefObject<boolean>;
  queuedPromptsRef: React.MutableRefObject<QueuedPrompt[]>;

  // State Setters
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ClaudeStreamMessage[]>>;
  setClaudeSessionId: (id: string | null) => void;
  setLastTranslationResult: (result: TranslationResult | null) => void;
  setQueuedPrompts: React.Dispatch<React.SetStateAction<QueuedPrompt[]>>;
  setRawJsonlOutput: React.Dispatch<React.SetStateAction<string[]>>;
  setExtractedSessionInfo: React.Dispatch<
    React.SetStateAction<{
      sessionId: string;
      projectId: string;
      engine?: "claude" | "codex" | "gemini" | "kiro";
    } | null>
  >;
  setIsFirstPrompt: (isFirst: boolean) => void;
  setCodexRateLimits?: React.Dispatch<React.SetStateAction<CodexRateLimits | null>>;

  // External Hook Functions
  processMessageWithTranslation: (
    message: ClaudeStreamMessage,
    payload: string,
    currentTranslationResult?: TranslationResult,
  ) => Promise<void>;
}

export interface UsePromptExecutionReturn {
  /**
   * 发送提示词
   * @param prompt - 提示词内容
   * @param model - 使用的模型
   * @param maxThinkingTokens - 思考模式 token 数量
   * @param forceImmediate - 强制立即发送（插队模式），绕过队列检查
   */
  handleSendPrompt: (
    prompt: string,
    model: ModelType,
    maxThinkingTokens?: number,
    forceImmediate?: boolean,
  ) => Promise<void>;
}

export type ClaudeGlobalEventPayload<T> = { tab_id?: string | null; payload: T } | T;

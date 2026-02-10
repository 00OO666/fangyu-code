import { useState, useRef, useCallback } from "react";
import type { Project } from "@/lib/api";
import type { CodexRateLimits } from "@/types/codex";
import type { ModelType } from "@/components/FloatingPromptInput";
import type { ExecutionEngineConfig } from "@/components/FloatingPromptInput/types";
import { logger } from "@/lib/logger";

interface UseSessionManagementProps {
  initialProjectPath?: string;
  sessionProjectPath?: string;
}

/**
 * 管理会话相关的状态和逻辑
 *
 * 包括：
 * - 项目路径管理
 * - 会话信息管理
 * - 执行引擎配置
 * - 队列管理
 * - 导航状态
 */
export function useSessionManagement({
  initialProjectPath = "",
  sessionProjectPath = "",
}: UseSessionManagementProps = {}) {
  // 项目路径
  const [projectPath, setProjectPath] = useState(initialProjectPath || sessionProjectPath || "");
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  // 错误状态
  const [error, setError] = useState<string | null>(null);

  // 会话状态
  const [isFirstPrompt, setIsFirstPrompt] = useState(true);
  const [extractedSessionInfo, setExtractedSessionInfo] = useState<{
    sessionId: string;
    projectId: string;
    engine?: "claude" | "codex" | "gemini";
  } | null>(null);
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [codexRateLimits, setCodexRateLimits] = useState<CodexRateLimits | null>(null);
  const lastKnownProjectIdRef = useRef<string | null>(null);

  // 执行引擎配置
  const [executionEngineConfig, setExecutionEngineConfig] = useState<ExecutionEngineConfig>(() => {
    try {
      const stored = localStorage.getItem("execution_engine_config");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error(
        "useSessionManagement",
        "[useSessionManagement] Failed to load engine config from localStorage:",
        error
      );
    }
    // Default config
    return {
      engine: "claude",
      codexMode: "read-only",
      codexModel: "gpt-5.2",
      geminiModel: "gemini-3-flash",
    };
  });

  // 队列管理
  const [queuedPrompts, setQueuedPrompts] = useState<
    Array<{ id: string; prompt: string; model: ModelType }>
  >([]);
  const [queuedPromptsCollapsed, setQueuedPromptsCollapsed] = useState(false);

  // 导航状态
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(-1);

  // 预览状态
  const [splitPosition, setSplitPosition] = useState(50);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);

  // 用于存储智能会话升级后待发送的首条消息
  const pendingFirstMessageRef = useRef<{
    prompt: string;
    model: ModelType;
    maxThinkingTokens?: number;
  } | null>(null);

  // 稳定的回调函数
  const handleSetProjectPath = useCallback((path: string) => {
    setProjectPath(path);
  }, []);

  const handleSetError = useCallback((errorMsg: string | null) => {
    setError(errorMsg);
  }, []);

  const handleAddQueuedPrompt = useCallback((prompt: string, model: ModelType) => {
    const id = `${Date.now()}-${Math.random()}`;
    setQueuedPrompts((prev) => [...prev, { id, prompt, model }]);
  }, []);

  const handleRemoveQueuedPrompt = useCallback((id: string) => {
    setQueuedPrompts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClearQueuedPrompts = useCallback(() => {
    setQueuedPrompts([]);
  }, []);

  const handleToggleQueuedPromptsCollapsed = useCallback(() => {
    setQueuedPromptsCollapsed((prev) => !prev);
  }, []);

  return {
    // 项目路径
    projectPath,
    setProjectPath,
    handleSetProjectPath,
    recentProjects,
    setRecentProjects,

    // 错误状态
    error,
    setError,
    handleSetError,

    // 会话状态
    isFirstPrompt,
    setIsFirstPrompt,
    extractedSessionInfo,
    setExtractedSessionInfo,
    sessionNotFound,
    setSessionNotFound,
    claudeSessionId,
    setClaudeSessionId,
    codexRateLimits,
    setCodexRateLimits,
    lastKnownProjectIdRef,

    // 执行引擎配置
    executionEngineConfig,
    setExecutionEngineConfig,

    // 队列管理
    queuedPrompts,
    setQueuedPrompts,
    handleAddQueuedPrompt,
    handleRemoveQueuedPrompt,
    handleClearQueuedPrompts,
    queuedPromptsCollapsed,
    setQueuedPromptsCollapsed,
    handleToggleQueuedPromptsCollapsed,

    // 导航状态
    currentPromptIndex,
    setCurrentPromptIndex,

    // 预览状态
    splitPosition,
    setSplitPosition,
    isPreviewMaximized,
    setIsPreviewMaximized,

    // Refs
    pendingFirstMessageRef,
  };
}

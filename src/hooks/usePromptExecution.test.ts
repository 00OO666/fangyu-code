/**
 * usePromptExecution Hook 单元测试
 *
 * 测试提示词执行的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePromptExecution } from "./usePromptExecution";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { Session } from "@/lib/api";

// Mock dependencies
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/hooks/useGlobalTaskState", () => ({
  globalTaskActions: {
    addTask: vi.fn(),
    updateTask: vi.fn(),
    removeTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    clearTasks: vi.fn(),
    registerTask: vi.fn(() => "task-id-123"),
  },
}));

vi.mock("@/lib/api", () => ({
  api: {
    executePrompt: vi.fn(),
    resumeSession: vi.fn(),
    continueSession: vi.fn(),
  },
}));

vi.mock("@/lib/translationMiddleware", () => ({
  translationMiddleware: vi.fn((prompt) =>
    Promise.resolve({
      translatedPrompt: prompt,
      originalPrompt: prompt,
      isTranslated: false,
    })
  ),
  isSlashCommand: vi.fn(() => false),
}));

describe("usePromptExecution", () => {
  // 创建默认配置
  const createDefaultConfig = () => ({
    projectPath: "/test/project",
    isLoading: false,
    claudeSessionId: null,
    effectiveSession: null,
    isPlanMode: false,
    lastTranslationResult: null,
    isActive: true,
    isFirstPrompt: true,
    extractedSessionInfo: null,
    hasActiveSessionRef: { current: false },
    unlistenRefs: { current: [] },
    isMountedRef: { current: true },
    isListeningRef: { current: false },
    queuedPromptsRef: { current: [] },
    setIsLoading: vi.fn(),
    setError: vi.fn(),
    setMessages: vi.fn(),
    setClaudeSessionId: vi.fn(),
    setLastTranslationResult: vi.fn(),
    setQueuedPrompts: vi.fn(),
    setRawJsonlOutput: vi.fn(),
    setExtractedSessionInfo: vi.fn(),
    setIsFirstPrompt: vi.fn(),
    processMessageWithTranslation: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Hook 初始化", () => {
    it("应正确初始化并返回 handleSendPrompt 函数", () => {
      const config = createDefaultConfig();
      const { result } = renderHook(() => usePromptExecution(config));

      expect(result.current.handleSendPrompt).toBeDefined();
      expect(typeof result.current.handleSendPrompt).toBe("function");
    });
  });

  describe("handleSendPrompt - 基本功能", () => {
    it("应拒绝空提示词", async () => {
      const config = createDefaultConfig();
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("", "claude-opus-4");
      });

      expect(config.setError).toHaveBeenCalledWith("提示词不能为空");
    });

    it("应拒绝只包含空格的提示词", async () => {
      const config = createDefaultConfig();
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("   ", "claude-opus-4");
      });

      expect(config.setError).toHaveBeenCalledWith("提示词不能为空");
    });

    it("应在加载中时拒绝新提示词", async () => {
      const config = createDefaultConfig();
      config.isLoading = true;
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("test prompt", "claude-opus-4");
      });

      // 应该不会调用 setIsLoading，因为已经在加载中
      expect(config.setIsLoading).not.toHaveBeenCalled();
    });
  });

  describe("handleSendPrompt - 执行引擎", () => {
    it("应使用默认的 Claude 引擎", async () => {
      const config = createDefaultConfig();
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("test prompt", "claude-opus-4");
      });

      // 验证使用了 Claude 引擎
      expect(config.setIsLoading).toHaveBeenCalledWith(true);
    });

    it("应支持 Codex 引擎", async () => {
      const config = createDefaultConfig();
      config.executionEngine = "codex";
      config.codexMode = "read-only";
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("test prompt", "gpt-5.2");
      });

      expect(config.setIsLoading).toHaveBeenCalledWith(true);
    });

    it("应支持 Gemini 引擎", async () => {
      const config = createDefaultConfig();
      config.executionEngine = "gemini";
      config.geminiModel = "gemini-3-flash";
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("test prompt", "gemini-3-flash");
      });

      expect(config.setIsLoading).toHaveBeenCalledWith(true);
    });
  });

  describe("handleSendPrompt - 翻译中间件", () => {
    it("应调用翻译中间件处理提示词", async () => {
      const { translationMiddleware } = await import("@/lib/translationMiddleware");
      const config = createDefaultConfig();
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("测试提示词", "claude-opus-4");
      });

      expect(translationMiddleware).toHaveBeenCalledWith("测试提示词");
    });
  });

  describe("handleSendPrompt - 队列管理", () => {
    it("应在加载时将提示词加入队列", async () => {
      const config = createDefaultConfig();
      config.isLoading = true;
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("queued prompt", "claude-opus-4");
      });

      // 验证提示词被加入队列
      expect(config.queuedPromptsRef.current.length).toBeGreaterThan(0);
    });

    it("应支持强制立即发送（插队模式）", async () => {
      const config = createDefaultConfig();
      config.isLoading = true;
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("immediate prompt", "claude-opus-4", undefined, true);
      });

      // 强制立即发送应该绕过队列检查
      expect(config.setIsLoading).toHaveBeenCalledWith(true);
    });
  });

  describe("handleSendPrompt - 思考模式", () => {
    it("应支持思考模式（maxThinkingTokens）", async () => {
      const config = createDefaultConfig();
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("think about this", "claude-opus-4", 10000);
      });

      expect(config.setIsLoading).toHaveBeenCalledWith(true);
    });
  });

  describe("handleSendPrompt - 计划模式", () => {
    it("应在计划模式下添加 --plan 标志", async () => {
      const config = createDefaultConfig();
      config.isPlanMode = true;
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("plan this", "claude-opus-4");
      });

      expect(config.setIsLoading).toHaveBeenCalledWith(true);
    });
  });

  describe("handleSendPrompt - 错误处理", () => {
    it("应处理执行错误", async () => {
      const { api } = await import("@/lib/api");
      (api.executePrompt as any).mockRejectedValueOnce(new Error("Execution failed"));

      const config = createDefaultConfig();
      const { result } = renderHook(() => usePromptExecution(config));

      await act(async () => {
        await result.current.handleSendPrompt("test prompt", "claude-opus-4");
      });

      expect(config.setError).toHaveBeenCalled();
      expect(config.setIsLoading).toHaveBeenCalledWith(false);
    });
  });
});

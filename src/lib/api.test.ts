/**
 * API Module 单元测试
 *
 * 测试核心 API 模块的功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { api } from "./api";
import type { Session, ClaudeSettings, ClaudeVersionStatus } from "./api/types";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("API Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getProjectSessions", () => {
    it("应正确获取项目会话（仅 Claude）", async () => {
      const mockClaudeSessions: Session[] = [
        {
          id: "session-1",
          project_id: "project-1",
          project_path: "/path/to/project",
          created_at: Date.now(),
          model: "claude-opus-4",
          first_message: "Hello",
          last_message_timestamp: Date.now(),
        },
      ];

      (invoke as any).mockResolvedValueOnce(mockClaudeSessions);
      (invoke as any).mockResolvedValueOnce([]); // listCodexSessions

      const result = await api.getProjectSessions("project-1");

      expect(result).toHaveLength(1);
      expect(result[0].engine).toBe("claude");
      expect(result[0].id).toBe("session-1");
    });

    it("应正确合并 Claude 和 Codex 会话", async () => {
      const mockClaudeSessions: Session[] = [
        {
          id: "claude-1",
          project_id: "project-1",
          project_path: "/path/to/project",
          created_at: 1000,
          model: "claude-opus-4",
          first_message: "Claude Session",
          last_message_timestamp: 1000,
        },
      ];

      const mockCodexSessions = [
        {
          id: "codex-1",
          projectPath: "/path/to/project",
          createdAt: 2000,
          model: "gpt-5.1-codex-max",
          firstMessage: "Codex Session",
          lastMessageTimestamp: 2000,
        },
      ];

      (invoke as any).mockResolvedValueOnce(mockClaudeSessions);
      vi.spyOn(api, "listCodexSessions").mockResolvedValueOnce(mockCodexSessions as any);

      const result = await api.getProjectSessions("project-1");

      expect(result).toHaveLength(2);
      expect(result[0].engine).toBe("codex"); // 更新的在前
      expect(result[1].engine).toBe("claude");
    });

    it("应正确过滤不匹配的 Codex 会话", async () => {
      const mockClaudeSessions: Session[] = [
        {
          id: "claude-1",
          project_id: "project-1",
          project_path: "/path/to/project",
          created_at: 1000,
          model: "claude-opus-4",
          first_message: "Claude Session",
          last_message_timestamp: 1000,
        },
      ];

      const mockCodexSessions = [
        {
          id: "codex-1",
          projectPath: "/different/path",
          createdAt: 2000,
          model: "gpt-5.1-codex-max",
          firstMessage: "Codex Session",
          lastMessageTimestamp: 2000,
        },
      ];

      (invoke as any).mockResolvedValueOnce(mockClaudeSessions);
      vi.spyOn(api, "listCodexSessions").mockResolvedValueOnce(mockCodexSessions as any);

      const result = await api.getProjectSessions("project-1");

      expect(result).toHaveLength(1);
      expect(result[0].engine).toBe("claude");
    });

    it("应处理路径规范化（Windows 反斜杠）", async () => {
      const mockClaudeSessions: Session[] = [
        {
          id: "claude-1",
          project_id: "project-1",
          project_path: "C:\\Users\\Project",
          created_at: 1000,
          model: "claude-opus-4",
          first_message: "Claude Session",
          last_message_timestamp: 1000,
        },
      ];

      const mockCodexSessions = [
        {
          id: "codex-1",
          projectPath: "C:/Users/Project",
          createdAt: 2000,
          model: "gpt-5.1-codex-max",
          firstMessage: "Codex Session",
          lastMessageTimestamp: 2000,
        },
      ];

      (invoke as any).mockResolvedValueOnce(mockClaudeSessions);
      vi.spyOn(api, "listCodexSessions").mockResolvedValueOnce(mockCodexSessions as any);

      const result = await api.getProjectSessions("project-1");

      expect(result).toHaveLength(2);
    });

    it("应处理错误情况", async () => {
      (invoke as any).mockRejectedValueOnce(new Error("Backend error"));

      await expect(api.getProjectSessions("project-1")).rejects.toThrow("Backend error");
    });
  });

  describe("getClaudeSettings", () => {
    it("应正确获取 Claude 设置", async () => {
      const mockSettings: ClaudeSettings = {
        execution: {
          permission_mode: "ask",
          auto_resume: false,
          auto_compact: false,
        },
      };

      (invoke as any).mockResolvedValueOnce(mockSettings);

      const result = await api.getClaudeSettings();

      expect(result).toEqual(mockSettings);
      expect(invoke).toHaveBeenCalledWith("get_claude_settings");
    });

    it("应处理获取设置失败", async () => {
      (invoke as any).mockRejectedValueOnce(new Error("Settings not found"));

      await expect(api.getClaudeSettings()).rejects.toThrow("Settings not found");
    });
  });

  describe("openNewSession", () => {
    it("应正确打开新会话（无路径）", async () => {
      (invoke as any).mockResolvedValueOnce("session-123");

      const result = await api.openNewSession();

      expect(result).toBe("session-123");
      expect(invoke).toHaveBeenCalledWith("open_new_session", { path: undefined });
    });

    it("应正确打开新会话（指定路径）", async () => {
      (invoke as any).mockResolvedValueOnce("session-456");

      const result = await api.openNewSession("/path/to/project");

      expect(result).toBe("session-456");
      expect(invoke).toHaveBeenCalledWith("open_new_session", { path: "/path/to/project" });
    });

    it("应处理打开会话失败", async () => {
      (invoke as any).mockRejectedValueOnce(new Error("Failed to open session"));

      await expect(api.openNewSession()).rejects.toThrow("Failed to open session");
    });
  });

  describe("getSystemPrompt", () => {
    it("应正确获取系统提示词", async () => {
      const mockPrompt = "# System Prompt\n\nYou are a helpful assistant.";
      (invoke as any).mockResolvedValueOnce(mockPrompt);

      const result = await api.getSystemPrompt();

      expect(result).toBe(mockPrompt);
      expect(invoke).toHaveBeenCalledWith("get_system_prompt");
    });

    it("应处理获取提示词失败", async () => {
      (invoke as any).mockRejectedValueOnce(new Error("Prompt file not found"));

      await expect(api.getSystemPrompt()).rejects.toThrow("Prompt file not found");
    });
  });

  describe("checkClaudeVersion", () => {
    it("应正确检查 Claude 版本（已安装）", async () => {
      const mockVersion: ClaudeVersionStatus = {
        installed: true,
        version: "1.2.3",
        path: "/usr/local/bin/claude",
      };

      (invoke as any).mockResolvedValueOnce(mockVersion);

      const result = await api.checkClaudeVersion();

      expect(result.installed).toBe(true);
      expect(result.version).toBe("1.2.3");
      expect(invoke).toHaveBeenCalledWith("check_claude_version");
    });

    it("应正确检查 Claude 版本（未安装）", async () => {
      const mockVersion: ClaudeVersionStatus = {
        installed: false,
        version: null,
        path: null,
      };

      (invoke as any).mockResolvedValueOnce(mockVersion);

      const result = await api.checkClaudeVersion();

      expect(result.installed).toBe(false);
      expect(result.version).toBeNull();
    });

    it("应处理版本检查失败", async () => {
      (invoke as any).mockRejectedValueOnce(new Error("Version check failed"));

      await expect(api.checkClaudeVersion()).rejects.toThrow("Version check failed");
    });
  });
});

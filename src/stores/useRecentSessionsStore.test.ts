/**
 * Recent Sessions Store 测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useRecentSessionsStore } from "@/stores/useRecentSessionsStore";
import type { SessionSnapshot } from "@/types/recentSessions";

describe("useRecentSessionsStore", () => {
  beforeEach(() => {
    // 清空 store
    useRecentSessionsStore.getState().clearRecentSessions();
  });

  it("should add a session to recent sessions", () => {
    const session: SessionSnapshot = {
      id: "test-session-1",
      projectPath: "/test/project",
      engine: "claude",
      title: "Test Session",
      timestamp: Date.now(),
      messageCount: 5,
      lastMessage: "Hello world",
    };

    useRecentSessionsStore.getState().addRecentSession(session);

    const sessions = useRecentSessionsStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("test-session-1");
  });

  it("should switch to a session", () => {
    const session: SessionSnapshot = {
      id: "test-session-2",
      projectPath: "/test/project",
      engine: "codex",
      title: "Test Session 2",
      timestamp: Date.now(),
      messageCount: 10,
      lastMessage: "Test message",
    };

    useRecentSessionsStore.getState().addRecentSession(session);
    useRecentSessionsStore.getState().switchSession("test-session-2");

    const currentSessionId = useRecentSessionsStore.getState().currentSessionId;
    expect(currentSessionId).toBe("test-session-2");
  });

  it("should remove a session", () => {
    const session: SessionSnapshot = {
      id: "test-session-3",
      projectPath: "/test/project",
      engine: "gemini",
      title: "Test Session 3",
      timestamp: Date.now(),
      messageCount: 3,
      lastMessage: "Another message",
    };

    useRecentSessionsStore.getState().addRecentSession(session);
    useRecentSessionsStore.getState().removeRecentSession("test-session-3");

    const sessions = useRecentSessionsStore.getState().sessions;
    expect(sessions).toHaveLength(0);
  });

  it("should limit sessions to MAX_RECENT_SESSIONS", () => {
    // 添加 51 个会话
    for (let i = 0; i < 51; i++) {
      const session: SessionSnapshot = {
        id: `test-session-${i}`,
        projectPath: "/test/project",
        engine: "claude",
        title: `Test Session ${i}`,
        timestamp: Date.now() + i,
        messageCount: i,
        lastMessage: `Message ${i}`,
      };
      useRecentSessionsStore.getState().addRecentSession(session);
    }

    const sessions = useRecentSessionsStore.getState().sessions;
    // 应该只保留 50 个
    expect(sessions).toHaveLength(50);
    // 最新的应该在前面
    expect(sessions[0].id).toBe("test-session-50");
  });

  it("should clear all sessions", () => {
    const session: SessionSnapshot = {
      id: "test-session-4",
      projectPath: "/test/project",
      engine: "claude",
      title: "Test Session 4",
      timestamp: Date.now(),
      messageCount: 1,
      lastMessage: "Test",
    };

    useRecentSessionsStore.getState().addRecentSession(session);
    useRecentSessionsStore.getState().clearRecentSessions();

    const sessions = useRecentSessionsStore.getState().sessions;
    expect(sessions).toHaveLength(0);
  });
});

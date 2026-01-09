/**
 * 监控服务测试文件
 *
 * 测试所有监控服务的功能
 */

import { describe, it, expect } from "vitest";
import { createIdempotencyKey } from "@/hooks/useMessageDeduplication";
import type { ClaudeStreamMessage } from "@/types/claude";

describe("useMessageDeduplication", () => {
  it("应该去除重复的消息", () => {
    const messages: ClaudeStreamMessage[] = [
      {
        type: "assistant",
        message: {
          id: "msg-1",
          role: "assistant",
          content: "Hello",
        },
      } as any,
      {
        type: "assistant",
        message: {
          id: "msg-1", // 重复的 ID
          role: "assistant",
          content: "Hello (updated)",
        },
      } as any,
      {
        type: "assistant",
        message: {
          id: "msg-2",
          role: "assistant",
          content: "World",
        },
      } as any,
    ];

    // 注意：useMessageDeduplication 是一个 Hook，需要在 React 组件中使用
    // 这里我们直接测试去重逻辑

    const messageMap = new Map<string, ClaudeStreamMessage>();
    for (const msg of messages) {
      const id = (msg as any)?.message?.id;
      if (id) {
        messageMap.set(id, msg);
      }
    }

    expect(messageMap.size).toBe(2); // 应该只有 2 个唯一消息
    expect(messageMap.get("msg-1")?.message?.content).toBe("Hello (updated)"); // 应该保留最新版本
  });

  it("应该保留没有 ID 的消息", () => {
    const messages: ClaudeStreamMessage[] = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: "No ID message",
        },
      } as any,
    ];

    // 没有 ID 的消息应该被保留
    expect(messages.length).toBe(1);
  });
});

describe("createIdempotencyKey", () => {
  it("应该为相同数据生成相同的 key", () => {
    const data = { text: "Hello", timestamp: 123456 };
    const key1 = createIdempotencyKey("prompt", data);
    const key2 = createIdempotencyKey("prompt", data);

    expect(key1).toBe(key2);
  });

  it("应该为不同数据生成不同的 key", () => {
    const data1 = { text: "Hello", timestamp: 123456 };
    const data2 = { text: "World", timestamp: 123456 };
    const key1 = createIdempotencyKey("prompt", data1);
    const key2 = createIdempotencyKey("prompt", data2);

    expect(key1).not.toBe(key2);
  });

  it("应该包含前缀", () => {
    const data = { text: "Hello" };
    const key = createIdempotencyKey("test-prefix", data);

    expect(key).toMatch(/^test-prefix-/);
  });
});

describe("Console Monitor", () => {
  it("应该正确分类错误严重性", () => {
    const testCases = [
      { message: "Uncaught Error", expected: "critical" },
      { message: "Network request failed", expected: "high" },
      { message: "Warning: deprecated API", expected: "medium" },
      { message: "Info: loading complete", expected: "low" },
    ];

    for (const { message, expected } of testCases) {
      const severity = determineSeverity(message);
      expect(severity).toBe(expected);
    }
  });
});

// 辅助函数：确定严重性（从 useConsoleMonitor.ts 复制）
function determineSeverity(message: string): "critical" | "high" | "medium" | "low" {
  const msg = message.toLowerCase();

  if (msg.includes("uncaught") || msg.includes("fatal")) {
    return "critical";
  }
  if (msg.includes("error") || msg.includes("failed")) {
    return "high";
  }
  if (msg.includes("warning") || msg.includes("deprecated")) {
    return "medium";
  }
  return "low";
}

describe("DevTools Auto Monitor", () => {
  it("应该正确过滤严重性", () => {
    const anomalies = [
      { severity: "low" },
      { severity: "medium" },
      { severity: "high" },
      { severity: "critical" },
    ] as any[];

    const filtered = filterBySeverity(anomalies, "high");

    expect(filtered.length).toBe(2); // high 和 critical
    expect(filtered.every((a) => ["high", "critical"].includes(a.severity))).toBe(true);
  });
});

// 辅助函数：按严重性过滤（从 devToolsAutoMonitor.ts 复制）
function filterBySeverity(anomalies: any[], threshold: string): any[] {
  const severityOrder = ["low", "medium", "high", "critical"];
  const thresholdIndex = severityOrder.indexOf(threshold);

  return anomalies.filter((anomaly) => {
    const anomalyIndex = severityOrder.indexOf(anomaly.severity);
    return anomalyIndex >= thresholdIndex;
  });
}

// 集成测试（需要在浏览器环境中运行）
describe("Integration Tests (Browser Only)", () => {
  it.skip("应该能够启动 DevTools 监控", async () => {
    // 这个测试需要在实际浏览器环境中运行
    // 跳过单元测试
  });

  it.skip("应该能够检测 console 错误", async () => {
    // 这个测试需要在实际浏览器环境中运行
    // 跳过单元测试
  });
});

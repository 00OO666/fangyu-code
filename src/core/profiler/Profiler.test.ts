/**
 * Profiler 测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Profiler } from "./Profiler";

describe("Profiler", () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler();
  });

  it("应该能够创建Profiler实例", () => {
    expect(profiler).toBeDefined();
  });

  it("应该能够启动会话", () => {
    const sessionId = profiler.startSession("Test Session");
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
  });

  it("应该能够结束会话", () => {
    const sessionId = profiler.startSession("Test");
    const session = profiler.endSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.endTime).toBeDefined();
  });

  it("应该能够启动和结束计时器", () => {
    profiler.startTimer("test");
    const result = profiler.endTimer("test");
    expect(result).toBeDefined();
    expect(result?.duration).toBeGreaterThanOrEqual(0);
  });

  it("应该能够分析函数执行", async () => {
    const result = await profiler.profileFunction("test", () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("应该能够获取内存使用情况", () => {
    const memory = profiler.getMemoryUsage();
    expect(memory).toBeDefined();
    expect(typeof memory.used).toBe("number");
    expect(typeof memory.total).toBe("number");
  });
});

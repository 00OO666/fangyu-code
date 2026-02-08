/**
 * E2E Tests: API Connection
 * 测试 API 连接和响应处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockServer, createStreamChunks, type MockResponse } from "./MockAPIServer";

describe("E2E: API Connection", () => {
  beforeEach(() => {
    mockServer.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("基本连接测试", () => {
    it("应该成功连接到 API 并获取响应", async () => {
      const customResponse: MockResponse = {
        id: "test-123",
        object: "chat.completion",
        created: Date.now(),
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello from API!" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
      };

      mockServer.setResponse("chat/completions", customResponse);

      const response = await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.choices[0].message.content).toBe("Hello from API!");
    });

    it("应该正确处理流式响应", async () => {
      const chunks = createStreamChunks("Hello world from stream", "gpt-4");
      mockServer.setResponse("chat/completions", chunks);

      const response = await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
          stream: true,
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");

      // 读取流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(value);
        }
      }

      expect(fullContent).toContain("data:");
      expect(fullContent).toContain("[DONE]");
    });
  });

  describe("错误处理测试", () => {
    it("应该正确处理 401 认证错误", async () => {
      mockServer.setError("chat/completions", 401, "Invalid API key");

      const response = await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-key",
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.message).toBe("Invalid API key");
    });

    it("应该正确处理 429 速率限制错误", async () => {
      mockServer.setError("chat/completions", 429, "Rate limit exceeded");

      const response = await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error.message).toBe("Rate limit exceeded");
    });

    it("应该正确处理 500 服务器错误", async () => {
      mockServer.setError("chat/completions", 500, "Internal server error");

      const response = await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe("延迟和超时测试", () => {
    it("应该正确模拟网络延迟", async () => {
      mockServer.setLatency(100);

      const startTime = Date.now();
      await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe("请求日志测试", () => {
    it("应该记录所有请求", async () => {
      await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "First request" }],
        }),
      });

      await mockServer.mockFetch("https://api.test.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3",
          messages: [{ role: "user", content: "Second request" }],
        }),
      });

      const log = mockServer.getRequestLog();
      expect(log).toHaveLength(2);
      expect(log[0].body).toHaveProperty("model", "gpt-4");
      expect(log[1].body).toHaveProperty("model", "claude-3");
    });
  });

  describe("多提供商测试", () => {
    it("应该支持不同的 API 端点", async () => {
      // HiAPI
      const hiApiResponse = await mockServer.mockFetch(
        "https://api.hiapi.online/v1/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4", messages: [] }),
        }
      );
      expect(hiApiResponse.status).toBe(200);

      // OpenAI
      const openAiResponse = await mockServer.mockFetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4", messages: [] }),
        }
      );
      expect(openAiResponse.status).toBe(200);

      // Anthropic
      const anthropicResponse = await mockServer.mockFetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-3", messages: [] }),
        }
      );
      expect(anthropicResponse.status).toBe(200);
    });
  });
});

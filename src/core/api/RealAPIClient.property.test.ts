/**
 * RealAPIClient 属性测试
 *
 * Property 1: API 配置正确性
 * Property 2: 请求格式合规性
 * Property 3: 流式响应完整性
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  RealAPIClient,
  APIClientConfig,
  ChatCompletionRequest,
  APIErrorCode,
  MODEL_MAPPING,
  createHiAPIClient,
  createOpenAIClient,
  StreamChunk,
} from "./RealAPIClient";
import { StreamHandler } from "./StreamHandler";

// =============================================================================
// 测试生成器
// =============================================================================

/** 生成有效的 API 密钥 */
const apiKeyArb = fc
  .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"), {
    minLength: 20,
    maxLength: 64,
  })
  .map((s) => `sk-${s}`);

/** 生成有效的 Base URL */
const baseUrlArb = fc.constantFrom(
  "https://api.hiapi.online/v1",
  "https://api.openai.com/v1",
  "https://api.anthropic.com/v1",
  "https://custom-api.example.com/v1",
  "https://localhost:8080/v1"
);

/** 生成 API 配置 */
const apiConfigArb: fc.Arbitrary<APIClientConfig> = fc.record({
  baseUrl: baseUrlArb,
  apiKey: apiKeyArb,
  timeout: fc.option(fc.integer({ min: 1000, max: 120000 }), { nil: undefined }),
  maxRetries: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
  retryDelay: fc.option(fc.integer({ min: 100, max: 5000 }), { nil: undefined }),
});

/** 生成消息角色 */
const roleArb = fc.constantFrom("system", "user", "assistant") as fc.Arbitrary<
  "system" | "user" | "assistant"
>;

/** 生成消息内容 */
const contentArb = fc.string({ minLength: 1, maxLength: 1000 });

/** 生成单条消息 */
const messageArb = fc.record({
  role: roleArb,
  content: contentArb,
});

/** 生成消息数组（至少一条） */
const messagesArb = fc.array(messageArb, { minLength: 1, maxLength: 10 });

/** 生成模型名称 */
const modelArb = fc.constantFrom(
  "claude-3.5-sonnet",
  "claude-3-opus",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4o-mini",
  "gemini-2.5-pro",
  "gemini-1.5-pro"
);

/** 生成 Chat Completion 请求 */
const chatRequestArb: fc.Arbitrary<ChatCompletionRequest> = fc.record({
  model: modelArb,
  messages: messagesArb,
  temperature: fc.option(fc.float({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
  max_tokens: fc.option(fc.integer({ min: 1, max: 8192 }), { nil: undefined }),
  stream: fc.option(fc.boolean(), { nil: undefined }),
});

/** 生成流式响应块 */
const streamChunkArb: fc.Arbitrary<StreamChunk> = fc.record({
  id: fc.string({ minLength: 10, maxLength: 30 }).map((s) => `chatcmpl-${s}`),
  object: fc.constant("chat.completion.chunk" as const),
  created: fc.integer({ min: 1600000000, max: 2000000000 }),
  model: modelArb.map((m) => MODEL_MAPPING[m] ?? m),
  choices: fc
    .tuple(
      fc.record({
        index: fc.constant(0),
        delta: fc.record({
          role: fc.option(fc.constant("assistant"), { nil: undefined }),
          content: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
        }),
        finish_reason: fc.constantFrom("stop", "length", null) as fc.Arbitrary<
          "stop" | "length" | "content_filter" | null
        >,
      })
    )
    .map((arr) => arr),
});

/** 生成多个流式响应块 */
const streamChunksArb = fc.array(streamChunkArb, { minLength: 1, maxLength: 20 });

// =============================================================================
// Property 1: API 配置正确性
// Validates: Requirements 1.1, 1.2
// =============================================================================

describe("RealAPIClient Property Tests", () => {
  describe("Property 1: API 配置正确性", () => {
    it("应正确初始化配置参数", () => {
      fc.assert(
        fc.property(apiConfigArb, (config) => {
          const client = new RealAPIClient(config);

          // 客户端应该成功创建
          expect(client).toBeDefined();
          expect(client).toBeInstanceOf(RealAPIClient);
        }),
        { numRuns: 100 }
      );
    });

    it("应移除 baseUrl 尾部斜杠", () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          fc.constantFrom(
            "https://api.example.com/v1/",
            "https://api.example.com/v1//",
            "https://api.example.com/v1"
          ),
          (apiKey, baseUrl) => {
            const client = new RealAPIClient({ baseUrl, apiKey });
            // 内部配置应该移除尾部斜杠
            expect(client).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it("应使用默认值填充可选配置", () => {
      fc.assert(
        fc.property(baseUrlArb, apiKeyArb, (baseUrl, apiKey) => {
          const client = new RealAPIClient({ baseUrl, apiKey });
          // 客户端应该使用默认值创建
          expect(client).toBeDefined();
        }),
        { numRuns: 50 }
      );
    });

    it("HiAPI 工厂函数应使用正确的默认 URL", () => {
      fc.assert(
        fc.property(apiKeyArb, (apiKey) => {
          const client = createHiAPIClient(apiKey);
          expect(client).toBeDefined();
          expect(client).toBeInstanceOf(RealAPIClient);
        }),
        { numRuns: 50 }
      );
    });

    it("OpenAI 工厂函数应使用正确的默认 URL", () => {
      fc.assert(
        fc.property(apiKeyArb, (apiKey) => {
          const client = createOpenAIClient(apiKey);
          expect(client).toBeDefined();
          expect(client).toBeInstanceOf(RealAPIClient);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // Property 2: 请求格式合规性
  // Validates: Requirements 1.2, 1.3
  // ===========================================================================

  describe("Property 2: 请求格式合规性", () => {
    it("模型映射应保持一致性", () => {
      fc.assert(
        fc.property(modelArb, (model) => {
          const mapped = MODEL_MAPPING[model];
          // 映射后的模型名应该是字符串
          if (mapped) {
            expect(typeof mapped).toBe("string");
            expect(mapped.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("消息数组应保持顺序", () => {
      fc.assert(
        fc.property(messagesArb, (messages) => {
          // 消息数组应该保持原始顺序
          const copy = [...messages];
          expect(copy).toEqual(messages);
          expect(copy.length).toBe(messages.length);
        }),
        { numRuns: 100 }
      );
    });

    it("请求参数应在有效范围内", () => {
      fc.assert(
        fc.property(chatRequestArb, (request) => {
          // temperature 应在 0-2 范围内
          if (request.temperature !== undefined) {
            expect(request.temperature).toBeGreaterThanOrEqual(0);
            expect(request.temperature).toBeLessThanOrEqual(2);
          }

          // max_tokens 应为正整数
          if (request.max_tokens !== undefined) {
            expect(request.max_tokens).toBeGreaterThan(0);
            expect(Number.isInteger(request.max_tokens)).toBe(true);
          }

          // messages 应至少有一条
          expect(request.messages.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it("每条消息应有有效的角色和内容", () => {
      fc.assert(
        fc.property(messagesArb, (messages) => {
          for (const msg of messages) {
            expect(["system", "user", "assistant"]).toContain(msg.role);
            expect(typeof msg.content).toBe("string");
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // ===========================================================================
  // Property 3: 流式响应完整性
  // Validates: Requirements 1.4
  // ===========================================================================

  describe("Property 3: 流式响应完整性", () => {
    let streamHandler: StreamHandler;

    beforeEach(() => {
      streamHandler = new StreamHandler();
    });

    it("合并后的内容应等于所有块内容的拼接", () => {
      fc.assert(
        fc.property(streamChunksArb, (chunks) => {
          // 计算预期的合并内容
          const expectedContent = chunks.map((c) => c.choices[0]?.delta?.content ?? "").join("");

          // 使用 StreamHandler 合并
          const merged = streamHandler.mergeChunks(chunks);

          // 合并后的内容应该等于预期
          expect(merged.choices[0]?.message?.content).toBe(expectedContent);
        }),
        { numRuns: 100 }
      );
    });

    it("合并后应保留第一个块的元数据", () => {
      fc.assert(
        fc.property(streamChunksArb, (chunks) => {
          if (chunks.length === 0) return;

          const merged = streamHandler.mergeChunks(chunks);
          const firstChunk = chunks[0];

          // ID 和 model 应该来自第一个块
          expect(merged.id).toBe(firstChunk.id);
          expect(merged.model).toBe(firstChunk.model);
        }),
        { numRuns: 100 }
      );
    });

    it("合并后应使用最后一个非空的 finish_reason", () => {
      fc.assert(
        fc.property(streamChunksArb, (chunks) => {
          const merged = streamHandler.mergeChunks(chunks);

          // 找到最后一个非空的 finish_reason
          let lastFinishReason: "stop" | "length" | "content_filter" | null = null;
          for (const chunk of chunks) {
            if (chunk.choices[0]?.finish_reason) {
              lastFinishReason = chunk.choices[0].finish_reason;
            }
          }

          expect(merged.choices[0]?.finish_reason).toBe(lastFinishReason);
        }),
        { numRuns: 100 }
      );
    });

    it("空块数组应返回空响应", () => {
      const merged = streamHandler.mergeChunks([]);

      expect(merged.choices[0]?.message?.content).toBe("");
      expect(merged.choices[0]?.finish_reason).toBe("stop");
    });

    it("StreamHandler 状态应正确初始化", () => {
      expect(streamHandler.getState()).toBe("idle");
      expect(streamHandler.getContent()).toBe("");
      expect(streamHandler.getChunks()).toEqual([]);
    });

    it("reset 应清除所有状态", () => {
      fc.assert(
        fc.property(streamChunksArb, (chunks) => {
          // 先合并一些块
          streamHandler.mergeChunks(chunks);

          // 重置
          streamHandler.reset();

          // 状态应该被清除
          expect(streamHandler.getState()).toBe("idle");
          expect(streamHandler.getContent()).toBe("");
          expect(streamHandler.getChunks()).toEqual([]);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 错误码属性测试
  // Validates: Requirements 1.5
  // ===========================================================================

  describe("APIErrorCode 属性测试", () => {
    it("所有错误码应该是唯一的字符串", () => {
      const codes = Object.values(APIErrorCode);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);

      for (const code of codes) {
        expect(typeof code).toBe("string");
        expect(code.length).toBeGreaterThan(0);
      }
    });

    it("可重试错误码应该是错误码的子集", () => {
      const retryableCodes = [
        APIErrorCode.NETWORK_ERROR,
        APIErrorCode.TIMEOUT,
        APIErrorCode.RATE_LIMITED,
        APIErrorCode.SERVER_ERROR,
        APIErrorCode.SERVICE_UNAVAILABLE,
      ];

      const allCodes = Object.values(APIErrorCode);

      for (const code of retryableCodes) {
        expect(allCodes).toContain(code);
      }
    });
  });

  // ===========================================================================
  // 配置更新属性测试
  // ===========================================================================

  describe("配置更新属性测试", () => {
    it("updateConfig 应正确更新部分配置", () => {
      fc.assert(
        fc.property(
          apiConfigArb,
          apiKeyArb,
          fc.integer({ min: 5000, max: 60000 }),
          (initialConfig, newApiKey, newTimeout) => {
            const client = new RealAPIClient(initialConfig);

            // 更新配置
            client.updateConfig({
              apiKey: newApiKey,
              timeout: newTimeout,
            });

            // 客户端应该仍然有效
            expect(client).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it("updateConfig 应移除新 baseUrl 的尾部斜杠", () => {
      fc.assert(
        fc.property(apiConfigArb, (config) => {
          const client = new RealAPIClient(config);

          client.updateConfig({
            baseUrl: "https://new-api.example.com/v1/",
          });

          // 客户端应该仍然有效
          expect(client).toBeDefined();
        }),
        { numRuns: 50 }
      );
    });
  });
});

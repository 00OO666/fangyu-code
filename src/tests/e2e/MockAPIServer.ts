/**
 * Mock API Server for E2E Testing
 * 模拟 OpenAI 兼容的 API 服务器
 */

export interface MockResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export class MockAPIServer {
  private responses: Map<string, MockResponse | StreamChunk[]> = new Map();
  private errors: Map<string, { status: number; message: string }> = new Map();
  private latency: number = 0;
  private requestLog: Array<{ endpoint: string; body: unknown; timestamp: number }> = [];

  /**
   * 设置模拟响应
   */
  setResponse(pattern: string, response: MockResponse | StreamChunk[]): void {
    this.responses.set(pattern, response);
  }

  /**
   * 设置模拟错误
   */
  setError(pattern: string, status: number, message: string): void {
    this.errors.set(pattern, { status, message });
  }

  /**
   * 设置响应延迟
   */
  setLatency(ms: number): void {
    this.latency = ms;
  }

  /**
   * 获取请求日志
   */
  getRequestLog(): Array<{ endpoint: string; body: unknown; timestamp: number }> {
    return [...this.requestLog];
  }

  /**
   * 清除所有配置
   */
  reset(): void {
    this.responses.clear();
    this.errors.clear();
    this.latency = 0;
    this.requestLog = [];
  }

  /**
   * 模拟 fetch 请求
   */
  async mockFetch(url: string, options: RequestInit): Promise<Response> {
    const endpoint = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body as string) : null;

    this.requestLog.push({
      endpoint,
      body,
      timestamp: Date.now(),
    });

    // 模拟延迟
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency));
    }

    // 检查是否有错误配置
    for (const [pattern, error] of this.errors) {
      if (endpoint.includes(pattern) || this.matchesContent(body, pattern)) {
        return new Response(
          JSON.stringify({ error: { message: error.message, type: "api_error" } }),
          { status: error.status, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 检查是否是流式请求
    const isStream = body?.stream === true;

    // 查找匹配的响应
    for (const [pattern, response] of this.responses) {
      if (endpoint.includes(pattern) || this.matchesContent(body, pattern)) {
        if (isStream && Array.isArray(response)) {
          return this.createStreamResponse(response);
        }
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 默认响应
    return new Response(JSON.stringify(this.createDefaultResponse(body?.model || "gpt-4")), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  private matchesContent(body: unknown, pattern: string): boolean {
    if (!body) return false;
    const bodyStr = JSON.stringify(body);
    return bodyStr.includes(pattern);
  }

  private createStreamResponse(chunks: StreamChunk[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(data));
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  private createDefaultResponse(model: string): MockResponse {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "This is a mock response from the test server.",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25,
      },
    };
  }
}

/**
 * 创建流式响应的 chunks
 */
export function createStreamChunks(content: string, model: string = "gpt-4"): StreamChunk[] {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const words = content.split(" ");

  const chunks: StreamChunk[] = [
    // 初始 chunk 带 role
    {
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: { role: "assistant" },
          finish_reason: null,
        },
      ],
    },
  ];

  // 内容 chunks
  for (const word of words) {
    chunks.push({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: { content: word + " " },
          finish_reason: null,
        },
      ],
    });
  }

  // 结束 chunk
  chunks.push({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  });

  return chunks;
}

export const mockServer = new MockAPIServer();

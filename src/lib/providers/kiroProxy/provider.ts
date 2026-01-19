/**
 * Kiro Proxy Provider - 主 Provider 实现
 */

import type {
  KiroProxyConfig,
  ChatRequest,
  ChatResponse,
  Message,
  ExecutionContext,
  AgentLoopEvent,
} from './types';
import { agentLoop } from './agentLoop';
import { outputParser } from './outputParser';
import { responseTransformer } from './responseTransformer';
import { invoke } from '@tauri-apps/api/core';

const DEFAULT_CONFIG: Partial<KiroProxyConfig> = {
  maxLoopIterations: 20,
  timeoutMs: 300000,
  model: 'claude-sonnet-4-20250514',
};

/**
 * 从 Kiro Token 文件读取 Token
 */
async function loadKiroToken(): Promise<string | null> {
  try {
    const tokenPath = await invoke<string>('get_kiro_token_path');
    const tokenContent = await invoke<string>('read_file_content', { path: tokenPath });
    const tokenData = JSON.parse(tokenContent);
    
    // 检查是否过期
    if (tokenData.expiresAt) {
      const expiresAt = new Date(tokenData.expiresAt);
      if (expiresAt < new Date()) {
        console.warn('[KiroProxy] Token expired');
        return null;
      }
    }
    
    return tokenData.accessToken || tokenData.token;
  } catch (error) {
    console.error('[KiroProxy] Failed to load token:', error);
    return null;
  }
}

/**
 * 调用 Kiro API
 */
async function callKiroApi(
  messages: Message[],
  system: string | undefined,
  model: string,
  token: string
): Promise<string> {
  // 将消息转换为纯文本格式
  const formattedMessages = messages.map(m => {
    if (typeof m.content === 'string') {
      return `${m.role}: ${m.content}`;
    }
    // 处理 ContentBlock 数组
    const textParts = m.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text);
    const toolResults = m.content
      .filter(c => c.type === 'tool_result')
      .map(c => {
        const tr = c as { type: 'tool_result'; tool_use_id: string; content: string };
        return `[Tool Result ${tr.tool_use_id}]: ${tr.content}`;
      });
    return `${m.role}: ${[...textParts, ...toolResults].join('\n')}`;
  }).join('\n\n');
  
  const prompt = system 
    ? `${system}\n\n${formattedMessages}`
    : formattedMessages;
  
  // 调用 Tauri 后端的 Kiro API
  const response = await invoke<string>('call_kiro_api', {
    prompt,
    model,
    token,
  });
  
  return response;
}

/**
 * 创建 Kiro Proxy Provider 实例
 */
export function createKiroProxyProvider(config: Partial<KiroProxyConfig> = {}) {
  const finalConfig: KiroProxyConfig = {
    token: config.token || '',
    workspaceRoot: config.workspaceRoot || '',
    maxLoopIterations: config.maxLoopIterations || DEFAULT_CONFIG.maxLoopIterations!,
    timeoutMs: config.timeoutMs || DEFAULT_CONFIG.timeoutMs!,
    model: config.model || DEFAULT_CONFIG.model!,
  };
  
  /**
   * 验证配置
   */
  async function validateConfig(): Promise<{ valid: boolean; error?: string }> {
    // 尝试加载 Token
    const token = finalConfig.token || await loadKiroToken();
    if (!token) {
      return { valid: false, error: 'Kiro Token not found or expired. Please login to Kiro IDE.' };
    }
    
    // 验证工作区
    if (!finalConfig.workspaceRoot) {
      return { valid: false, error: 'Workspace root not configured.' };
    }
    
    return { valid: true };
  }
  
  /**
   * 发送消息（非流式）
   */
  async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const token = finalConfig.token || await loadKiroToken();
    if (!token) {
      return responseTransformer.errorResponse('Kiro Token not found', finalConfig.model);
    }
    
    const context: ExecutionContext = {
      workspaceRoot: finalConfig.workspaceRoot,
      env: {},
    };
    
    // 如果没有工具定义，直接调用 API
    if (!request.tools || request.tools.length === 0) {
      try {
        const response = await callKiroApi(
          request.messages,
          request.system,
          request.model || finalConfig.model,
          token
        );
        return responseTransformer.textToAnthropicResponse(response, finalConfig.model);
      } catch (error) {
        return responseTransformer.errorResponse(
          error instanceof Error ? error.message : String(error),
          finalConfig.model
        );
      }
    }
    
    // 使用 Agent Loop 处理工具调用
    const loop = agentLoop.createAgentLoop({
      maxIterations: finalConfig.maxLoopIterations,
      timeoutMs: finalConfig.timeoutMs,
    });
    
    const sendToApi = async (messages: Message[], system?: string) => {
      return callKiroApi(messages, system, request.model || finalConfig.model, token);
    };
    
    let finalResponse = '';
    let lastParseResult = outputParser.parse('');
    
    try {
      for await (const event of loop.run(request, sendToApi, context)) {
        switch (event.type) {
          case 'text':
            finalResponse += event.content;
            break;
          case 'done':
            finalResponse = event.finalResponse;
            lastParseResult = outputParser.parse(finalResponse);
            break;
          case 'error':
            return responseTransformer.errorResponse(event.error.message, finalConfig.model);
        }
      }
    } catch (error) {
      return responseTransformer.errorResponse(
        error instanceof Error ? error.message : String(error),
        finalConfig.model
      );
    }
    
    return responseTransformer.toAnthropicResponse(lastParseResult, finalConfig.model);
  }
  
  /**
   * 发送消息（流式）
   */
  async function* sendMessageStream(request: ChatRequest): AsyncGenerator<AgentLoopEvent> {
    const token = finalConfig.token || await loadKiroToken();
    if (!token) {
      yield { type: 'error', error: new Error('Kiro Token not found') };
      return;
    }
    
    const context: ExecutionContext = {
      workspaceRoot: finalConfig.workspaceRoot,
      env: {},
    };
    
    // 如果没有工具定义，直接调用 API
    if (!request.tools || request.tools.length === 0) {
      try {
        const response = await callKiroApi(
          request.messages,
          request.system,
          request.model || finalConfig.model,
          token
        );
        yield { type: 'text', content: response };
        yield { type: 'done', finalResponse: response };
      } catch (error) {
        yield { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
      }
      return;
    }
    
    // 使用 Agent Loop 处理工具调用
    const loop = agentLoop.createAgentLoop({
      maxIterations: finalConfig.maxLoopIterations,
      timeoutMs: finalConfig.timeoutMs,
    });
    
    const sendToApi = async (messages: Message[], system?: string) => {
      return callKiroApi(messages, system, request.model || finalConfig.model, token);
    };
    
    yield* loop.run(request, sendToApi, context);
  }
  
  return {
    name: 'kiro-proxy' as const,
    config: finalConfig,
    validateConfig,
    sendMessage,
    sendMessageStream,
  };
}

export const KiroProxyProvider = {
  create: createKiroProxyProvider,
  loadKiroToken,
  DEFAULT_CONFIG,
};

/**
 * Agent Loop Engine - 多轮工具调用循环引擎
 */

import type {
  AgentLoopConfig,
  AgentLoopState,
  AgentLoopEvent,
  ChatRequest,
  Message,
  ToolCall,
  ToolResult,
  ExecutionContext,
  ContentBlock,
} from './types';
import { outputParser } from './outputParser';
import { toolExecutor } from './toolExecutor';
import { toolTransformer } from './toolTransformer';

const DEFAULT_CONFIG: AgentLoopConfig = {
  maxIterations: 20,
  timeoutMs: 300000, // 5 minutes
};

/**
 * 创建 Agent Loop 实例
 */
function createAgentLoop(config: Partial<AgentLoopConfig> = {}) {
  const finalConfig: AgentLoopConfig = { ...DEFAULT_CONFIG, ...config };
  
  let state: AgentLoopState = {
    iteration: 0,
    messages: [],
    toolResults: [],
    startTime: 0,
  };
  
  /**
   * 检查是否超时
   */
  function isTimeout(): boolean {
    return Date.now() - state.startTime > finalConfig.timeoutMs;
  }
  
  /**
   * 检查是否达到最大迭代次数
   */
  function isMaxIterations(): boolean {
    return state.iteration >= finalConfig.maxIterations;
  }
  
  /**
   * 将工具结果注入到消息中
   */
  function injectToolResults(toolCalls: ToolCall[], results: ToolResult[]): Message {
    const content: ContentBlock[] = toolCalls.map((tc, i) => ({
      type: 'tool_result' as const,
      tool_use_id: tc.id,
      content: results[i].success ? results[i].content : `Error: ${results[i].error}`,
    }));
    
    return {
      role: 'user',
      content,
    };
  }
  
  /**
   * 运行 Agent 循环
   */
  async function* run(
    initialRequest: ChatRequest,
    sendToApi: (messages: Message[], system?: string) => Promise<string>,
    context: ExecutionContext
  ): AsyncGenerator<AgentLoopEvent> {
    state = {
      iteration: 0,
      messages: [...initialRequest.messages],
      toolResults: [],
      startTime: Date.now(),
    };
    
    // 注入工具定义到 system prompt
    const toolsPrompt = initialRequest.tools 
      ? toolTransformer.toXmlPrompt(initialRequest.tools)
      : '';
    const systemPrompt = [initialRequest.system, toolsPrompt].filter(Boolean).join('\n\n');
    
    while (true) {
      // 检查终止条件
      if (isTimeout()) {
        yield { type: 'error', error: new Error('Agent loop timeout') };
        return;
      }
      
      if (isMaxIterations()) {
        yield { type: 'error', error: new Error('Max iterations reached') };
        return;
      }
      
      state.iteration++;
      
      // 调用 API
      let response: string;
      try {
        response = await sendToApi(state.messages, systemPrompt);
      } catch (error) {
        yield { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
        return;
      }
      
      // 解析响应
      const parseResult = outputParser.parse(response);
      
      // 输出文本部分
      if (parseResult.text) {
        yield { type: 'text', content: parseResult.text };
      }
      
      // 如果没有工具调用，结束循环
      if (!parseResult.hasToolCall) {
        yield { type: 'done', finalResponse: response };
        return;
      }
      
      // 添加 assistant 消息
      const assistantContent: ContentBlock[] = [];
      if (parseResult.text) {
        assistantContent.push({ type: 'text', text: parseResult.text });
      }
      for (const tc of parseResult.toolCalls) {
        assistantContent.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }
      state.messages.push({ role: 'assistant', content: assistantContent });
      
      // 执行工具调用
      const results: ToolResult[] = [];
      for (const toolCall of parseResult.toolCalls) {
        yield { type: 'tool_call', toolCall };
        
        const result = await toolExecutor.execute(toolCall, context);
        results.push(result);
        state.toolResults.push(result);
        
        yield { type: 'tool_result', result, toolCallId: toolCall.id };
      }
      
      // 注入工具结果
      const toolResultMessage = injectToolResults(parseResult.toolCalls, results);
      state.messages.push(toolResultMessage);
    }
  }
  
  /**
   * 获取当前状态
   */
  function getState(): AgentLoopState {
    return { ...state };
  }
  
  /**
   * 重置状态
   */
  function reset(): void {
    state = {
      iteration: 0,
      messages: [],
      toolResults: [],
      startTime: 0,
    };
  }
  
  return {
    run,
    getState,
    reset,
    config: finalConfig,
  };
}

export const agentLoop = {
  createAgentLoop,
  DEFAULT_CONFIG,
};

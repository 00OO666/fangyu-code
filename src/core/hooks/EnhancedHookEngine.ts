import { logger } from '@/lib/logger';

/**
 * EnhancedHookEngine - 增强 Hook 引擎
 * 
 * 支持 22+ 种 hook 事件类型，实现 hook 链执行和阻塞传播
 * 
 * Requirements: 2.1, 2.3, 2.4
 */

// Hook 事件类型
export type HookEventType =
  // 消息相关
  | 'message:before'
  | 'message:after'
  | 'message:error'
  // 会话相关
  | 'session:create'
  | 'session:end'
  | 'session:switch'
  // 文件相关
  | 'file:save'
  | 'file:open'
  | 'file:close'
  | 'file:change'
  | 'file:create'
  | 'file:delete'
  // Agent 相关
  | 'agent:start'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:spawn'
  | 'agent:destroy'
  // 工具相关
  | 'tool:before'
  | 'tool:after'
  | 'tool:error'
  // 上下文相关
  | 'context:inject'
  | 'context:compact'
  | 'context:threshold'
  // 其他
  | 'manual:trigger'
  | 'startup'
  | 'shutdown';

// Hook 动作类型
export type HookActionType = 'sendMessage' | 'executeCommand' | 'custom';

// Hook 动作定义
export interface HookAction {
  type: HookActionType;
  payload: string | Record<string, unknown>;
}

// Hook 定义
export interface HookDefinition {
  id: string;
  name: string;
  description?: string;
  event: HookEventType;
  condition?: HookCondition;
  actions: HookAction[];
  priority?: number;  // 数字越小优先级越高
  enabled?: boolean;
  blocking?: boolean;  // 是否阻塞后续 hook
}

// Hook 条件
export interface HookCondition {
  type: 'fileMatch' | 'contentMatch' | 'custom';
  pattern?: string;
  predicate?: (context: HookContext) => boolean;
}

// Hook 执行上下文
export interface HookContext {
  event: HookEventType;
  timestamp: number;
  data: Record<string, unknown>;
  source?: string;
  blocked?: boolean;
}

// Hook 执行结果
export interface HookResult {
  hookId: string;
  success: boolean;
  blocked: boolean;
  error?: string;
  output?: unknown;
  duration: number;
}

// Hook 链执行结果
export interface HookChainResult {
  event: HookEventType;
  results: HookResult[];
  totalDuration: number;
  blocked: boolean;
  blockedBy?: string;
}

// Hook 执行器接口
export interface HookExecutor {
  execute(action: HookAction, context: HookContext): Promise<unknown>;
}

/**
 * 默认 Hook 执行器
 */
export class DefaultHookExecutor implements HookExecutor {
  async execute(action: HookAction, context: HookContext): Promise<unknown> {
    switch (action.type) {
      case 'sendMessage':
        // 模拟发送消息
        logger.debug('EnhancedHookEngine', `[Hook] Sending message: ${action.payload}`);
        return { sent: true, message: action.payload };
        
      case 'executeCommand':
        // 模拟执行命令
        logger.debug('EnhancedHookEngine', `[Hook] Executing command: ${action.payload}`);
        return { executed: true, command: action.payload };
        
      case 'custom':
        // 自定义动作
        logger.debug('EnhancedHookEngine', `[Hook] Custom action:`, action.payload);
        return { custom: true, payload: action.payload };
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
}

/**
 * EnhancedHookEngine 类
 */
export class EnhancedHookEngine {
  private hooks: Map<string, HookDefinition> = new Map();
  private eventHooks: Map<HookEventType, Set<string>> = new Map();
  private executor: HookExecutor;
  private enabled: boolean = true;
  
  constructor(executor?: HookExecutor) {
    this.executor = executor ?? new DefaultHookExecutor();
  }
  
  /**
   * 注册 Hook
   */
  registerHook(hook: HookDefinition): void {
    if (this.hooks.has(hook.id)) {
      throw new Error(`Hook with id '${hook.id}' already exists`);
    }
    
    // 设置默认值
    hook.priority = hook.priority ?? 100;
    hook.enabled = hook.enabled ?? true;
    hook.blocking = hook.blocking ?? false;
    
    this.hooks.set(hook.id, hook);
    
    // 添加到事件索引
    if (!this.eventHooks.has(hook.event)) {
      this.eventHooks.set(hook.event, new Set());
    }
    this.eventHooks.get(hook.event)!.add(hook.id);
  }
  
  /**
   * 注销 Hook
   */
  unregisterHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      return false;
    }
    
    // 从事件索引中移除
    const eventHooks = this.eventHooks.get(hook.event);
    if (eventHooks) {
      eventHooks.delete(hookId);
      if (eventHooks.size === 0) {
        this.eventHooks.delete(hook.event);
      }
    }
    
    this.hooks.delete(hookId);
    return true;
  }
  
  /**
   * 启用/禁用 Hook
   */
  setHookEnabled(hookId: string, enabled: boolean): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      return false;
    }
    hook.enabled = enabled;
    return true;
  }
  
  /**
   * 获取 Hook
   */
  getHook(hookId: string): HookDefinition | undefined {
    return this.hooks.get(hookId);
  }
  
  /**
   * 获取所有 Hook
   */
  getAllHooks(): HookDefinition[] {
    return Array.from(this.hooks.values());
  }
  
  /**
   * 获取指定事件的所有 Hook（按优先级排序）
   */
  getHooksForEvent(event: HookEventType): HookDefinition[] {
    const hookIds = this.eventHooks.get(event);
    if (!hookIds) {
      return [];
    }
    
    return Array.from(hookIds)
      .map(id => this.hooks.get(id)!)
      .filter(hook => hook.enabled)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }
  
  /**
   * 检查条件是否满足
   */
  private checkCondition(condition: HookCondition | undefined, context: HookContext): boolean {
    if (!condition) {
      return true;
    }
    
    switch (condition.type) {
      case 'fileMatch': {
        if (!condition.pattern || !context.data.filePath) {
          return false;
        }
        // 简单的文件匹配
        const filePath = String(context.data.filePath);
        return filePath.includes(condition.pattern) ||
               new RegExp(condition.pattern, 'i').test(filePath);
      }
        
      case 'contentMatch': {
        if (!condition.pattern || !context.data.content) {
          return false;
        }
        const content = String(context.data.content);
        return content.includes(condition.pattern) ||
               new RegExp(condition.pattern, 'i').test(content);
      }
        
      case 'custom':
        if (!condition.predicate) {
          return true;
        }
        return condition.predicate(context);
        
      default:
        return true;
    }
  }
  
  /**
   * 执行单个 Hook
   */
  private async executeHook(hook: HookDefinition, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();
    
    try {
      // 检查条件
      if (!this.checkCondition(hook.condition, context)) {
        return {
          hookId: hook.id,
          success: true,
          blocked: false,
          output: { skipped: true, reason: 'condition not met' },
          duration: Date.now() - startTime
        };
      }
      
      // 执行所有动作
      const outputs: unknown[] = [];
      for (const action of hook.actions) {
        const output = await this.executor.execute(action, context);
        outputs.push(output);
      }
      
      return {
        hookId: hook.id,
        success: true,
        blocked: hook.blocking ?? false,
        output: outputs.length === 1 ? outputs[0] : outputs,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        hookId: hook.id,
        success: false,
        blocked: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * 执行 Hook 链
   */
  async executeChain(event: HookEventType, data: Record<string, unknown> = {}): Promise<HookChainResult> {
    const startTime = Date.now();
    const context: HookContext = {
      event,
      timestamp: Date.now(),
      data,
      blocked: false
    };
    
    const results: HookResult[] = [];
    let blocked = false;
    let blockedBy: string | undefined;
    
    if (!this.enabled) {
      return {
        event,
        results: [],
        totalDuration: 0,
        blocked: false
      };
    }
    
    const hooks = this.getHooksForEvent(event);
    
    for (const hook of hooks) {
      if (blocked) {
        // 如果已被阻塞，跳过后续 hook
        results.push({
          hookId: hook.id,
          success: true,
          blocked: false,
          output: { skipped: true, reason: 'blocked by previous hook' },
          duration: 0
        });
        continue;
      }
      
      const result = await this.executeHook(hook, context);
      results.push(result);
      
      if (result.blocked) {
        blocked = true;
        blockedBy = hook.id;
        context.blocked = true;
      }
    }
    
    return {
      event,
      results,
      totalDuration: Date.now() - startTime,
      blocked,
      blockedBy
    };
  }
  
  /**
   * 触发事件（executeChain 的别名）
   */
  async trigger(event: HookEventType, data?: Record<string, unknown>): Promise<HookChainResult> {
    return this.executeChain(event, data);
  }
  
  /**
   * 启用/禁用引擎
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * 检查引擎是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * 清除所有 Hook
   */
  clear(): void {
    this.hooks.clear();
    this.eventHooks.clear();
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalHooks: number;
    enabledHooks: number;
    eventTypes: number;
    hooksByEvent: Record<string, number>;
  } {
    const hooksByEvent: Record<string, number> = {};
    
    for (const [event, hookIds] of this.eventHooks) {
      hooksByEvent[event] = hookIds.size;
    }
    
    return {
      totalHooks: this.hooks.size,
      enabledHooks: Array.from(this.hooks.values()).filter(h => h.enabled).length,
      eventTypes: this.eventHooks.size,
      hooksByEvent
    };
  }
}

export default EnhancedHookEngine;

/**
 * ClaudeCodeCompat - Claude Code 兼容层
 * 
 * 解析 Claude Code 格式的 hook 配置，转换为 EnhancedHookEngine 格式
 * 
 * Requirements: 2.5
 */

import {
  HookDefinition,
  HookEventType,
  HookAction,
  HookCondition
} from './EnhancedHookEngine';

// Claude Code Hook 配置格式
export interface ClaudeCodeHook {
  name: string;
  description?: string;
  trigger: ClaudeCodeTrigger;
  action: ClaudeCodeAction;
  condition?: string;  // glob 模式或正则表达式
  enabled?: boolean;
}

// Claude Code 触发器类型
export interface ClaudeCodeTrigger {
  type: 'message' | 'file' | 'session' | 'manual' | 'startup' | 'shutdown';
  event?: 'before' | 'after' | 'save' | 'open' | 'create' | 'end' | 'switch';
  pattern?: string;
}

// Claude Code 动作类型
export interface ClaudeCodeAction {
  type: 'send_message' | 'run_command' | 'custom';
  content: string;
  args?: string[];
}

// Claude Code 配置文件格式
export interface ClaudeCodeConfig {
  hooks?: ClaudeCodeHook[];
  settings?: {
    autoApprove?: string[];
    disabled?: boolean;
  };
}

/**
 * 将 Claude Code 触发器转换为 HookEventType
 */
function convertTriggerToEventType(trigger: ClaudeCodeTrigger): HookEventType {
  const { type, event } = trigger;
  
  switch (type) {
    case 'message':
      return event === 'after' ? 'message:after' : 'message:before';
    case 'file':
      switch (event) {
        case 'save': return 'file:save';
        case 'open': return 'file:open';
        case 'create': return 'file:create';
        default: return 'file:change';
      }
    case 'session':
      switch (event) {
        case 'end': return 'session:end';
        case 'switch': return 'session:switch';
        default: return 'session:create';
      }
    case 'manual':
      return 'manual:trigger';
    case 'startup':
      return 'startup';
    case 'shutdown':
      return 'shutdown';
    default:
      return 'message:before';
  }
}

/**
 * 将 Claude Code 动作转换为 HookAction
 */
function convertAction(action: ClaudeCodeAction): HookAction {
  switch (action.type) {
    case 'send_message':
      return {
        type: 'sendMessage',
        payload: action.content
      };
    case 'run_command':
      return {
        type: 'executeCommand',
        payload: action.args ? `${action.content} ${action.args.join(' ')}` : action.content
      };
    case 'custom':
      return {
        type: 'custom',
        payload: { content: action.content, args: action.args }
      };
    default:
      return {
        type: 'sendMessage',
        payload: action.content
      };
  }
}

/**
 * 将 Claude Code 条件转换为 HookCondition
 */
function convertCondition(condition: string | undefined, trigger: ClaudeCodeTrigger): HookCondition | undefined {
  if (!condition) {
    return undefined;
  }
  
  // 根据触发器类型决定条件类型
  if (trigger.type === 'file') {
    return {
      type: 'fileMatch',
      pattern: condition
    };
  }
  
  if (trigger.type === 'message') {
    return {
      type: 'contentMatch',
      pattern: condition
    };
  }
  
  // 默认使用自定义条件
  return {
    type: 'custom',
    predicate: (context) => {
      const content = String(context.data.content ?? '');
      return content.includes(condition) || new RegExp(condition, 'i').test(content);
    }
  };
}

/**
 * 生成唯一的 Hook ID
 */
function generateHookId(name: string, index: number): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `claude-${sanitized}-${index}`;
}

/**
 * 将单个 Claude Code Hook 转换为 HookDefinition
 */
export function convertClaudeCodeHook(hook: ClaudeCodeHook, index: number): HookDefinition {
  return {
    id: generateHookId(hook.name, index),
    name: hook.name,
    description: hook.description,
    event: convertTriggerToEventType(hook.trigger),
    condition: convertCondition(hook.condition, hook.trigger),
    actions: [convertAction(hook.action)],
    priority: 100,  // 默认优先级
    enabled: hook.enabled ?? true,
    blocking: false
  };
}

/**
 * 将 Claude Code 配置转换为 HookDefinition 数组
 */
export function convertClaudeCodeConfig(config: ClaudeCodeConfig): HookDefinition[] {
  if (!config.hooks || config.hooks.length === 0) {
    return [];
  }
  
  return config.hooks.map((hook, index) => convertClaudeCodeHook(hook, index));
}

/**
 * 解析 Claude Code 配置文件内容（JSON 格式）
 */
export function parseClaudeCodeConfig(content: string): ClaudeCodeConfig {
  try {
    const parsed = JSON.parse(content);
    return parsed as ClaudeCodeConfig;
  } catch (error) {
    throw new Error(`Failed to parse Claude Code config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解析 Claude Code 配置文件内容（YAML 格式）
 * 简单的 YAML 解析器，支持基本格式
 */
export function parseClaudeCodeYaml(content: string): ClaudeCodeConfig {
  const config: ClaudeCodeConfig = { hooks: [] };
  const lines = content.split(/\r?\n/);
  
  let currentHook: Partial<ClaudeCodeHook> | null = null;
  let currentSection: string | null = null;
  let indent = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const currentIndent = line.search(/\S/);
    
    // 检测 hooks 数组项
    if (trimmed.startsWith('- name:')) {
      if (currentHook && currentHook.name) {
        config.hooks!.push(currentHook as ClaudeCodeHook);
      }
      currentHook = {
        name: trimmed.slice(7).trim().replace(/^['"]|['"]$/g, ''),
        trigger: { type: 'message' },
        action: { type: 'send_message', content: '' }
      };
      currentSection = null;
      indent = currentIndent;
      continue;
    }
    
    if (!currentHook) continue;
    
    // 解析键值对
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    
    switch (key) {
      case 'description':
        currentHook.description = value;
        break;
      case 'condition':
        currentHook.condition = value;
        break;
      case 'enabled':
        currentHook.enabled = value.toLowerCase() === 'true';
        break;
      case 'trigger':
        currentSection = 'trigger';
        break;
      case 'action':
        currentSection = 'action';
        break;
      case 'type':
        if (currentSection === 'trigger') {
          currentHook.trigger!.type = value as ClaudeCodeTrigger['type'];
        } else if (currentSection === 'action') {
          currentHook.action!.type = value as ClaudeCodeAction['type'];
        }
        break;
      case 'event':
        if (currentSection === 'trigger') {
          currentHook.trigger!.event = value as ClaudeCodeTrigger['event'];
        }
        break;
      case 'pattern':
        if (currentSection === 'trigger') {
          currentHook.trigger!.pattern = value;
        }
        break;
      case 'content':
        if (currentSection === 'action') {
          currentHook.action!.content = value;
        }
        break;
    }
  }
  
  // 添加最后一个 hook
  if (currentHook && currentHook.name) {
    config.hooks!.push(currentHook as ClaudeCodeHook);
  }
  
  return config;
}

/**
 * ClaudeCodeCompat 类 - 提供完整的兼容层功能
 */
export class ClaudeCodeCompat {
  private hooks: HookDefinition[] = [];
  
  /**
   * 从 JSON 配置加载
   */
  loadFromJson(content: string): HookDefinition[] {
    const config = parseClaudeCodeConfig(content);
    this.hooks = convertClaudeCodeConfig(config);
    return this.hooks;
  }
  
  /**
   * 从 YAML 配置加载
   */
  loadFromYaml(content: string): HookDefinition[] {
    const config = parseClaudeCodeYaml(content);
    this.hooks = convertClaudeCodeConfig(config);
    return this.hooks;
  }
  
  /**
   * 从 Claude Code Hook 对象加载
   */
  loadFromHooks(hooks: ClaudeCodeHook[]): HookDefinition[] {
    this.hooks = hooks.map((hook, index) => convertClaudeCodeHook(hook, index));
    return this.hooks;
  }
  
  /**
   * 获取转换后的 hooks
   */
  getHooks(): HookDefinition[] {
    return this.hooks;
  }
  
  /**
   * 清除已加载的 hooks
   */
  clear(): void {
    this.hooks = [];
  }
  
  /**
   * 导出为 JSON 格式
   */
  exportToJson(): string {
    return JSON.stringify({ hooks: this.hooks }, null, 2);
  }
}

export default ClaudeCodeCompat;

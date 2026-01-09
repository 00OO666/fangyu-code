/**
 * SmartContextManager - 智能上下文管理器
 * 
 * 实现 token 计数、使用量追踪、阈值监控和压缩
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7
 */

// 模型配置
export interface ModelConfig {
  name: string;
  provider: 'anthropic' | 'openai' | 'google' | 'xai';
  maxTokens: number;
  inputCostPer1k: number;  // 每 1000 token 的输入成本（美元）
  outputCostPer1k: number; // 每 1000 token 的输出成本（美元）
}

// 预定义模型配置
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'claude-3-opus': {
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    maxTokens: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075
  },
  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    maxTokens: 200000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    provider: 'openai',
    maxTokens: 128000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03
  },
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 128000,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015
  },
  'gemini-pro': {
    name: 'Gemini Pro',
    provider: 'google',
    maxTokens: 1000000,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005
  },
  'grok-2': {
    name: 'Grok 2',
    provider: 'xai',
    maxTokens: 131072,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.01
  }
};

// 上下文项
export interface ContextItem {
  id: string;
  type: 'system' | 'user' | 'assistant' | 'tool' | 'file' | 'steering';
  content: string;
  tokens: number;
  timestamp: number;
  priority: number;  // 数字越小优先级越高，压缩时优先保留
  metadata?: Record<string, unknown>;
}

// 阈值配置
export interface ThresholdConfig {
  warning: number;   // 警告阈值（默认 70%）
  critical: number;  // 临界阈值（默认 85%）
  autoCompact: boolean;  // 是否自动压缩
}

// 压缩策略
export type CompactionStrategy = 'fifo' | 'priority' | 'similarity' | 'hybrid';

// 压缩结果
export interface CompactionResult {
  removed: ContextItem[];
  retained: ContextItem[];
  tokensBefore: number;
  tokensAfter: number;
  compressionRatio: number;
}

// 使用统计
export interface UsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  utilizationPercent: number;
  itemCount: number;
}

// 阈值事件
export type ThresholdEvent = 'warning' | 'critical' | 'normal';

// 阈值监听器
export type ThresholdListener = (event: ThresholdEvent, stats: UsageStats) => void;

/**
 * 简单的 token 计数器（基于字符估算）
 * 实际应用中应使用 tiktoken 或模型特定的 tokenizer
 */
export function estimateTokens(text: string): number {
  // 粗略估算：平均每 4 个字符约 1 个 token
  // 中文字符约 1.5 个 token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

/**
 * 计算内容哈希（用于去重）
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * SmartContextManager 类
 */
export class SmartContextManager {
  private items: Map<string, ContextItem> = new Map();
  private contentHashes: Set<string> = new Set();
  private modelConfig: ModelConfig;
  private thresholdConfig: ThresholdConfig;
  private listeners: Set<ThresholdListener> = new Set();
  private lastThresholdEvent: ThresholdEvent = 'normal';
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  
  constructor(
    modelName: string = 'claude-3-sonnet',
    thresholdConfig?: Partial<ThresholdConfig>
  ) {
    this.modelConfig = MODEL_CONFIGS[modelName] ?? MODEL_CONFIGS['claude-3-sonnet'];
    this.thresholdConfig = {
      warning: thresholdConfig?.warning ?? 0.70,
      critical: thresholdConfig?.critical ?? 0.85,
      autoCompact: thresholdConfig?.autoCompact ?? true
    };
  }
  
  /**
   * 注入上下文项（带去重）
   */
  inject(item: Omit<ContextItem, 'id' | 'tokens' | 'timestamp'>): ContextItem | null {
    const contentHash = hashContent(item.content);
    
    // 去重检查
    if (this.contentHashes.has(contentHash)) {
      return null;  // 重复内容，不注入
    }
    
    const tokens = estimateTokens(item.content);
    const contextItem: ContextItem = {
      ...item,
      id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tokens,
      timestamp: Date.now()
    };
    
    this.items.set(contextItem.id, contextItem);
    this.contentHashes.add(contentHash);
    this.inputTokens += tokens;
    
    // 检查阈值
    this.checkThreshold();
    
    return contextItem;
  }
  
  /**
   * 批量注入
   */
  injectBatch(items: Array<Omit<ContextItem, 'id' | 'tokens' | 'timestamp'>>): ContextItem[] {
    const injected: ContextItem[] = [];
    for (const item of items) {
      const result = this.inject(item);
      if (result) {
        injected.push(result);
      }
    }
    return injected;
  }
  
  /**
   * 移除上下文项
   */
  remove(id: string): boolean {
    const item = this.items.get(id);
    if (!item) {
      return false;
    }
    
    this.items.delete(id);
    this.contentHashes.delete(hashContent(item.content));
    return true;
  }
  
  /**
   * 获取当前 token 使用量
   */
  getCurrentTokens(): number {
    let total = 0;
    for (const item of this.items.values()) {
      total += item.tokens;
    }
    return total;
  }
  
  /**
   * 获取使用统计
   */
  getStats(): UsageStats {
    const totalTokens = this.getCurrentTokens();
    const utilizationPercent = totalTokens / this.modelConfig.maxTokens;
    
    const inputCost = (this.inputTokens / 1000) * this.modelConfig.inputCostPer1k;
    const outputCost = (this.outputTokens / 1000) * this.modelConfig.outputCostPer1k;
    
    return {
      totalTokens,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      estimatedCost: inputCost + outputCost,
      utilizationPercent,
      itemCount: this.items.size
    };
  }
  
  /**
   * 检查阈值并触发事件
   */
  private checkThreshold(): void {
    const stats = this.getStats();
    let event: ThresholdEvent = 'normal';
    
    if (stats.utilizationPercent >= this.thresholdConfig.critical) {
      event = 'critical';
      if (this.thresholdConfig.autoCompact) {
        this.triggerCompaction('hybrid');
      }
    } else if (stats.utilizationPercent >= this.thresholdConfig.warning) {
      event = 'warning';
    }
    
    // 只在状态变化时触发
    if (event !== this.lastThresholdEvent) {
      this.lastThresholdEvent = event;
      this.notifyListeners(event, stats);
    }
  }
  
  /**
   * 触发压缩
   */
  triggerCompaction(strategy: CompactionStrategy = 'hybrid'): CompactionResult {
    const tokensBefore = this.getCurrentTokens();
    const targetTokens = Math.floor(this.modelConfig.maxTokens * 0.5);  // 压缩到 50%
    
    const itemsArray = Array.from(this.items.values());
    const removed: ContextItem[] = [];
    const retained: ContextItem[] = [];
    
    // 按策略排序
    let sortedItems: ContextItem[];
    switch (strategy) {
      case 'fifo':
        // 先进先出：按时间戳排序，移除最旧的
        sortedItems = [...itemsArray].sort((a, b) => a.timestamp - b.timestamp);
        break;
      case 'priority':
        // 优先级：按优先级排序，移除低优先级的
        sortedItems = [...itemsArray].sort((a, b) => b.priority - a.priority);
        break;
      case 'similarity':
      case 'hybrid':
      default:
        // 混合策略：结合时间和优先级
        sortedItems = [...itemsArray].sort((a, b) => {
          const priorityDiff = b.priority - a.priority;
          if (priorityDiff !== 0) return priorityDiff;
          return a.timestamp - b.timestamp;
        });
        break;
    }
    
    // 保留高优先级的 system 和 steering 类型
    const _mustRetain = sortedItems.filter(item => 
      item.type === 'system' || (item.type === 'steering' && item.priority <= 10)
    );
    const canRemove = sortedItems.filter(item => 
      item.type !== 'system' && !(item.type === 'steering' && item.priority <= 10)
    );
    
    let currentTokens = tokensBefore;
    
    // 移除项直到达到目标
    for (const item of canRemove) {
      if (currentTokens <= targetTokens) {
        break;
      }
      removed.push(item);
      this.remove(item.id);
      currentTokens -= item.tokens;
    }
    
    // 收集保留的项
    for (const item of this.items.values()) {
      retained.push(item);
    }
    
    const tokensAfter = this.getCurrentTokens();
    
    return {
      removed,
      retained,
      tokensBefore,
      tokensAfter,
      compressionRatio: tokensBefore > 0 ? tokensAfter / tokensBefore : 1
    };
  }
  
  /**
   * 添加阈值监听器
   */
  addThresholdListener(listener: ThresholdListener): void {
    this.listeners.add(listener);
  }
  
  /**
   * 移除阈值监听器
   */
  removeThresholdListener(listener: ThresholdListener): void {
    this.listeners.delete(listener);
  }
  
  /**
   * 通知监听器
   */
  private notifyListeners(event: ThresholdEvent, stats: UsageStats): void {
    for (const listener of this.listeners) {
      try {
        listener(event, stats);
      } catch (error) {
        console.error('Threshold listener error:', error);
      }
    }
  }
  
  /**
   * 记录输出 token
   */
  recordOutput(tokens: number): void {
    this.outputTokens += tokens;
  }
  
  /**
   * 获取所有上下文项
   */
  getItems(): ContextItem[] {
    return Array.from(this.items.values());
  }
  
  /**
   * 获取指定类型的上下文项
   */
  getItemsByType(type: ContextItem['type']): ContextItem[] {
    return Array.from(this.items.values()).filter(item => item.type === type);
  }
  
  /**
   * 构建上下文字符串
   */
  buildContext(): string {
    const items = Array.from(this.items.values())
      .sort((a, b) => a.priority - b.priority);
    
    return items.map(item => item.content).join('\n\n');
  }
  
  /**
   * 切换模型
   */
  setModel(modelName: string): void {
    const config = MODEL_CONFIGS[modelName];
    if (config) {
      this.modelConfig = config;
      this.checkThreshold();
    }
  }
  
  /**
   * 获取当前模型配置
   */
  getModelConfig(): ModelConfig {
    return { ...this.modelConfig };
  }
  
  /**
   * 设置阈值配置
   */
  setThresholdConfig(config: Partial<ThresholdConfig>): void {
    this.thresholdConfig = { ...this.thresholdConfig, ...config };
    this.checkThreshold();
  }
  
  /**
   * 获取阈值配置
   */
  getThresholdConfig(): ThresholdConfig {
    return { ...this.thresholdConfig };
  }
  
  /**
   * 清除所有上下文
   */
  clear(): void {
    this.items.clear();
    this.contentHashes.clear();
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.lastThresholdEvent = 'normal';
  }
  
  /**
   * 重置统计（保留上下文）
   */
  resetStats(): void {
    this.inputTokens = this.getCurrentTokens();
    this.outputTokens = 0;
  }
}

export default SmartContextManager;

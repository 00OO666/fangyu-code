/**
 * 增强型Hooks自动化系统 TypeScript类型定义
 * 与Rust后端的结构体保持同步
 */

/**
 * 扩展的Hook事件类型
 * 注意：重命名为 EnhancedHookEvent 以避免与 @/types/hooks 中的 HookEvent 冲突
 */
export type EnhancedHookEvent =
  // 现有事件
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop'
  // 新增事件
  | 'OnContextCompact'     // 上下文压缩时触发
  | 'OnAgentSwitch'        // 切换子代理时触发
  | 'OnFileChange'         // 文件修改时触发
  | 'OnSessionStart'       // 会话开始时触发
  | 'OnSessionEnd'         // 会话结束时触发
  | 'OnTabSwitch';         // 切换标签页时触发

/**
 * Hook执行上下文
 */
export interface HookContext {
  event: string;
  session_id: string;
  project_path: string;
  data: any; // 事件特定数据
}

/**
 * Hook执行结果
 */
export interface HookExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  execution_time_ms: number;
  hook_command: string;
}

/**
 * Hook链执行结果
 */
export interface HookChainResult {
  event: string;
  total_hooks: number;
  successful: number;
  failed: number;
  results: HookExecutionResult[];
  should_continue: boolean; // 是否应该继续后续操作
}

/**
 * 条件触发配置
 */
export interface ConditionalTrigger {
  condition: string;      // 条件表达式
  enabled: boolean;
  priority?: number;      // 执行优先级
}

/**
 * 增强型Hook定义
 */
export interface EnhancedHook {
  command: string;
  timeout?: number;
  retry?: number;
  condition?: ConditionalTrigger;
  on_success?: string[];    // 成功后执行的命令
  on_failure?: string[];    // 失败后执行的命令
}

/**
 * 增强型Hooks配置
 */
export interface EnhancedHooksConfiguration {
  // 现有事件
  PreToolUse?: EnhancedHook[];
  PostToolUse?: EnhancedHook[];
  Notification?: EnhancedHook[];
  Stop?: EnhancedHook[];
  SubagentStop?: EnhancedHook[];

  // 新增事件
  OnContextCompact?: EnhancedHook[];
  OnAgentSwitch?: EnhancedHook[];
  OnFileChange?: EnhancedHook[];
  OnSessionStart?: EnhancedHook[];
  OnSessionEnd?: EnhancedHook[];
  OnTabSwitch?: EnhancedHook[];
}

/**
 * 增强型Hooks API接口
 */
export interface EnhancedHooksAPI {
  /**
   * 触发Hook事件
   */
  triggerHookEvent(event: string, context: HookContext): Promise<HookChainResult>;

  /**
   * 测试Hook条件
   */
  testHookCondition(condition: string, context: HookContext): Promise<boolean>;
}

/**
 * Hook事件描述
 */
export const HOOK_EVENT_DESCRIPTIONS: Record<EnhancedHookEvent, string> = {
  // 现有事件
  'PreToolUse': '在工具使用前触发',
  'PostToolUse': '在工具使用后触发',
  'Notification': '通知事件触发',
  'Stop': '停止事件触发',
  'SubagentStop': '子代理停止时触发',

  // 新增事件
  'OnContextCompact': '上下文压缩时触发，可用于备份或通知',
  'OnAgentSwitch': '切换子代理时触发，可用于状态传递',
  'OnFileChange': '文件修改时触发，可用于自动保存或验证',
  'OnSessionStart': '会话开始时触发，可用于环境初始化',
  'OnSessionEnd': '会话结束时触发，可用于清理和总结',
  'OnTabSwitch': '切换标签页时触发，可用于状态同步',
};

/**
 * Hook事件分类
 */
export const HOOK_EVENT_CATEGORIES = {
  'Session Lifecycle': ['OnSessionStart', 'OnSessionEnd'],
  'Context Management': ['OnContextCompact'],
  'Agent Management': ['OnAgentSwitch', 'SubagentStop'],
  'User Interface': ['OnTabSwitch'],
  'File System': ['OnFileChange'],
  'Tool Usage': ['PreToolUse', 'PostToolUse'],
  'System Events': ['Notification', 'Stop'],
} as const;

/**
 * 常用Hook模板
 */
export interface HookTemplate {
  name: string;
  description: string;
  events: EnhancedHookEvent[];
  hooks: EnhancedHook[];
}

export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    name: '自动备份',
    description: '在上下文压缩时自动备份',
    events: ['OnContextCompact'],
    hooks: [
      {
        command: 'git add . && git commit -m "Auto backup: $(date)"',
        timeout: 30,
        retry: 1,
      }
    ]
  },
  {
    name: '会话日志',
    description: '记录会话开始和结束时间',
    events: ['OnSessionStart', 'OnSessionEnd'],
    hooks: [
      {
        command: 'echo "$(date): Session $HOOK_EVENT" >> session.log',
        timeout: 5,
      }
    ]
  },
  {
    name: '性能监控',
    description: '在工具使用前后监控性能',
    events: ['PreToolUse', 'PostToolUse'],
    hooks: [
      {
        command: 'echo "$(date): $HOOK_EVENT - Memory: $(free -h | grep Mem)" >> perf.log',
        timeout: 10,
      }
    ]
  },
  {
    name: '文件变更通知',
    description: '文件修改时发送通知',
    events: ['OnFileChange'],
    hooks: [
      {
        command: 'notify-send "文件已修改" "项目: $PROJECT_PATH"',
        timeout: 5,
        condition: {
          condition: 'event == "OnFileChange"',
          enabled: true,
        }
      }
    ]
  },
];

/**
 * Hook条件表达式示例
 */
export const CONDITION_EXAMPLES = [
  'event == "OnContextCompact"',
  'session_id == "specific-session"',
  'data.tokens > 100000',
  'data.file_count > 50',
  'data.agent_type == "code-reviewer"',
] as const;

// ============ 智能化自动化场景类型定义 ============

/**
 * 提交前代码审查Hook配置
 */
export interface PreCommitCodeReviewConfig {
  enabled: boolean;
  quality_threshold: number;        // 最低质量分数阈值 (0.0-10.0)
  block_critical_issues: boolean;   // 是否阻止严重问题
  block_major_issues: boolean;      // 是否阻止重要问题
  review_scope: string;             // "security", "performance", "all"
  exclude_patterns: string[];       // 排除的文件模式
  max_files_to_review: number;      // 最大审查文件数量
  show_suggestions: boolean;        // 是否显示改进建议
}

/**
 * 提交决策结果
 */
export type CommitDecision =
  | {
      type: 'Allow';
      message: string;
      suggestions: string[];
    }
  | {
      type: 'Block';
      reason: string;
      details: string;
      suggestions: string[];
    };

/**
 * 智能Hook模板配置
 */
export interface IntelligentHookTemplate {
  id: string;
  name: string;
  description: string;
  category: 'quality' | 'security' | 'performance' | 'automation';
  config: PreCommitCodeReviewConfig;
  icon: string;
  enabled_by_default: boolean;
}

/**
 * 预定义的智能化Hook模板
 */
export const INTELLIGENT_HOOK_TEMPLATES: IntelligentHookTemplate[] = [
  {
    id: 'strict-quality-gate',
    name: '严格质量门禁',
    description: '阻止所有严重和重要问题，确保代码质量',
    category: 'quality',
    config: {
      enabled: true,
      quality_threshold: 7.0,
      block_critical_issues: true,
      block_major_issues: true,
      review_scope: 'all',
      exclude_patterns: ['node_modules/**', 'dist/**', 'build/**', 'target/**'],
      max_files_to_review: 20,
      show_suggestions: true,
    },
    icon: 'shield-check',
    enabled_by_default: false,
  },
  {
    id: 'security-focused',
    name: '安全优先',
    description: '专注于安全问题检测，阻止所有安全威胁',
    category: 'security',
    config: {
      enabled: true,
      quality_threshold: 5.0,
      block_critical_issues: true,
      block_major_issues: false,
      review_scope: 'security',
      exclude_patterns: ['node_modules/**', 'dist/**', 'test/**', '*.test.*'],
      max_files_to_review: 30,
      show_suggestions: true,
    },
    icon: 'shield-alert',
    enabled_by_default: true,
  },
  {
    id: 'performance-monitor',
    name: '性能监控',
    description: '专注于性能问题检测和优化建议',
    category: 'performance',
    config: {
      enabled: true,
      quality_threshold: 6.0,
      block_critical_issues: false,
      block_major_issues: false,
      review_scope: 'performance',
      exclude_patterns: ['node_modules/**', 'dist/**', '*.min.*'],
      max_files_to_review: 15,
      show_suggestions: true,
    },
    icon: 'gauge',
    enabled_by_default: false,
  },
  {
    id: 'balanced-review',
    name: '平衡审查',
    description: '平衡的代码审查，适合日常开发使用',
    category: 'quality',
    config: {
      enabled: true,
      quality_threshold: 6.0,
      block_critical_issues: true,
      block_major_issues: false,
      review_scope: 'all',
      exclude_patterns: ['node_modules/**', 'dist/**', 'build/**', 'target/**', '.git/**'],
      max_files_to_review: 25,
      show_suggestions: true,
    },
    icon: 'bot',
    enabled_by_default: true,
  },
];

/**
 * Hook配置验证规则
 */
export interface HookConfigValidation {
  quality_threshold: { min: number; max: number };
  max_files_to_review: { min: number; max: number };
  review_scopes: string[];
}

export const HOOK_CONFIG_VALIDATION: HookConfigValidation = {
  quality_threshold: { min: 0.0, max: 10.0 },
  max_files_to_review: { min: 1, max: 100 },
  review_scopes: ['security', 'performance', 'maintainability', 'style', 'all'],
};
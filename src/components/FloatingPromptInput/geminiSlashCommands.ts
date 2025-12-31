/**
 * Gemini CLI 斜杠命令定义
 *
 * Gemini CLI 内置斜杠命令列表和自定义命令支持
 * 来源: https://geminicli.com/docs/cli/custom-commands/
 *
 * Gemini CLI 从 v0.1.59 (PR #8305) 开始支持非交互式模式下的斜杠命令
 */

import type { SlashCommand } from './slashCommands';

/**
 * Gemini CLI 内置斜杠命令
 *
 * supportsNonInteractive: 标记命令是否支持非交互式模式
 * - true: 支持 -p 模式，会返回输出
 * - false: 仅交互式模式，非交互式下会报错或无响应
 *
 * 注意: Gemini CLI 的自定义命令 (从 .gemini/commands/*.toml 加载) 在非交互模式下完全支持
 */
export const GEMINI_BUILT_IN_SLASH_COMMANDS: SlashCommand[] = [
  // ============================================================================
  // 会话管理 - Session Management
  // ============================================================================
  {
    name: 'clear',
    description: '清除当前会话历史',
    source: 'built-in',
    category: 'session',
    supportsNonInteractive: false,
  },
  {
    name: 'compact',
    description: '压缩会话上下文以释放 token',
    source: 'built-in',
    category: 'session',
    supportsNonInteractive: true,
  },
  {
    name: 'save',
    description: '保存当前会话到文件',
    source: 'built-in',
    category: 'session',
    supportsNonInteractive: false,
    argHint: '[filename]',
  },
  {
    name: 'load',
    description: '加载已保存的会话',
    source: 'built-in',
    category: 'session',
    supportsNonInteractive: false,
    argHint: '<filename>',
  },

  // ============================================================================
  // 统计和信息 - Stats & Info (支持非交互式)
  // ============================================================================
  {
    name: 'stats',
    description: '显示 Token 使用统计和配额信息',
    source: 'built-in',
    category: 'context',
    supportsNonInteractive: true,
  },
  {
    name: 'context',
    description: '查看当前上下文使用情况',
    source: 'built-in',
    category: 'context',
    supportsNonInteractive: true,
  },

  // ============================================================================
  // 配置和设置 - Configuration
  // ============================================================================
  {
    name: 'help',
    description: '显示帮助信息',
    source: 'built-in',
    category: 'system',
    supportsNonInteractive: false,
  },
  {
    name: 'settings',
    description: '打开设置界面',
    source: 'built-in',
    category: 'config',
    supportsNonInteractive: false,
  },
  {
    name: 'model',
    description: '选择或更换 AI 模型',
    source: 'built-in',
    category: 'config',
    supportsNonInteractive: false,
  },
  {
    name: 'tools',
    description: '管理可用工具列表',
    source: 'built-in',
    category: 'config',
    supportsNonInteractive: false,
  },

  // ============================================================================
  // 扩展管理 - Extensions
  // ============================================================================
  {
    name: 'extensions',
    description: '管理 Gemini CLI 扩展',
    source: 'built-in',
    category: 'system',
    supportsNonInteractive: false,
  },
  {
    name: 'mcp',
    description: '管理 MCP 服务器连接',
    source: 'built-in',
    category: 'system',
    supportsNonInteractive: false,
  },

  // ============================================================================
  // 项目和代码 - Project & Code
  // ============================================================================
  {
    name: 'init',
    description: '初始化项目 GEMINI.md 配置',
    source: 'built-in',
    category: 'system',
    supportsNonInteractive: true,
  },
  {
    name: 'memory',
    description: '编辑 GEMINI.md 记忆文件',
    source: 'built-in',
    category: 'system',
    supportsNonInteractive: false,
  },

  // ============================================================================
  // 其他 - Misc
  // ============================================================================
  {
    name: 'quit',
    description: '退出 Gemini CLI',
    source: 'built-in',
    category: 'session',
    supportsNonInteractive: false,
  },
  {
    name: 'version',
    description: '显示版本信息',
    source: 'built-in',
    category: 'system',
    supportsNonInteractive: true,
  },
];

/**
 * 获取支持非交互式模式的 Gemini 命令
 */
export function getGeminiNonInteractiveCommands(): SlashCommand[] {
  return GEMINI_BUILT_IN_SLASH_COMMANDS.filter(cmd => cmd.supportsNonInteractive);
}

/**
 * Gemini 自定义命令文件格式 (TOML)
 *
 * 示例 (~/.gemini/commands/pr-review.toml):
 * ```toml
 * description = "Review PR changes for issues"
 * prompt = """
 * Review these code changes for:
 * - Security issues
 * - Performance problems
 * """
 * ```
 *
 * 命令位置:
 * - 用户级: ~/.gemini/commands/*.toml
 * - 项目级: <project>/.gemini/commands/*.toml
 *
 * 参数处理:
 * - {{args}}: 替换为用户输入的参数
 * - !{command}: 执行 shell 命令并注入输出
 */

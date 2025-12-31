/**
 * 斜杠命令定义
 *
 * Claude Code 内置斜杠命令列表和自定义命令支持
 */

export interface SlashCommand {
  /** 命令名称 (不含 /) */
  name: string;
  /** 命令描述 */
  description: string;
  /** 命令来源: built-in, project, user */
  source: 'built-in' | 'project' | 'user';
  /** 命令分类 */
  category: 'session' | 'context' | 'system' | 'git' | 'config' | 'custom';
  /** 是否支持非交互式模式 (-p 模式) */
  supportsNonInteractive: boolean;
  /** 参数提示 */
  argHint?: string;
}

/**
 * Claude Code 内置斜杠命令
 * 来源: https://code.claude.com/docs/en/slash-commands
 *
 * supportsNonInteractive: 标记命令是否支持非交互式模式
 * - true: 支持 -p 模式，会返回输出
 * - false: 仅交互式模式，非交互式下会报错或无响应
 */
export const BUILT_IN_SLASH_COMMANDS: SlashCommand[] = [
  // Session 管理 - 大多不支持非交互式
  { name: 'clear', description: '清除会话历史', source: 'built-in', category: 'session', supportsNonInteractive: false },
  { name: 'compact', description: '压缩会话上下文', source: 'built-in', category: 'session', supportsNonInteractive: true, argHint: '[instructions]' },
  { name: 'exit', description: '退出会话', source: 'built-in', category: 'session', supportsNonInteractive: false },
  { name: 'resume', description: '恢复之前的会话', source: 'built-in', category: 'session', supportsNonInteractive: false, argHint: '[session]' },
  { name: 'rename', description: '重命名当前会话', source: 'built-in', category: 'session', supportsNonInteractive: false, argHint: '<name>' },
  { name: 'export', description: '导出会话到文件', source: 'built-in', category: 'session', supportsNonInteractive: false, argHint: '[filename]' },

  // 上下文和成本 - 支持非交互式，返回统计信息
  { name: 'context', description: '查看上下文使用情况', source: 'built-in', category: 'context', supportsNonInteractive: true },
  { name: 'cost', description: '查看 Token 使用统计', source: 'built-in', category: 'context', supportsNonInteractive: true },
  { name: 'usage', description: '查看订阅计划用量限制', source: 'built-in', category: 'context', supportsNonInteractive: true },
  { name: 'stats', description: '查看使用统计和历史', source: 'built-in', category: 'context', supportsNonInteractive: true },

  // 系统和配置 - 大多不支持非交互式
  { name: 'help', description: '显示帮助信息', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'config', description: '打开设置界面', source: 'built-in', category: 'config', supportsNonInteractive: false },
  { name: 'status', description: '显示版本和连接状态', source: 'built-in', category: 'system', supportsNonInteractive: true },
  { name: 'doctor', description: '检查安装健康状态', source: 'built-in', category: 'system', supportsNonInteractive: true },
  { name: 'model', description: '选择或更换 AI 模型', source: 'built-in', category: 'config', supportsNonInteractive: false },
  { name: 'permissions', description: '查看或更新权限', source: 'built-in', category: 'config', supportsNonInteractive: false },
  { name: 'privacy-settings', description: '查看和更新隐私设置', source: 'built-in', category: 'config', supportsNonInteractive: false },
  { name: 'output-style', description: '设置输出样式', source: 'built-in', category: 'config', supportsNonInteractive: false, argHint: '[style]' },

  // 项目和代码
  { name: 'init', description: '初始化项目 CLAUDE.md', source: 'built-in', category: 'system', supportsNonInteractive: true },
  { name: 'add-dir', description: '添加额外工作目录', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'memory', description: '编辑 CLAUDE.md 记忆文件', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'review', description: '请求代码审查', source: 'built-in', category: 'git', supportsNonInteractive: true },
  { name: 'security-review', description: '执行安全审查', source: 'built-in', category: 'git', supportsNonInteractive: true },
  { name: 'pr-comments', description: '查看 PR 评论', source: 'built-in', category: 'git', supportsNonInteractive: true },
  { name: 'rewind', description: '回退会话或代码', source: 'built-in', category: 'git', supportsNonInteractive: false },
  { name: 'todos', description: '列出当前 TODO 项', source: 'built-in', category: 'system', supportsNonInteractive: true },

  // 工具和集成 - 大多不支持非交互式
  { name: 'mcp', description: '管理 MCP 服务器连接', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'ide', description: '管理 IDE 集成', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'hooks', description: '管理 Hook 配置', source: 'built-in', category: 'config', supportsNonInteractive: false },
  { name: 'plugin', description: '管理 Claude Code 插件', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'agents', description: '管理自定义 AI 子代理', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'bashes', description: '列出后台任务', source: 'built-in', category: 'system', supportsNonInteractive: true },
  { name: 'sandbox', description: '启用沙箱模式', source: 'built-in', category: 'system', supportsNonInteractive: false },

  // 账户和其他 - 不支持非交互式
  { name: 'login', description: '切换 Anthropic 账户', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'logout', description: '登出账户', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'bug', description: '报告 Bug', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'release-notes', description: '查看发布说明', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'vim', description: '进入 Vim 模式', source: 'built-in', category: 'system', supportsNonInteractive: false },
  { name: 'statusline', description: '设置状态栏 UI', source: 'built-in', category: 'config', supportsNonInteractive: false },
  { name: 'terminal-setup', description: '安装 Shift+Enter 快捷键', source: 'built-in', category: 'config', supportsNonInteractive: false },
  { name: 'install-github-app', description: '安装 GitHub Actions', source: 'built-in', category: 'system', supportsNonInteractive: false },
];

/**
 * 命令分类显示名称
 */
export const CATEGORY_LABELS: Record<string, string> = {
  'session': '会话',
  'context': '上下文',
  'system': '系统',
  'git': 'Git/代码',
  'config': '配置',
  'custom': '自定义',
};

/**
 * 命令来源显示名称
 */
export const SOURCE_LABELS: Record<string, string> = {
  'built-in': '内置',
  'project': '项目',
  'user': '用户',
};

/**
 * 获取支持非交互式模式的命令
 */
export function getNonInteractiveCommands(): SlashCommand[] {
  return BUILT_IN_SLASH_COMMANDS.filter(cmd => cmd.supportsNonInteractive);
}

/**
 * 过滤斜杠命令
 * @param commands 命令列表
 * @param query 搜索查询 (不含 /)
 * @param nonInteractiveOnly 是否只显示支持非交互式的命令
 */
export function filterSlashCommands(
  commands: SlashCommand[],
  query: string,
  nonInteractiveOnly: boolean = false
): SlashCommand[] {
  let filtered = commands;

  // 过滤非交互式支持
  if (nonInteractiveOnly) {
    filtered = filtered.filter(cmd => cmd.supportsNonInteractive);
  }

  // 按查询过滤
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    );
  }

  return filtered;
}

/**
 * 按分类分组命令
 */
export function groupCommandsByCategory(
  commands: SlashCommand[]
): Map<string, SlashCommand[]> {
  const groups = new Map<string, SlashCommand[]>();

  for (const cmd of commands) {
    const existing = groups.get(cmd.category) || [];
    existing.push(cmd);
    groups.set(cmd.category, existing);
  }

  return groups;
}

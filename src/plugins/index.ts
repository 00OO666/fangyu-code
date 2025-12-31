/**
 * Plugin System - 插件系统统一导出入口
 *
 * 提供完整的插件系统功能：
 * - 插件类型定义
 * - 插件加载和生命周期管理
 * - 插件市场和安装
 * - 插件管理UI组件
 */

// ============================================================
// 类型定义导出
// ============================================================

export type {
  // 插件元数据
  PluginManifest,
  PluginCategory,
  ActivationEvent,
  PluginPermission,

  // 插件贡献点
  PluginContributions,
  CommandContribution,
  MenuContribution,
  ConfigurationContribution,
  LanguageContribution,
  ThemeContribution,
  SnippetContribution,
  PromptContribution,
  ToolContribution,

  // 插件状态
  PluginState,

  // 插件API
  Plugin,
  PluginContext,
  PluginAPI,
  Disposable,
  StateStorage,
  Logger,

  // 具体API接口
  CommandsAPI,
  EditorAPI,
  WorkspaceAPI,
  AIAPI,
  WindowAPI,
  FileSystemAPI,
  GitAPI,

  // 编辑器类型
  EditorInstance,
  TextDocument,
  Position,
  Range,
  Selection,

  // 工作区类型
  WorkspaceFolder,
  WorkspaceConfiguration,

  // AI类型
  AIPromptOptions,
  AIResponse,
  AITool,
  AIToolCall,

  // 插件安装和市场
  PluginInstallOptions,
  PluginMarketplaceInfo,
  PluginSearchOptions,
  PluginSearchResult,
} from '@/types/plugins';

// ============================================================
// Hook 导出
// ============================================================

export {
  usePluginLoader,
  type PluginLoaderConfig,
  type PluginLoadResult,
  type PluginActivationResult,
} from '@/hooks/usePluginLoader';

export {
  usePluginMarketplace,
  type MarketplaceConfig,
  type InstallProgress,
  type UpdateInfo,
} from '@/hooks/usePluginMarketplace';

// Import for default export
import { usePluginLoader } from '@/hooks/usePluginLoader';
import { usePluginMarketplace } from '@/hooks/usePluginMarketplace';
import { PluginManager } from '@/components/PluginManager';

// ============================================================
// 组件导出
// ============================================================

export { PluginManager } from '@/components/PluginManager';

// ============================================================
// 常量导出
// ============================================================

/**
 * 插件分类信息
 */
export const PLUGIN_CATEGORIES = {
  ai: { label: 'AI 增强', icon: '🤖', description: 'AI 辅助编程和智能补全' },
  editor: { label: '编辑器', icon: '✏️', description: '编辑器功能增强' },
  language: { label: '语言支持', icon: '🌐', description: '编程语言支持' },
  theme: { label: '主题', icon: '🎨', description: '编辑器主题和配色' },
  snippet: { label: '代码片段', icon: '📝', description: '代码片段和模板' },
  debugger: { label: '调试器', icon: '🐛', description: '调试工具' },
  formatter: { label: '格式化', icon: '📐', description: '代码格式化工具' },
  linter: { label: '代码检查', icon: '🔍', description: '代码质量检查' },
  testing: { label: '测试', icon: '🧪', description: '测试框架和工具' },
  productivity: { label: '效率工具', icon: '⚡', description: '提升开发效率' },
  git: { label: 'Git 工具', icon: '📦', description: 'Git 版本控制工具' },
  other: { label: '其他', icon: '📁', description: '其他类型插件' },
} as const;

/**
 * 默认插件权限描述
 */
export const PLUGIN_PERMISSIONS = {
  'filesystem.read': '读取文件系统',
  'filesystem.write': '写入文件系统',
  'network.fetch': '发起网络请求',
  'shell.execute': '执行 Shell 命令',
  'clipboard.read': '读取剪贴板',
  'clipboard.write': '写入剪贴板',
  'ai.prompt': '使用 AI 提示',
  'ai.tools': '使用 AI 工具',
  'config.read': '读取配置',
  'config.write': '写入配置',
} as const;

/**
 * 激活事件说明
 */
export const ACTIVATION_EVENTS = {
  '*': '总是激活（启动时自动加载）',
  'onStartupFinished': '启动完成后激活',
  'onUri': '处理 URI 时激活',
  'onLanguage:*': '打开特定语言文件时激活',
  'onCommand:*': '执行特定命令时激活',
  'onView:*': '打开特定视图时激活',
  'onFileSystem:*': '访问特定文件系统时激活',
} as const;

// ============================================================
// 工具函数导出
// ============================================================

/**
 * 验证插件清单
 */
export function validatePluginManifest(manifest: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!manifest.id) errors.push('缺少插件 ID');
  if (!manifest.name) errors.push('缺少插件名称');
  if (!manifest.version) errors.push('缺少插件版本');
  if (!manifest.activationEvents || manifest.activationEvents.length === 0) {
    errors.push('缺少激活事件');
  }

  // 验证版本格式
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push(`无效的版本格式: ${manifest.version}`);
  }

  // 验证 ID 格式
  if (manifest.id && !/^[\w-]+\.[\w-]+$/.test(manifest.id)) {
    errors.push(`无效的插件 ID 格式: ${manifest.id}（应为 publisher.name）`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 解析插件 ID
 */
export function parsePluginId(pluginId: string): {
  publisher: string;
  name: string;
} | null {
  const match = pluginId.match(/^([\w-]+)\.([\w-]+)$/);
  if (!match) return null;

  return {
    publisher: match[1],
    name: match[2],
  };
}

/**
 * 格式化插件版本
 */
export function formatPluginVersion(version: string): string {
  // 确保版本号符合语义化版本规范
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return version;

  return `v${match[1]}.${match[2]}.${match[3]}`;
}

/**
 * 比较插件版本
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * 检查是否需要更新
 */
export function needsUpdate(currentVersion: string, latestVersion: string): boolean {
  return compareVersions(currentVersion, latestVersion) < 0;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 格式化下载次数
 */
export function formatDownloads(downloads: number): string {
  if (downloads >= 1000000) {
    return `${(downloads / 1000000).toFixed(1)}M`;
  }
  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}K`;
  }
  return downloads.toString();
}

/**
 * 获取插件分类标签颜色
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    ai: 'blue',
    editor: 'green',
    language: 'purple',
    theme: 'pink',
    snippet: 'yellow',
    debugger: 'red',
    formatter: 'cyan',
    linter: 'orange',
    testing: 'teal',
    productivity: 'indigo',
    git: 'violet',
    other: 'gray',
  };

  return colors[category] || 'gray';
}

// ============================================================
// 默认导出（方便整体导入）
// ============================================================

export default {
  // Hooks
  usePluginLoader,
  usePluginMarketplace,

  // Components
  PluginManager,

  // Constants
  PLUGIN_CATEGORIES,
  PLUGIN_PERMISSIONS,
  ACTIVATION_EVENTS,

  // Utils
  validatePluginManifest,
  parsePluginId,
  formatPluginVersion,
  compareVersions,
  needsUpdate,
  formatFileSize,
  formatDownloads,
  getCategoryColor,
};

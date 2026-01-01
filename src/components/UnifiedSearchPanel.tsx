/**
 * UnifiedSearchPanel - 统一搜索面板（下拉式）
 *
 * 功能:
 * - 下拉伸展式面板（非全屏）
 * - 搜索 MCP、SKILL、插件、Hooks
 * - 每个项目带启用/禁用开关（与配置文件同步）
 * - 打开本体文件按钮
 * - 支持模糊搜索和过滤
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Zap,
  Network,
  Puzzle,
  Webhook,
  X,
  Filter,
  ExternalLink,
  FileCode,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { notify } from '@/components/notifications';
import { useToolUsageStats } from '@/hooks/useToolUsageStats';

// ============================================================================
// 类型定义
// ============================================================================

type SearchItemType = 'mcp' | 'skill' | 'plugin' | 'hook';

interface SearchItem {
  id: string;
  type: SearchItemType;
  name: string;
  description?: string;
  category?: string;
  path?: string;
  filePath?: string; // 本体文件路径
  triggers?: string[];
  enabled?: boolean;
  scope?: 'user' | 'project';
  engine?: 'claude' | 'codex' | 'gemini';
  originalName?: string; // 原始文件名（可能包含 _disabled_ 前缀）
  eventType?: string; // Hook 事件类型
  serverSpec?: any; // MCP Server 配置（用于切换状态时传递）
}

interface UnifiedSearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 项目路径 */
  projectPath?: string;
  /** 触发器元素的引用，用于定位面板 */
  triggerRef?: React.RefObject<HTMLElement>;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 清理显示名称 - 移除 _disabled_ 前缀
 */
function cleanDisplayName(name: string): string {
  return name.replace(/^_disabled_/, '');
}

/**
 * 生成清晰的配置描述
 * 优先使用配置自带的 description，其次使用智能生成的描述
 */
function generateDescription(config: {
  type: SearchItemType;
  name: string;
  description?: string;
  eventType?: string;
  scope?: 'user' | 'project';
}): string {
  // 如果配置自带有效描述，直接使用
  if (config.description && config.description.trim() && !config.description.includes('·')) {
    return config.description.trim();
  }

  // 根据类型生成清晰的描述（不包含类型前缀，因为已有标签）
  switch (config.type) {
    case 'skill':
      return `自动化工作流，可通过特定触发词或命令调用`;

    case 'mcp': {
      const name = config.name;
      // 常见 MCP 工具的描述（不带"MCP"前缀）
      const mcpDescriptions: Record<string, string> = {
        'github': '搜索仓库、读取文件、创建 PR/Issue、Fork 等',
        'filesystem': '读写文件、创建目录、搜索文件等',
        'fetch': '发送 GET/POST 请求，访问 API',
        'puppeteer': '浏览器自动化 - 截图、爬虫、表单填充、页面交互',
        'memory': '持久化记忆 - 跨会话存储和检索项目知识',
        'sequential-thinking': '复杂逻辑推理 - 分步骤思考和解决复杂问题',
        'context7': '技术文档查询 - 获取最新的 React/Vue/Node.js 等官方文档',
      };

      const lowerName = name.toLowerCase();
      for (const [key, desc] of Object.entries(mcpDescriptions)) {
        if (lowerName.includes(key)) {
          return desc;
        }
      }

      return `扩展 Claude Code 的能力`;
    }

    case 'hook': {
      const eventType = config.eventType || '';
      const eventDescriptions: Record<string, string> = {
        'PreToolUse': '在调用任何工具前执行自定义脚本',
        'PostToolUse': '在调用工具后执行自定义脚本',
        'SessionStart': '在会话开始时执行初始化脚本',
        'Stop': '在会话停止时执行清理脚本',
        'user-prompt-submit': '在用户提交消息前处理',
      };

      for (const [key, desc] of Object.entries(eventDescriptions)) {
        if (eventType.includes(key)) {
          return desc;
        }
      }

      return `在特定事件发生时自动执行脚本`;
    }

    case 'plugin':
      return `扩展 Claude Code 的功能`;

    default:
      return '无描述';
  }
}

// ============================================================================
// 图标映射
// ============================================================================

const TYPE_ICONS: Record<SearchItemType, React.ElementType> = {
  mcp: Network,
  skill: Zap,
  plugin: Puzzle,
  hook: Webhook,
};

const TYPE_COLORS: Record<SearchItemType, string> = {
  mcp: 'text-blue-500',
  skill: 'text-yellow-500',
  plugin: 'text-purple-500',
  hook: 'text-green-500',
};

const TYPE_BG: Record<SearchItemType, string> = {
  mcp: 'bg-blue-50 dark:bg-blue-950/30',
  skill: 'bg-yellow-50 dark:bg-yellow-950/30',
  plugin: 'bg-purple-50 dark:bg-purple-950/30',
  hook: 'bg-green-50 dark:bg-green-950/30',
};

// ============================================================================
// 主组件
// ============================================================================

export function UnifiedSearchPanel({
  open,
  onOpenChange,
  projectPath,
  triggerRef,
}: UnifiedSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<SearchItemType | 'all'>('all');
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 🆕 使用统计 Hook
  const { recordUsage, sortByUsage } = useToolUsageStats();

  // 🆕 响应式定位状态
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxWidth: number;
    maxHeight: number;
    alignRight: boolean;
  }>({
    top: 0,
    left: 0,
    width: 420,
    maxWidth: 420,
    maxHeight: 280,
    alignRight: true,
  });

  // 项目路径变化时重置状态
  useEffect(() => {
    setItems([]);
    setSearchQuery('');
    setFilterType('all');
  }, [projectPath]);

  // 加载所有资源
  useEffect(() => {
    if (open) {
      loadAllItems();
      setSearchQuery('');
      // 聚焦搜索框
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open, projectPath]); // 添加 projectPath 依赖，项目切换时重新加载

  // 🆕 计算响应式定位
  const calculatePosition = useCallback(() => {
    if (!triggerRef?.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16; // 视口边距

    // 计算可用空间
    const spaceBelow = viewportHeight - triggerRect.bottom - padding;

    // 基础尺寸
    const baseWidth = 420;
    const minWidth = 280;
    const baseHeight = 280;
    const minHeight = 200;

    // 计算实际宽度（不超过视口宽度减去两边边距）
    const maxAvailableWidth = viewportWidth - padding * 2;
    const width = Math.min(baseWidth, Math.max(minWidth, maxAvailableWidth));

    // 计算最大高度（响应式）
    const maxHeight = Math.min(baseHeight, Math.max(minHeight, spaceBelow - 8));

    // 计算位置 - 优先右对齐到触发按钮
    const top = triggerRect.bottom + 8; // 按钮下方 8px

    // 计算 left 位置：尝试右对齐到按钮，但确保不超出视口
    let left = triggerRect.right - width; // 右对齐

    // 确保不超出左边界
    if (left < padding) {
      left = padding;
    }

    // 确保不超出右边界
    if (left + width > viewportWidth - padding) {
      left = viewportWidth - padding - width;
    }

    // 最终边界检查
    left = Math.max(padding, Math.min(left, viewportWidth - width - padding));

    setPanelPosition({
      top,
      left,
      width,
      maxWidth: width,
      maxHeight,
      alignRight: true,
    });
  }, [triggerRef]);

  // 监听窗口缩放和面板打开
  useEffect(() => {
    if (!open) return;

    calculatePosition();

    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [open, calculatePosition]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onOpenChange]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const allItems: SearchItem[] = [];

      // 加载 Skills
      try {
        const skills = await api.listAgentSkills(projectPath);
        const skillItems: SearchItem[] = skills.map((s: any) => {
          // 检查是否被禁用（文件名以 _disabled_ 开头）
          const isDisabled = s.name.startsWith('_disabled_');
          const cleanName = cleanDisplayName(s.name);

          // 使用智能描述生成器
          const description = generateDescription({
            type: 'skill',
            name: cleanName,
            description: s.description,
            scope: s.scope,
          });

          return {
            id: `skill:${s.name}`,
            type: 'skill' as const,
            name: cleanName, // 使用清理后的名称
            originalName: s.name, // 保存原始名称（可能带 _disabled_ 前缀）
            description,
            path: s.path,
            filePath: s.path,
            triggers: s.triggers || [],
            scope: s.scope || 'user',
            enabled: !isDisabled, // 如果没有 _disabled_ 前缀，则为启用状态
          };
        });
        allItems.push(...skillItems);
      } catch (err) {
        console.warn('[UnifiedSearchPanel] Failed to load skills:', err);
      }

      // 加载 MCP Servers
      try {
        // 🔧 修复：去重并合并多引擎的 MCP 服务器
        // 使用 Map 来去重，key 为 server name，value 为 server 信息
        const mcpMap = new Map<string, {
          name: string;
          description?: string;
          enabled: boolean;
          engines: Array<'claude' | 'codex' | 'gemini'>;
          serverId: string;
          serverSpec?: any; // MCP Server 配置
        }>();

        const engines: Array<'claude' | 'codex' | 'gemini'> = ['claude', 'codex', 'gemini'];
        for (const engine of engines) {
          try {
            const servers = await api.mcpGetEngineServersWithStatus(engine);
            for (const server of servers) {
              const serverName = server.name || server.id;
              const serverId = server.id || server.name;

              // 如果已存在，只更新状态和添加引擎
              if (mcpMap.has(serverName)) {
                const existing = mcpMap.get(serverName)!;
                existing.engines.push(engine);
                // 如果任何一个引擎中启用了，就认为是启用状态
                existing.enabled = existing.enabled || (server.enabled ?? false);
              } else {
                // 新增
                mcpMap.set(serverName, {
                  name: serverName,
                  description: server.description,
                  enabled: server.enabled ?? false,
                  engines: [engine],
                  serverId,
                  serverSpec: server.spec, // 🔧 保存 serverSpec 用于切换状态
                });
              }
            }
          } catch (err) {
            console.warn(`[UnifiedSearchPanel] Failed to load ${engine} MCP servers:`, err);
          }
        }

        // 转换为 SearchItem 数组
        const mcpItems: SearchItem[] = Array.from(mcpMap.values()).map((mcpInfo) => {
          // 使用智能描述生成器
          const description = generateDescription({
            type: 'mcp',
            name: mcpInfo.name,
            description: mcpInfo.description,
          });

          // 使用主引擎（第一个）作为 ID
          const primaryEngine = mcpInfo.engines[0];

          return {
            id: `mcp:${primaryEngine}:${mcpInfo.serverId}`,
            type: 'mcp' as const,
            name: mcpInfo.name,
            description,
            enabled: mcpInfo.enabled,
            engine: primaryEngine, // 使用主引擎
            filePath: '~/.claude/settings.json',
            serverSpec: mcpInfo.serverSpec, // 🔧 保存 serverSpec
          };
        });
        allItems.push(...mcpItems);
      } catch (err) {
        console.warn('[UnifiedSearchPanel] Failed to load MCP servers:', err);
      }

      // 加载 Hooks
      try {
        const hookFiles = await api.listHookFiles();
        const hookItems: SearchItem[] = hookFiles.map((hook: any) => {
          // 检查是否被禁用（文件名以 _disabled_ 开头）
          const isDisabled = hook.name.startsWith('_disabled_');
          const cleanName = cleanDisplayName(hook.name);

          // 使用智能描述生成器
          const description = generateDescription({
            type: 'hook',
            name: cleanName,
            description: hook.description,
            eventType: hook.eventType,
          });

          return {
            id: `hook:${hook.name}`,
            type: 'hook' as const,
            name: cleanName, // 使用清理后的名称
            originalName: hook.name, // 保存原始名称（可能带 _disabled_ 前缀）
            description,
            // 优先使用 API 返回的 isEnabled 状态，否则根据文件名判断
            enabled: hook.isEnabled ?? !isDisabled,
            filePath: hook.path,
            scope: 'user', // Hooks 目前都是用户级别
            eventType: hook.eventType, // 保存事件类型
          };
        });
        allItems.push(...hookItems);
      } catch (err) {
        console.warn('[UnifiedSearchPanel] Failed to load hooks:', err);
      }

      // 加载 Plugins (待实现)
      // TODO: 从配置文件读取插件列表

      setItems(allItems);
    } catch (error) {
      console.error('[UnifiedSearchPanel] Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  // 过滤和搜索
  const filteredItems = useMemo(() => {
    let result = items;

    // 类型过滤
    if (filterType !== 'all') {
      result = result.filter(item => item.type === filterType);
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        const triggerMatch = item.triggers?.some(t => t.toLowerCase().includes(query));
        return nameMatch || descMatch || triggerMatch;
      });
    }

    // 🆕 排序优先级：已启用 > 使用频率 > 时间
    // 分成两组：已启用的和未启用的
    const enabled = result.filter(item => item.enabled);
    const disabled = result.filter(item => !item.enabled);

    // 每组内部按使用频率和时间排序
    const sortedEnabled = sortByUsage(enabled);
    const sortedDisabled = sortByUsage(disabled);

    // 合并：已启用的在前
    return [...sortedEnabled, ...sortedDisabled];
  }, [items, searchQuery, filterType, sortByUsage]);

  // 切换启用/禁用
  const handleToggle = async (item: SearchItem, enabled: boolean) => {
    // 防止重复点击
    if (toggling.has(item.id)) return;

    setToggling(prev => new Set(prev).add(item.id));

    try {
      switch (item.type) {
        case 'mcp': {
          // 解析 ID: mcp:engine:serverId
          const parts = item.id.split(':');
          const engine = parts[1] as 'claude' | 'codex' | 'gemini';
          const serverId = parts.slice(2).join(':');

          // 🔧 修复：必须传递 serverSpec 参数
          if (!item.serverSpec) {
            console.warn('[UnifiedSearchPanel] MCP missing serverSpec:', item);
            notify.global.error(`无法切换 MCP 工具：缺少配置信息`);
            break;
          }

          await api.mcpToggleEngineServer(engine, serverId, item.serverSpec, enabled);
          // 🔧 修复：不需要调用 syncSettingsToClaudeJson()，因为 mcpToggleEngineServer 已经直接更新了 ~/.claude.json
          // 避免从 settings.json 读取旧配置覆盖刚才的更改

          // 全局通知
          notify.global.success(
            enabled ? `已启用 MCP 工具：${item.name}` : `已禁用 MCP 工具：${item.name}`,
            { duration: 2000 }
          );
          break;
        }
        case 'hook': {
          if (!item.filePath) {
            console.warn('[UnifiedSearchPanel] Hook missing filePath:', item);
            break;
          }
          // 使用保存的 eventType，如果没有则使用文件名推断
          const eventType = item.eventType || item.name;
          await api.toggleHookFile(item.filePath, enabled, eventType);

          // 全局通知
          notify.global.success(
            enabled ? `已启用 Hook：${item.name}` : `已禁用 Hook：${item.name}`,
            { duration: 2000 }
          );
          break;
        }
        case 'skill': {
          if (!item.originalName || !item.scope) {
            console.warn('[UnifiedSearchPanel] Skill missing originalName or scope:', item);
            break;
          }
          await api.toggleSkill(item.originalName, item.scope, enabled, projectPath);

          // 全局通知
          notify.global.success(
            enabled ? `已启用 Skill：${item.name}` : `已禁用 Skill：${item.name}`,
            { duration: 2000 }
          );
          break;
        }
        case 'plugin': {
          // TODO: 实现 Plugin 的启用/禁用
          console.warn('[UnifiedSearchPanel] Plugin toggle not implemented yet');
          break;
        }
      }

      // 🆕 记录使用统计（仅在启用时记录）
      if (enabled) {
        recordUsage(item.id);
      }

      // 更新本地状态
      setItems(prev => prev.map(i => {
        if (i.id !== item.id) return i;

        // 更新 skill 和 hook 的 originalName（因为文件名会改变）
        let newOriginalName = i.originalName;
        if ((i.type === 'skill' || i.type === 'hook') && i.originalName) {
          const cleanName = cleanDisplayName(i.originalName);
          newOriginalName = enabled ? cleanName : `_disabled_${cleanName}`;
        }

        return {
          ...i,
          enabled,
          originalName: newOriginalName,
        };
      }));
    } catch (error) {
      console.error('[UnifiedSearchPanel] Failed to toggle item:', error);
      // 恢复状态
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, enabled: !enabled } : i));

      // 错误通知
      notify.global.error(
        `${enabled ? '启用' : '禁用'}失败`,
        {
          description: error instanceof Error ? error.message : '未知错误',
          duration: 4000,
        }
      );
    } finally {
      setToggling(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // 打开本体文件
  const handleOpenFile = async (item: SearchItem) => {
    if (!item.filePath) {
      console.warn('[UnifiedSearchPanel] Item missing filePath:', item);
      return;
    }

    try {
      // 展开波浪号路径
      const expandedPath = item.filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '');
      await api.openFileWithDefaultApp(expandedPath);
    } catch (error) {
      console.error('[UnifiedSearchPanel] Failed to open file:', error);
    }
  };

  if (!open) return null;

  // 使用 Portal 渲染到 body，避免影响父容器布局
  const panelContent = (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={cn(
          "fixed rounded-xl z-[9999] overflow-hidden",
          "bg-background/95 backdrop-blur-xl backdrop-saturate-150",
          "border border-white/20 dark:border-white/10",
          "shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        )}
        style={{
          top: `${panelPosition.top}px`,
          left: `${panelPosition.left}px`,
          width: `${panelPosition.width}px`,
          maxWidth: `${panelPosition.maxWidth}px`,
        }}
      >
        {/* 搜索框 */}
        <div className="flex items-center gap-2 p-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="搜索 MCP、SKILL、插件、Hooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* 过滤器 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="flex gap-1 flex-shrink-0">
            {(['all', 'mcp', 'skill', 'hook'] as const).map((type) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterType(type)}
                className="h-6 px-2 text-xs whitespace-nowrap"
              >
                {type === 'all' ? '全部' : type.toUpperCase()}
              </Button>
            ))}
          </div>
          <div className="flex-1 min-w-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
            共 {filteredItems.length} 项
          </span>
        </div>

        {/* 结果列表 */}
        <ScrollArea style={{ height: `${panelPosition.maxHeight}px` }}>
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">加载中...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {searchQuery ? '未找到匹配项' : '暂无数据'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredItems.map((item) => {
                  const Icon = TYPE_ICONS[item.type];
                  const isToggling = toggling.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      {/* 图标 */}
                      <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0",
                        TYPE_BG[item.type]
                      )}>
                        <Icon className={cn("h-4 w-4", TYPE_COLORS[item.type])} />
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {item.type.toUpperCase()}
                          </Badge>
                          {item.scope && (
                            <Badge
                              variant={item.scope === 'user' ? 'default' : 'secondary'}
                              className={cn(
                                "text-[10px] h-4 px-1.5",
                                item.scope === 'user'
                                  ? "bg-orange-500/90 text-white border-orange-600 dark:bg-orange-600/90 dark:border-orange-700"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {item.scope === 'user' ? '全局' : '当前会话'}
                            </Badge>
                          )}
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground truncate cursor-help">
                              {item.description || '无描述'}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            align="start"
                            className="max-w-[300px] text-xs whitespace-normal"
                          >
                            {item.description || '无描述'}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* 打开文件按钮 */}
                        {item.filePath && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenFile(item)}
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="打开本体文件"
                          >
                            <FileCode className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* 启用/禁用开关 */}
                        <div className="flex items-center gap-2">
                          {isToggling ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={item.enabled ?? false}
                              onCheckedChange={(checked) => handleToggle(item, checked)}
                              className="scale-75"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="whitespace-nowrap">⌘/Ctrl+Shift+P 打开</span>
            <span className="whitespace-nowrap">ESC 关闭</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-6 text-xs flex-shrink-0"
          >
            关闭
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // 使用 Portal 渲染到 document.body，完全脱离父容器布局
  return createPortal(panelContent, document.body);
}

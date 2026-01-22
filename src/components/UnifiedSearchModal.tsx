/**
 * UnifiedSearchModal - 统一搜索框
 *
 * 功能:
 * - Ctrl+Shift+P 快捷键触发
 * - 搜索 MCP、SKILL、插件、Hooks
 * - 快速跳转到对应设置页
 * - 支持模糊搜索和过滤
 *
 * 参考: VSCode Command Palette
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Search from 'lucide-react/dist/esm/icons/search'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Network from 'lucide-react/dist/esm/icons/network'
import Puzzle from 'lucide-react/dist/esm/icons/puzzle'
import Webhook from 'lucide-react/dist/esm/icons/webhook'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Play from 'lucide-react/dist/esm/icons/play'
import X from 'lucide-react/dist/esm/icons/x'
import Filter from 'lucide-react/dist/esm/icons/filter';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

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
  triggers?: string[];
  enabled?: boolean;
  scope?: 'user' | 'project';
  engine?: 'claude' | 'codex' | 'gemini';
}

interface UnifiedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 执行操作回调（如启动 Skill、配置 MCP） */
  onExecuteAction?: (item: SearchItem, action: 'run' | 'configure') => void;
  /** 项目路径 */
  projectPath?: string;
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

export function UnifiedSearchModal({
  open,
  onOpenChange,
  onExecuteAction,
  projectPath,
}: UnifiedSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterType, setFilterType] = useState<SearchItemType | 'all'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 加载所有资源
  useEffect(() => {
    if (open) {
      loadAllItems();
      setSearchQuery('');
      setSelectedIndex(0);
      // 聚焦搜索框
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const allItems: SearchItem[] = [];

      // 加载 Skills
      try {
        const skills = await api.listAgentSkills(projectPath);
        const skillItems: SearchItem[] = skills.map((s: any) => ({
          id: `skill:${s.name}`,
          type: 'skill' as const,
          name: s.name,
          description: s.description || '无描述',
          path: s.path,
          triggers: s.triggers || [],
          scope: s.scope || 'user',
          enabled: true,
        }));
        allItems.push(...skillItems);
      } catch (err) {
        logger.warn('UnifiedSearchModal', '[UnifiedSearch] Failed to load skills:', err);
      }

      // 加载 MCP Servers (模拟数据，实际应从配置文件读取)
      try {
        // TODO: 从 ~/.claude/settings.json 读取 MCP 配置
        const mcpServers: SearchItem[] = [
          {
            id: 'mcp:filesystem',
            type: 'mcp',
            name: 'filesystem',
            description: '文件系统操作工具',
            engine: 'claude',
            enabled: true,
          },
          {
            id: 'mcp:github',
            type: 'mcp',
            name: 'github',
            description: 'GitHub 仓库操作',
            engine: 'claude',
            enabled: true,
          },
          {
            id: 'mcp:puppeteer',
            type: 'mcp',
            name: 'puppeteer',
            description: '浏览器自动化',
            engine: 'claude',
            enabled: false,
          },
        ];
        allItems.push(...mcpServers);
      } catch (err) {
        logger.warn('UnifiedSearchModal', '[UnifiedSearch] Failed to load MCP servers:', err);
      }

      // 加载 Hooks (模拟数据)
      try {
        const hooks: SearchItem[] = [
          {
            id: 'hook:pre-commit',
            type: 'hook',
            name: 'pre-commit',
            description: 'Git pre-commit 钩子',
            enabled: true,
          },
          {
            id: 'hook:user-prompt-submit',
            type: 'hook',
            name: 'user-prompt-submit',
            description: '用户提交提示词时触发',
            enabled: true,
          },
        ];
        allItems.push(...hooks);
      } catch (err) {
        logger.warn('UnifiedSearchModal', '[UnifiedSearch] Failed to load hooks:', err);
      }

      // 加载 Plugins (模拟数据)
      try {
        const plugins: SearchItem[] = [
          {
            id: 'plugin:prettier',
            type: 'plugin',
            name: 'prettier',
            description: '代码格式化插件',
            enabled: true,
          },
          {
            id: 'plugin:eslint',
            type: 'plugin',
            name: 'eslint',
            description: '代码检查插件',
            enabled: true,
          },
        ];
        allItems.push(...plugins);
      } catch (err) {
        logger.warn('UnifiedSearchModal', '[UnifiedSearch] Failed to load plugins:', err);
      }

      setItems(allItems);
    } catch (error) {
      logger.error('UnifiedSearchModal', '[UnifiedSearch] Failed to load items:', error);
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

    return result;
  }, [items, searchQuery, filterType]);

  // 键盘导航
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleItemClick(filteredItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }, [filteredItems, selectedIndex]);

  const handleItemClick = (item: SearchItem) => {
    onExecuteAction?.(item, 'configure');
    onOpenChange(false);
  };

  const handleRunAction = (item: SearchItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onExecuteAction?.(item, 'run');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* 搜索框 */}
        <div className="flex items-center gap-2 p-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="搜索 MCP、SKILL、插件、Hooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 过滤器 */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {(['all', 'mcp', 'skill', 'plugin', 'hook'] as const).map((type) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterType(type)}
                className="h-7 px-2 text-xs"
              >
                {type === 'all' ? '全部' : type.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* 结果列表 */}
        <ScrollArea className="h-[400px]" ref={scrollAreaRef}>
          <div className="p-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                加载中...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? '未找到匹配项' : '暂无数据'}
              </div>
            ) : (
              <AnimatePresence>
                {filteredItems.map((item, index) => {
                  const Icon = TYPE_ICONS[item.type];
                  const isSelected = index === selectedIndex;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                        "hover:bg-accent/50",
                        isSelected && "bg-accent ring-1 ring-primary/20"
                      )}
                    >
                      {/* 图标 */}
                      <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0",
                        TYPE_BG[item.type]
                      )}>
                        <Icon className={cn("h-5 w-5", TYPE_COLORS[item.type])} />
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.type.toUpperCase()}
                          </Badge>
                          {item.scope && (
                            <Badge variant="secondary" className="text-xs">
                              {item.scope === 'user' ? '全局' : '项目'}
                            </Badge>
                          )}
                          {item.engine && (
                            <Badge variant="secondary" className="text-xs">
                              {item.engine}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.description || '无描述'}
                        </p>
                        {item.triggers && item.triggers.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {item.triggers.slice(0, 3).map((trigger, i) => (
                              <code key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted">
                                {trigger}
                              </code>
                            ))}
                            {item.triggers.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{item.triggers.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.type === 'skill' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleRunAction(item, e)}
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>Enter 选择</span>
            <span>Esc 关闭</span>
          </div>
          <div>
            共 {filteredItems.length} 项
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

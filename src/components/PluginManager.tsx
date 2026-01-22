/**
 * PluginManager - 插件管理器UI组件
 *
 * 功能:
 * - 显示已安装插件列表
 * - 启用/禁用插件
 * - 插件详情和配置
 * - 插件安装/卸载
 * - 插件更新检查
 *
 * 来源: VSCode Extensions Panel + Cursor Extensions
 */

import { logger } from '@/lib/logger';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Package from 'lucide-react/dist/esm/icons/package'
import Search from 'lucide-react/dist/esm/icons/search'
import Power from 'lucide-react/dist/esm/icons/power'
import PowerOff from 'lucide-react/dist/esm/icons/power-off'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Download from 'lucide-react/dist/esm/icons/download'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePluginLoader } from '@/hooks/usePluginLoader';
import { PluginState, PluginCategory } from '@/types/plugins';

// ============================================================
// 类型定义
// ============================================================

interface PluginManagerProps {
  /** 工作区路径 */
  workspacePath?: string;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 类名 */
  className?: string;
  /** 插件安装回调 */
  onInstall?: (pluginId: string) => void;
  /** 插件卸载回调 */
  onUninstall?: (pluginId: string) => void;
}

type ViewMode = 'installed' | 'marketplace' | 'recommended';
type SortBy = 'name' | 'status' | 'date' | 'category';

// ============================================================
// 分类信息
// ============================================================

const CATEGORY_INFO: Record<PluginCategory, { label: string; icon: string }> = {
  ai: { label: 'AI 增强', icon: '🤖' },
  editor: { label: '编辑器', icon: '✏️' },
  language: { label: '语言支持', icon: '🌐' },
  theme: { label: '主题', icon: '🎨' },
  snippet: { label: '代码片段', icon: '📝' },
  debugger: { label: '调试器', icon: '🐛' },
  formatter: { label: '格式化', icon: '📐' },
  linter: { label: '代码检查', icon: '🔍' },
  testing: { label: '测试', icon: '🧪' },
  productivity: { label: '效率工具', icon: '⚡' },
  git: { label: 'Git 工具', icon: '📦' },
  other: { label: '其他', icon: '📁' },
};

// ============================================================
// 示例插件数据
// ============================================================

// 注意：插件系统尚未实现，这里不再显示演示数据
// 当插件系统完善后，会从 .fangyu/plugins 目录自动发现插件
const SAMPLE_PLUGINS: PluginState[] = [];

// ============================================================
// 组件
// ============================================================

export function PluginManager({
  workspacePath,
  compact: _compact = false,
  className,
  onInstall: _onInstall,
  onUninstall,
}: PluginManagerProps) {
  // 使用插件加载器 Hook
  const pluginLoader = usePluginLoader({
    workspacePath,
    onPluginActivated: (plugin) => {
      logger.debug('PluginManager', '[PluginManager] Plugin activated:', plugin.id);
    },
    onPluginError: (plugin, error) => {
      logger.error('PluginManager', '[PluginManager] Plugin error:', plugin.id, error);
    },
  });

  // UI 状态
  const [viewMode, setViewMode] = useState<ViewMode>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | 'all'>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginState | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());

  // 本地管理的示例数据状态（当没有真实插件时使用）
  const [localPlugins, setLocalPlugins] = useState<PluginState[]>(SAMPLE_PLUGINS);

  // 使用 pluginLoader 的插件数据，如果为空则显示本地示例数据
  const plugins = pluginLoader.plugins.length > 0 ? pluginLoader.plugins : localPlugins;

  // 过滤和排序插件
  const filteredPlugins = useMemo(() => {
    let result = [...plugins];

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.manifest.name.toLowerCase().includes(query) ||
          p.manifest.description.toLowerCase().includes(query) ||
          p.manifest.id.toLowerCase().includes(query)
      );
    }

    // 分类过滤
    if (selectedCategory !== 'all') {
      result = result.filter((p) =>
        p.manifest.categories.includes(selectedCategory)
      );
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.manifest.name.localeCompare(b.manifest.name);
        case 'status':
          if (a.activated !== b.activated) return a.activated ? -1 : 1;
          if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
          return 0;
        case 'category':
          return a.manifest.categories[0]?.localeCompare(b.manifest.categories[0] || '') || 0;
        case 'date':
          return (b.loadTime || 0) - (a.loadTime || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [plugins, searchQuery, selectedCategory, sortBy]);

  // 统计信息
  const stats = useMemo(() => {
    const enabled = plugins.filter((p) => p.enabled).length;
    const activated = plugins.filter((p) => p.activated).length;
    const errors = plugins.filter((p) => p.error).length;
    return { total: plugins.length, enabled, activated, errors };
  }, [plugins]);

  // 切换插件展开状态
  const toggleExpanded = (pluginId: string) => {
    setExpandedPlugins((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  };

  // 启用/禁用插件
  const handleToggleEnabled = async (plugin: PluginState) => {
    const newEnabled = !plugin.enabled;

    // 如果是真实插件，使用 pluginLoader
    if (pluginLoader.plugins.length > 0) {
      if (newEnabled) {
        pluginLoader.enablePlugin(plugin.id);
      } else {
        await pluginLoader.disablePlugin(plugin.id);
      }
    } else {
      // 本地示例数据模式，直接更新本地状态
      setLocalPlugins(prev => prev.map(p =>
        p.id === plugin.id
          ? { ...p, enabled: newEnabled, activated: newEnabled ? p.activated : false }
          : p
      ));
    }
  };

  // 激活/停用插件
  const handleToggleActivation = async (plugin: PluginState) => {
    const newActivated = !plugin.activated;

    // 如果是真实插件，使用 pluginLoader
    if (pluginLoader.plugins.length > 0) {
      if (newActivated) {
        await pluginLoader.activatePlugin(plugin.id);
      } else {
        await pluginLoader.deactivatePlugin(plugin.id);
      }
    } else {
      // 本地示例数据模式，直接更新本地状态
      setLocalPlugins(prev => prev.map(p =>
        p.id === plugin.id
          ? { ...p, activated: newActivated }
          : p
      ));
    }
  };

  // 卸载插件
  const handleUninstall = async (plugin: PluginState) => {
    await pluginLoader.unloadPlugin(plugin.id);
    setShowUninstallConfirm(false);
    setSelectedPlugin(null);
    onUninstall?.(plugin.id);
  };

  // 重新加载插件
  const handleReload = async (plugin: PluginState) => {
    await pluginLoader.reloadPlugin(plugin.id);
  };

  // 渲染插件状态徽章
  const renderStatusBadge = (plugin: PluginState) => {
    if (plugin.error) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          错误
        </Badge>
      );
    }
    if (plugin.activated) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          已激活
        </Badge>
      );
    }
    if (plugin.enabled) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Power className="h-3 w-3" />
          已启用
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <PowerOff className="h-3 w-3" />
        已禁用
      </Badge>
    );
  };

  // 渲染插件卡片
  const renderPluginCard = (plugin: PluginState) => {
    const isExpanded = expandedPlugins.has(plugin.id);

    return (
      <Card key={plugin.id} className="overflow-hidden">
        <div
          className="flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleExpanded(plugin.id)}
        >
          {/* 展开图标 */}
          <button className="mt-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* 插件图标 */}
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>

          {/* 插件信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{plugin.manifest.name}</h4>
              <span className="text-xs text-muted-foreground">
                v{plugin.manifest.version}
              </span>
              {renderStatusBadge(plugin)}
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {plugin.manifest.description}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {plugin.manifest.publisher}
              </span>
              {plugin.manifest.categories.map((cat) => (
                <Badge key={cat} variant="outline" className="text-xs h-5">
                  {CATEGORY_INFO[cat]?.icon} {CATEGORY_INFO[cat]?.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* 快捷操作 */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={(checked) => {
                        logger.debug('PluginManager', '[PluginManager] Toggle plugin:', plugin.id, 'to', checked);
                        handleToggleEnabled(plugin);
                      }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {plugin.enabled ? '禁用插件' : '启用插件'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* 展开内容 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t"
            >
              <div className="p-3 space-y-3 bg-muted/30">
                {/* 详细描述 */}
                <p className="text-sm text-muted-foreground">
                  {plugin.manifest.description}
                </p>

                {/* 错误信息 */}
                {plugin.error && (
                  <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {plugin.error}
                  </div>
                )}

                {/* 统计信息 */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {plugin.loadTime !== undefined && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      加载: {plugin.loadTime}ms
                    </div>
                  )}
                  {plugin.activationTime !== undefined && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      激活: {plugin.activationTime}ms
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActivation(plugin)}
                    disabled={!plugin.enabled}
                  >
                    {plugin.activated ? (
                      <>
                        <PowerOff className="h-4 w-4 mr-1" />
                        停用
                      </>
                    ) : (
                      <>
                        <Power className="h-4 w-4 mr-1" />
                        激活
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReload(plugin)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    重新加载
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPlugin(plugin);
                      setShowDetails(true);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    设置
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedPlugin(plugin);
                      setShowUninstallConfirm(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    卸载
                  </Button>
                </div>

                {/* 贡献点 */}
                {plugin.manifest.contributes && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium">贡献点</h5>
                    <div className="flex flex-wrap gap-2">
                      {plugin.manifest.contributes.commands && (
                        <Badge variant="secondary">
                          {plugin.manifest.contributes.commands.length} 命令
                        </Badge>
                      )}
                      {plugin.manifest.contributes.languages && (
                        <Badge variant="secondary">
                          {plugin.manifest.contributes.languages.length} 语言
                        </Badge>
                      )}
                      {plugin.manifest.contributes.themes && (
                        <Badge variant="secondary">
                          {plugin.manifest.contributes.themes.length} 主题
                        </Badge>
                      )}
                      {plugin.manifest.contributes.snippets && (
                        <Badge variant="secondary">
                          {plugin.manifest.contributes.snippets.length} 代码片段
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">插件管理</h3>
          <p className="text-sm text-muted-foreground">
            已安装 {stats.total} 个插件，{stats.activated} 个已激活
            {stats.errors > 0 && (
              <span className="text-destructive ml-2">
                {stats.errors} 个错误
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pluginLoader.discoverPlugins()}
            disabled={pluginLoader.isLoading}
          >
            {pluginLoader.isLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            刷新
          </Button>
          <Button variant="outline" size="sm">
            <FolderOpen className="h-4 w-4 mr-1" />
            打开插件目录
          </Button>
          <Button variant="default" size="sm" onClick={() => setViewMode('marketplace')}>
            <Download className="h-4 w-4 mr-1" />
            安装插件
          </Button>
        </div>
      </div>

      {/* 视图切换 */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="installed">已安装</TabsTrigger>
            <TabsTrigger value="marketplace">插件市场</TabsTrigger>
            <TabsTrigger value="recommended">推荐</TabsTrigger>
          </TabsList>

          {/* 搜索和过滤 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索插件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>

            <Select
              value={selectedCategory}
              onValueChange={(v) => setSelectedCategory(v as PluginCategory | 'all')}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.icon} {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">按名称</SelectItem>
                <SelectItem value="status">按状态</SelectItem>
                <SelectItem value="category">按分类</SelectItem>
                <SelectItem value="date">按时间</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 已安装插件列表 */}
        <TabsContent value="installed" className="mt-4">
          {filteredPlugins.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? '未找到匹配的插件' : '暂无已安装的插件'}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setViewMode('marketplace')}
              >
                浏览插件市场
              </Button>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {filteredPlugins.map(renderPluginCard)}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* 插件市场 */}
        <TabsContent value="marketplace" className="mt-4">
          <Card className="p-8 text-center">
            <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              插件市场正在建设中...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              您可以通过文件方式安装本地插件
            </p>
            <Button variant="outline" className="mt-4">
              <FolderOpen className="h-4 w-4 mr-1" />
              从文件安装
            </Button>
          </Card>
        </TabsContent>

        {/* 推荐插件 */}
        <TabsContent value="recommended" className="mt-4">
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              推荐插件功能即将上线...
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 加载进度 */}
      {pluginLoader.isLoading && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-3 shadow-lg flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">正在加载插件...</p>
            <div className="w-32 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pluginLoader.loadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 插件详情对话框 */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedPlugin?.manifest.name}
            </DialogTitle>
            <DialogDescription>
              v{selectedPlugin?.manifest.version} · {selectedPlugin?.manifest.publisher}
            </DialogDescription>
          </DialogHeader>

          {selectedPlugin && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">描述</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedPlugin.manifest.description}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">激活事件</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPlugin.manifest.activationEvents.map((event, i) => (
                    <Badge key={i} variant="outline">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedPlugin.manifest.permissions && (
                <div>
                  <h4 className="font-medium mb-2">权限要求</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlugin.manifest.permissions.map((perm, i) => (
                      <Badge key={i} variant="secondary">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedPlugin.manifest.repository && (
                <div>
                  <h4 className="font-medium mb-2">仓库</h4>
                  <a
                    href={selectedPlugin.manifest.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {selectedPlugin.manifest.repository}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 卸载确认对话框 */}
      <Dialog open={showUninstallConfirm} onOpenChange={setShowUninstallConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认卸载</DialogTitle>
            <DialogDescription>
              您确定要卸载插件 "{selectedPlugin?.manifest.name}" 吗？
              此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUninstallConfirm(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedPlugin && handleUninstall(selectedPlugin)}
            >
              确认卸载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PluginManager;

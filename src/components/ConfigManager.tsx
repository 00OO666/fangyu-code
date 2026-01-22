/**
 * ConfigManager - 配置管理中心
 *
 * 功能:
 * - 配置健康度诊断
 * - 项目缓存管理（查看、清理）
 * - Skills/Hooks 开关管理
 * - 配置备份
 *
 * 解决问题：C盘 Token 消耗 5 倍于 F 盘
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import Activity from 'lucide-react/dist/esm/icons/activity'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import HardDrive from 'lucide-react/dist/esm/icons/hard-drive'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Shield from 'lucide-react/dist/esm/icons/shield'
import Zap from 'lucide-react/dist/esm/icons/zap'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Download from 'lucide-react/dist/esm/icons/download'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Cpu from 'lucide-react/dist/esm/icons/cpu'
import Database from 'lucide-react/dist/esm/icons/database';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// ============================================================
// 类型定义
// ============================================================

interface ConfigHealthReport {
  score: number;
  claude_md_size: number;
  claude_md_tokens: number;
  projects_cache_size: number;
  projects_cache_size_formatted: string;
  session_files_count: number;
  large_session_files: number;
  active_skills: number;
  disabled_skills: number;
  active_mcps: number;
  issues: ConfigIssue[];
  suggestions: string[];
}

interface ConfigIssue {
  level: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  fix_action?: string;
}

interface ProjectCacheInfo {
  path: string;
  name: string;
  size: number;
  size_formatted: string;
  session_count: number;
  last_modified: number;
}

interface ConfigItem {
  id: string;
  name: string;
  category: 'mcp' | 'skill' | 'hook' | 'setting';
  enabled: boolean;
  description: string;
  config_path: string;
  size?: number;
}

interface CleanupResult {
  files_deleted: number;
  bytes_freed: number;
  bytes_freed_formatted: string;
}

interface ConfigManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConfigManagerEmbeddedProps {
  className?: string;
}

// ============================================================
// 主组件
// ============================================================

export function ConfigManager({ open, onOpenChange }: ConfigManagerProps) {
  useTranslation(); // 保留 hook 调用以支持未来国际化
  const [activeTab, setActiveTab] = useState('health');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 健康度数据
  const [healthReport, setHealthReport] = useState<ConfigHealthReport | null>(null);

  // 缓存数据
  const [projectCaches, setProjectCaches] = useState<ProjectCacheInfo[]>([]);

  // 配置项数据
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', description: '', action: async () => { } });

  // 加载健康度报告
  const loadHealthReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const report = await invoke<ConfigHealthReport>('get_config_health');
      setHealthReport(report);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载项目缓存
  const loadProjectCaches = useCallback(async () => {
    setIsLoading(true);
    try {
      const caches = await invoke<ProjectCacheInfo[]>('get_projects_cache');
      setProjectCaches(caches);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载配置项
  const loadConfigItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await invoke<ConfigItem[]>('get_config_items');
      setConfigItems(items);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 清理单个项目缓存
  const cleanProjectCache = async (projectName: string) => {
    try {
      await invoke<number>('clean_project_cache', { projectName });
      await loadProjectCaches();
      await loadHealthReport();
    } catch (err) {
      setError(String(err));
    }
  };

  // 清理旧缓存
  const cleanOldCache = async (days: number) => {
    try {
      const result = await invoke<CleanupResult>('clean_old_cache', { days });
      await loadProjectCaches();
      await loadHealthReport();
      alert(`清理完成！删除 ${result.files_deleted} 个文件，释放 ${result.bytes_freed_formatted}`);
    } catch (err) {
      setError(String(err));
    }
  };

  // 切换配置项
  const toggleConfigItem = async (item: ConfigItem) => {
    try {
      await invoke('toggle_config_item', {
        id: item.id,
        category: item.category,
        enabled: !item.enabled,
      });
      await loadConfigItems();
    } catch (err) {
      setError(String(err));
    }
  };

  // 备份配置
  const backupConfig = async () => {
    try {
      const backupPath = await invoke<string>('backup_config');
      alert(`配置已备份到: ${backupPath}`);
    } catch (err) {
      setError(String(err));
    }
  };

  // 初始加载
  useEffect(() => {
    if (open) {
      loadHealthReport();
    }
  }, [open, loadHealthReport]);

  // Tab 切换时加载数据
  useEffect(() => {
    if (!open) return;

    if (activeTab === 'cache') {
      loadProjectCaches();
    } else if (activeTab === 'items') {
      loadConfigItems();
    }
  }, [activeTab, open, loadProjectCaches, loadConfigItems]);

  // 获取健康度颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '健康';
    if (score >= 60) return '需优化';
    return '严重问题';
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${bytes}B`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              配置管理中心
            </DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>管理应用配置、缓存和健康诊断</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="health" className="gap-2">
                <Activity className="h-4 w-4" />
                健康诊断
              </TabsTrigger>
              <TabsTrigger value="cache" className="gap-2">
                <HardDrive className="h-4 w-4" />
                缓存管理
              </TabsTrigger>
              <TabsTrigger value="items" className="gap-2">
                <Zap className="h-4 w-4" />
                配置开关
              </TabsTrigger>
            </TabsList>

            {/* 健康诊断 Tab */}
            <TabsContent value="health" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[calc(85vh-200px)]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : healthReport ? (
                  <div className="space-y-6 p-4">
                    {/* 健康度评分 */}
                    <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                      <div className="text-center">
                        <div className={cn("text-5xl font-bold", getScoreColor(healthReport.score))}>
                          {healthReport.score}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {getScoreLabel(healthReport.score)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <Progress value={healthReport.score} className="h-3" />
                      </div>
                    </div>

                    {/* 统计概览 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard
                        icon={<Database className="h-5 w-5" />}
                        label="缓存大小"
                        value={healthReport.projects_cache_size_formatted}
                        status={healthReport.projects_cache_size > 100 * 1024 * 1024 ? 'critical' : 'ok'}
                      />
                      <StatCard
                        icon={<FolderOpen className="h-5 w-5" />}
                        label="会话文件"
                        value={`${healthReport.session_files_count} 个`}
                        status={healthReport.session_files_count > 500 ? 'warning' : 'ok'}
                      />
                      <StatCard
                        icon={<Zap className="h-5 w-5" />}
                        label="活跃 Skills"
                        value={`${healthReport.active_skills} / ${healthReport.active_skills + healthReport.disabled_skills}`}
                        status={healthReport.active_skills > 10 ? 'warning' : 'ok'}
                      />
                      <StatCard
                        icon={<Cpu className="h-5 w-5" />}
                        label="活跃 MCP"
                        value={`${healthReport.active_mcps} 个`}
                        status={healthReport.active_mcps > 5 ? 'warning' : 'ok'}
                      />
                    </div>

                    {/* CLAUDE.md 信息 */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">CLAUDE.md</span>
                        <div className="text-sm text-muted-foreground">
                          {formatSize(healthReport.claude_md_size)} (~{healthReport.claude_md_tokens} tokens)
                        </div>
                      </div>
                      <Progress
                        value={Math.min((healthReport.claude_md_size / 15360) * 100, 100)}
                        className="h-2 mt-2"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        建议保持在 5KB 以下（当前 {healthReport.claude_md_size > 5120 ? '偏大' : '正常'}）
                      </div>
                    </div>

                    {/* 发现的问题 */}
                    {healthReport.issues.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          发现的问题
                        </h3>
                        {healthReport.issues.map((issue, idx) => (
                          <IssueCard key={idx} issue={issue} onFix={() => {
                            if (issue.fix_action === 'clean_old_cache') {
                              setConfirmDialog({
                                open: true,
                                title: '清理旧缓存',
                                description: '将删除 30 天前的所有会话文件，此操作不可撤销。',
                                action: () => cleanOldCache(30),
                              });
                            } else if (issue.fix_action === 'clean_large_sessions') {
                              setActiveTab('cache');
                            }
                          }} />
                        ))}
                      </div>
                    )}

                    {/* 建议 */}
                    {healthReport.suggestions.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-medium flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          优化建议
                        </h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {healthReport.suggestions.map((suggestion, idx) => (
                            <li key={idx}>• {suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-40 text-red-500">
                    <XCircle className="h-8 w-8 mb-2" />
                    <div>{error}</div>
                  </div>
                ) : null}
              </ScrollArea>
            </TabsContent>

            {/* 缓存管理 Tab */}
            <TabsContent value="cache" className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="text-sm text-muted-foreground">
                  共 {projectCaches.length} 个项目缓存
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadProjectCaches()}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    刷新
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDialog({
                      open: true,
                      title: '清理 30 天前的缓存',
                      description: '将删除所有 30 天前的会话文件，此操作不可撤销。确定要继续吗？',
                      action: () => cleanOldCache(30),
                    })}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    清理旧缓存
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[calc(85vh-280px)]">
                <div className="p-4 space-y-2">
                  {projectCaches.map((cache) => (
                    <div
                      key={cache.path}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        cache.size > 20 * 1024 * 1024 && "border-red-500/50 bg-red-500/5",
                        cache.size > 5 * 1024 * 1024 && cache.size <= 20 * 1024 * 1024 && "border-yellow-500/50 bg-yellow-500/5"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm truncate" title={cache.name}>
                          {cache.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {cache.session_count} 个会话 • 最后修改 {new Date(cache.last_modified * 1000).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={cache.size > 20 * 1024 * 1024 ? "destructive" : cache.size > 5 * 1024 * 1024 ? "secondary" : "outline"}>
                          {cache.size_formatted}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDialog({
                            open: true,
                            title: `清理 ${cache.name}`,
                            description: `将删除该项目的所有会话文件（${cache.session_count} 个），释放 ${cache.size_formatted}。此操作不可撤销。`,
                            action: () => cleanProjectCache(cache.name),
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* 配置开关 Tab */}
            <TabsContent value="items" className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="text-sm text-muted-foreground">
                  管理 Skills 和 Hooks 的开关状态
                </div>
                <Button variant="outline" size="sm" onClick={() => loadConfigItems()}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
              </div>
              <ScrollArea className="h-[calc(85vh-280px)]">
                <div className="p-4 space-y-4">
                  {/* Skills 分组 */}
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Skills
                    </h3>
                    <div className="space-y-2">
                      {configItems.filter(item => item.category === 'skill').map((item) => (
                        <ConfigItemRow key={item.id} item={item} onToggle={toggleConfigItem} />
                      ))}
                    </div>
                  </div>

                  {/* Hooks 分组 */}
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Hooks
                    </h3>
                    <div className="space-y-2">
                      {configItems.filter(item => item.category === 'hook').map((item) => (
                        <ConfigItemRow key={item.id} item={item} onToggle={toggleConfigItem} />
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={backupConfig}>
              <Download className="h-4 w-4 mr-2" />
              备份配置
            </Button>
            <Button variant="outline" onClick={() => loadHealthReport()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新诊断
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await confirmDialog.action();
              setConfirmDialog({ ...confirmDialog, open: false });
            }}>
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================
// 子组件
// ============================================================

function StatCard({ icon, label, value, status }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'critical';
}) {
  return (
    <div className={cn(
      "p-3 rounded-lg border",
      status === 'critical' && "border-red-500/50 bg-red-500/5",
      status === 'warning' && "border-yellow-500/50 bg-yellow-500/5",
      status === 'ok' && "border-border"
    )}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function IssueCard({ issue, onFix }: { issue: ConfigIssue; onFix?: () => void }) {
  const iconMap = {
    critical: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    info: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
  };

  const bgMap = {
    critical: "bg-red-500/10 border-red-500/30",
    warning: "bg-yellow-500/10 border-yellow-500/30",
    info: "bg-blue-500/10 border-blue-500/30",
  };

  return (
    <div className={cn("p-3 rounded-lg border flex items-start gap-3", bgMap[issue.level])}>
      {iconMap[issue.level]}
      <div className="flex-1">
        <div className="font-medium">{issue.title}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{issue.description}</div>
      </div>
      {issue.fix_action && onFix && (
        <Button variant="outline" size="sm" onClick={onFix}>
          修复
        </Button>
      )}
    </div>
  );
}

function ConfigItemRow({ item, onToggle }: { item: ConfigItem; onToggle: (item: ConfigItem) => void }) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border",
      !item.enabled && "opacity-50"
    )}>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{item.name}</div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {item.description}
        </div>
        {item.size && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatSize(item.size)}
          </div>
        )}
      </div>
      <Switch
        checked={item.enabled}
        onCheckedChange={() => onToggle(item)}
      />
    </div>
  );
}

// 辅助函数
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

/**
 * 嵌入式配置管理组件（用于设置页面）
 */
export function ConfigManagerEmbedded({ className }: ConfigManagerEmbeddedProps) {
  const [activeTab, setActiveTab] = useState('health');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 健康度数据
  const [healthReport, setHealthReport] = useState<ConfigHealthReport | null>(null);

  // 缓存数据
  const [projectCaches, setProjectCaches] = useState<ProjectCacheInfo[]>([]);

  // 配置项数据
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', description: '', action: async () => { } });

  // 加载健康度报告
  const loadHealthReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const report = await invoke<ConfigHealthReport>('get_config_health');
      setHealthReport(report);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载项目缓存
  const loadProjectCaches = useCallback(async () => {
    setIsLoading(true);
    try {
      const caches = await invoke<ProjectCacheInfo[]>('get_projects_cache');
      setProjectCaches(caches);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载配置项
  const loadConfigItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await invoke<ConfigItem[]>('get_config_items');
      setConfigItems(items);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 清理单个项目缓存
  const cleanProjectCache = async (projectName: string) => {
    try {
      await invoke<number>('clean_project_cache', { projectName });
      await loadProjectCaches();
      await loadHealthReport();
    } catch (err) {
      setError(String(err));
    }
  };

  // 清理旧缓存
  const cleanOldCache = async (days: number) => {
    try {
      const result = await invoke<CleanupResult>('clean_old_cache', { days });
      await loadProjectCaches();
      await loadHealthReport();
      alert(`清理完成！删除 ${result.files_deleted} 个文件，释放 ${result.bytes_freed_formatted}`);
    } catch (err) {
      setError(String(err));
    }
  };

  // 切换配置项
  const toggleConfigItem = async (item: ConfigItem) => {
    try {
      await invoke('toggle_config_item', {
        id: item.id,
        category: item.category,
        enabled: !item.enabled,
      });
      await loadConfigItems();
    } catch (err) {
      setError(String(err));
    }
  };

  // 备份配置
  const backupConfig = async () => {
    try {
      const backupPath = await invoke<string>('backup_config');
      alert(`配置已备份到: ${backupPath}`);
    } catch (err) {
      setError(String(err));
    }
  };

  // 初始加载
  useEffect(() => {
    loadHealthReport();
  }, [loadHealthReport]);

  // Tab 切换时加载数据
  useEffect(() => {
    if (activeTab === 'cache') {
      loadProjectCaches();
    } else if (activeTab === 'items') {
      loadConfigItems();
    }
  }, [activeTab, loadProjectCaches, loadConfigItems]);

  // 获取健康度颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '健康';
    if (score >= 60) return '需优化';
    return '严重问题';
  };

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="health" className="gap-2">
                <Activity className="h-4 w-4" />
                健康诊断
              </TabsTrigger>
              <TabsTrigger value="cache" className="gap-2">
                <HardDrive className="h-4 w-4" />
                缓存管理
              </TabsTrigger>
              <TabsTrigger value="items" className="gap-2">
                <Zap className="h-4 w-4" />
                配置开关
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={backupConfig}>
                <Download className="h-4 w-4 mr-1" />
                备份
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadHealthReport()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                诊断
              </Button>
            </div>
          </div>

          {/* 健康诊断 Tab */}
          <TabsContent value="health" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : healthReport ? (
              <div className="space-y-6">
                {/* 健康度评分 */}
                <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className={cn("text-5xl font-bold", getScoreColor(healthReport.score))}>
                      {healthReport.score}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {getScoreLabel(healthReport.score)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <Progress value={healthReport.score} className="h-3" />
                  </div>
                </div>

                {/* 统计概览 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={<Database className="h-5 w-5" />}
                    label="缓存大小"
                    value={healthReport.projects_cache_size_formatted}
                    status={healthReport.projects_cache_size > 100 * 1024 * 1024 ? 'critical' : 'ok'}
                  />
                  <StatCard
                    icon={<FolderOpen className="h-5 w-5" />}
                    label="会话文件"
                    value={`${healthReport.session_files_count} 个`}
                    status={healthReport.session_files_count > 500 ? 'warning' : 'ok'}
                  />
                  <StatCard
                    icon={<Zap className="h-5 w-5" />}
                    label="活跃 Skills"
                    value={`${healthReport.active_skills} / ${healthReport.active_skills + healthReport.disabled_skills}`}
                    status={healthReport.active_skills > 10 ? 'warning' : 'ok'}
                  />
                  <StatCard
                    icon={<Cpu className="h-5 w-5" />}
                    label="活跃 MCP"
                    value={`${healthReport.active_mcps} 个`}
                    status={healthReport.active_mcps > 5 ? 'warning' : 'ok'}
                  />
                </div>

                {/* CLAUDE.md 信息 */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CLAUDE.md</span>
                    <div className="text-sm text-muted-foreground">
                      {formatSize(healthReport.claude_md_size)} (~{healthReport.claude_md_tokens} tokens)
                    </div>
                  </div>
                  <Progress
                    value={Math.min((healthReport.claude_md_size / 15360) * 100, 100)}
                    className="h-2 mt-2"
                  />
                </div>

                {/* 发现的问题 */}
                {healthReport.issues.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      发现的问题
                    </h3>
                    {healthReport.issues.map((issue, idx) => (
                      <IssueCard key={idx} issue={issue} onFix={() => {
                        if (issue.fix_action === 'clean_old_cache') {
                          setConfirmDialog({
                            open: true,
                            title: '清理旧缓存',
                            description: '将删除 30 天前的所有会话文件，此操作不可撤销。',
                            action: () => cleanOldCache(30),
                          });
                        } else if (issue.fix_action === 'clean_large_sessions') {
                          setActiveTab('cache');
                        }
                      }} />
                    ))}
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-40 text-red-500">
                <XCircle className="h-8 w-8 mb-2" />
                <div>{error}</div>
              </div>
            ) : null}
          </TabsContent>

          {/* 缓存管理 Tab */}
          <TabsContent value="cache" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                共 {projectCaches.length} 个项目缓存
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDialog({
                  open: true,
                  title: '清理 30 天前的缓存',
                  description: '将删除所有 30 天前的会话文件，此操作不可撤销。',
                  action: () => cleanOldCache(30),
                })}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                清理旧缓存
              </Button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {projectCaches.map((cache) => (
                <div
                  key={cache.path}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    cache.size > 20 * 1024 * 1024 && "border-red-500/50 bg-red-500/5",
                    cache.size > 5 * 1024 * 1024 && cache.size <= 20 * 1024 * 1024 && "border-yellow-500/50 bg-yellow-500/5"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm truncate" title={cache.name}>
                      {cache.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {cache.session_count} 个会话
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={cache.size > 20 * 1024 * 1024 ? "destructive" : cache.size > 5 * 1024 * 1024 ? "secondary" : "outline"}>
                      {cache.size_formatted}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDialog({
                        open: true,
                        title: `清理 ${cache.name}`,
                        description: `将删除该项目的所有会话文件（${cache.session_count} 个），释放 ${cache.size_formatted}。`,
                        action: () => cleanProjectCache(cache.name),
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 配置开关 Tab */}
          <TabsContent value="items" className="mt-4">
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {/* Skills 分组 */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Skills ({configItems.filter(item => item.category === 'skill').length})
                </h3>
                <div className="space-y-2">
                  {configItems.filter(item => item.category === 'skill').map((item) => (
                    <ConfigItemRow key={item.id} item={item} onToggle={toggleConfigItem} />
                  ))}
                </div>
              </div>

              {/* Hooks 分组 */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Hooks ({configItems.filter(item => item.category === 'hook').length})
                </h3>
                <div className="space-y-2">
                  {configItems.filter(item => item.category === 'hook').map((item) => (
                    <ConfigItemRow key={item.id} item={item} onToggle={toggleConfigItem} />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 确认对话框 */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await confirmDialog.action();
              setConfirmDialog({ ...confirmDialog, open: false });
            }}>
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ConfigManager;

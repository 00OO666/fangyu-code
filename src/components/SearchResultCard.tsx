/**
 * SearchResultCard - 增强的搜索结果卡片组件
 *
 * 功能:
 * - 详细信息展示
 * - 使用统计（最近使用时间、使用次数）
 * - 快速操作按钮
 * - 悬停展开详情
 * - 流畅动画
 */

import { motion } from 'framer-motion';
import {
  FileCode,
  ExternalLink,
  Copy,
  Check,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// 类型定义
// ============================================================================

export interface SearchResultItem {
  id: string;
  type: 'mcp' | 'skill' | 'plugin' | 'hook';
  name: string;
  description?: string;
  enabled?: boolean;
  scope?: 'user' | 'project';
  engine?: 'claude' | 'codex' | 'gemini';
  filePath?: string;
  // 使用统计
  lastUsed?: number;
  usageCount?: number;
  // 快速操作
  quickActions?: Array<{
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
  }>;
  // 详细信息
  details?: {
    triggers?: string[];
    category?: string;
    version?: string;
    author?: string;
  };
}

interface SearchResultCardProps {
  item: SearchResultItem;
  onToggle?: (id: string, enabled: boolean) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenDocs?: (id: string) => void;
  className?: string;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化相对时间
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

/**
 * 格式化使用次数
 */
function formatUsageCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.floor(count / 1000)}k`;
}

// ============================================================================
// 图标和颜色映射
// ============================================================================

const TYPE_COLORS = {
  mcp: 'text-blue-500',
  skill: 'text-yellow-500',
  plugin: 'text-purple-500',
  hook: 'text-green-500',
};

const TYPE_BG = {
  mcp: 'bg-blue-50 dark:bg-blue-950/30',
  skill: 'bg-yellow-50 dark:bg-yellow-950/30',
  plugin: 'bg-purple-50 dark:bg-purple-950/30',
  hook: 'bg-green-50 dark:bg-green-950/30',
};

// ============================================================================
// 主组件
// ============================================================================

export function SearchResultCard({
  item,
  onToggle,
  onOpenFile,
  onOpenDocs,
  className,
}: SearchResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyName = async () => {
    try {
      await navigator.clipboard.writeText(item.name);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const hasStats = item.lastUsed || item.usageCount;
  const hasDetails = item.details && Object.keys(item.details).length > 0;
  const hasQuickActions = item.quickActions && item.quickActions.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-lg border',
        'bg-background/50 hover:bg-accent/30',
        'transition-all duration-200',
        'overflow-hidden',
        className
      )}
    >
      {/* 主要内容 */}
      <div className="p-3">
        {/* 头部 */}
        <div className="flex items-start gap-3">
          {/* 类型图标 */}
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
              TYPE_BG[item.type]
            )}
          >
            <span className={cn('text-lg font-bold', TYPE_COLORS[item.type])}>
              {item.type.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm truncate">{item.name}</h4>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {item.type.toUpperCase()}
              </Badge>
              {item.scope && (
                <Badge
                  variant={item.scope === 'user' ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] h-4 px-1.5',
                    item.scope === 'user'
                      ? 'bg-orange-500/90 text-white'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {item.scope === 'user' ? '全局' : '项目'}
                </Badge>
              )}
              {item.engine && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {item.engine}
                </Badge>
              )}
            </div>

            {/* 描述 */}
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {item.description}
              </p>
            )}

            {/* 使用统计 */}
            {hasStats && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {item.lastUsed && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatRelativeTime(item.lastUsed)}</span>
                  </div>
                )}
                {item.usageCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>{formatUsageCount(item.usageCount)} 次</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 复制名称 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyName}
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制名称</TooltipContent>
            </Tooltip>

            {/* 打开文件 */}
            {item.filePath && onOpenFile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenFile(item.filePath!)}
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>打开文件</TooltipContent>
              </Tooltip>
            )}

            {/* 查看文档 */}
            {onOpenDocs && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenDocs(item.id)}
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>查看文档</TooltipContent>
              </Tooltip>
            )}

            {/* 展开/收起 */}
            {(hasDetails || hasQuickActions) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 p-0"
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            {/* 启用/禁用开关 */}
            {onToggle && (
              <Switch
                checked={item.enabled ?? false}
                onCheckedChange={(checked) => onToggle(item.id, checked)}
                className="scale-75"
              />
            )}
          </div>
        </div>

        {/* 展开内容 */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 pt-3 border-t space-y-3"
          >
            {/* 快速操作 */}
            {hasQuickActions && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  快速操作
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.quickActions!.map((action, index) => {
                    const Icon = action.icon || ExternalLink;
                    return (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={action.onClick}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Icon className="h-3 w-3" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 详细信息 */}
            {hasDetails && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  详细信息
                </div>
                <div className="space-y-1.5 text-xs">
                  {item.details!.triggers && item.details!.triggers.length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">触发词:</span>
                      <div className="flex flex-wrap gap-1">
                        {item.details!.triggers.map((trigger, index) => (
                          <Badge key={index} variant="secondary" className="text-[10px] h-4">
                            {trigger}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.details!.category && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">分类:</span>
                      <span>{item.details!.category}</span>
                    </div>
                  )}
                  {item.details!.version && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">版本:</span>
                      <span>{item.details!.version}</span>
                    </div>
                  )}
                  {item.details!.author && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">作者:</span>
                      <span>{item.details!.author}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

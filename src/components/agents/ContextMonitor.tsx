/**
 * ContextMonitor - 上下文监控组件
 * 
 * 显示上下文使用量、阈值状态
 * 
 * Requirements: 4.1, 4.2
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Database from 'lucide-react/dist/esm/icons/database'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Info from 'lucide-react/dist/esm/icons/info'
import Zap from 'lucide-react/dist/esm/icons/zap';

// =============================================================================
// 类型定义
// =============================================================================

interface ContextItem {
  id: string;
  type: 'file' | 'folder' | 'reference' | 'system' | 'user';
  name: string;
  tokens: number;
  priority: number;
  timestamp: number;
}

interface ContextStats {
  totalTokens: number;
  maxTokens: number;
  usagePercent: number;
  warningThreshold: number;
  criticalThreshold: number;
  items: ContextItem[];
}

interface ContextMonitorProps {
  stats?: ContextStats;
  onCompact?: () => void;
  onClearItem?: (itemId: string) => void;
  onRefresh?: () => void;
}

// =============================================================================
// 辅助函数
// =============================================================================

const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

const getStatusColor = (percent: number, warning: number, critical: number): string => {
  if (percent >= critical) return 'text-red-500';
  if (percent >= warning) return 'text-yellow-500';
  return 'text-green-500';
};

const getTypeIcon = (type: ContextItem['type']) => {
  switch (type) {
    case 'file':
      return <FileText className="w-4 h-4" />;
    case 'folder':
      return <Database className="w-4 h-4" />;
    case 'reference':
      return <Info className="w-4 h-4" />;
    case 'system':
      return <Zap className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};


// =============================================================================
// 主组件
// =============================================================================

export const ContextMonitor: React.FC<ContextMonitorProps> = ({
  stats,
  onCompact,
  onClearItem,
  onRefresh,
}) => {
  if (!stats) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No context data available</p>
        </CardContent>
      </Card>
    );
  }

  const { totalTokens, maxTokens, usagePercent, warningThreshold, criticalThreshold, items } = stats;
  const statusColor = getStatusColor(usagePercent, warningThreshold, criticalThreshold);

  const isWarning = usagePercent >= warningThreshold;
  const isCritical = usagePercent >= criticalThreshold;

  // 按 token 数量排序
  const sortedItems = [...items].sort((a, b) => b.tokens - a.tokens);

  return (
    <div className="space-y-4">
      {/* 使用量概览 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5" />
              Context Usage
            </CardTitle>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
              {isCritical && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Critical
                </Badge>
              )}
              {isWarning && !isCritical && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
                  <AlertTriangle className="w-3 h-3" />
                  Warning
                </Badge>
              )}
              {!isWarning && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3" />
                  Healthy
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 主进度条 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${statusColor}`}>
                {usagePercent.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">
                {formatTokens(totalTokens)} / {formatTokens(maxTokens)} tokens
              </span>
            </div>
            
            <div className="relative">
              <Progress value={usagePercent} className="h-3" />
              {/* 阈值标记 */}
              <div
                className="absolute top-0 h-3 w-0.5 bg-yellow-500"
                style={{ left: `${warningThreshold}%` }}
              />
              <div
                className="absolute top-0 h-3 w-0.5 bg-red-500"
                style={{ left: `${criticalThreshold}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="text-yellow-500">{warningThreshold}% Warning</span>
              <span className="text-red-500">{criticalThreshold}% Critical</span>
              <span>100%</span>
            </div>
          </div>

          {/* 压缩按钮 */}
          {isWarning && onCompact && (
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={onCompact}
            >
              <Zap className="w-4 h-4 mr-2" />
              Compact Context
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 上下文项列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Context Items</CardTitle>
            <span className="text-sm text-muted-foreground">
              {items.length} items
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="px-4 pb-4 space-y-2">
              {sortedItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No context items
                </p>
              ) : (
                sortedItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getTypeIcon(item.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTokens(item.tokens)} tokens • Priority {item.priority}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Token 占比 */}
                      <div className="w-16">
                        <Progress
                          value={(item.tokens / totalTokens) * 100}
                          className="h-1"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {((item.tokens / totalTokens) * 100).toFixed(1)}%
                      </span>
                      
                      {onClearItem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onClearItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 统计摘要 */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Files</p>
            <p className="text-lg font-bold">
              {items.filter(i => i.type === 'file').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">References</p>
            <p className="text-lg font-bold">
              {items.filter(i => i.type === 'reference').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">System</p>
            <p className="text-lg font-bold">
              {items.filter(i => i.type === 'system').length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContextMonitor;

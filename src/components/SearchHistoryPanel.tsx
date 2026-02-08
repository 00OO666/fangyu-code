/**
 * SearchHistoryPanel - 搜索历史面板组件
 *
 * 功能:
 * - 显示最近 50 个搜索记录
 * - 支持收藏常用搜索
 * - 单个删除 / 清除全部
 * - 点击快速重新搜索
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Star, X, Trash2, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SearchHistoryItem } from '@/hooks/useSearchHistory';

// ============================================================================
// 类型定义
// ============================================================================

interface SearchHistoryPanelProps {
  history: SearchHistoryItem[];
  pinnedSearches: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onTogglePin: (id: string) => void;
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

// ============================================================================
// 主组件
// ============================================================================

export function SearchHistoryPanel({
  history,
  pinnedSearches,
  onSelect,
  onRemove,
  onClear,
  onTogglePin,
  className,
}: SearchHistoryPanelProps) {
  const unpinnedHistory = history.filter((item) => !item.pinned);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">搜索历史</h3>
          <span className="text-xs text-muted-foreground">({history.length})</span>
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 text-xs gap-1.5"
          >
            <Trash2 className="h-3 w-3" />
            清除全部
          </Button>
        )}
      </div>

      {/* 内容 */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* 收藏的搜索 */}
          {pinnedSearches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
                <Star className="h-3 w-3 fill-current" />
                <span>常用搜索</span>
              </div>
              <AnimatePresence>
                {pinnedSearches.map((item, index) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    index={index}
                    onSelect={onSelect}
                    onRemove={onRemove}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* 最近搜索 */}
          {unpinnedHistory.length > 0 && (
            <div className="space-y-2">
              {pinnedSearches.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>最近搜索</span>
                </div>
              )}
              <AnimatePresence>
                {unpinnedHistory.map((item, index) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    index={index}
                    onSelect={onSelect}
                    onRemove={onRemove}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* 空状态 */}
          {history.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无搜索历史</p>
              <p className="text-xs mt-1">开始搜索后，历史记录将自动保存</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// 历史项组件
// ============================================================================

interface HistoryItemProps {
  item: SearchHistoryItem;
  index: number;
  onSelect: (item: SearchHistoryItem) => void;
  onRemove: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function HistoryItem({ item, index, onSelect, onRemove, onTogglePin }: HistoryItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        'group flex items-center gap-3 p-2.5 rounded-lg',
        'border border-transparent',
        'hover:bg-accent/50 hover:border-accent',
        'transition-all cursor-pointer'
      )}
      onClick={() => onSelect(item)}
    >
      {/* 收藏图标 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(item.id);
        }}
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center',
          'transition-colors',
          item.pinned
            ? 'text-yellow-500 hover:text-yellow-600'
            : 'text-muted-foreground/30 hover:text-muted-foreground'
        )}
        title={item.pinned ? '取消收藏' : '收藏'}
      >
        {item.pinned ? (
          <Star className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Star className="h-3.5 w-3.5" />
        )}
      </button>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.query}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{item.resultCount} 个结果</span>
          <span>·</span>
          <span>{formatRelativeTime(item.timestamp)}</span>
          {item.filterType && item.filterType !== 'all' && (
            <>
              <span>·</span>
              <span className="uppercase">{item.filterType}</span>
            </>
          )}
        </div>
      </div>

      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center',
          'text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10',
          'opacity-0 group-hover:opacity-100',
          'transition-all'
        )}
        title="删除"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

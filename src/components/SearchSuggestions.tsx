/**
 * SearchSuggestions - 搜索建议下拉组件
 *
 * 功能:
 * - 显示搜索建议（历史、最近使用、推荐）
 * - 键盘导航（↑↓ 选择，Enter 确认）
 * - 高亮匹配文本
 * - 流畅动画
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Zap, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SearchSuggestion } from '@/hooks/useSearchHistory';

// ============================================================================
// 类型定义
// ============================================================================

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  query: string;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClose: () => void;
  className?: string;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 高亮匹配文本
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-primary font-medium rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

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
// 图标映射
// ============================================================================

const SUGGESTION_ICONS = {
  history: Clock,
  recent: Zap,
  recommended: Sparkles,
};

const SUGGESTION_COLORS = {
  history: 'text-blue-500',
  recent: 'text-yellow-500',
  recommended: 'text-purple-500',
};

const SUGGESTION_LABELS = {
  history: '历史搜索',
  recent: '最近使用',
  recommended: '推荐',
};

// ============================================================================
// 主组件
// ============================================================================

export function SearchSuggestions({
  suggestions,
  query,
  onSelect,
  onClose,
  className,
}: SearchSuggestionsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            onSelect(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  // 滚动到选中项
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'absolute top-full left-0 right-0 mt-2',
          'bg-background/95 backdrop-blur-xl backdrop-saturate-150',
          'border border-white/20 dark:border-white/10',
          'rounded-lg shadow-lg overflow-hidden',
          'z-50',
          className
        )}
      >
        <div className="max-h-[300px] overflow-y-auto">
          {suggestions.map((suggestion, index) => {
            const Icon = SUGGESTION_ICONS[suggestion.type];
            const isSelected = index === selectedIndex;

            return (
              <motion.div
                key={suggestion.id}
                ref={(el) => (itemRefs.current[index] = el)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => onSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5',
                  'cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-primary/10 border-l-2 border-primary'
                    : 'hover:bg-accent/50 border-l-2 border-transparent'
                )}
              >
                {/* 图标 */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0',
                    suggestion.type === 'history' && 'bg-blue-50 dark:bg-blue-950/30',
                    suggestion.type === 'recent' && 'bg-yellow-50 dark:bg-yellow-950/30',
                    suggestion.type === 'recommended' && 'bg-purple-50 dark:bg-purple-950/30'
                  )}
                >
                  <Icon className={cn('h-4 w-4', SUGGESTION_COLORS[suggestion.type])} />
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {highlightMatch(suggestion.text, query)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{SUGGESTION_LABELS[suggestion.type]}</span>
                    {suggestion.metadata?.resultCount !== undefined && (
                      <>
                        <span>·</span>
                        <span>{suggestion.metadata.resultCount} 个结果</span>
                      </>
                    )}
                    {suggestion.metadata?.timestamp && (
                      <>
                        <span>·</span>
                        <span>{formatRelativeTime(suggestion.metadata.timestamp)}</span>
                      </>
                    )}
                    {suggestion.metadata?.itemType && (
                      <>
                        <span>·</span>
                        <span className="uppercase">{suggestion.metadata.itemType}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 选中指示器 */}
                {isSelected && (
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
          <span>↑↓ 选择</span>
          <span>Enter 确认</span>
          <span>Esc 关闭</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

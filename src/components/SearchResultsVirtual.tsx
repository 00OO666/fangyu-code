/**
 * SearchResultsVirtual - 虚拟滚动搜索结果组件
 *
 * 功能:
 * - 使用虚拟滚动优化大量结果的渲染
 * - 支持高亮匹配文本
 * - 支持点击跳转到文件
 * - 支持搜索进度显示
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { File, Loader2 } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import type { SearchResult, SearchProgress } from '@/hooks/useRipgrepSearch';

// ============================================================================
// 类型定义
// ============================================================================

interface SearchResultsVirtualProps {
  results: SearchResult[];
  progress: SearchProgress;
  isSearching: boolean;
  onResultClick?: (result: SearchResult) => void;
  className?: string;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 高亮匹配文本
 */
function highlightMatch(text: string, matchedText: string): React.ReactNode {
  if (!matchedText) return text;

  const parts = text.split(new RegExp(`(${escapeRegExp(matchedText)})`, 'gi'));

  return parts.map((part, index) =>
    part.toLowerCase() === matchedText.toLowerCase() ? (
      <span key={index} className="bg-yellow-200 dark:bg-yellow-900 font-semibold">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 格式化文件路径（显示相对路径）
 */
function formatFilePath(filePath: string): string {
  // 简化路径显示
  const parts = filePath.split(/[/\\]/);
  if (parts.length > 3) {
    return `.../${parts.slice(-3).join('/')}`;
  }
  return filePath;
}

// ============================================================================
// 组件
// ============================================================================

export function SearchResultsVirtual({
  results,
  progress,
  isSearching,
  onResultClick,
  className,
}: SearchResultsVirtualProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 虚拟滚动配置
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 每个结果项的估计高度
    overscan: 5, // 预渲染 5 个项目
  });

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 搜索进度 */}
      {isSearching && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            搜索中... {progress.current} 个结果
            {progress.total && ` / ${progress.total}`}
          </span>
        </div>
      )}

      {/* 结果统计 */}
      {!isSearching && results.length > 0 && (
        <div className="px-4 py-2 bg-muted/30 border-b">
          <span className="text-sm text-muted-foreground">
            找到 {results.length} 个结果
          </span>
        </div>
      )}

      {/* 虚拟滚动列表 */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const result = results[virtualItem.index];

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={cn(
                    'px-4 py-3 border-b hover:bg-accent/50 cursor-pointer transition-colors',
                    'group'
                  )}
                  onClick={() => onResultClick?.(result)}
                >
                  {/* 文件路径 */}
                  <div className="flex items-center gap-2 mb-1">
                    <File className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate" title={result.file_path}>
                      {formatFilePath(result.file_path)}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      :{result.line_number}:{result.column}
                    </span>
                  </div>

                  {/* 匹配行内容 */}
                  <div className="font-mono text-sm pl-5">
                    {highlightMatch(result.line_content.trim(), result.matched_text)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 空状态 */}
      {!isSearching && results.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无搜索结果</p>
          </div>
        </div>
      )}
    </div>
  );
}

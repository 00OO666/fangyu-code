/**
 * CodeSearchPanel - 代码内容搜索面板
 *
 * 功能:
 * - 集成 useSearchWorker Hook
 * - 使用虚拟滚动显示结果
 * - 支持搜索选项配置
 * - 支持取消搜索
 * - 支持点击结果跳转到文件
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Settings, Loader2, FileSearch } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SearchResultsVirtual } from '@/components/SearchResultsVirtual';
import { useSearchWorker } from '@/hooks/useSearchWorker';
import type { SearchOptions, SearchResult } from '@/hooks/useRipgrepSearch';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

// ============================================================================
// 类型定义
// ============================================================================

interface CodeSearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath?: string;
  triggerRef?: React.RefObject<HTMLElement>;
}

// ============================================================================
// 组件
// ============================================================================

export function CodeSearchPanel({
  open,
  onOpenChange,
  projectPath,
  triggerRef,
}: CodeSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPath, setSearchPath] = useState(projectPath || '');
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    regex: false,
    case_sensitive: false,
    whole_word: false,
    follow_symlinks: true,
    max_results: 1000,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { search, cancel, clear, isSearching, progress, results, error } = useSearchWorker();

  // 更新搜索路径
  useEffect(() => {
    if (projectPath) {
      setSearchPath(projectPath);
    }
  }, [projectPath]);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onOpenChange]);

  /**
   * 执行搜索
   */
  const handleSearch = () => {
    if (!searchQuery.trim() || !searchPath.trim()) {
      return;
    }

    search(searchPath, searchQuery, options);
  };

  /**
   * 处理键盘事件
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      if (isSearching) {
        cancel();
      } else {
        onOpenChange(false);
      }
    }
  };

  /**
   * 点击搜索结果
   */
  const handleResultClick = async (result: SearchResult) => {
    try {
      // 打开文件并跳转到指定行
      await api.openFileWithDefaultApp(result.file_path);
      logger.info('CodeSearchPanel', 'Opened file:', result.file_path);
    } catch (err) {
      logger.error('CodeSearchPanel', 'Failed to open file:', err);
    }
  };

  if (!open) return null;

  const panelContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'fixed inset-4 md:inset-8 lg:inset-16',
            'bg-background/95 backdrop-blur-xl',
            'border rounded-xl shadow-2xl',
            'flex flex-col overflow-hidden',
            'z-50'
          )}
        >
          {/* 头部 */}
          <div className="flex items-center gap-3 p-4 border-b">
            <FileSearch className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">代码内容搜索</h2>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOptions(!showOptions)}
              className={cn(showOptions && 'bg-accent')}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 搜索栏 */}
          <div className="p-4 border-b space-y-3">
            {/* 搜索路径 */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground w-16">路径:</Label>
              <Input
                type="text"
                placeholder="搜索路径"
                value={searchPath}
                onChange={(e) => setSearchPath(e.target.value)}
                className="flex-1"
              />
            </div>

            {/* 搜索模式 */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground w-16">搜索:</Label>
              <div className="flex-1 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="输入搜索内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                {isSearching ? (
                  <Button onClick={cancel} variant="destructive" size="sm">
                    <X className="h-4 w-4 mr-1" />
                    取消
                  </Button>
                ) : (
                  <Button onClick={handleSearch} size="sm">
                    <Search className="h-4 w-4 mr-1" />
                    搜索
                  </Button>
                )}
              </div>
            </div>

            {/* 搜索选项 */}
            {showOptions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-4 pt-2 border-t"
              >
                <div className="flex items-center gap-2">
                  <Switch
                    id="regex"
                    checked={options.regex}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, regex: checked })
                    }
                  />
                  <Label htmlFor="regex" className="text-sm cursor-pointer">
                    正则表达式
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="case-sensitive"
                    checked={options.case_sensitive}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, case_sensitive: checked })
                    }
                  />
                  <Label htmlFor="case-sensitive" className="text-sm cursor-pointer">
                    区分大小写
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="whole-word"
                    checked={options.whole_word}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, whole_word: checked })
                    }
                  />
                  <Label htmlFor="whole-word" className="text-sm cursor-pointer">
                    全词匹配
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="follow-symlinks"
                    checked={options.follow_symlinks}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, follow_symlinks: checked })
                    }
                  />
                  <Label htmlFor="follow-symlinks" className="text-sm cursor-pointer">
                    跟随符号链接
                  </Label>
                </div>
              </motion.div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-b text-destructive text-sm">
              {error}
            </div>
          )}

          {/* 搜索结果 */}
          <div className="flex-1 overflow-hidden">
            <SearchResultsVirtual
              results={results}
              progress={progress}
              isSearching={isSearching}
              onResultClick={handleResultClick}
            />
          </div>

          {/* 底部提示 */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Enter 搜索</span>
              <span>ESC 关闭</span>
            </div>
            {results.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear} className="h-6 text-xs">
                清除结果
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(panelContent, document.body);
}

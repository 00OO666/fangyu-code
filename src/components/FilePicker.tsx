import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { 
  X, 
  Folder, 
  File, 
  ArrowLeft,
  FileCode,
  FileText,
  FileImage,
  Search,
  ChevronRight
} from "lucide-react";
import type { FileEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

// Global caches that persist across component instances
const globalDirectoryCache = new Map<string, FileEntry[]>();
const globalSearchCache = new Map<string, FileEntry[]>();

// Note: These caches persist for the lifetime of the application.
// In a production app, you might want to:
// 1. Add TTL (time-to-live) to expire old entries
// 2. Implement LRU (least recently used) eviction
// 3. Clear caches when the working directory changes
// 4. Add a maximum cache size limit

interface FilePickerProps {
  /**
   * The base directory path to browse
   */
  basePath: string;
  /**
   * Callback when a file/directory is selected
   */
  onSelect: (entry: FileEntry) => void;
  /**
   * Callback to close the picker
   */
  onClose: () => void;
  /**
   * Initial search query
   */
  initialQuery?: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

// File icon mapping based on extension
const getFileIcon = (entry: FileEntry) => {
  if (entry.is_directory) return Folder;
  
  const ext = entry.extension?.toLowerCase();
  if (!ext) return File;
  
  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'h'].includes(ext)) {
    return FileCode;
  }
  
  // Text/Markdown files
  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'css'].includes(ext)) {
    return FileText;
  }
  
  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
    return FileImage;
  }
  
  return File;
};

// Format file size to human readable
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * FilePicker component - File browser with fuzzy search
 *
 * @example
 * <FilePicker
 *   basePath="/Users/example/project"
 *   onSelect={(entry) => console.log('Selected:', entry)}
 *   onClose={() => setShowPicker(false)}
 * />
 */
export const FilePicker: React.FC<FilePickerProps> = ({
  basePath,
  onSelect,
  onClose,
  initialQuery = "",
  className,
}) => {
  const searchQuery = initialQuery;
  
  const [currentPath, setCurrentPath] = useState(basePath);
  const [entries, setEntries] = useState<FileEntry[]>(() => 
    searchQuery.trim() ? [] : globalDirectoryCache.get(basePath) || []
  );
  const [searchResults, setSearchResults] = useState<FileEntry[]>(() => {
    if (searchQuery.trim()) {
      const cacheKey = `${basePath}:${searchQuery}`;
      return globalSearchCache.get(cacheKey) || [];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([basePath]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isShowingCached, setIsShowingCached] = useState(() => {
    // Check if we're showing cached data on mount
    if (searchQuery.trim()) {
      const cacheKey = `${basePath}:${searchQuery}`;
      return globalSearchCache.has(cacheKey);
    }
    return globalDirectoryCache.has(basePath);
  });
  
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  
  // Computed values
  const displayEntries = searchQuery.trim() ? searchResults : entries;
  const canGoBack = pathHistory.length > 1;
  
  // Get relative path for display
  const relativePath = currentPath.startsWith(basePath) 
    ? currentPath.slice(basePath.length) || '/'
    : currentPath;

  // Load directory contents
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchQuery.trim()) {
      const cacheKey = `${basePath}:${searchQuery}`;
      
      // Immediately show cached results if available
      if (globalSearchCache.has(cacheKey)) {
        setSearchResults(globalSearchCache.get(cacheKey) || []);
        setIsShowingCached(true);
        setError(null);
      }
      
      // Schedule fresh search after debounce
      searchDebounceRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
      setIsShowingCached(false);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, basePath]);

  // Reset selected index when entries change
  useEffect(() => {
    setSelectedIndex(0);
  }, [entries, searchResults]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const displayEntries = searchQuery.trim() ? searchResults : entries;
      
      // ⚡ 修复：只处理文件选择器相关的按键，使用 capture 阶段确保优先执行
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
          
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          // Enter always selects the current item (file or directory)
          if (displayEntries.length > 0 && selectedIndex < displayEntries.length) {
            onSelect(displayEntries[selectedIndex]);
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => Math.min(displayEntries.length - 1, prev + 1));
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          // Right arrow enters directories
          if (displayEntries.length > 0 && selectedIndex < displayEntries.length) {
            const entry = displayEntries[selectedIndex];
            if (entry.is_directory) {
              navigateToDirectory(entry.path);
            }
          }
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          // Left arrow goes back to parent directory
          if (canGoBack) {
            navigateBack();
          }
          break;
      }
    };

    // ⚡ 使用 capture 阶段，确保优先于其他组件处理
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [entries, searchResults, selectedIndex, searchQuery, canGoBack, onClose, onSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (fileListRef.current) {
      const selectedElement = fileListRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const loadDirectory = async (path: string) => {
    try {
      // Check cache first and show immediately
      if (globalDirectoryCache.has(path)) {
        setEntries(globalDirectoryCache.get(path) || []);
        setIsShowingCached(true);
        setError(null);
      } else {
        // Only show loading if we don't have cached data
        setIsLoading(true);
      }

      // Always fetch fresh data in background
      const contents = await api.listDirectoryContents(path);
      
      // Cache the results
      globalDirectoryCache.set(path, contents);
      
      // Update with fresh data
      setEntries(contents);
      setIsShowingCached(false);
      setError(null);
    } catch (err) {
      console.error('[FilePicker] Failed to load directory:', path, err);
      console.error('[FilePicker] Error details:', err);
      // Only set error if we don't have cached data to show
      if (!globalDirectoryCache.has(path)) {
        setError(err instanceof Error ? err.message : '加载目录失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    try {
      // Create cache key that includes both query and basePath
      const cacheKey = `${basePath}:${query}`;

      // Check cache first and show immediately
      if (globalSearchCache.has(cacheKey)) {
        setSearchResults(globalSearchCache.get(cacheKey) || []);
        setIsShowingCached(true);
        setError(null);
      } else {
        // Only show loading if we don't have cached data
        setIsLoading(true);
      }

      // Always fetch fresh results in background
      const results = await api.searchFiles(basePath, query);
      
      // Cache the results
      globalSearchCache.set(cacheKey, results);
      
      // Update with fresh results
      setSearchResults(results);
      setIsShowingCached(false);
      setError(null);
    } catch (err) {
      console.error('[FilePicker] Search failed:', query, err);
      // Only set error if we don't have cached data to show
      const cacheKey = `${basePath}:${query}`;
      if (!globalSearchCache.has(cacheKey)) {
        setError(err instanceof Error ? err.message : '搜索失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToDirectory = (path: string) => {
    setCurrentPath(path);
    setPathHistory(prev => [...prev, path]);
  };

  const navigateBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory];
      newHistory.pop(); // Remove current
      const previousPath = newHistory[newHistory.length - 1];
      
      // Don't go beyond the base path
      if (previousPath.startsWith(basePath) || previousPath === basePath) {
        setCurrentPath(previousPath);
        setPathHistory(newHistory);
      }
    }
  };

  // ⚡ 优化：直观的鼠标操作
  // 单击 → 进入目录 / 悬停预览文件
  // 双击 → 选中文件或目录
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clickCountRef = useRef(0);
  const [hoveredEntry, setHoveredEntry] = useState<FileEntry | null>(null);

  const handleEntryClick = (entry: FileEntry) => {
    clickCountRef.current += 1;
    
    // 清除之前的定时器
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    
    // 等待判断是单击还是双击
    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        // 单击：如果是目录就进入，文件就不处理（等双击）
        if (entry.is_directory) {
          navigateToDirectory(entry.path);
        }
      }
      clickCountRef.current = 0;
    }, 250);
  };
  
  const handleEntryDoubleClick = (entry: FileEntry) => {
    // 清除单击定时器
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickCountRef.current = 0;
    
    // 双击：选中文件或目录
    onSelect(entry);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "absolute bottom-full mb-2 left-0 z-50",
        "w-[500px] h-[400px]",
        "bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg",
        "flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={navigateBack}
              disabled={!canGoBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono text-muted-foreground truncate max-w-[300px]">
              {relativePath}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Show loading only if no cached data */}
        {isLoading && displayEntries.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-muted-foreground">加载中...</span>
          </div>
        )}

        {/* Show subtle indicator when displaying cached data while fetching fresh */}
        {isShowingCached && isLoading && displayEntries.length > 0 && (
          <div className="absolute top-1 right-2 text-xs text-muted-foreground/50 italic">
            更新中...
          </div>
        )}

        {error && displayEntries.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {!isLoading && !error && displayEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Search className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {searchQuery.trim() ? '未找到文件' : '空目录'}
            </span>
          </div>
        )}

        {displayEntries.length > 0 && (
          <div className="p-2 space-y-0.5" ref={fileListRef}>
            {displayEntries.map((entry, index) => {
              const Icon = getFileIcon(entry);
              const isSearching = searchQuery.trim() !== '';
              const isSelected = index === selectedIndex;
              
              return (
                <button
                  key={entry.path}
                  data-index={index}
                  onClick={() => handleEntryClick(entry)}
                  onDoubleClick={() => handleEntryDoubleClick(entry)}
                  onMouseEnter={() => {
                    setSelectedIndex(index);
                    setHoveredEntry(entry);
                  }}
                  onMouseLeave={() => setHoveredEntry(null)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md",
                    "hover:bg-accent/80 hover:border hover:border-primary/30 transition-all",
                    "text-left text-sm",
                    // ⚡ 增强选中状态的视觉反馈
                    isSelected && "bg-primary/10 border-2 border-primary ring-2 ring-primary/20 font-medium",
                    hoveredEntry?.path === entry.path && !isSelected && "ring-1 ring-primary/20"
                  )}
                  title={entry.is_directory ? "单击进入 • 双击选中" : "双击选中"}
                >
                  <Icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    entry.is_directory ? "text-blue-500" : "text-muted-foreground"
                  )} />
                  
                  <span className="flex-1 truncate">
                    {entry.name}
                  </span>
                  
                  {!entry.is_directory && entry.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(entry.size)}
                    </span>
                  )}
                  
                  {entry.is_directory && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  
                  {isSearching && (
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                      {entry.path.replace(basePath, '').replace(/^\//, '')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with status */}
      <div className="border-t border-border p-2 space-y-1">
        {/* 悬停状态提示 */}
        {hoveredEntry && (
          <div className="text-xs text-primary font-medium truncate text-center">
            {hoveredEntry.is_directory ? (
              <span>📁 单击进入"{hoveredEntry.name}" • 双击选中</span>
            ) : (
              <span>📄 双击选中"{hoveredEntry.name}"</span>
            )}
          </div>
        )}
        {/* 操作提示 */}
        <p className="text-xs text-muted-foreground text-center">
          {hoveredEntry ? (
            "目录:单击进入 双击选中 • 文件:双击选中"
          ) : (
            "↑↓ 导航 • Enter 选择 • → 进入目录 • ← 返回 • Esc 关闭"
          )}
        </p>
      </div>
    </motion.div>
  );
}; 

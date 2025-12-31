/**
 * PromptSearchModal - 可搜索提示历史弹窗
 *
 * 功能:
 * - Ctrl+R 快捷键触发
 * - 模糊搜索历史提示词
 * - 按项目/引擎/日期过滤
 * - 支持快速编辑和重发
 *
 * 来源: Claude Code CLI 2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Clock,
  Filter,
  Edit,
  Send,
  Copy,
  Check,
  Terminal,
  Code2,
  Sparkles,
  Folder,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// 提示词历史项
interface PromptHistoryItem {
  id: string;
  content: string;
  timestamp: string;
  sessionId: string;
  projectPath: string;
  projectName: string;
  engine: 'claude' | 'codex' | 'gemini';
  model?: string;
}

interface PromptSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt?: (prompt: string) => void;
  onSendPrompt?: (prompt: string) => void;
  currentProjectPath?: string;
}

export function PromptSearchModal({
  open,
  onOpenChange,
  onSelectPrompt,
  onSendPrompt,
  currentProjectPath: _currentProjectPath,
}: PromptSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [prompts, setPrompts] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterEngine, setFilterEngine] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 加载提示历史（模拟数据，实际应从后端加载）
  useEffect(() => {
    if (open) {
      loadPromptHistory();
      // 聚焦搜索框
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  const loadPromptHistory = async () => {
    setLoading(true);
    try {
      // TODO: 从后端加载实际数据
      // 目前使用模拟数据
      const mockPrompts: PromptHistoryItem[] = [
        {
          id: '1',
          content: '帮我创建一个 React 组件',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          sessionId: 'session-1',
          projectPath: '/path/to/project1',
          projectName: 'My Project',
          engine: 'claude',
          model: 'claude-opus-4-5',
        },
        {
          id: '2',
          content: '修复这个 TypeScript 类型错误',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          sessionId: 'session-2',
          projectPath: '/path/to/project2',
          projectName: 'Another Project',
          engine: 'codex',
        },
        {
          id: '3',
          content: '重构代码使用 async/await',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          sessionId: 'session-1',
          projectPath: '/path/to/project1',
          projectName: 'My Project',
          engine: 'gemini',
        },
      ];

      setPrompts(mockPrompts);
    } catch (error) {
      console.error('Failed to load prompt history:', error);
    } finally {
      setLoading(false);
    }
  };

  // 简单模糊搜索（替代 Fuse.js）
  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return true;

    // 支持空格分隔的多关键词搜索
    const keywords = lowerQuery.split(/\s+/);
    return keywords.every((kw) => lowerText.includes(kw));
  }, []);

  // 过滤和搜索结果
  const filteredPrompts = useMemo(() => {
    let results = prompts;

    // 引擎过滤
    if (filterEngine !== 'all') {
      results = results.filter((p) => p.engine === filterEngine);
    }

    // 日期过滤
    if (filterDate !== 'all') {
      const now = Date.now();
      const cutoff =
        filterDate === 'today'
          ? now - 86400000
          : filterDate === 'week'
          ? now - 604800000
          : filterDate === 'month'
          ? now - 2592000000
          : 0;

      results = results.filter((p) => new Date(p.timestamp).getTime() > cutoff);
    }

    // 搜索过滤（原生字符串搜索）
    if (searchQuery.trim()) {
      results = results.filter(
        (p) => fuzzyMatch(p.content, searchQuery) || fuzzyMatch(p.projectName, searchQuery)
      );
    }

    return results;
  }, [prompts, searchQuery, filterEngine, filterDate, fuzzyMatch]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredPrompts.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredPrompts[selectedIndex]) {
        e.preventDefault();
        handleSelectPrompt(filteredPrompts[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredPrompts, onOpenChange]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, filterEngine, filterDate]);

  // 选择提示词
  const handleSelectPrompt = useCallback(
    (prompt: PromptHistoryItem) => {
      onSelectPrompt?.(prompt.content);
      onOpenChange(false);
    },
    [onSelectPrompt, onOpenChange]
  );

  // 发送提示词
  const handleSendPrompt = useCallback(
    (prompt: PromptHistoryItem) => {
      onSendPrompt?.(prompt.content);
      onOpenChange(false);
    },
    [onSendPrompt, onOpenChange]
  );

  // 复制到剪贴板
  const handleCopy = useCallback(async (prompt: PromptHistoryItem) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopiedId(prompt.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  // 获取引擎图标
  const getEngineIcon = (engine: string) => {
    switch (engine) {
      case 'claude':
        return <Terminal className="h-3.5 w-3.5 text-blue-500" />;
      case 'codex':
        return <Code2 className="h-3.5 w-3.5 text-green-500" />;
      case 'gemini':
        return <Sparkles className="h-3.5 w-3.5 text-purple-500" />;
      default:
        return null;
    }
  };

  // 格式化时间
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            搜索提示历史
          </DialogTitle>
        </DialogHeader>

        {/* 搜索和过滤 */}
        <div className="px-4 pb-3 space-y-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="搜索提示词内容或项目名称... (支持模糊搜索)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterEngine} onValueChange={setFilterEngine}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有引擎</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDate} onValueChange={setFilterDate}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有时间</SelectItem>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="week">最近一周</SelectItem>
                <SelectItem value="month">最近一月</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {filteredPrompts.length} 条结果
            </span>
          </div>
        </div>

        {/* 结果列表 */}
        <div className="overflow-y-auto max-h-96 px-2 py-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <span className="text-sm">加载中...</span>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <span className="text-sm">未找到匹配的提示词</span>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredPrompts.map((prompt, index) => (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    'group rounded-lg p-3 mb-2 cursor-pointer transition-colors',
                    'hover:bg-accent',
                    index === selectedIndex && 'bg-accent ring-2 ring-primary'
                  )}
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  <div className="flex items-start gap-3">
                    {/* 引擎图标 */}
                    <div className="flex-shrink-0 mt-0.5">{getEngineIcon(prompt.engine)}</div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{prompt.content}</p>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(prompt.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Folder className="h-3 w-3" />
                          {prompt.projectName}
                        </span>
                        {prompt.model && (
                          <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                            {prompt.model}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPrompt(prompt);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendPrompt(prompt);
                        }}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(prompt);
                        }}
                      >
                        {copiedId === prompt.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>↑↓ 导航 • Enter 选择 • Esc 关闭</span>
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">
                Ctrl+R
              </kbd>
              快捷打开
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PromptSearchModal;

/**
 * RevertPromptPicker - 撤回提示词选择器
 *
 * 按两次 ESC 键时显示，允许用户选择要撤回的提示词
 * 智能识别每个提示词的撤回能力（CLI/项目界面）
 */

import { logger } from '@/lib/logger';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ArrowLeft, MessageSquare, X, Terminal, FolderGit2, AlertCircle, FileCode, FilePlus, FileX, FileEdit, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { RewindMode, RewindCapabilities, GitFileChange } from '@/lib/api';

interface PromptEntry {
  /** 提示词索引（从0开始，后端分配的准确索引） */
  index: number;
  /** 提示词内容 */
  content: string;
  /** 提示词预览（截断后的内容） */
  preview: string;
  /** 来源（project 或 cli） */
  source: string;
  /** 撤回能力（异步加载） */
  capabilities?: RewindCapabilities;
  /** 加载状态 */
  loading: boolean;
}

interface RevertPromptPickerProps {
  /** 会话ID */
  sessionId: string;
  /** 项目ID */
  projectId: string;
  /** 项目路径（Gemini 需要） */
  projectPath?: string;
  /** 会话引擎（claude/codex/gemini），用于选择正确的撤回接口 */
  engine?: 'claude' | 'codex' | 'gemini' | 'siliconflow';
  /** 选择回调 */
  onSelect: (promptIndex: number, mode: RewindMode) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 可选的样式类名 */
  className?: string;
}

/**
 * 截断文本用于预览
 */
const truncateText = (text: string, maxLength: number = 80): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * RevertPromptPicker 组件
 */
export const RevertPromptPicker: React.FC<RevertPromptPickerProps> = ({
  sessionId,
  projectId,
  projectPath = '',
  engine = 'claude',
  onSelect,
  onClose,
  className,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMode, setSelectedMode] = useState<RewindMode>('both');
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const isCodex = engine === 'codex';
  const isGemini = engine === 'gemini';

  // 🆕 文件变更预览状态
  const [fileChanges, setFileChanges] = useState<GitFileChange[]>([]);
  const [loadingFileChanges, setLoadingFileChanges] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);

  // 从后端加载准确的提示词列表
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        // 调用后端获取准确的提示词列表（包含正确的 index）
        const promptRecords = isCodex
          ? await api.getCodexPromptList(sessionId)
          : isGemini
          ? await api.getGeminiPromptList(sessionId, projectPath)
          : await api.getPromptList(sessionId, projectId);

        if (promptRecords.length === 0) {
          onClose();
          return;
        }

        // 转换为 PromptEntry 格式
        const promptEntries: PromptEntry[] = promptRecords.map((record) => ({
          index: record.index,  // 使用后端返回的准确索引
          content: record.text,
          preview: truncateText(record.text),
          source: record.source,
          loading: true,
        }));

        setPrompts(promptEntries);
      } catch (error) {
        logger.error('RevertPromptPicker', '[RevertPromptPicker] Failed to load prompts:', error);
        onClose();
      }
    };

    loadPrompts();
  }, [sessionId, projectId, projectPath, onClose, isCodex, isGemini]);

  // 异步加载每个提示词的撤回能力
  useEffect(() => {
    const loadCapabilities = async () => {
      for (const prompt of prompts) {
        if (prompt.loading && !prompt.capabilities) {
          try {
            const capabilities = isCodex
              ? await api.checkCodexRewindCapabilities(sessionId, prompt.index)
              : isGemini
              ? await api.checkGeminiRewindCapabilities(sessionId, projectPath, prompt.index)
              : await api.checkRewindCapabilities(
                  sessionId,
                  projectId,
                  prompt.index
                );

            setPrompts(prev =>
              prev.map(p =>
                p.index === prompt.index
                  ? { ...p, capabilities, loading: false }
                  : p
              )
            );
          } catch (error) {
            logger.error('RevertPromptPicker', `Failed to load capabilities for prompt #${prompt.index}:`, error);
            // 失败时设置默认能力（仅对话）
            setPrompts(prev =>
              prev.map(p =>
                p.index === prompt.index
                  ? {
                      ...p,
                      capabilities: {
                        conversation: true,
                        code: false,
                        both: false,
                        warning: '无法获取撤回能力信息',
                        source: 'cli',
                      },
                      loading: false,
                    }
                  : p
              )
            );
          }
        }
      }
    };

    if (prompts.length > 0) {
      loadCapabilities();
    }
  }, [prompts, sessionId, projectId, isCodex]);

  // 当前选中提示词的撤回能力
  const currentCapabilities = useMemo(() => {
    return prompts[selectedIndex]?.capabilities;
  }, [prompts, selectedIndex]);

  // 🆕 加载文件变更列表（当选择代码撤回模式时）
  const loadFileChanges = useCallback(async () => {
    const selectedPrompt = prompts[selectedIndex];
    if (!selectedPrompt || !currentCapabilities?.code) {
      setFileChanges([]);
      return;
    }

    // 只在代码撤回模式时加载文件变更
    if (selectedMode !== 'code_only' && selectedMode !== 'both') {
      setFileChanges([]);
      return;
    }

    setLoadingFileChanges(true);
    try {
      // 从 prompt 的 git 记录中获取 commit hash
      const promptRecords = isCodex
        ? await api.getCodexPromptList(sessionId)
        : isGemini
        ? await api.getGeminiPromptList(sessionId, projectPath)
        : await api.getPromptList(sessionId, projectId);

      const promptRecord = promptRecords.find(p => p.index === selectedPrompt.index);
      if (!promptRecord || !promptRecord.gitCommitBefore) {
        logger.warn('RevertPromptPicker', '[RevertPromptPicker] No git commit found for prompt', selectedPrompt.index);
        setFileChanges([]);
        return;
      }

      // 获取从撤回点到当前的文件变更
      const changes = await api.getGitChangedFiles(
        projectPath,
        promptRecord.gitCommitBefore,
        'HEAD' // 当前状态
      );

      setFileChanges(changes);
    } catch (error) {
      logger.error('RevertPromptPicker', '[RevertPromptPicker] Failed to load file changes:', error);
      setFileChanges([]);
    } finally {
      setLoadingFileChanges(false);
    }
  }, [selectedIndex, selectedMode, prompts, currentCapabilities, sessionId, projectId, projectPath, isCodex, isGemini]);

  // 当选择的提示词或模式变化时，加载文件变更
  useEffect(() => {
    if (showFilePreview) {
      loadFileChanges();
    }
  }, [selectedIndex, selectedMode, showFilePreview, loadFileChanges]);

  // 根据当前选中提示词的能力，自动调整选中的模式
  useEffect(() => {
    if (!currentCapabilities) return;

    // 如果当前模式不可用，自动切换到可用模式
    if (selectedMode === 'code_only' && !currentCapabilities.code) {
      setSelectedMode('conversation_only');
    } else if (selectedMode === 'both' && !currentCapabilities.both) {
      if (currentCapabilities.code) {
        setSelectedMode('code_only');
      } else {
        setSelectedMode('conversation_only');
      }
    }
  }, [currentCapabilities, selectedMode]);

  // 滚动到选中项
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;

        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prompts.length - 1, prev + 1));
          break;

        case 'Enter':
          e.preventDefault();
          if (prompts[selectedIndex] && currentCapabilities) {
            // 验证模式是否可用
            if (
              (selectedMode === 'conversation_only' && currentCapabilities.conversation) ||
              (selectedMode === 'code_only' && currentCapabilities.code) ||
              (selectedMode === 'both' && currentCapabilities.both)
            ) {
              onSelect(prompts[selectedIndex].index, selectedMode);
              onClose();
            }
          }
          break;

        case '1':
          e.preventDefault();
          if (currentCapabilities?.conversation) {
            setSelectedMode('conversation_only');
          }
          break;

        case '2':
          e.preventDefault();
          if (currentCapabilities?.code) {
            setSelectedMode('code_only');
          }
          break;

        case '3':
          e.preventDefault();
          if (currentCapabilities?.both) {
            setSelectedMode('both');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [prompts, selectedIndex, selectedMode, currentCapabilities, onSelect, onClose]);

  if (prompts.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
          className
        )}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "relative w-full max-h-[80vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col transition-all duration-300",
            showFilePreview ? "max-w-6xl" : "max-w-3xl"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                选择要撤回的提示词
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* 撤回模式选择 */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              撤回模式：
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => currentCapabilities?.conversation && setSelectedMode('conversation_only')}
                disabled={!currentCapabilities?.conversation}
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-md transition-colors',
                  selectedMode === 'conversation_only'
                    ? 'bg-blue-500 text-white'
                    : currentCapabilities?.conversation
                    ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                )}
              >
                <span className="font-mono text-xs mr-1">[1]</span>
                仅删除对话
              </button>
              <button
                onClick={() => currentCapabilities?.code && setSelectedMode('code_only')}
                disabled={!currentCapabilities?.code}
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-md transition-colors',
                  selectedMode === 'code_only'
                    ? 'bg-blue-500 text-white'
                    : currentCapabilities?.code
                    ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                )}
              >
                <span className="font-mono text-xs mr-1">[2]</span>
                仅回滚代码
              </button>
              <button
                onClick={() => currentCapabilities?.both && setSelectedMode('both')}
                disabled={!currentCapabilities?.both}
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-md transition-colors',
                  selectedMode === 'both'
                    ? 'bg-blue-500 text-white'
                    : currentCapabilities?.both
                    ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                )}
              >
                <span className="font-mono text-xs mr-1">[3]</span>
                对话 + 代码
              </button>

              {/* 🆕 文件预览切换按钮 */}
              <button
                onClick={() => {
                  setShowFilePreview(!showFilePreview);
                  if (!showFilePreview) {
                    loadFileChanges();
                  }
                }}
                disabled={!currentCapabilities?.code}
                className={cn(
                  'px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-1',
                  showFilePreview
                    ? 'bg-purple-500 text-white'
                    : currentCapabilities?.code
                    ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                )}
                title="查看将要回滚的文件变更"
              >
                <FileCode className="w-4 h-4" />
                <span className="hidden sm:inline">预览文件</span>
              </button>
            </div>

            {/* 警告信息 */}
            {currentCapabilities?.warning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {currentCapabilities.warning}
                </p>
              </motion.div>
            )}
          </div>

          {/* 主内容区域：提示词列表 + 文件预览 */}
          <div className="flex-1 overflow-hidden flex">
            {/* 左侧：提示词列表 */}
            <div
              ref={listRef}
              className={cn(
                "overflow-y-auto px-6 py-4 space-y-2 transition-all duration-300",
                showFilePreview ? "w-1/2" : "w-full"
              )}
            >
            {prompts.map((prompt, idx) => (
              <div
                key={prompt.index}
                ref={idx === selectedIndex ? selectedItemRef : null}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer transition-all',
                  idx === selectedIndex
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
                onClick={() => {
                  setSelectedIndex(idx);
                }}
                onDoubleClick={() => {
                  if (prompt.capabilities) {
                    // 双击时使用当前可用的最佳模式
                    let mode: RewindMode = 'conversation_only';
                    if (prompt.capabilities.both) {
                      mode = 'both';
                    } else if (prompt.capabilities.code) {
                      mode = 'code_only';
                    }
                    onSelect(prompt.index, mode);
                    onClose();
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        提示词 #{prompt.index + 1}
                      </span>

                      {/* 来源标记 */}
                      {prompt.capabilities && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
                            prompt.capabilities.source === 'project'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          )}
                        >
                          {prompt.capabilities.source === 'project' ? (
                            <>
                              <FolderGit2 className="w-3 h-3" />
                              项目
                            </>
                          ) : (
                            <>
                              <Terminal className="w-3 h-3" />
                              CLI
                            </>
                          )}
                        </span>
                      )}

                      <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 break-words">
                      {prompt.preview}
                    </p>

                    {/* 能力指示器 */}
                    {prompt.capabilities && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">可撤回：</span>
                        {prompt.capabilities.conversation && (
                          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            对话
                          </span>
                        )}
                        {prompt.capabilities.code && (
                          <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                            代码
                          </span>
                        )}
                      </div>
                    )}

                    {/* 加载中 */}
                    {prompt.loading && (
                      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        加载撤回能力...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            </div>

            {/* 右侧：文件变更预览面板 */}
            <AnimatePresence>
              {showFilePreview && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '50%', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
                >
                  {/* 文件预览标题 */}
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        文件变更预览
                      </span>
                      {fileChanges.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {fileChanges.length} 个文件
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowFilePreview(false)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  {/* 文件列表 */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {loadingFileChanges ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                        <span className="ml-2 text-sm text-gray-500">加载文件变更...</span>
                      </div>
                    ) : fileChanges.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-500">
                        {(selectedMode === 'code_only' || selectedMode === 'both')
                          ? '无文件变更'
                          : '请选择代码撤回模式查看文件变更'}
                      </div>
                    ) : (
                      fileChanges.map((file, idx) => (
                        <div
                          key={`${file.path}-${idx}`}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group"
                        >
                          {/* 变更类型图标 */}
                          {file.changeType === 'added' && (
                            <FilePlus className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          {file.changeType === 'deleted' && (
                            <FileX className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          {file.changeType === 'modified' && (
                            <FileEdit className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          {file.changeType === 'renamed' && (
                            <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          )}

                          {/* 文件路径 */}
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate" title={file.path}>
                            {file.oldPath ? (
                              <>
                                <span className="text-gray-400 line-through">{file.oldPath}</span>
                                <span className="mx-1 text-gray-400">→</span>
                                {file.path}
                              </>
                            ) : (
                              file.path
                            )}
                          </span>

                          {/* 行数变更 */}
                          <div className="flex items-center gap-1 text-xs flex-shrink-0">
                            {file.added > 0 && (
                              <span className="text-green-600 dark:text-green-400">+{file.added}</span>
                            )}
                            {file.removed > 0 && (
                              <span className="text-red-600 dark:text-red-400">-{file.removed}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 统计摘要 */}
                  {fileChanges.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          共 {fileChanges.length} 个文件
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-green-600 dark:text-green-400">
                            +{fileChanges.reduce((sum, f) => sum + f.added, 0)}
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            -{fileChanges.reduce((sum, f) => sum + f.removed, 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 底部提示 */}
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                <span className="font-mono">↑↓</span> 上下移动 |{' '}
                <span className="font-mono">Enter</span> 确认 |{' '}
                <span className="font-mono">ESC</span> 取消 |{' '}
                <span className="font-mono">1/2/3</span> 切换模式
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

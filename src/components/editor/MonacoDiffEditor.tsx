/**
 * MonacoDiffEditor - Monaco Diff 对比编辑器
 *
 * 功能：
 * 1. 并排对比代码变更
 * 2. 高亮显示新增/删除/修改
 * 3. 行号对齐
 * 4. 折叠未变更区域
 * 5. 一键接受/拒绝修改
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  FileCode,
  GitCompare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

// ============================================
// 类型定义
// ============================================

export interface DiffChange {
  startLineNumber: number;
  endLineNumber: number;
  changeType: 'insert' | 'delete' | 'modify';
  originalText?: string;
  modifiedText?: string;
}

export interface MonacoDiffEditorProps {
  /** 原始代码 */
  original: string;
  /** 修改后的代码 */
  modified: string;
  /** 文件路径（用于语言检测） */
  filePath?: string;
  /** 语言类型 */
  language?: string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否内联显示差异 */
  inline?: boolean;
  /** 接受修改回调 */
  onAccept?: (modifiedCode: string) => void;
  /** 拒绝修改回调 */
  onReject?: () => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 工具函数
// ============================================

/**
 * 从文件路径检测语言
 */
const detectLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();
  const mapping: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
    sh: 'shell'
  };
  return mapping[ext || ''] || 'plaintext';
};

/**
 * 计算差异统计
 */
const calculateDiffStats = (original: string, modified: string) => {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  let additions = 0;
  let deletions = 0;

  // 简单的行差异计算
  const maxLength = Math.max(originalLines.length, modifiedLines.length);
  for (let i = 0; i < maxLength; i++) {
    const origLine = originalLines[i] || '';
    const modLine = modifiedLines[i] || '';

    if (origLine !== modLine) {
      if (!origLine) additions++;
      else if (!modLine) deletions++;
      else {
        // 修改的行同时计入新增和删除
        additions++;
        deletions++;
      }
    }
  }

  return { additions, deletions, changes: additions + deletions };
};

// ============================================
// 主组件
// ============================================

export const MonacoDiffEditor: React.FC<MonacoDiffEditorProps> = ({
  original,
  modified,
  filePath,
  language: propLanguage,
  readOnly = false,
  inline = false,
  onAccept,
  onReject,
  className
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [currentModified, setCurrentModified] = useState(modified);

  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  // 确定语言
  const language = propLanguage || (filePath ? detectLanguageFromPath(filePath) : 'typescript');

  // 计算统计
  const stats = calculateDiffStats(original, currentModified);

  // 编辑器挂载
  const handleEditorMount = useCallback((editor: editor.IStandaloneDiffEditor) => {
    diffEditorRef.current = editor;

    // 配置编辑器选项
    const modifiedEditor = editor.getModifiedEditor();
    modifiedEditor.updateOptions({
      fontSize: 14,
      lineHeight: 22,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      readOnly,
      renderWhitespace: 'selection',
      renderLineHighlight: 'all'
    });

    const originalEditor = editor.getOriginalEditor();
    originalEditor.updateOptions({
      fontSize: 14,
      lineHeight: 22,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      readOnly: true,
      renderWhitespace: 'selection'
    });
  }, [readOnly]);

  // 修改后的代码变更
  const handleModifiedChange = useCallback((value: string | undefined) => {
    setCurrentModified(value || '');
  }, []);

  // 接受修改
  const handleAccept = useCallback(() => {
    onAccept?.(currentModified);
  }, [currentModified, onAccept]);

  // 拒绝修改
  const handleReject = useCallback(() => {
    setCurrentModified(original);
    onReject?.();
  }, [original, onReject]);

  // 复制修改后的代码
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(currentModified);
  }, [currentModified]);

  // 下载修改后的代码
  const handleDownload = useCallback(() => {
    const blob = new Blob([currentModified], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath?.split('/').pop() || 'modified.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [currentModified, filePath]);

  // 重置
  const handleReset = useCallback(() => {
    setCurrentModified(modified);
  }, [modified]);

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border rounded-lg overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">代码对比</span>
          </div>

          {filePath && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileCode className="w-3 h-3" />
              <span>{filePath.split('/').pop()}</span>
              <Badge variant="outline" className="text-[10px] ml-1">
                {language}
              </Badge>
            </div>
          )}

          {/* 统计信息 */}
          <AnimatePresence>
            {showStats && stats.changes > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 ml-2"
              >
                {stats.additions > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-300">
                    +{stats.additions}
                  </Badge>
                )}
                {stats.deletions > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-300">
                    -{stats.deletions}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {stats.changes} 处变更
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {onAccept && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 px-2 bg-green-600 hover:bg-green-700"
                    onClick={handleAccept}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    接受
                  </Button>
                </TooltipTrigger>
                <TooltipContent>接受所有修改</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {onReject && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleReject}
                  >
                    <X className="w-3 h-3 mr-1" />
                    拒绝
                  </Button>
                </TooltipTrigger>
                <TooltipContent>拒绝所有修改</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleReset}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重置修改</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleCopy}>
                  <Copy className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制修改后的代码</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleDownload}>
                  <Download className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载修改后的代码</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Diff 编辑器 */}
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          height="100%"
          language={language}
          original={original}
          modified={currentModified}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            renderSideBySide: !inline,
            readOnly,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'all',
            enableSplitViewResizing: true,
            renderOverviewRuler: true,
            diffWordWrap: 'on',
            ignoreTrimWhitespace: false,
            renderIndicators: true,
            originalEditable: false,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false
            }
          }}
        />
      </div>

      {/* 底部提示 */}
      {stats.changes === 0 && (
        <div className="px-4 py-2 border-t bg-muted/30 text-center text-sm text-muted-foreground">
          ✨ 没有检测到代码变更
        </div>
      )}
    </div>
  );
};

export default MonacoDiffEditor;

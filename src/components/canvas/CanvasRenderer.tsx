/**
 * CanvasRenderer - 实时代码渲染组件（Gemini 风格）
 *
 * 功能：
 * 1. 边写代码边实时预览
 * 2. 支持 HTML/React/Markdown/SVG
 * 3. Monaco Editor 代码编辑
 * 4. 分屏/全屏模式
 * 5. 错误捕获和展示
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Eye, SplitSquareHorizontal, Maximize2, Minimize2, Play, Download, Copy, Check, AlertCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

// Monaco Editor (动态导入)
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

// Markdown 渲染
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================
// 类型定义
// ============================================

export type CanvasMode = 'code' | 'preview' | 'split';
export type CanvasLanguage = 'html' | 'jsx' | 'tsx' | 'markdown' | 'svg' | 'javascript' | 'typescript';

export interface CanvasRendererProps {
  /** 初始代码 */
  initialCode?: string;
  /** 语言类型 */
  language: CanvasLanguage;
  /** 初始模式 */
  initialMode?: CanvasMode;
  /** 是否启用实时预览 */
  livePreview?: boolean;
  /** 代码变更回调 */
  onCodeChange?: (code: string) => void;
  /** 是否只读 */
  readOnly?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 工具函数
// ============================================

/**
 * 检测语言是否支持实时预览
 */
const supportsLivePreview = (lang: CanvasLanguage): boolean => {
  return ['html', 'jsx', 'tsx', 'markdown', 'svg'].includes(lang);
};

/**
 * 获取 Monaco 编辑器语言
 */
const getMonacoLanguage = (lang: CanvasLanguage): string => {
  const mapping: Record<CanvasLanguage, string> = {
    html: 'html',
    jsx: 'javascript',
    tsx: 'typescript',
    markdown: 'markdown',
    svg: 'xml',
    javascript: 'javascript',
    typescript: 'typescript'
  };
  return mapping[lang];
};

// ============================================
// 预览组件
// ============================================

interface PreviewPanelProps {
  code: string;
  language: CanvasLanguage;
  onError?: (error: Error) => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ code, language, onError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  // HTML 预览
  const renderHTML = useCallback(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc) return;

    try {
      // 完整的 HTML 文档
      const fullHTML = code.includes('<!DOCTYPE') ? code : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  ${code}
</body>
</html>
      `;

      doc.open();
      doc.write(fullHTML);
      doc.close();

      setError(null);
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
    }
  }, [code, onError]);

  // React JSX/TSX 预览
  const renderReact = useCallback(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc) return;

    try {
      // 使用 Babel standalone 编译 JSX
      const babelScript = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; }
    #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useCallback, useMemo } = React;

    ${code}

    // 假设最后一个组件是要渲染的
    const lastComponent = Object.values(window).find(v =>
      typeof v === 'function' && v.toString().includes('return')
    );

    if (lastComponent) {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(lastComponent));
    }
  </script>
</body>
</html>
      `;

      doc.open();
      doc.write(babelScript);
      doc.close();

      setError(null);
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
    }
  }, [code, onError]);

  // SVG 预览
  const renderSVG = useCallback(() => {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div dangerouslySetInnerHTML={{ __html: code }} />
      </div>
    );
  }, [code]);

  // Markdown 预览
  const renderMarkdown = useCallback(() => {
    return (
      <ScrollArea className="h-full">
        <div className="prose prose-neutral dark:prose-invert max-w-none p-6">
          <ReactMarkdown
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match;
                return !isInline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match[1]}
                    PreTag="div"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {code}
          </ReactMarkdown>
        </div>
      </ScrollArea>
    );
  }, [code]);

  // 根据语言类型渲染
  useEffect(() => {
    if (language === 'html') {
      renderHTML();
    } else if (language === 'jsx' || language === 'tsx') {
      renderReact();
    }
  }, [code, language, renderHTML, renderReact]);

  // 错误展示
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8 bg-red-50 dark:bg-red-900/20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">渲染错误</h3>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  // 根据语言选择渲染方式
  if (language === 'markdown') {
    return renderMarkdown();
  }

  if (language === 'svg') {
    return renderSVG();
  }

  // HTML/JSX/TSX 使用 iframe
  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white dark:bg-slate-950"
      title="Preview"
      sandbox="allow-scripts allow-same-origin allow-modals"
    />
  );
};

// ============================================
// 主组件
// ============================================

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  initialCode = '',
  language,
  initialMode = 'split',
  livePreview = true,
  onCodeChange,
  readOnly = false,
  className
}) => {
  const [code, setCode] = useState(initialCode);
  const [mode, setMode] = useState<CanvasMode>(initialMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoRun, setAutoRun] = useState(livePreview);
  const [previewCode, setPreviewCode] = useState(initialCode);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  // 是否支持预览
  const canPreview = supportsLivePreview(language);

  // 代码变更处理
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    onCodeChange?.(newCode);

    // 自动运行模式：防抖更新预览
    if (autoRun && canPreview) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        setPreviewCode(newCode);
      }, 500); // 500ms 防抖
    }
  }, [autoRun, canPreview, onCodeChange]);

  // 手动运行
  const handleRun = useCallback(() => {
    setPreviewCode(code);
  }, [code]);

  // 复制代码
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // 下载代码
  const handleDownload = useCallback(() => {
    const extensions: Record<CanvasLanguage, string> = {
      html: 'html',
      jsx: 'jsx',
      tsx: 'tsx',
      markdown: 'md',
      svg: 'svg',
      javascript: 'js',
      typescript: 'ts'
    };

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${extensions[language]}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, language]);

  // 编辑器挂载
  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // 设置编辑器选项
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 22,
      minimap: { enabled: mode !== 'split' },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      formatOnPaste: true,
      formatOnType: true
    });
  }, [mode]);

  // 清理
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

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
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {language.toUpperCase()} Canvas
          </span>

          {canPreview && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as CanvasMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="code" className="text-xs px-2 py-1">
                  <Code className="w-3 h-3 mr-1" />
                  代码
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs px-2 py-1">
                  <Eye className="w-3 h-3 mr-1" />
                  预览
                </TabsTrigger>
                <TabsTrigger value="split" className="text-xs px-2 py-1">
                  <SplitSquareHorizontal className="w-3 h-3 mr-1" />
                  分屏
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        <div className="flex items-center gap-1">
          {canPreview && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={autoRun ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setAutoRun(!autoRun)}
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      自动运行
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {autoRun ? '已启用自动预览' : '点击启用自动预览'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {!autoRun && (
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleRun}>
                  <Play className="w-3 h-3 mr-1" />
                  运行
                </Button>
              )}
            </>
          )}

          <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleCopy}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>

          <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleDownload}>
            <Download className="w-3 h-3" />
          </Button>

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

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 代码编辑器 */}
        <AnimatePresence mode="wait">
          {(mode === 'code' || mode === 'split') && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                'flex flex-col',
                mode === 'split' ? 'w-1/2 border-r' : 'w-full'
              )}
            >
              <Editor
                height="100%"
                language={getMonacoLanguage(language)}
                value={code}
                onChange={handleCodeChange}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  readOnly,
                  automaticLayout: true,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  glyphMargin: false,
                  folding: true,
                  lineDecorationsWidth: 10,
                  lineNumbersMinChars: 3,
                  renderLineHighlight: 'all',
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    useShadows: false
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 预览面板 */}
        <AnimatePresence mode="wait">
          {canPreview && (mode === 'preview' || mode === 'split') && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                'flex flex-col bg-white dark:bg-slate-950',
                mode === 'split' ? 'w-1/2' : 'w-full'
              )}
            >
              <PreviewPanel code={previewCode} language={language} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 不支持预览的提示 */}
        {!canPreview && mode === 'preview' && (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground">
            <div className="text-center">
              <Eye className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">该语言暂不支持实时预览</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasRenderer;

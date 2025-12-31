/**
 * Canvas 分屏面板 - Gemini 风格
 *
 * 功能：
 * 1. 实时代码预览（HTML/JSX/TSX/Markdown/SVG）
 * 2. Code / Preview 模式切换
 * 3. 可拖拽调整宽度
 * 4. 支持从聊天消息中提取代码
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Code, Eye, Maximize2, Minimize2, RefreshCw, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Editor from '@monaco-editor/react';

export interface CanvasPanelProps {
  isOpen: boolean;
  onClose: () => void;
  code?: string;
  language?: string;
  title?: string;
  onCodeChange?: (code: string) => void;
}

type ViewMode = 'code' | 'preview' | 'split';

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  isOpen,
  onClose,
  code: initialCode = '',
  language = 'html',
  title = 'Canvas',
  onCodeChange,
}) => {
  const [code, setCode] = useState(initialCode);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 当外部代码变化时更新
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  // 预览 HTML 内容（使用 srcdoc 而不是 Blob URL，避免 Tauri 安全限制）
  const [previewHtml, setPreviewHtml] = useState('');

  // 更新预览
  useEffect(() => {
    if (!code) return;

    try {
      setError(null);
      const html = generatePreviewHtml(code, language);
      setPreviewHtml(html);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览生成失败');
    }
  }, [code, language]);

  // 生成预览 HTML
  const generatePreviewHtml = (sourceCode: string, lang: string): string => {
    const baseStyles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          background: #0f0f0f;
          color: #e0e0e0;
          min-height: 100vh;
        }
        a { color: #60a5fa; }
        button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        button:hover { background: #2563eb; }
        input, textarea {
          background: #1f1f1f;
          border: 1px solid #333;
          color: #e0e0e0;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
        }
        h1, h2, h3 { color: #fff; margin-bottom: 16px; }
        p { line-height: 1.6; margin-bottom: 12px; }
        code {
          background: #1f1f1f;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', monospace;
        }
        pre {
          background: #1f1f1f;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
        }
      </style>
    `;

    if (lang === 'html' || lang === 'htm') {
      return sourceCode.includes('<html') ? sourceCode : `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseStyles}
        </head>
        <body>${sourceCode}</body>
        </html>
      `;
    }

    if (lang === 'jsx' || lang === 'tsx' || lang === 'javascript' || lang === 'typescript') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          ${baseStyles}
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            ${sourceCode}

            // 自动渲染 App 或默认导出
            const root = ReactDOM.createRoot(document.getElementById('root'));
            if (typeof App !== 'undefined') {
              root.render(<App />);
            } else if (typeof Component !== 'undefined') {
              root.render(<Component />);
            }
          </script>
        </body>
        </html>
      `;
    }

    if (lang === 'markdown' || lang === 'md') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          ${baseStyles}
          <style>
            body { max-width: 800px; margin: 0 auto; }
            img { max-width: 100%; }
            table { border-collapse: collapse; width: 100%; margin: 16px 0; }
            th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
            th { background: #1f1f1f; }
            blockquote { border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #888; }
          </style>
        </head>
        <body>
          <div id="content"></div>
          <script>
            document.getElementById('content').innerHTML = marked.parse(\`${sourceCode.replace(/`/g, '\\`')}\`);
          </script>
        </body>
        </html>
      `;
    }

    if (lang === 'svg') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          ${baseStyles}
          <style>
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            svg { max-width: 100%; max-height: 80vh; }
          </style>
        </head>
        <body>${sourceCode}</body>
        </html>
      `;
    }

    // 默认：显示代码
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyles}
      </head>
      <body>
        <pre><code>${sourceCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </body>
      </html>
    `;
  };

  // 复制代码
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 刷新预览
  const handleRefresh = () => {
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = currentSrc;
      }, 50);
    }
  };

  // 在新窗口打开
  const handleOpenExternal = () => {
    const html = generatePreviewHtml(code, language);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex flex-col bg-[#0f0f0f] border-l border-[#2a2a2a]",
        isFullscreen
          ? "fixed inset-0 z-50"
          : "h-full"
      )}
      style={{ width: isFullscreen ? '100%' : '50%', minWidth: '400px' }}
    >
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{title}</span>
          <span className="text-xs text-gray-500 bg-[#2a2a2a] px-2 py-0.5 rounded">
            {language.toUpperCase()}
          </span>
        </div>

        {/* 模式切换 */}
        <div className="flex items-center gap-1 bg-[#2a2a2a] rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('code')}
            className={cn(
              "h-7 px-3 text-xs rounded-md",
              viewMode === 'code'
                ? "bg-[#3a3a3a] text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Code size={14} className="mr-1" />
            Code
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('preview')}
            className={cn(
              "h-7 px-3 text-xs rounded-md",
              viewMode === 'preview'
                ? "bg-[#3a3a3a] text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Eye size={14} className="mr-1" />
            Preview
          </Button>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 text-gray-400 hover:text-white"
            title="复制代码"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-7 w-7 text-gray-400 hover:text-white"
            title="刷新预览"
          >
            <RefreshCw size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenExternal}
            className="h-7 w-7 text-gray-400 hover:text-white"
            title="在新窗口打开"
          >
            <ExternalLink size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-7 w-7 text-gray-400 hover:text-white"
            title={isFullscreen ? "退出全屏" : "全屏"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-red-500/20"
            title="关闭"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 代码编辑器 */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div className={cn("flex-1 overflow-hidden", viewMode === 'split' && "border-r border-[#2a2a2a]")}>
            <Editor
              height="100%"
              language={language === 'tsx' ? 'typescript' : language}
              value={code}
              onChange={(value) => {
                setCode(value || '');
                onCodeChange?.(value || '');
              }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                padding: { top: 12 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        )}

        {/* 预览区域 */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 bg-[#0a0a0a] overflow-hidden">
            {error ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-4 max-w-md">
                  <p className="font-medium mb-2">预览错误</p>
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0 bg-white"
                srcDoc={previewHtml}
                sandbox="allow-scripts allow-modals"
                title="Preview"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasPanel;

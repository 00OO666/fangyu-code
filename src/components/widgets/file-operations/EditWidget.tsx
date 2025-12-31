/**
 * ✅ Edit Widget - 文件编辑展示（Diff 视图）
 *
 * Performance Optimized Version
 */

import React, { useState, useMemo } from "react";
import { FileEdit, ChevronUp, ChevronDown, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import * as Diff from 'diff';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { getLanguage } from "../common/languageDetector";

export interface EditWidgetProps {
  /** 文件路径 */
  file_path: string;
  /** 旧字符串 */
  old_string: string;
  /** 新字符串 */
  new_string: string;
  /** 工具结果 */
  result?: any;
}

/**
 * 单行 Diff 渲染组件 - Memoized for Performance
 */
interface DiffLineProps {
  part: Diff.Change;
  language: string;
  theme: string; // 'dark' | 'light'
}

const DiffLine = React.memo(({ part, language, theme }: DiffLineProps) => {
  const partClass = part.added
    ? 'bg-green-500/15 dark:bg-green-500/20'
    : part.removed
    ? 'bg-red-500/15 dark:bg-red-500/20'
    : '';

  // 优化：如果是纯空白行，直接渲染 &nbsp;
  if (!part.value.trim() && part.value.length < 50) {
     return (
      <div className={cn(partClass, "flex w-full")}>
        <div className="w-8 select-none text-center flex-shrink-0 opacity-50">
          {part.added ? <span className="text-green-600 dark:text-green-400">+</span> : part.removed ? <span className="text-red-600 dark:text-red-400">-</span> : null}
        </div>
        <div className="flex-1 whitespace-pre">{part.value}</div>
      </div>
     );
  }

  // 移除末尾换行符，防止 SyntaxHighlighter 生成额外空行
  const value = part.value.endsWith('\n') ? part.value.slice(0, -1) : part.value;
  const isDark = theme === 'dark';
  const syntaxStyle = getClaudeSyntaxTheme(isDark);

  return (
    <div className={cn(partClass, "flex w-full")}>
      <div className="w-8 select-none text-center flex-shrink-0 opacity-50">
        {part.added ? <span className="text-green-600 dark:text-green-400">+</span> : part.removed ? <span className="text-red-600 dark:text-red-400">-</span> : null}
      </div>
      <div className="flex-1 min-w-0">
        <SyntaxHighlighter
          language={language}
          style={syntaxStyle}
          PreTag="div"
          wrapLongLines={false} // 性能优化：关闭自动换行计算
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            overflow: 'visible' // 允许容器控制滚动
          }}
          codeTagProps={{
            style: {
              fontSize: '0.8rem',
              lineHeight: '1.6',
              fontFamily: 'var(--font-mono, monospace)'
            }
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}, (prev, next) => {
  // 自定义比较函数：只在内容或主题改变时重绘
  return prev.part.value === next.part.value && 
         prev.part.added === next.part.added && 
         prev.part.removed === next.part.removed &&
         prev.theme === next.theme;
});

DiffLine.displayName = 'DiffLine';

/**
 * 文件编辑 Widget
 */
export const EditWidget: React.FC<EditWidgetProps> = ({
  file_path,
  old_string,
  new_string,
  result,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  // 性能优化：使用 useMemo 缓存 Diff 计算结果
  const { diffResult, stats, language } = useMemo(() => {
    const diff = Diff.diffLines(old_string || '', new_string || '', {
      newlineIsToken: true,
      ignoreWhitespace: false
    });
    
    const lang = getLanguage(file_path);
    
    const s = diff.reduce((acc, part) => {
      if (part.added) acc.added += part.count || 0;
      if (part.removed) acc.removed += part.count || 0;
      return acc;
    }, { added: 0, removed: 0 });

    return { diffResult: diff, stats: s, language: lang };
  }, [old_string, new_string, file_path]);

  const hasResult = result !== undefined;
  const isError = result?.is_error;
  
  const statusIcon = hasResult
    ? isError
      ? <XCircle className="h-3.5 w-3.5 text-red-500" />
      : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    : <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;

  const statusColor = hasResult ? (isError ? 'text-red-500' : 'text-green-500') : 'text-blue-500';

  // 大文件保护：如果 Diff 块超过 200 个，可能影响性能
  const isLargeDiff = diffResult.length > 200;

  return (
    <div className="space-y-2 w-full">
      <div className="ml-1 space-y-2">
        {/* Header */}
        <div 
          className="flex items-center justify-between bg-muted/30 p-2.5 rounded-md border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group/header select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileEdit className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-sm font-medium text-muted-foreground">Edit</span>
              <span className="text-muted-foreground/30">|</span>
              <code className="text-sm font-mono text-foreground/90 truncate font-medium" title={file_path}>
                {file_path.split(/[/\\]/).pop()}
              </code>
            </div>
            
            {/* Diff Stats */}
            <div className="flex items-center gap-3 text-xs font-mono font-medium">
              <div className="flex items-center gap-2">
                {stats.added > 0 && (
                  <span className="text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                    +{stats.added}
                  </span>
                )}
                {stats.removed > 0 && (
                  <span className="text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                    -{stats.removed}
                  </span>
                )}
              </div>
              
              {/* Status Badge */}
              <div className="flex items-center gap-1">
                {statusIcon}
                {hasResult && (
                  <span className={cn("font-medium hidden sm:inline", statusColor)}>
                    {isError ? '失败' : '成功'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="h-6 px-2 ml-2 text-muted-foreground group-hover/header:text-foreground flex items-center gap-1 transition-colors">
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </div>
        </div>

        {/* Diff View */}
        {isExpanded && (
          <div className="rounded-lg border overflow-hidden text-xs font-mono mt-2 bg-muted border-border/50">
            <div className="max-h-[440px] overflow-y-auto overflow-x-auto scrollbar-thin">
              {isLargeDiff && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-secondary/30 border-b border-border/50">
                  ⚠️ 文件变动较大，已启用性能模式
                </div>
              )}
              
              {diffResult.map((part, index) => {
                // Smart collapse for unchanged lines > 8
                if (!part.added && !part.removed && part.count && part.count > 8) {
                  return (
                    <div key={index} className="px-4 py-1 border-y text-center text-[10px] bg-secondary/50 border-border/50 text-muted-foreground select-none">
                      ... {part.count} 未更改的行 ...
                    </div>
                  );
                }

                return (
                  <DiffLine 
                    key={index} 
                    part={part} 
                    language={language} 
                    theme={theme} 
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
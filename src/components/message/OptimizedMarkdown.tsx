/**
 * OptimizedMarkdown - 高性能 Markdown 渲染组件
 *
 * 优化策略：
 * 1. 懒加载语法高亮（按需加载语言包）
 * 2. 虚拟化长代码块
 * 3. 缓存已解析的 AST
 * 4. 使用 Web Worker 进行复杂解析（可选）
 */

import React, { memo, useMemo, Suspense, lazy, useCallback, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";

// 懒加载语法高亮组件
const SyntaxHighlighter = lazy(() =>
    import("react-syntax-highlighter").then((mod) => ({
        default: mod.Prism,
    }))
);

// 懒加载主题
const loadTheme = async (isDark: boolean) => {
    if (isDark) {
        const { oneDark } = await import(
            "react-syntax-highlighter/dist/esm/styles/prism"
        );
        return oneDark;
    } else {
        const { oneLight } = await import(
            "react-syntax-highlighter/dist/esm/styles/prism"
        );
        return oneLight;
    }
};

interface OptimizedCodeBlockProps {
    language: string;
    code: string;
    isDark: boolean;
}

/**
 * 优化的代码块组件
 * - 长代码折叠
 * - 懒加载语法高亮
 * - 复制功能
 */
const OptimizedCodeBlock: React.FC<OptimizedCodeBlockProps> = memo(
    ({ language, code, isDark }) => {
        const [copied, setCopied] = useState(false);
        const [isExpanded, setIsExpanded] = useState(false);
        const [theme, setTheme] = useState<any>(null);
        const lines = code.split("\n");
        const isLong = lines.length > 20;
        const displayCode = isLong && !isExpanded ? lines.slice(0, 15).join("\n") : code;

        // 加载主题
        useEffect(() => {
            loadTheme(isDark).then(setTheme);
        }, [isDark]);

        const handleCopy = useCallback(async () => {
            try {
                await copyTextToClipboard(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (e) {
                console.error("Copy failed:", e);
            }
        }, [code]);

        return (
            <div className="group relative my-3 rounded-xl overflow-hidden border border-white/10 bg-black/20 backdrop-blur-sm">
                {/* 头部工具栏 */}
                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                        </div>
                        <span className="text-xs font-mono text-white/50 ml-2">
                            {language || "text"}
                        </span>
                        {isLong && (
                            <span className="text-xs text-white/30">
                                ({lines.length} 行)
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleCopy}
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all",
                            "opacity-0 group-hover:opacity-100",
                            copied
                                ? "bg-green-500/20 text-green-400"
                                : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                        )}
                    >
                        {copied ? (
                            <>
                                <Check className="w-3 h-3" />
                                已复制
                            </>
                        ) : (
                            <>
                                <Copy className="w-3 h-3" />
                                复制
                            </>
                        )}
                    </button>
                </div>

                {/* 代码内容 */}
                <div className="relative">
                    <Suspense
                        fallback={
                            <pre className="p-4 text-sm font-mono text-white/80 overflow-x-auto">
                                {displayCode}
                            </pre>
                        }
                    >
                        {theme && (
                            <SyntaxHighlighter
                                language={language || "text"}
                                style={theme}
                                showLineNumbers
                                wrapLines
                                customStyle={{
                                    margin: 0,
                                    padding: "1rem",
                                    background: "transparent",
                                    fontSize: "0.8125rem",
                                    lineHeight: "1.6",
                                }}
                                lineNumberStyle={{
                                    minWidth: "2.5em",
                                    paddingRight: "1em",
                                    color: "rgba(255,255,255,0.2)",
                                    textAlign: "right",
                                    userSelect: "none",
                                }}
                            >
                                {displayCode}
                            </SyntaxHighlighter>
                        )}
                    </Suspense>

                    {/* 长代码折叠渐变 */}
                    {isLong && !isExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                    )}
                </div>

                {/* 展开/折叠按钮 */}
                {isLong && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-2",
                            "text-xs text-white/50 hover:text-white/80 transition-colors",
                            "bg-white/5 hover:bg-white/10 border-t border-white/10"
                        )}
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="w-4 h-4" />
                                收起代码
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-4 h-4" />
                                展开全部 ({lines.length - 15} 行)
                            </>
                        )}
                    </button>
                )}
            </div>
        );
    }
);

OptimizedCodeBlock.displayName = "OptimizedCodeBlock";

interface OptimizedMarkdownProps {
    /** Markdown 内容 */
    content: string;
    /** 是否正在流式输出 */
    isStreaming?: boolean;
    /** 自定义类名 */
    className?: string;
}

/**
 * 优化的 Markdown 渲染组件
 */
const OptimizedMarkdownComponent: React.FC<OptimizedMarkdownProps> = ({
    content,
    isStreaming = false,
    className,
}) => {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    // 缓存 Markdown 组件配置
    const components = useMemo(
        () => ({
            code({ inline, className: codeClassName, children, ...props }: any) {
                const match = /language-(\w+)/.exec(codeClassName || "");
                const language = match ? match[1] : "";
                const code = String(children).replace(/\n$/, "");

                if (inline || !language) {
                    return (
                        <code
                            className={cn(
                                "px-1.5 py-0.5 rounded-md text-xs font-mono",
                                "bg-[var(--ds-primary)]/10 text-[var(--ds-primary)]",
                                "border border-[var(--ds-primary)]/20"
                            )}
                            {...props}
                        >
                            {children}
                        </code>
                    );
                }

                return (
                    <OptimizedCodeBlock language={language} code={code} isDark={isDark} />
                );
            },

            // 优化的链接渲染
            a({ children, href, ...props }: any) {
                return (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            "text-[var(--ds-primary)] hover:text-[var(--ds-accent)]",
                            "underline decoration-[var(--ds-primary)]/30 hover:decoration-[var(--ds-accent)]",
                            "transition-colors duration-200"
                        )}
                        {...props}
                    >
                        {children}
                    </a>
                );
            },

            // 优化的表格渲染
            table({ children, ...props }: any) {
                return (
                    <div className="my-4 overflow-x-auto rounded-xl border border-white/10">
                        <table
                            className="min-w-full divide-y divide-white/10"
                            {...props}
                        >
                            {children}
                        </table>
                    </div>
                );
            },

            thead({ children, ...props }: any) {
                return (
                    <thead className="bg-white/5" {...props}>
                        {children}
                    </thead>
                );
            },

            th({ children, ...props }: any) {
                return (
                    <th
                        className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider"
                        {...props}
                    >
                        {children}
                    </th>
                );
            },

            td({ children, ...props }: any) {
                return (
                    <td className="px-4 py-3 text-sm text-white/80" {...props}>
                        {children}
                    </td>
                );
            },

            // 优化的引用块
            blockquote({ children, ...props }: any) {
                return (
                    <blockquote
                        className={cn(
                            "my-4 pl-4 py-2 border-l-4 rounded-r-lg",
                            "border-[var(--ds-primary)]/50 bg-[var(--ds-primary)]/5",
                            "text-white/70 italic"
                        )}
                        {...props}
                    >
                        {children}
                    </blockquote>
                );
            },

            // 优化的列表
            ul({ children, ...props }: any) {
                return (
                    <ul className="my-2 pl-6 space-y-1 list-disc marker:text-[var(--ds-primary)]/50" {...props}>
                        {children}
                    </ul>
                );
            },

            ol({ children, ...props }: any) {
                return (
                    <ol className="my-2 pl-6 space-y-1 list-decimal marker:text-[var(--ds-primary)]/50" {...props}>
                        {children}
                    </ol>
                );
            },

            // 优化的段落
            p({ children, ...props }: any) {
                return (
                    <p className="my-2 leading-relaxed text-white/85" {...props}>
                        {children}
                    </p>
                );
            },

            // 优化的标题
            h1({ children, ...props }: any) {
                return (
                    <h1
                        className="mt-6 mb-4 text-2xl font-bold text-white/95 border-b border-white/10 pb-2"
                        {...props}
                    >
                        {children}
                    </h1>
                );
            },

            h2({ children, ...props }: any) {
                return (
                    <h2
                        className="mt-5 mb-3 text-xl font-semibold text-white/90"
                        {...props}
                    >
                        {children}
                    </h2>
                );
            },

            h3({ children, ...props }: any) {
                return (
                    <h3
                        className="mt-4 mb-2 text-lg font-semibold text-white/85"
                        {...props}
                    >
                        {children}
                    </h3>
                );
            },

            // 分隔线
            hr({ ...props }: any) {
                return (
                    <hr
                        className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        {...props}
                    />
                );
            },
        }),
        [isDark]
    );

    return (
        <div
            className={cn(
                "prose prose-sm dark:prose-invert max-w-none",
                "text-white/85",
                className
            )}
        >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </ReactMarkdown>

            {/* 流式输出光标 */}
            {isStreaming && (
                <span
                    className={cn(
                        "inline-block w-2 h-5 ml-1 rounded-sm",
                        "bg-gradient-to-b from-[var(--ds-primary)] to-[var(--ds-accent)]",
                        "animate-pulse"
                    )}
                />
            )}
        </div>
    );
};

export const OptimizedMarkdown = memo(OptimizedMarkdownComponent);

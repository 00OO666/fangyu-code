/**
 * 轻量级语法高亮配置
 *
 * 策略：
 * 1. 使用 light 版本的 Prism（不包含所有语言）
 * 2. 只注册最常用的语言（~200KB vs ~1.6MB）
 * 3. 其他语言降级为纯文本显示
 *
 * 预计节省：~1.4 MB (gzip: ~450 KB)
 */

import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/light";

// 只导入最常用的语言
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import html from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import xml from "react-syntax-highlighter/dist/esm/languages/prism/markup";

// 注册语言
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("rs", rust);
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("golang", go);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("c++", cpp);
SyntaxHighlighter.registerLanguage("c", c);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("yml", yaml);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("md", markdown);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("html", html);
SyntaxHighlighter.registerLanguage("xml", xml);

// 支持的语言列表
export const SUPPORTED_LANGUAGES = new Set([
  "javascript",
  "js",
  "typescript",
  "ts",
  "jsx",
  "tsx",
  "python",
  "py",
  "rust",
  "rs",
  "go",
  "golang",
  "java",
  "cpp",
  "c++",
  "c",
  "bash",
  "sh",
  "shell",
  "json",
  "yaml",
  "yml",
  "markdown",
  "md",
  "sql",
  "css",
  "html",
  "xml",
]);

/**
 * 检查语言是否被支持
 */
export function isLanguageSupported(language: string): boolean {
  return SUPPORTED_LANGUAGES.has(language.toLowerCase());
}

/**
 * 规范化语言名称
 */
export function normalizeLanguage(language: string): string {
  const normalized = language.toLowerCase();
  if (SUPPORTED_LANGUAGES.has(normalized)) {
    return normalized;
  }
  // 降级为 text
  return "text";
}

export { SyntaxHighlighter, SyntaxHighlighter as Prism };
export default SyntaxHighlighter;

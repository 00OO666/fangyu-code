/**
 * ASTGrepTools - AST-Grep 工具封装
 *
 * 封装 AST-Grep 的 search 和 replace 方法
 *
 * Requirements: 3.2
 */

import { ASTMatch, Range } from "../types/unified-agent";

// 支持的语言列表
export const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "python",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "csharp",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "lua",
  "html",
  "css",
  "json",
  "yaml",
  "toml",
  "markdown",
  "sql",
  "bash",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// 替换结果
export interface ReplaceResult {
  success: boolean;
  matchCount: number;
  replacedCount: number;
  changes: Array<{
    file: string;
    original: string;
    replaced: string;
    range: Range;
  }>;
  error?: string;
}

// AST-Grep 执行器接口（用于依赖注入）
export interface ASTGrepExecutor {
  search(pattern: string, lang: string, path?: string): Promise<ASTMatch[]>;
  replace(pattern: string, replacement: string, path: string, lang: string): Promise<ReplaceResult>;
}

// Mock AST-Grep 执行器（用于测试）
export class MockASTGrepExecutor implements ASTGrepExecutor {
  private searchResults: Map<string, ASTMatch[]> = new Map();
  private fileContents: Map<string, string> = new Map();

  setSearchResult(pattern: string, lang: string, results: ASTMatch[]): void {
    this.searchResults.set(`${pattern}:${lang}`, results);
  }

  setFileContent(path: string, content: string): void {
    this.fileContents.set(path, content);
  }

  async search(pattern: string, lang: string, path?: string): Promise<ASTMatch[]> {
    const results = this.searchResults.get(`${pattern}:${lang}`) ?? [];
    if (path) {
      return results.filter((r) => r.file === path || r.file.startsWith(path));
    }
    return results;
  }

  async replace(
    pattern: string,
    replacement: string,
    path: string,
    lang: string
  ): Promise<ReplaceResult> {
    const matches = await this.search(pattern, lang, path);

    if (matches.length === 0) {
      return {
        success: true,
        matchCount: 0,
        replacedCount: 0,
        changes: [],
      };
    }

    const changes: ReplaceResult["changes"] = [];

    for (const match of matches) {
      changes.push({
        file: match.file,
        original: match.text,
        replaced: this.applyReplacement(match.text, replacement, match.captures),
        range: match.range,
      });
    }

    return {
      success: true,
      matchCount: matches.length,
      replacedCount: changes.length,
      changes,
    };
  }

  private applyReplacement(
    original: string,
    replacement: string,
    captures?: Record<string, string>
  ): string {
    if (!captures) return replacement;

    let result = replacement;
    for (const [key, value] of Object.entries(captures)) {
      result = result.replace(new RegExp(`\\$${key}`, "g"), value);
    }
    return result;
  }
}

/**
 * ASTGrepTools 类
 */
export class ASTGrepTools {
  private executor: ASTGrepExecutor;
  private workspaceRoot: string;

  constructor(workspaceRoot: string, executor?: ASTGrepExecutor) {
    this.workspaceRoot = workspaceRoot;
    this.executor = executor ?? new MockASTGrepExecutor();
  }

  /**
   * 搜索 AST 模式
   */
  async search(pattern: string, lang: string, path?: string): Promise<ASTMatch[]> {
    this.validateLanguage(lang);

    const searchPath = path ? this.resolvePath(path) : this.workspaceRoot;
    return this.executor.search(pattern, lang, searchPath);
  }

  /**
   * 替换 AST 模式
   */
  async replace(
    pattern: string,
    replacement: string,
    path: string,
    lang: string
  ): Promise<ReplaceResult> {
    this.validateLanguage(lang);

    const fullPath = this.resolvePath(path);
    return this.executor.replace(pattern, replacement, fullPath, lang);
  }

  /**
   * 获取支持的语言列表
   */
  supportedLanguages(): string[] {
    return [...SUPPORTED_LANGUAGES];
  }

  /**
   * 检查语言是否支持
   */
  isLanguageSupported(lang: string): boolean {
    return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
  }

  /**
   * 根据文件扩展名推断语言
   */
  inferLanguage(filePath: string): string | null {
    const ext = filePath.split(".").pop()?.toLowerCase();

    const extToLang: Record<string, string> = {
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      c: "c",
      cpp: "cpp",
      cc: "cpp",
      cxx: "cpp",
      cs: "csharp",
      rb: "ruby",
      php: "php",
      swift: "swift",
      kt: "kotlin",
      scala: "scala",
      lua: "lua",
      html: "html",
      htm: "html",
      css: "css",
      scss: "css",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      toml: "toml",
      md: "markdown",
      sql: "sql",
      sh: "bash",
      bash: "bash",
    };

    return ext ? (extToLang[ext] ?? null) : null;
  }

  /**
   * 搜索并返回格式化结果
   */
  async searchFormatted(pattern: string, lang: string, path?: string): Promise<string> {
    const matches = await this.search(pattern, lang, path);

    if (matches.length === 0) {
      return `No matches found for pattern: ${pattern}`;
    }

    const lines: string[] = [`Found ${matches.length} match(es):`];

    for (const match of matches) {
      lines.push(`\n${match.file}:${match.range.start.line}:${match.range.start.character}`);
      lines.push(`  ${match.text}`);

      if (match.captures && Object.keys(match.captures).length > 0) {
        lines.push("  Captures:");
        for (const [key, value] of Object.entries(match.captures)) {
          lines.push(`    $${key}: ${value}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * 验证语言
   */
  private validateLanguage(lang: string): void {
    if (!this.isLanguageSupported(lang)) {
      throw new Error(
        `Unsupported language: ${lang}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`
      );
    }
  }

  /**
   * 解析路径
   */
  private resolvePath(path: string): string {
    if (path.startsWith("/") || path.match(/^[A-Za-z]:/)) {
      return path;
    }
    return `${this.workspaceRoot}/${path}`;
  }
}

export default ASTGrepTools;

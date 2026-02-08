/**
 * ReferenceResolver - #引用解析器
 *
 * 实现 #File、#Folder、#Problems、#Terminal、#Git Diff、#Codebase 解析
 *
 * Requirements: 10.1-10.7
 */

import { ReferenceType, Reference, Diagnostic } from "../types/unified-agent";

// 引用解析结果
export interface ResolvedReference {
  type: ReferenceType;
  target: string;
  content: string;
  tokens: number;
  metadata?: Record<string, unknown>;
}

// 解析选项
export interface ResolveOptions {
  maxTokens?: number;
  includeLineNumbers?: boolean;
  recursive?: boolean;
  maxDepth?: number;
}

// 文件系统接口（用于依赖注入）
export interface FileSystem {
  readFile(path: string): Promise<string>;
  readDir(path: string): Promise<string[]>;
  stat(path: string): Promise<{ isDirectory: boolean; size: number }>;
  exists(path: string): Promise<boolean>;
}

// 诊断提供者接口
export interface DiagnosticsProvider {
  getDiagnostics(files: string[]): Promise<Diagnostic[]>;
}

// 终端提供者接口
export interface TerminalProvider {
  getOutput(lines?: number): Promise<string>;
}

// Git 提供者接口
export interface GitProvider {
  getDiff(): Promise<string>;
  getStatus(): Promise<string>;
}

// 代码库搜索提供者接口
export interface CodebaseProvider {
  search(query: string): Promise<Array<{ file: string; line: number; content: string }>>;
}

// 默认文件系统实现（Node.js 风格，实际使用时需要 Tauri 实现）
export class DefaultFileSystem implements FileSystem {
  async readFile(_path: string): Promise<string> {
    // 在浏览器/Tauri 环境中，这需要通过 IPC 调用
    throw new Error("FileSystem not implemented. Use Tauri IPC.");
  }

  async readDir(_path: string): Promise<string[]> {
    throw new Error("FileSystem not implemented. Use Tauri IPC.");
  }

  async stat(_path: string): Promise<{ isDirectory: boolean; size: number }> {
    throw new Error("FileSystem not implemented. Use Tauri IPC.");
  }

  async exists(_path: string): Promise<boolean> {
    throw new Error("FileSystem not implemented. Use Tauri IPC.");
  }
}

/**
 * 估算 token 数量
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

/**
 * 解析 #引用字符串
 */
export function parseReference(ref: string): Reference | null {
  const trimmed = ref.trim();

  // #File:path/to/file
  if (trimmed.startsWith("#File:") || trimmed.startsWith("#file:")) {
    return {
      type: "file",
      target: trimmed.slice(6).trim(),
    };
  }

  // #Folder:path/to/folder
  if (trimmed.startsWith("#Folder:") || trimmed.startsWith("#folder:")) {
    return {
      type: "folder",
      target: trimmed.slice(8).trim(),
    };
  }

  // #Problems 或 #Problems:path
  if (trimmed.startsWith("#Problems") || trimmed.startsWith("#problems")) {
    const colonIndex = trimmed.indexOf(":");
    return {
      type: "problems",
      target: colonIndex > 0 ? trimmed.slice(colonIndex + 1).trim() : "",
    };
  }

  // #Terminal 或 #Terminal:lines
  if (trimmed.startsWith("#Terminal") || trimmed.startsWith("#terminal")) {
    const colonIndex = trimmed.indexOf(":");
    return {
      type: "terminal",
      target: colonIndex > 0 ? trimmed.slice(colonIndex + 1).trim() : "100",
    };
  }

  // #Git Diff 或 #GitDiff
  if (
    trimmed.startsWith("#Git Diff") ||
    trimmed.startsWith("#GitDiff") ||
    trimmed.startsWith("#git diff") ||
    trimmed.startsWith("#gitdiff")
  ) {
    return {
      type: "gitDiff",
      target: "",
    };
  }

  // #Codebase:query
  if (trimmed.startsWith("#Codebase:") || trimmed.startsWith("#codebase:")) {
    return {
      type: "codebase",
      target: trimmed.slice(10).trim(),
    };
  }

  return null;
}

/**
 * ReferenceResolver 类
 */
export class ReferenceResolver {
  private fs: FileSystem;
  private diagnostics?: DiagnosticsProvider;
  private terminal?: TerminalProvider;
  private git?: GitProvider;
  private codebase?: CodebaseProvider;
  private workspaceRoot: string;

  constructor(
    workspaceRoot: string,
    options?: {
      fs?: FileSystem;
      diagnostics?: DiagnosticsProvider;
      terminal?: TerminalProvider;
      git?: GitProvider;
      codebase?: CodebaseProvider;
    }
  ) {
    this.workspaceRoot = workspaceRoot;
    this.fs = options?.fs ?? new DefaultFileSystem();
    this.diagnostics = options?.diagnostics;
    this.terminal = options?.terminal;
    this.git = options?.git;
    this.codebase = options?.codebase;
  }

  /**
   * 解析引用字符串
   */
  async resolve(ref: string, options?: ResolveOptions): Promise<ResolvedReference | null> {
    const parsed = parseReference(ref);
    if (!parsed) {
      return null;
    }

    return this.resolveReference(parsed, options);
  }

  /**
   * 解析 Reference 对象
   */
  async resolveReference(
    ref: Reference,
    options?: ResolveOptions
  ): Promise<ResolvedReference | null> {
    switch (ref.type) {
      case "file":
        return this.resolveFile(ref.target, options);
      case "folder":
        return this.resolveFolder(ref.target, options);
      case "problems":
        return this.resolveProblems(ref.target, options);
      case "terminal":
        return this.resolveTerminal(ref.target, options);
      case "gitDiff":
        return this.resolveGitDiff(options);
      case "codebase":
        return this.resolveCodebase(ref.target, options);
      default:
        return null;
    }
  }

  /**
   * 解析 #File 引用
   */
  private async resolveFile(path: string, options?: ResolveOptions): Promise<ResolvedReference> {
    const fullPath = this.resolvePath(path);

    try {
      const content = await this.fs.readFile(fullPath);
      let result = content;

      if (options?.includeLineNumbers) {
        result = content
          .split("\n")
          .map((line, i) => `${i + 1}: ${line}`)
          .join("\n");
      }

      // 截断到最大 token
      const tokens = estimateTokens(result);
      if (options?.maxTokens && tokens > options.maxTokens) {
        result = this.truncateToTokens(result, options.maxTokens);
      }

      return {
        type: "file",
        target: path,
        content: result,
        tokens: estimateTokens(result),
        metadata: { fullPath },
      };
    } catch (error) {
      return {
        type: "file",
        target: path,
        content: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokens: 10,
        metadata: { error: true },
      };
    }
  }

  /**
   * 解析 #Folder 引用
   */
  private async resolveFolder(path: string, options?: ResolveOptions): Promise<ResolvedReference> {
    const fullPath = this.resolvePath(path);
    const maxDepth = options?.maxDepth ?? 3;
    const recursive = options?.recursive ?? true;

    try {
      const tree = await this.buildDirectoryTree(fullPath, 0, maxDepth, recursive);
      const content = this.formatDirectoryTree(tree, path);

      return {
        type: "folder",
        target: path,
        content,
        tokens: estimateTokens(content),
        metadata: { fullPath, depth: maxDepth },
      };
    } catch (error) {
      return {
        type: "folder",
        target: path,
        content: `Error reading folder: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokens: 10,
        metadata: { error: true },
      };
    }
  }

  /**
   * 解析 #Problems 引用
   */
  private async resolveProblems(
    target: string,
    _options?: ResolveOptions
  ): Promise<ResolvedReference> {
    if (!this.diagnostics) {
      return {
        type: "problems",
        target,
        content: "Diagnostics provider not configured",
        tokens: 5,
        metadata: { error: true },
      };
    }

    try {
      const files = target ? [this.resolvePath(target)] : [];
      const diagnostics = await this.diagnostics.getDiagnostics(files);

      if (diagnostics.length === 0) {
        return {
          type: "problems",
          target,
          content: "No problems found",
          tokens: 3,
          metadata: { count: 0 },
        };
      }

      const content = diagnostics
        .map(
          (d) =>
            `${d.file}:${d.range.start.line}:${d.range.start.character} - ${d.severity}: ${d.message}`
        )
        .join("\n");

      return {
        type: "problems",
        target,
        content,
        tokens: estimateTokens(content),
        metadata: { count: diagnostics.length },
      };
    } catch (error) {
      return {
        type: "problems",
        target,
        content: `Error getting diagnostics: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokens: 10,
        metadata: { error: true },
      };
    }
  }

  /**
   * 解析 #Terminal 引用
   */
  private async resolveTerminal(
    target: string,
    _options?: ResolveOptions
  ): Promise<ResolvedReference> {
    if (!this.terminal) {
      return {
        type: "terminal",
        target,
        content: "Terminal provider not configured",
        tokens: 5,
        metadata: { error: true },
      };
    }

    try {
      const lines = parseInt(target) || 100;
      const content = await this.terminal.getOutput(lines);

      return {
        type: "terminal",
        target,
        content,
        tokens: estimateTokens(content),
        metadata: { lines },
      };
    } catch (error) {
      return {
        type: "terminal",
        target,
        content: `Error getting terminal output: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokens: 10,
        metadata: { error: true },
      };
    }
  }

  /**
   * 解析 #Git Diff 引用
   */
  private async resolveGitDiff(options?: ResolveOptions): Promise<ResolvedReference> {
    if (!this.git) {
      return {
        type: "gitDiff",
        target: "",
        content: "Git provider not configured",
        tokens: 5,
        metadata: { error: true },
      };
    }

    try {
      const diff = await this.git.getDiff();

      if (!diff || diff.trim() === "") {
        return {
          type: "gitDiff",
          target: "",
          content: "No changes detected",
          tokens: 3,
          metadata: { hasChanges: false },
        };
      }

      let content = diff;
      if (options?.maxTokens) {
        const tokens = estimateTokens(content);
        if (tokens > options.maxTokens) {
          content = this.truncateToTokens(content, options.maxTokens);
        }
      }

      return {
        type: "gitDiff",
        target: "",
        content,
        tokens: estimateTokens(content),
        metadata: { hasChanges: true },
      };
    } catch (error) {
      return {
        type: "gitDiff",
        target: "",
        content: `Error getting git diff: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokens: 10,
        metadata: { error: true },
      };
    }
  }

  /**
   * 解析 #Codebase 引用
   */
  private async resolveCodebase(
    query: string,
    options?: ResolveOptions
  ): Promise<ResolvedReference> {
    if (!this.codebase) {
      return {
        type: "codebase",
        target: query,
        content: "Codebase provider not configured",
        tokens: 5,
        metadata: { error: true },
      };
    }

    if (!query || query.trim() === "") {
      return {
        type: "codebase",
        target: query,
        content: "Search query is required",
        tokens: 5,
        metadata: { error: true },
      };
    }

    try {
      const results = await this.codebase.search(query);

      if (results.length === 0) {
        return {
          type: "codebase",
          target: query,
          content: `No results found for: ${query}`,
          tokens: 10,
          metadata: { count: 0 },
        };
      }

      const content = results.map((r) => `${r.file}:${r.line}: ${r.content}`).join("\n");

      let finalContent = content;
      if (options?.maxTokens) {
        const tokens = estimateTokens(content);
        if (tokens > options.maxTokens) {
          finalContent = this.truncateToTokens(content, options.maxTokens);
        }
      }

      return {
        type: "codebase",
        target: query,
        content: finalContent,
        tokens: estimateTokens(finalContent),
        metadata: { count: results.length },
      };
    } catch (error) {
      return {
        type: "codebase",
        target: query,
        content: `Error searching codebase: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokens: 10,
        metadata: { error: true },
      };
    }
  }

  /**
   * 解析相对路径
   */
  private resolvePath(path: string): string {
    if (path.startsWith("/") || path.match(/^[A-Za-z]:/)) {
      return path;
    }
    return `${this.workspaceRoot}/${path}`;
  }

  /**
   * 构建目录树
   */
  private async buildDirectoryTree(
    path: string,
    depth: number,
    maxDepth: number,
    recursive: boolean
  ): Promise<DirectoryNode> {
    const entries = await this.fs.readDir(path);
    const children: DirectoryNode[] = [];

    for (const entry of entries) {
      const fullPath = `${path}/${entry}`;
      const stat = await this.fs.stat(fullPath);

      if (stat.isDirectory) {
        if (recursive && depth < maxDepth) {
          const subtree = await this.buildDirectoryTree(fullPath, depth + 1, maxDepth, recursive);
          children.push(subtree);
        } else {
          children.push({ name: entry, isDirectory: true, children: [] });
        }
      } else {
        children.push({ name: entry, isDirectory: false, size: stat.size });
      }
    }

    return {
      name: path.split("/").pop() || path,
      isDirectory: true,
      children,
    };
  }

  /**
   * 格式化目录树
   */
  private formatDirectoryTree(node: DirectoryNode, prefix: string = ""): string {
    const lines: string[] = [prefix || node.name];

    const formatNode = (n: DirectoryNode, indent: string): void => {
      const marker = n.isDirectory ? "📁" : "📄";
      const size = n.size ? ` (${this.formatSize(n.size)})` : "";
      lines.push(`${indent}${marker} ${n.name}${size}`);

      if (n.children) {
        for (const child of n.children) {
          formatNode(child, indent + "  ");
        }
      }
    };

    if (node.children) {
      for (const child of node.children) {
        formatNode(child, "  ");
      }
    }

    return lines.join("\n");
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * 截断到指定 token 数
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const lines = text.split("\n");
    let result = "";
    let tokens = 0;

    for (const line of lines) {
      const lineTokens = estimateTokens(line);
      if (tokens + lineTokens > maxTokens) {
        result += "\n... [truncated]";
        break;
      }
      result += (result ? "\n" : "") + line;
      tokens += lineTokens;
    }

    return result;
  }

  /**
   * 批量解析引用
   */
  async resolveAll(refs: string[], options?: ResolveOptions): Promise<ResolvedReference[]> {
    const results: ResolvedReference[] = [];

    for (const ref of refs) {
      const resolved = await this.resolve(ref, options);
      if (resolved) {
        results.push(resolved);
      }
    }

    return results;
  }

  /**
   * 从文本中提取并解析所有引用
   */
  async extractAndResolve(text: string, options?: ResolveOptions): Promise<ResolvedReference[]> {
    const refPattern = /#(File|Folder|Problems|Terminal|Git Diff|GitDiff|Codebase)(?::[^\s]+)?/gi;
    const matches = text.match(refPattern) || [];

    return this.resolveAll(matches, options);
  }
}

// 目录节点类型
interface DirectoryNode {
  name: string;
  isDirectory: boolean;
  children?: DirectoryNode[];
  size?: number;
}

export default ReferenceResolver;

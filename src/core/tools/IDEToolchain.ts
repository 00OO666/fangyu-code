/**
 * IDEToolchain - IDE 工具链统一接口
 *
 * 整合 LSP、AST-Grep、Powers、Skills
 * 实现 analyzeCode、validateSyntax 方法
 *
 * Requirements: 3.5, 3.6
 */

import { LSPTools, MockLSPClient, LSPClient } from "./LSPTools";
import { ASTGrepTools, ASTGrepExecutor, MockASTGrepExecutor } from "./ASTGrepTools";
import {
  PowersManager,
  PowerStorage,
  MCPClient,
  MockPowerStorage,
  MockMCPClient,
} from "./PowersManager";
import { Diagnostic, Location, Range, ASTMatch, CodeAnalysis } from "../types/unified-agent";

// 代码分析选项
export interface AnalyzeOptions {
  includeHover?: boolean;
  includeDefinition?: boolean;
  includeReferences?: boolean;
  includeDiagnostics?: boolean;
  includeAST?: boolean;
  astPattern?: string;
}

// 语法验证结果
export interface SyntaxValidationResult {
  valid: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  hints: Diagnostic[];
  summary: string;
}

// 代码搜索结果
export interface CodeSearchResult {
  pattern: string;
  language: string;
  matches: ASTMatch[];
  totalCount: number;
}

// 重构建议
export interface RefactorSuggestion {
  type: "rename" | "extract" | "inline" | "move";
  description: string;
  range: Range;
  newCode?: string;
}

// 工具链配置
export interface ToolchainConfig {
  workspaceRoot: string;
  lspClient?: LSPClient;
  astExecutor?: ASTGrepExecutor;
  powerStorage?: PowerStorage;
  mcpClient?: MCPClient;
}

/**
 * IDEToolchain 类
 */
export class IDEToolchain {
  private lsp: LSPTools;
  private ast: ASTGrepTools;
  private powers: PowersManager;
  private workspaceRoot: string;

  constructor(config: ToolchainConfig) {
    this.workspaceRoot = config.workspaceRoot;

    this.lsp = new LSPTools(config.workspaceRoot, config.lspClient ?? new MockLSPClient());

    this.ast = new ASTGrepTools(
      config.workspaceRoot,
      config.astExecutor ?? new MockASTGrepExecutor()
    );

    this.powers = new PowersManager(
      config.powerStorage ?? new MockPowerStorage(),
      config.mcpClient ?? new MockMCPClient()
    );
  }

  /**
   * 分析代码
   * Requirements: 3.5
   */
  async analyzeCode(
    file: string,
    line: number,
    character: number,
    options: AnalyzeOptions = {}
  ): Promise<CodeAnalysis> {
    const result: CodeAnalysis = {};

    const tasks: Promise<void>[] = [];

    // 获取 hover 信息
    if (options.includeHover !== false) {
      tasks.push(
        this.lsp
          .hover(file, line, character)
          .then((hover) => {
            result.hover = hover ?? undefined;
          })
          .catch(() => {
            /* ignore */
          })
      );
    }

    // 获取定义位置
    if (options.includeDefinition) {
      tasks.push(
        this.lsp
          .definition(file, line, character)
          .then((def) => {
            result.definition = def ?? undefined;
          })
          .catch(() => {
            /* ignore */
          })
      );
    }

    // 获取引用
    if (options.includeReferences) {
      tasks.push(
        this.lsp
          .references(file, line, character)
          .then((refs) => {
            result.references = refs;
          })
          .catch(() => {
            /* ignore */
          })
      );
    }

    // 获取诊断信息
    if (options.includeDiagnostics !== false) {
      tasks.push(
        this.lsp
          .diagnostics(file)
          .then((diags) => {
            result.diagnostics = diags;
          })
          .catch(() => {
            /* ignore */
          })
      );
    }

    await Promise.all(tasks);

    return result;
  }

  /**
   * 验证语法
   * Requirements: 3.6
   */
  async validateSyntax(file: string): Promise<SyntaxValidationResult> {
    const diagnostics = await this.lsp.diagnostics(file);

    const errors = diagnostics.filter((d) => d.severity === "error");
    const warnings = diagnostics.filter((d) => d.severity === "warning");
    const hints = diagnostics.filter((d) => d.severity === "hint" || d.severity === "info");

    const valid = errors.length === 0;

    let summary: string;
    if (valid && warnings.length === 0) {
      summary = "No issues found";
    } else if (valid) {
      summary = `${warnings.length} warning(s)`;
    } else {
      summary = `${errors.length} error(s), ${warnings.length} warning(s)`;
    }

    return {
      valid,
      errors,
      warnings,
      hints,
      summary,
    };
  }

  /**
   * 搜索代码模式
   */
  async searchCode(pattern: string, language: string, path?: string): Promise<CodeSearchResult> {
    const matches = await this.ast.search(pattern, language, path);

    return {
      pattern,
      language,
      matches,
      totalCount: matches.length,
    };
  }

  /**
   * 替换代码模式
   */
  async replaceCode(pattern: string, replacement: string, language: string, path?: string) {
    return this.ast.replace(pattern, replacement, path ?? this.workspaceRoot, language);
  }

  /**
   * 获取符号的所有引用
   */
  async findAllReferences(file: string, line: number, character: number): Promise<Location[]> {
    return this.lsp.references(file, line, character);
  }

  /**
   * 重命名符号
   */
  async renameSymbol(file: string, line: number, character: number, newName: string) {
    return this.lsp.rename(file, line, character, newName);
  }

  /**
   * 获取代码补全
   */
  async getCompletions(file: string, line: number, character: number) {
    return this.lsp.completion(file, line, character);
  }

  /**
   * 推断文件语言
   */
  inferLanguage(file: string): string | null {
    return this.ast.inferLanguage(file);
  }

  /**
   * 检查语言是否支持 AST 搜索
   */
  isASTSupported(language: string): boolean {
    return this.ast.isLanguageSupported(language);
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return this.ast.supportedLanguages();
  }

  /**
   * 获取 Powers 管理器
   */
  getPowersManager(): PowersManager {
    return this.powers;
  }

  /**
   * 获取 LSP 工具
   */
  getLSPTools(): LSPTools {
    return this.lsp;
  }

  /**
   * 获取 AST-Grep 工具
   */
  getASTTools(): ASTGrepTools {
    return this.ast;
  }

  /**
   * 批量验证多个文件
   */
  async validateMultiple(files: string[]): Promise<Map<string, SyntaxValidationResult>> {
    const results = new Map<string, SyntaxValidationResult>();

    await Promise.all(
      files.map(async (file) => {
        const result = await this.validateSyntax(file);
        results.set(file, result);
      })
    );

    return results;
  }

  /**
   * 获取工作区诊断摘要
   */
  async getWorkspaceDiagnosticsSummary(files: string[]): Promise<{
    totalErrors: number;
    totalWarnings: number;
    fileCount: number;
    filesWithErrors: string[];
  }> {
    const validations = await this.validateMultiple(files);

    let totalErrors = 0;
    let totalWarnings = 0;
    const filesWithErrors: string[] = [];

    for (const [file, result] of validations) {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      if (result.errors.length > 0) {
        filesWithErrors.push(file);
      }
    }

    return {
      totalErrors,
      totalWarnings,
      fileCount: files.length,
      filesWithErrors,
    };
  }
}

export default IDEToolchain;

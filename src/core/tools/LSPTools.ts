/**
 * LSPTools - LSP 工具封装
 * 
 * 封装 Language Server Protocol 功能：hover、rename、references、definition、diagnostics、completion
 * 
 * Requirements: 3.1
 */

import {
  Position,
  Location,
  Range,
  HoverInfo,
  Diagnostic,
} from '../types/unified-agent';

// 补全项
export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

export type CompletionItemKind =
  | 'text'
  | 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'interface'
  | 'module'
  | 'property'
  | 'unit'
  | 'value'
  | 'enum'
  | 'keyword'
  | 'snippet'
  | 'color'
  | 'file'
  | 'reference'
  | 'folder'
  | 'enumMember'
  | 'constant'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter';

// 工作区编辑
export interface WorkspaceEdit {
  changes: Record<string, TextEdit[]>;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

// LSP 客户端接口（用于依赖注入）
export interface LSPClient {
  initialize(workspaceRoot: string): Promise<void>;
  shutdown(): Promise<void>;

  textDocumentHover(file: string, position: Position): Promise<HoverInfo | null>;
  textDocumentDefinition(file: string, position: Position): Promise<Location | null>;
  textDocumentReferences(file: string, position: Position): Promise<Location[]>;
  textDocumentRename(file: string, position: Position, newName: string): Promise<WorkspaceEdit | null>;
  textDocumentCompletion(file: string, position: Position): Promise<CompletionItem[]>;
  textDocumentDiagnostics(file: string): Promise<Diagnostic[]>;
}

// Mock LSP 客户端（用于测试）
export class MockLSPClient implements LSPClient {
  private initialized = false;
  private hoverResults: Map<string, HoverInfo> = new Map();
  private definitionResults: Map<string, Location> = new Map();
  private referencesResults: Map<string, Location[]> = new Map();
  private completionResults: Map<string, CompletionItem[]> = new Map();
  private diagnosticsResults: Map<string, Diagnostic[]> = new Map();

  async initialize(workspaceRoot: string): Promise<void> {
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  setHoverResult(file: string, line: number, char: number, result: HoverInfo): void {
    this.hoverResults.set(`${file}:${line}:${char}`, result);
  }

  setDefinitionResult(file: string, line: number, char: number, result: Location): void {
    this.definitionResults.set(`${file}:${line}:${char}`, result);
  }

  setReferencesResult(file: string, line: number, char: number, results: Location[]): void {
    this.referencesResults.set(`${file}:${line}:${char}`, results);
  }

  setCompletionResult(file: string, line: number, char: number, results: CompletionItem[]): void {
    this.completionResults.set(`${file}:${line}:${char}`, results);
  }

  setDiagnosticsResult(file: string, results: Diagnostic[]): void {
    this.diagnosticsResults.set(file, results);
  }

  // 别名方法（用于测试兼容性）
  setHover(file: string, line: number, char: number, result: HoverInfo): void {
    this.setHoverResult(file, line, char, result);
  }

  setDefinition(file: string, line: number, char: number, result: Location): void {
    this.setDefinitionResult(file, line, char, result);
  }

  setReferences(file: string, line: number, char: number, results: Location[]): void {
    this.setReferencesResult(file, line, char, results);
  }

  setDiagnostics(file: string, results: Diagnostic[]): void {
    this.setDiagnosticsResult(file, results);
  }

  async textDocumentHover(file: string, position: Position): Promise<HoverInfo | null> {
    return this.hoverResults.get(`${file}:${position.line}:${position.character}`) ?? null;
  }

  async textDocumentDefinition(file: string, position: Position): Promise<Location | null> {
    return this.definitionResults.get(`${file}:${position.line}:${position.character}`) ?? null;
  }

  async textDocumentReferences(file: string, position: Position): Promise<Location[]> {
    return this.referencesResults.get(`${file}:${position.line}:${position.character}`) ?? [];
  }

  async textDocumentRename(file: string, position: Position, newName: string): Promise<WorkspaceEdit | null> {
    const refs = await this.textDocumentReferences(file, position);
    if (refs.length === 0) return null;

    const changes: Record<string, TextEdit[]> = {};
    for (const ref of refs) {
      if (!changes[ref.file]) {
        changes[ref.file] = [];
      }
      changes[ref.file].push({
        range: ref.range,
        newText: newName
      });
    }

    return { changes };
  }

  async textDocumentCompletion(file: string, position: Position): Promise<CompletionItem[]> {
    return this.completionResults.get(`${file}:${position.line}:${position.character}`) ?? [];
  }

  async textDocumentDiagnostics(file: string): Promise<Diagnostic[]> {
    return this.diagnosticsResults.get(file) ?? [];
  }
}

/**
 * LSPTools 类
 */
export class LSPTools {
  private client: LSPClient;
  private workspaceRoot: string;
  private initialized = false;

  constructor(workspaceRoot: string, client?: LSPClient) {
    this.workspaceRoot = workspaceRoot;
    this.client = client ?? new MockLSPClient();
  }

  /**
   * 初始化 LSP
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.client.initialize(this.workspaceRoot);
    this.initialized = true;
  }

  /**
   * 关闭 LSP
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    await this.client.shutdown();
    this.initialized = false;
  }

  /**
   * 获取悬停信息
   */
  async hover(file: string, line: number, character: number): Promise<HoverInfo | null> {
    await this.ensureInitialized();
    return this.client.textDocumentHover(
      this.resolvePath(file),
      { line, character }
    );
  }

  /**
   * 重命名符号
   */
  async rename(
    file: string,
    line: number,
    character: number,
    newName: string
  ): Promise<WorkspaceEdit | null> {
    await this.ensureInitialized();
    return this.client.textDocumentRename(
      this.resolvePath(file),
      { line, character },
      newName
    );
  }

  /**
   * 查找引用
   */
  async references(file: string, line: number, character: number): Promise<Location[]> {
    await this.ensureInitialized();
    return this.client.textDocumentReferences(
      this.resolvePath(file),
      { line, character }
    );
  }

  /**
   * 跳转到定义
   */
  async definition(file: string, line: number, character: number): Promise<Location | null> {
    await this.ensureInitialized();
    return this.client.textDocumentDefinition(
      this.resolvePath(file),
      { line, character }
    );
  }

  /**
   * 获取诊断信息（单个文件）
   */
  async diagnostics(file: string): Promise<Diagnostic[]>;
  /**
   * 获取诊断信息（多个文件）
   */
  async diagnostics(files: string[]): Promise<Diagnostic[]>;
  async diagnostics(fileOrFiles: string | string[]): Promise<Diagnostic[]> {
    await this.ensureInitialized();

    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    const allDiagnostics: Diagnostic[] = [];

    for (const file of files) {
      const diags = await this.client.textDocumentDiagnostics(this.resolvePath(file));
      allDiagnostics.push(...diags);
    }

    return allDiagnostics;
  }

  /**
   * 获取补全建议
   */
  async completion(file: string, line: number, character: number): Promise<CompletionItem[]> {
    await this.ensureInitialized();
    return this.client.textDocumentCompletion(
      this.resolvePath(file),
      { line, character }
    );
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 解析路径
   */
  private resolvePath(path: string): string {
    if (path.startsWith('/') || path.match(/^[A-Za-z]:/)) {
      return path;
    }
    return `${this.workspaceRoot}/${path}`;
  }
}

export default LSPTools;

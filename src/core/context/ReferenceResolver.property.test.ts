/**
 * ReferenceResolver 属性测试
 * 
 * Property 26: #引用解析正确性
 * Validates: Requirements 10.1-10.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ReferenceResolver,
  parseReference,
  ResolvedReference,
  FileSystem,
  DiagnosticsProvider,
  TerminalProvider,
  GitProvider,
  CodebaseProvider
} from './ReferenceResolver';
import { Diagnostic } from '../types/unified-agent';

// Mock 文件系统
class MockFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private dirs: Map<string, string[]> = new Map();
  
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  
  setDir(path: string, entries: string[]): void {
    this.dirs.set(path, entries);
  }
  
  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }
  
  async readDir(path: string): Promise<string[]> {
    const entries = this.dirs.get(path);
    if (entries === undefined) {
      throw new Error(`Directory not found: ${path}`);
    }
    return entries;
  }
  
  async stat(path: string): Promise<{ isDirectory: boolean; size: number }> {
    if (this.dirs.has(path)) {
      return { isDirectory: true, size: 0 };
    }
    const content = this.files.get(path);
    if (content !== undefined) {
      return { isDirectory: false, size: content.length };
    }
    throw new Error(`Path not found: ${path}`);
  }
  
  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }
}

// Mock 诊断提供者
class MockDiagnosticsProvider implements DiagnosticsProvider {
  private diagnostics: Diagnostic[] = [];
  
  setDiagnostics(diags: Diagnostic[]): void {
    this.diagnostics = diags;
  }
  
  async getDiagnostics(files: string[]): Promise<Diagnostic[]> {
    if (files.length === 0) {
      return this.diagnostics;
    }
    return this.diagnostics.filter(d => files.includes(d.file));
  }
}

// Mock 终端提供者
class MockTerminalProvider implements TerminalProvider {
  private output: string = '';
  
  setOutput(output: string): void {
    this.output = output;
  }
  
  async getOutput(lines?: number): Promise<string> {
    if (lines) {
      return this.output.split('\n').slice(-lines).join('\n');
    }
    return this.output;
  }
}

// Mock Git 提供者
class MockGitProvider implements GitProvider {
  private diff: string = '';
  private status: string = '';
  
  setDiff(diff: string): void {
    this.diff = diff;
  }
  
  setStatus(status: string): void {
    this.status = status;
  }
  
  async getDiff(): Promise<string> {
    return this.diff;
  }
  
  async getStatus(): Promise<string> {
    return this.status;
  }
}

// Mock 代码库提供者
class MockCodebaseProvider implements CodebaseProvider {
  private results: Array<{ file: string; line: number; content: string }> = [];
  
  setResults(results: Array<{ file: string; line: number; content: string }>): void {
    this.results = results;
  }
  
  async search(query: string): Promise<Array<{ file: string; line: number; content: string }>> {
    return this.results.filter(r => r.content.includes(query) || r.file.includes(query));
  }
}

// 生成有效的文件路径
const filePathArb = fc.array(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), { minLength: 1, maxLength: 10 }),
  { minLength: 1, maxLength: 4 }
).map(parts => parts.join('/') + '.ts');

// 生成文件内容
const fileContentArb = fc.string({ minLength: 10, maxLength: 500 });

// 生成引用类型

describe('ReferenceResolver Property Tests', () => {
  let mockFs: MockFileSystem;
  let mockDiagnostics: MockDiagnosticsProvider;
  let mockTerminal: MockTerminalProvider;
  let mockGit: MockGitProvider;
  let mockCodebase: MockCodebaseProvider;
  let resolver: ReferenceResolver;
  
  beforeEach(() => {
    mockFs = new MockFileSystem();
    mockDiagnostics = new MockDiagnosticsProvider();
    mockTerminal = new MockTerminalProvider();
    mockGit = new MockGitProvider();
    mockCodebase = new MockCodebaseProvider();
    
    resolver = new ReferenceResolver('/workspace', {
      fs: mockFs,
      diagnostics: mockDiagnostics,
      terminal: mockTerminal,
      git: mockGit,
      codebase: mockCodebase
    });
  });
  
  describe('Reference Parsing Properties', () => {
    it('Property 26.1: #File 引用应正确解析', () => {
      fc.assert(
        fc.property(filePathArb, (path) => {
          const ref = parseReference(`#File:${path}`);
          
          expect(ref).not.toBeNull();
          expect(ref?.type).toBe('file');
          expect(ref?.target).toBe(path);
        }),
        { numRuns: 100 }
      );
    });
    
    it('Property 26.2: #Folder 引用应正确解析', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 }),
            { minLength: 1, maxLength: 3 }
          ).map(parts => parts.join('/')),
          (path) => {
            const ref = parseReference(`#Folder:${path}`);
            
            expect(ref).not.toBeNull();
            expect(ref?.type).toBe('folder');
            expect(ref?.target).toBe(path);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('Property 26.3: #Problems 引用应正确解析', () => {
      const ref1 = parseReference('#Problems');
      expect(ref1).not.toBeNull();
      expect(ref1?.type).toBe('problems');
      expect(ref1?.target).toBe('');
      
      fc.assert(
        fc.property(filePathArb, (path) => {
          const ref = parseReference(`#Problems:${path}`);
          
          expect(ref).not.toBeNull();
          expect(ref?.type).toBe('problems');
          expect(ref?.target).toBe(path);
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property 26.4: #Terminal 引用应正确解析', () => {
      const ref1 = parseReference('#Terminal');
      expect(ref1).not.toBeNull();
      expect(ref1?.type).toBe('terminal');
      
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (lines) => {
          const ref = parseReference(`#Terminal:${lines}`);
          
          expect(ref).not.toBeNull();
          expect(ref?.type).toBe('terminal');
          expect(ref?.target).toBe(String(lines));
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property 26.5: #Git Diff 引用应正确解析', () => {
      const variants = ['#Git Diff', '#GitDiff', '#git diff', '#gitdiff'];
      
      for (const variant of variants) {
        const ref = parseReference(variant);
        expect(ref).not.toBeNull();
        expect(ref?.type).toBe('gitDiff');
      }
    });
    
    it('Property 26.6: #Codebase 引用应正确解析', () => {
      fc.assert(
        fc.property(
          // 生成非空白字符串作为查询
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), { minLength: 1, maxLength: 50 }),
          (query) => {
            const ref = parseReference(`#Codebase:${query}`);
            
            expect(ref).not.toBeNull();
            expect(ref?.type).toBe('codebase');
            expect(ref?.target).toBe(query);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('Property 26.7: 无效引用应返回 null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.startsWith('#')),
          (text) => {
            const ref = parseReference(text);
            expect(ref).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('File Resolution Properties (Property 26 - Requirement 10.1)', () => {
    it('Property 26.8: 文件解析应返回正确内容', async () => {
      await fc.assert(
        fc.asyncProperty(filePathArb, fileContentArb, async (path, content) => {
          const fullPath = `/workspace/${path}`;
          mockFs.setFile(fullPath, content);
          
          const result = await resolver.resolve(`#File:${path}`);
          
          expect(result).not.toBeNull();
          expect(result?.type).toBe('file');
          expect(result?.content).toBe(content);
          expect(result?.tokens).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property 26.9: 不存在的文件应返回错误信息', async () => {
      const result = await resolver.resolve('#File:nonexistent.ts');
      
      expect(result).not.toBeNull();
      expect(result?.content).toContain('Error');
      expect(result?.metadata?.error).toBe(true);
    });
  });
  
  describe('Terminal Resolution Properties (Property 26 - Requirement 10.4)', () => {
    it('Property 26.10: 终端输出应正确解析', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 20 }),
          async (lines) => {
            const output = lines.join('\n');
            mockTerminal.setOutput(output);
            
            const result = await resolver.resolve('#Terminal');
            
            expect(result).not.toBeNull();
            expect(result?.type).toBe('terminal');
            expect(result?.content).toBe(output);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Git Diff Resolution Properties (Property 26 - Requirement 10.5)', () => {
    it('Property 26.11: Git diff 应正确解析', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 10, maxLength: 500 }), async (diff) => {
          mockGit.setDiff(diff);
          
          const result = await resolver.resolve('#Git Diff');
          
          expect(result).not.toBeNull();
          expect(result?.type).toBe('gitDiff');
          expect(result?.content).toBe(diff);
          expect(result?.metadata?.hasChanges).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property 26.12: 无变更时应返回相应信息', async () => {
      mockGit.setDiff('');
      
      const result = await resolver.resolve('#Git Diff');
      
      expect(result).not.toBeNull();
      expect(result?.content).toContain('No changes');
      expect(result?.metadata?.hasChanges).toBe(false);
    });
  });
  
  describe('Codebase Search Properties (Property 26 - Requirement 10.6)', () => {
    it('Property 26.13: 代码库搜索应返回匹配结果', async () => {
      const searchResults = [
        { file: 'src/index.ts', line: 10, content: 'function test() {}' },
        { file: 'src/utils.ts', line: 20, content: 'const test = 1;' }
      ];
      mockCodebase.setResults(searchResults);
      
      const result = await resolver.resolve('#Codebase:test');
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('codebase');
      expect(result?.metadata?.count).toBe(2);
    });
    
    it('Property 26.14: 空查询应返回错误', async () => {
      const result = await resolver.resolve('#Codebase:');
      
      expect(result).not.toBeNull();
      expect(result?.content).toContain('required');
      expect(result?.metadata?.error).toBe(true);
    });
  });
  
  describe('Problems Resolution Properties (Property 26 - Requirement 10.3)', () => {
    it('Property 26.15: 诊断信息应正确解析', async () => {
      const diagnostics: Diagnostic[] = [
        {
          file: 'src/index.ts',
          range: { start: { line: 10, character: 5 }, end: { line: 10, character: 15 } },
          message: 'Type error',
          severity: 'error'
        }
      ];
      mockDiagnostics.setDiagnostics(diagnostics);
      
      const result = await resolver.resolve('#Problems');
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('problems');
      expect(result?.content).toContain('Type error');
      expect(result?.metadata?.count).toBe(1);
    });
    
    it('Property 26.16: 无问题时应返回相应信息', async () => {
      mockDiagnostics.setDiagnostics([]);
      
      const result = await resolver.resolve('#Problems');
      
      expect(result).not.toBeNull();
      expect(result?.content).toContain('No problems');
      expect(result?.metadata?.count).toBe(0);
    });
  });
  
  describe('Batch Resolution Properties', () => {
    it('Property 26.17: 批量解析应返回所有有效结果', async () => {
      mockFs.setFile('/workspace/test.ts', 'content');
      mockTerminal.setOutput('terminal output');
      mockGit.setDiff('diff content');
      
      const refs = ['#File:test.ts', '#Terminal', '#Git Diff', 'invalid'];
      const results = await resolver.resolveAll(refs);
      
      // 应该有 3 个有效结果（invalid 被忽略）
      expect(results.length).toBe(3);
    });
  });
  
  describe('Token Estimation Properties', () => {
    it('Property 26.18: 解析结果应包含正确的 token 估算', async () => {
      await fc.assert(
        fc.asyncProperty(fileContentArb, async (content) => {
          mockFs.setFile('/workspace/test.ts', content);
          
          const result = await resolver.resolve('#File:test.ts');
          
          expect(result).not.toBeNull();
          expect(result?.tokens).toBeGreaterThan(0);
          
          // Token 数应与内容长度相关
          if (content.length > 0) {
            expect(result?.tokens).toBeLessThanOrEqual(content.length);
          }
        }),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Extract and Resolve Properties', () => {
    it('Property 26.19: 从文本中提取引用应正确工作', async () => {
      mockFs.setFile('/workspace/test.ts', 'file content');
      mockTerminal.setOutput('terminal output');
      
      const text = 'Please check #File:test.ts and also #Terminal for more info';
      const results = await resolver.extractAndResolve(text);
      
      expect(results.length).toBe(2);
      expect(results.some(r => r.type === 'file')).toBe(true);
      expect(results.some(r => r.type === 'terminal')).toBe(true);
    });
  });
});

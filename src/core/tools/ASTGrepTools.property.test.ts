/**
 * ASTGrepTools 属性测试
 * 
 * Property 8: AST 模式搜索准确性
 * Validates: Requirements 3.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ASTGrepTools,
  MockASTGrepExecutor,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  ReplaceResult
} from './ASTGrepTools';
import { ASTMatch } from '../types/unified-agent';

// 生成有效的语言
const languageArb = fc.constantFrom(...SUPPORTED_LANGUAGES);

// 生成有效的文件路径（带 workspace 前缀）
const filePathArb = fc.array(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), { minLength: 1, maxLength: 10 }),
  { minLength: 1, maxLength: 4 }
).map(parts => '/workspace/' + parts.join('/'));

// 生成有效的 AST 模式
const patternArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$(){}[].,;:'.split('')),
  { minLength: 1, maxLength: 50 }
);

// 生成 Range
const rangeArb = fc.record({
  start: fc.record({
    line: fc.integer({ min: 0, max: 1000 }),
    character: fc.integer({ min: 0, max: 200 })
  }),
  end: fc.record({
    line: fc.integer({ min: 0, max: 1000 }),
    character: fc.integer({ min: 0, max: 200 })
  })
}).map(r => {
  // 确保 end >= start
  if (r.end.line < r.start.line || (r.end.line === r.start.line && r.end.character < r.start.character)) {
    return {
      start: r.start,
      end: { line: r.start.line, character: r.start.character + 10 }
    };
  }
  return r;
});

// 生成 ASTMatch
const astMatchArb = fc.record({
  file: filePathArb.map(p => p + '.ts'),
  range: rangeArb,
  text: fc.string({ minLength: 1, maxLength: 100 }),
  captures: fc.option(fc.dictionary(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 }),
    fc.string({ minLength: 1, maxLength: 50 })
  ), { nil: undefined })
});

describe('ASTGrepTools Property Tests', () => {
  let mockExecutor: MockASTGrepExecutor;
  let tools: ASTGrepTools;
  
  beforeEach(() => {
    mockExecutor = new MockASTGrepExecutor();
    tools = new ASTGrepTools('/workspace', mockExecutor);
  });
  
  describe('Language Support Properties', () => {
    it('Property 8.1: 支持的语言列表应包含至少 10 种语言', () => {
      const languages = tools.supportedLanguages();
      expect(languages.length).toBeGreaterThanOrEqual(10);
    });
    
    it('Property 8.2: 所有列出的语言都应被识别为支持', () => {
      fc.assert(
        fc.property(languageArb, (lang) => {
          expect(tools.isLanguageSupported(lang)).toBe(true);
        }),
        { numRuns: SUPPORTED_LANGUAGES.length }
      );
    });
    
    it('Property 8.3: 不支持的语言应返回 false', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
            !SUPPORTED_LANGUAGES.includes(s as SupportedLanguage)
          ),
          (lang) => {
            expect(tools.isLanguageSupported(lang)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Language Inference Properties', () => {
    it('Property 8.4: 常见扩展名应正确推断语言', () => {
      const testCases: Array<[string, string]> = [
        ['file.ts', 'typescript'],
        ['file.tsx', 'tsx'],
        ['file.js', 'javascript'],
        ['file.jsx', 'jsx'],
        ['file.py', 'python'],
        ['file.rs', 'rust'],
        ['file.go', 'go'],
        ['file.java', 'java'],
        ['file.c', 'c'],
        ['file.cpp', 'cpp'],
        ['file.cs', 'csharp'],
        ['file.rb', 'ruby'],
        ['file.php', 'php'],
        ['file.swift', 'swift'],
        ['file.kt', 'kotlin'],
        ['file.html', 'html'],
        ['file.css', 'css'],
        ['file.json', 'json'],
        ['file.yaml', 'yaml'],
        ['file.yml', 'yaml'],
        ['file.md', 'markdown'],
        ['file.sql', 'sql'],
        ['file.sh', 'bash']
      ];
      
      for (const [file, expectedLang] of testCases) {
        expect(tools.inferLanguage(file)).toBe(expectedLang);
      }
    });
    
    it('Property 8.5: 未知扩展名应返回 null', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 }),
          (ext) => {
            const unknownExts = ['xyz', 'abc', 'qqq', 'zzz'];
            if (unknownExts.includes(ext)) {
              expect(tools.inferLanguage(`file.${ext}`)).toBeNull();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Search Properties (Property 8)', () => {
    it('Property 8.6: 搜索应返回设置的结果', async () => {
      await fc.assert(
        fc.asyncProperty(
          patternArb,
          languageArb,
          fc.array(astMatchArb, { minLength: 0, maxLength: 10 }),
          async (pattern, lang, matches) => {
            // 为每次测试创建新的实例
            const executor = new MockASTGrepExecutor();
            const testTools = new ASTGrepTools('/workspace', executor);
            
            executor.setSearchResult(pattern, lang, matches);
            
            const results = await testTools.search(pattern, lang);
            
            expect(results).toEqual(matches);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('Property 8.7: 搜索结果应只包含匹配的文件', async () => {
      const matches: ASTMatch[] = [
        { file: '/workspace/src/a.ts', range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } }, text: 'match1' },
        { file: '/workspace/src/b.ts', range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } }, text: 'match2' },
        { file: '/workspace/lib/c.ts', range: { start: { line: 3, character: 0 }, end: { line: 3, character: 10 } }, text: 'match3' }
      ];
      
      mockExecutor.setSearchResult('pattern', 'typescript', matches);
      
      const srcResults = await tools.search('pattern', 'typescript', '/workspace/src');
      
      // 应该只返回 src 目录下的匹配
      expect(srcResults.every(r => r.file.startsWith('/workspace/src'))).toBe(true);
    });
    
    it('Property 8.8: 空搜索结果应返回空数组', async () => {
      const results = await tools.search('nonexistent', 'typescript');
      expect(results).toEqual([]);
    });
  });
  
  describe('Replace Properties', () => {
    it('Property 8.9: 替换应返回正确的变更数量', async () => {
      await fc.assert(
        fc.asyncProperty(
          patternArb,
          languageArb,
          fc.array(astMatchArb, { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (pattern, lang, matches, replacement) => {
            // 为每次测试创建新的实例
            const executor = new MockASTGrepExecutor();
            const testTools = new ASTGrepTools('/workspace', executor);
            
            executor.setSearchResult(pattern, lang, matches);
            
            const result = await testTools.replace(pattern, replacement, '/workspace', lang);
            
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(matches.length);
            expect(result.replacedCount).toBe(matches.length);
            expect(result.changes.length).toBe(matches.length);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('Property 8.10: 无匹配时替换应返回空变更', async () => {
      const result = await tools.replace('nonexistent', 'replacement', '/workspace', 'typescript');
      
      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(0);
      expect(result.replacedCount).toBe(0);
      expect(result.changes).toEqual([]);
    });
    
    it('Property 8.11: 替换变更应包含原始和替换后的文本', async () => {
      const matches: ASTMatch[] = [
        { 
          file: '/workspace/test.ts', 
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } }, 
          text: 'originalText' 
        }
      ];
      
      mockExecutor.setSearchResult('pattern', 'typescript', matches);
      
      const result = await tools.replace('pattern', 'newText', '/workspace', 'typescript');
      
      expect(result.changes[0].original).toBe('originalText');
      expect(result.changes[0].replaced).toBe('newText');
    });
  });
  
  describe('Formatted Search Properties', () => {
    it('Property 8.12: 格式化搜索应包含匹配数量', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(astMatchArb, { minLength: 1, maxLength: 5 }),
          async (matches) => {
            // 为每次测试创建新的实例
            const executor = new MockASTGrepExecutor();
            const testTools = new ASTGrepTools('/workspace', executor);
            
            executor.setSearchResult('pattern', 'typescript', matches);
            
            const formatted = await testTools.searchFormatted('pattern', 'typescript');
            
            expect(formatted).toContain(`${matches.length} match`);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('Property 8.13: 无匹配时格式化搜索应返回提示信息', async () => {
      const formatted = await tools.searchFormatted('nonexistent', 'typescript');
      
      expect(formatted).toContain('No matches found');
    });
  });
  
  describe('Error Handling Properties', () => {
    it('Property 8.14: 不支持的语言应抛出错误', async () => {
      await expect(tools.search('pattern', 'unsupported_lang')).rejects.toThrow('Unsupported language');
    });
    
    it('Property 8.15: 替换时不支持的语言应抛出错误', async () => {
      await expect(tools.replace('pattern', 'replacement', '/path', 'unsupported_lang')).rejects.toThrow('Unsupported language');
    });
  });
  
  describe('Capture Replacement Properties', () => {
    it('Property 8.16: 捕获组应正确替换', async () => {
      const matches: ASTMatch[] = [
        { 
          file: '/workspace/test.ts', 
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 20 } }, 
          text: 'function foo()',
          captures: { name: 'foo' }
        }
      ];
      
      mockExecutor.setSearchResult('function $name()', 'typescript', matches);
      
      const result = await tools.replace('function $name()', 'const $name = () =>', '/workspace', 'typescript');
      
      expect(result.changes[0].replaced).toBe('const foo = () =>');
    });
  });
});

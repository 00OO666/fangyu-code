/**
 * SteeringLoader 属性测试
 * 
 * Property 7: Steering 规则加载正确性
 * Validates: Requirements 2.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  SteeringLoader,
  parseFrontMatter,
  matchGlobPattern,
  InclusionMode,
  SteeringFrontMatter
} from './SteeringLoader';

// 测试用临时目录
let tempDir: string;
let steeringDir: string;

// 创建临时测试环境
function setupTestEnv() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-test-'));
  steeringDir = path.join(tempDir, '.kiro', 'steering');
  fs.mkdirSync(steeringDir, { recursive: true });
}

// 清理临时测试环境
function cleanupTestEnv() {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// 生成有效的 inclusion 模式
const inclusionModeArb = fc.constantFrom<InclusionMode>('always', 'fileMatch', 'manual');

// 生成有效的文件名（不含特殊字符）
const validFileNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 20 }
);

// 生成有效的 glob 模式
const globPatternArb = fc.oneof(
  fc.constant('*.ts'),
  fc.constant('*.tsx'),
  fc.constant('**/*.ts'),
  fc.constant('src/**/*.ts'),
  fc.constant('README*'),
  validFileNameArb.map(name => `${name}.*`)
);

// 生成 front-matter 配置
const frontMatterArb = fc.record({
  inclusion: inclusionModeArb,
  fileMatchPattern: fc.option(globPatternArb, { nil: undefined }),
  description: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  priority: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined })
});

// 生成 steering 文件内容
function generateSteeringContent(frontMatter: Partial<SteeringFrontMatter>, body: string): string {
  const lines: string[] = ['---'];
  
  if (frontMatter.inclusion) {
    lines.push(`inclusion: ${frontMatter.inclusion}`);
  }
  if (frontMatter.fileMatchPattern) {
    lines.push(`fileMatchPattern: '${frontMatter.fileMatchPattern}'`);
  }
  if (frontMatter.description) {
    lines.push(`description: "${frontMatter.description}"`);
  }
  if (frontMatter.priority !== undefined) {
    lines.push(`priority: ${frontMatter.priority}`);
  }
  
  lines.push('---');
  lines.push('');
  lines.push(body);
  
  return lines.join('\n');
}

describe('SteeringLoader Property Tests', () => {
  describe('Front-matter Parsing', () => {
    it('Property 7.1: 应正确解析所有有效的 front-matter 配置', () => {
      fc.assert(
        fc.property(frontMatterArb, fc.string({ minLength: 0, maxLength: 500 }), (fm, body) => {
          const content = generateSteeringContent(fm, body);
          const result = parseFrontMatter(content);
          
          // 验证 inclusion 模式正确解析
          if (fm.inclusion) {
            expect(result.frontMatter.inclusion).toBe(fm.inclusion);
          }
          
          // 验证 fileMatchPattern 正确解析
          if (fm.fileMatchPattern) {
            expect(result.frontMatter.fileMatchPattern).toBe(fm.fileMatchPattern);
          }
          
          // 验证 priority 正确解析
          if (fm.priority !== undefined) {
            expect(result.frontMatter.priority).toBe(fm.priority);
          }
          
          // 验证内容正确提取（去除 front-matter）
          expect(result.content).toBe(body.trim());
        }),
        { numRuns: 100 }
      );
    });
    
    it('Property 7.2: 无 front-matter 时应使用默认值', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 500 }), (content) => {
          // 确保内容不以 --- 开头
          const safeContent = content.startsWith('---') ? `# ${content}` : content;
          const result = parseFrontMatter(safeContent);
          
          // 默认 inclusion 应为 always
          expect(result.frontMatter.inclusion).toBe('always');
          // 默认 priority 应为 100
          expect(result.frontMatter.priority).toBe(100);
          // 内容应保持不变（仅 trim）
          expect(result.content).toBe(safeContent.trim());
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Glob Pattern Matching', () => {
    it('Property 7.3: * 应匹配单层目录中的任意字符', () => {
      fc.assert(
        fc.property(validFileNameArb, fc.constantFrom('ts', 'tsx', 'js', 'md'), (name, ext) => {
          const pattern = `*.${ext}`;
          const matchingFile = `${name}.${ext}`;
          const nonMatchingFile = `${name}.other`;
          const nestedFile = `dir/${name}.${ext}`;
          
          expect(matchGlobPattern(pattern, matchingFile)).toBe(true);
          expect(matchGlobPattern(pattern, nonMatchingFile)).toBe(false);
          // * 不应匹配嵌套路径
          expect(matchGlobPattern(pattern, nestedFile)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
    
    it('Property 7.4: ** 应匹配任意深度的路径', () => {
      fc.assert(
        fc.property(
          fc.array(validFileNameArb, { minLength: 1, maxLength: 5 }),  // 至少一个目录
          validFileNameArb,
          fc.constantFrom('ts', 'tsx', 'js'),
          (dirs, name, ext) => {
            const pattern = `**/*.${ext}`;
            const filePath = [...dirs, `${name}.${ext}`].join('/');
            
            expect(matchGlobPattern(pattern, filePath)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('Property 7.5: 精确模式应只匹配完全相同的路径', () => {
      fc.assert(
        fc.property(validFileNameArb, validFileNameArb, (name1, name2) => {
          const pattern = `${name1}.ts`;
          
          expect(matchGlobPattern(pattern, `${name1}.ts`)).toBe(true);
          
          // 不同名称不应匹配（除非恰好相同）
          if (name1 !== name2) {
            expect(matchGlobPattern(pattern, `${name2}.ts`)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Steering File Loading', () => {
    beforeEach(() => {
      setupTestEnv();
    });
    
    afterEach(() => {
      cleanupTestEnv();
    });
    
    it('Property 7.6: always 模式的文件应始终被加载', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validFileNameArb, { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (names, body) => {
            // 确保名称唯一
            const uniqueNames = [...new Set(names)];
            
            // 创建 always 模式的 steering 文件
            for (const name of uniqueNames) {
              const content = generateSteeringContent({ inclusion: 'always' }, body);
              fs.writeFileSync(path.join(steeringDir, `${name}.md`), content);
            }
            
            const loader = new SteeringLoader(tempDir);
            const result = await loader.scanAll();
            
            // 所有文件应被加载
            expect(result.loaded.length).toBe(uniqueNames.length);
            
            // getAlwaysIncluded 应返回所有文件
            const alwaysFiles = loader.getAlwaysIncluded();
            expect(alwaysFiles.length).toBe(uniqueNames.length);
            
            // 清理
            for (const name of uniqueNames) {
              fs.unlinkSync(path.join(steeringDir, `${name}.md`));
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('Property 7.7: fileMatch 模式应只在文件匹配时加载', async () => {
      await fc.assert(
        fc.asyncProperty(validFileNameArb, fc.constantFrom('ts', 'tsx', 'js'), async (name, ext) => {
          // 创建 fileMatch 模式的 steering 文件
          const content = generateSteeringContent({
            inclusion: 'fileMatch',
            fileMatchPattern: `*.${ext}`
          }, '# Test content');
          
          fs.writeFileSync(path.join(steeringDir, `${name}.md`), content);
          
          const loader = new SteeringLoader(tempDir);
          await loader.scanAll();
          
          // 匹配的文件应触发加载
          const matchingFiles = loader.getFileMatchIncluded(`test.${ext}`);
          expect(matchingFiles.length).toBe(1);
          expect(matchingFiles[0].name).toBe(name);
          
          // 不匹配的文件不应触发加载
          const nonMatchingFiles = loader.getFileMatchIncluded('test.other');
          expect(nonMatchingFiles.length).toBe(0);
          
          // 清理
          fs.unlinkSync(path.join(steeringDir, `${name}.md`));
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property 7.8: manual 模式应只在显式引用时加载', async () => {
      await fc.assert(
        fc.asyncProperty(validFileNameArb, async (name) => {
          // 创建 manual 模式的 steering 文件
          const content = generateSteeringContent({ inclusion: 'manual' }, '# Manual content');
          fs.writeFileSync(path.join(steeringDir, `${name}.md`), content);
          
          const loader = new SteeringLoader(tempDir);
          await loader.scanAll();
          
          // getAlwaysIncluded 不应包含 manual 文件
          const alwaysFiles = loader.getAlwaysIncluded();
          expect(alwaysFiles.find(f => f.name === name)).toBeUndefined();
          
          // getManual 应能获取
          const manualFile = loader.getManual(name);
          expect(manualFile).toBeDefined();
          expect(manualFile?.name).toBe(name);
          
          // listManual 应包含该文件
          const manualList = loader.listManual();
          expect(manualList.find(f => f.name === name)).toBeDefined();
          
          // 清理
          fs.unlinkSync(path.join(steeringDir, `${name}.md`));
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property 7.9: 优先级排序应正确', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 10 }),
          async (priorities) => {
            // 创建不同优先级的 steering 文件
            const files: Array<{ name: string; priority: number }> = [];
            
            for (let i = 0; i < priorities.length; i++) {
              const name = `test-${i}`;
              const content = generateSteeringContent({
                inclusion: 'always',
                priority: priorities[i]
              }, `# Priority ${priorities[i]}`);
              
              fs.writeFileSync(path.join(steeringDir, `${name}.md`), content);
              files.push({ name, priority: priorities[i] });
            }
            
            const loader = new SteeringLoader(tempDir);
            await loader.scanAll();
            
            const loaded = loader.getAlwaysIncluded();
            
            // 验证按优先级排序（数字越小优先级越高）
            for (let i = 1; i < loaded.length; i++) {
              const prevPriority = loaded[i - 1].frontMatter.priority ?? 100;
              const currPriority = loaded[i].frontMatter.priority ?? 100;
              expect(prevPriority).toBeLessThanOrEqual(currPriority);
            }
            
            // 清理
            for (const file of files) {
              fs.unlinkSync(path.join(steeringDir, `${file.name}.md`));
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
  
  describe('Context-based Loading', () => {
    beforeEach(() => {
      setupTestEnv();
    });
    
    afterEach(() => {
      cleanupTestEnv();
    });
    
    it('Property 7.10: getForContext 应正确组合所有模式', async () => {
      // 创建三种模式的文件
      const alwaysContent = generateSteeringContent({ inclusion: 'always', priority: 1 }, '# Always');
      const fileMatchContent = generateSteeringContent({
        inclusion: 'fileMatch',
        fileMatchPattern: '*.ts',
        priority: 2
      }, '# FileMatch');
      const manualContent = generateSteeringContent({ inclusion: 'manual', priority: 3 }, '# Manual');
      
      fs.writeFileSync(path.join(steeringDir, 'always-test.md'), alwaysContent);
      fs.writeFileSync(path.join(steeringDir, 'filematch-test.md'), fileMatchContent);
      fs.writeFileSync(path.join(steeringDir, 'manual-test.md'), manualContent);
      
      const loader = new SteeringLoader(tempDir);
      await loader.scanAll();
      
      // 测试不同上下文组合
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          (includeActiveFile, includeManualRef) => {
            const options: { activeFiles?: string[]; manualRefs?: string[] } = {};
            
            if (includeActiveFile) {
              options.activeFiles = ['test.ts'];
            }
            if (includeManualRef) {
              options.manualRefs = ['manual-test'];
            }
            
            const result = loader.getForContext(options);
            
            // always 文件应始终存在
            expect(result.find(f => f.name === 'always-test')).toBeDefined();
            
            // fileMatch 文件应在有匹配文件时存在
            if (includeActiveFile) {
              expect(result.find(f => f.name === 'filematch-test')).toBeDefined();
            } else {
              expect(result.find(f => f.name === 'filematch-test')).toBeUndefined();
            }
            
            // manual 文件应在显式引用时存在
            if (includeManualRef) {
              expect(result.find(f => f.name === 'manual-test')).toBeDefined();
            } else {
              expect(result.find(f => f.name === 'manual-test')).toBeUndefined();
            }
            
            // 结果应按优先级排序
            for (let i = 1; i < result.length; i++) {
              const prevPriority = result[i - 1].frontMatter.priority ?? 100;
              const currPriority = result[i].frontMatter.priority ?? 100;
              expect(prevPriority).toBeLessThanOrEqual(currPriority);
            }
          }
        ),
        { numRuns: 20 }
      );
      
      // 清理
      fs.unlinkSync(path.join(steeringDir, 'always-test.md'));
      fs.unlinkSync(path.join(steeringDir, 'filematch-test.md'));
      fs.unlinkSync(path.join(steeringDir, 'manual-test.md'));
    });
  });
  
  describe('File Reference Resolution', () => {
    beforeEach(() => {
      setupTestEnv();
    });
    
    afterEach(() => {
      cleanupTestEnv();
    });
    
    it('Property 7.11: #[[file:xxx]] 引用应正确解析', () => {
      fc.assert(
        fc.property(validFileNameArb, fc.string({ minLength: 1, maxLength: 100 }), (name, fileContent) => {
          // 创建被引用的文件
          const refFilePath = path.join(tempDir, `${name}.txt`);
          fs.writeFileSync(refFilePath, fileContent);
          
          const loader = new SteeringLoader(tempDir);
          
          // 测试引用解析
          const contentWithRef = `# Test\n\n#[[file:${name}.txt]]\n\nMore content`;
          const resolved = loader.resolveFileReferences(contentWithRef, tempDir);
          
          // 应包含被引用文件的内容
          expect(resolved).toContain(fileContent);
          expect(resolved).toContain(`Included from: ${name}.txt`);
          
          // 清理
          fs.unlinkSync(refFilePath);
        }),
        { numRuns: 30 }
      );
    });
    
    it('Property 7.12: 不存在的文件引用应优雅处理', () => {
      const loader = new SteeringLoader(tempDir);
      
      fc.assert(
        fc.property(validFileNameArb, (name) => {
          const contentWithRef = `# Test\n\n#[[file:nonexistent-${name}.txt]]\n\nMore content`;
          const resolved = loader.resolveFileReferences(contentWithRef, tempDir);
          
          // 应包含 "File not found" 注释
          expect(resolved).toContain('File not found');
          // 不应抛出错误
        }),
        { numRuns: 30 }
      );
    });
  });
});

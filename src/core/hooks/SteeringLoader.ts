/**
 * SteeringLoader - Steering 文件加载器
 * 
 * 实现三种 inclusion 模式：
 * - always: 始终加载
 * - fileMatch: 当匹配文件被读取时加载
 * - manual: 手动引用时加载（#steering-name）
 * 
 * Requirements: 2.2
 */

import * as fs from 'fs';
import * as path from 'path';

// Steering 文件的 inclusion 模式
export type InclusionMode = 'always' | 'fileMatch' | 'manual';

// Front-matter 配置
export interface SteeringFrontMatter {
  inclusion: InclusionMode;
  fileMatchPattern?: string;  // glob 模式，用于 fileMatch 模式
  description?: string;
  priority?: number;  // 加载优先级，数字越小优先级越高
}

// 解析后的 Steering 文件
export interface SteeringFile {
  name: string;           // 文件名（不含扩展名）
  path: string;           // 完整路径
  frontMatter: SteeringFrontMatter;
  content: string;        // 去除 front-matter 后的内容
  rawContent: string;     // 原始内容
}

// 加载结果
export interface LoadResult {
  loaded: SteeringFile[];
  errors: Array<{ file: string; error: string }>;
}

// 默认 front-matter
const DEFAULT_FRONT_MATTER: SteeringFrontMatter = {
  inclusion: 'always',
  priority: 100
};

/**
 * 解析 YAML front-matter
 * 支持格式：
 * ---
 * inclusion: always
 * fileMatchPattern: '*.ts'
 * ---
 */
export function parseFrontMatter(content: string): { frontMatter: SteeringFrontMatter; content: string } {
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = content.match(frontMatterRegex);
  
  if (!match) {
    return {
      frontMatter: { ...DEFAULT_FRONT_MATTER },
      content: content.trim()
    };
  }
  
  const yamlContent = match[1];
  const remainingContent = content.slice(match[0].length).trim();
  
  // 简单的 YAML 解析（不依赖外部库）
  const frontMatter: SteeringFrontMatter = { ...DEFAULT_FRONT_MATTER };
  
  const lines = yamlContent.split(/\r?\n/);
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    
    // 移除引号
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    
    switch (key) {
      case 'inclusion':
        if (value === 'always' || value === 'fileMatch' || value === 'manual') {
          frontMatter.inclusion = value;
        }
        break;
      case 'fileMatchPattern':
        frontMatter.fileMatchPattern = value;
        break;
      case 'description':
        frontMatter.description = value;
        break;
      case 'priority':
        const num = parseInt(value, 10);
        if (!isNaN(num)) {
          frontMatter.priority = num;
        }
        break;
    }
  }
  
  return { frontMatter, content: remainingContent };
}

/**
 * 简单的 glob 模式匹配
 * 支持: *, **, ?
 */
export function matchGlobPattern(pattern: string, filePath: string): boolean {
  // 标准化路径分隔符
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  // 构建正则表达式
  let regexStr = '';
  let i = 0;
  
  while (i < normalizedPattern.length) {
    const char = normalizedPattern[i];
    const nextChar = normalizedPattern[i + 1];
    
    if (char === '*' && nextChar === '*') {
      // ** 匹配任意路径
      if (normalizedPattern[i + 2] === '/') {
        // **/ 匹配零个或多个目录
        regexStr += '(?:[^/]+/)*';
        i += 3;
      } else {
        // ** 匹配任意字符
        regexStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      // * 匹配单层目录中的任意字符
      regexStr += '[^/]*';
      i++;
    } else if (char === '?') {
      // ? 匹配单个字符
      regexStr += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(char)) {
      // 转义正则特殊字符
      regexStr += '\\' + char;
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }
  
  const regex = new RegExp(`^${regexStr}$`, 'i');
  return regex.test(normalizedPath);
}

/**
 * SteeringLoader 类
 */
export class SteeringLoader {
  private steeringDir: string;
  private cache: Map<string, SteeringFile> = new Map();
  private loaded: boolean = false;
  
  constructor(workspaceRoot: string) {
    this.steeringDir = path.join(workspaceRoot, '.kiro', 'steering');
  }
  
  /**
   * 扫描并加载所有 steering 文件
   */
  async scanAll(): Promise<LoadResult> {
    const result: LoadResult = { loaded: [], errors: [] };
    
    if (!fs.existsSync(this.steeringDir)) {
      return result;
    }
    
    try {
      const files = fs.readdirSync(this.steeringDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      for (const file of mdFiles) {
        try {
          const filePath = path.join(this.steeringDir, file);
          const rawContent = fs.readFileSync(filePath, 'utf-8');
          const { frontMatter, content } = parseFrontMatter(rawContent);
          
          const steeringFile: SteeringFile = {
            name: file.replace(/\.md$/, ''),
            path: filePath,
            frontMatter,
            content,
            rawContent
          };
          
          this.cache.set(steeringFile.name, steeringFile);
          result.loaded.push(steeringFile);
        } catch (err) {
          result.errors.push({
            file,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      this.loaded = true;
    } catch (err) {
      result.errors.push({
        file: this.steeringDir,
        error: err instanceof Error ? err.message : String(err)
      });
    }
    
    return result;
  }
  
  /**
   * 获取所有 always 模式的 steering 文件
   */
  getAlwaysIncluded(): SteeringFile[] {
    return Array.from(this.cache.values())
      .filter(s => s.frontMatter.inclusion === 'always')
      .sort((a, b) => (a.frontMatter.priority ?? 100) - (b.frontMatter.priority ?? 100));
  }
  
  /**
   * 根据文件路径获取匹配的 fileMatch steering 文件
   */
  getFileMatchIncluded(filePath: string): SteeringFile[] {
    return Array.from(this.cache.values())
      .filter(s => {
        if (s.frontMatter.inclusion !== 'fileMatch') return false;
        if (!s.frontMatter.fileMatchPattern) return false;
        return matchGlobPattern(s.frontMatter.fileMatchPattern, filePath);
      })
      .sort((a, b) => (a.frontMatter.priority ?? 100) - (b.frontMatter.priority ?? 100));
  }
  
  /**
   * 手动获取指定名称的 steering 文件
   */
  getManual(name: string): SteeringFile | undefined {
    const steering = this.cache.get(name);
    if (steering && steering.frontMatter.inclusion === 'manual') {
      return steering;
    }
    return undefined;
  }
  
  /**
   * 获取所有 manual 模式的 steering 文件列表（用于自动补全）
   */
  listManual(): SteeringFile[] {
    return Array.from(this.cache.values())
      .filter(s => s.frontMatter.inclusion === 'manual')
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * 根据上下文获取应该加载的所有 steering 文件
   */
  getForContext(options: {
    activeFiles?: string[];
    manualRefs?: string[];
  } = {}): SteeringFile[] {
    const result: SteeringFile[] = [];
    const seen = new Set<string>();
    
    // 1. 始终加载 always 模式
    for (const s of this.getAlwaysIncluded()) {
      if (!seen.has(s.name)) {
        result.push(s);
        seen.add(s.name);
      }
    }
    
    // 2. 根据活动文件加载 fileMatch 模式
    if (options.activeFiles) {
      for (const file of options.activeFiles) {
        for (const s of this.getFileMatchIncluded(file)) {
          if (!seen.has(s.name)) {
            result.push(s);
            seen.add(s.name);
          }
        }
      }
    }
    
    // 3. 加载手动引用的 steering
    if (options.manualRefs) {
      for (const ref of options.manualRefs) {
        const s = this.getManual(ref);
        if (s && !seen.has(s.name)) {
          result.push(s);
          seen.add(s.name);
        }
      }
    }
    
    // 按优先级排序
    return result.sort((a, b) => 
      (a.frontMatter.priority ?? 100) - (b.frontMatter.priority ?? 100)
    );
  }
  
  /**
   * 解析内容中的 #[[file:xxx]] 引用
   */
  resolveFileReferences(content: string, workspaceRoot: string): string {
    const refRegex = /#\[\[file:([^\]]+)\]\]/g;
    
    return content.replace(refRegex, (match, relativePath) => {
      try {
        const fullPath = path.join(workspaceRoot, relativePath.trim());
        if (fs.existsSync(fullPath)) {
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          return `\n<!-- Included from: ${relativePath} -->\n${fileContent}\n<!-- End of: ${relativePath} -->\n`;
        }
        return `<!-- File not found: ${relativePath} -->`;
      } catch {
        return `<!-- Error reading: ${relativePath} -->`;
      }
    });
  }
  
  /**
   * 获取所有已加载的 steering 文件
   */
  getAll(): SteeringFile[] {
    return Array.from(this.cache.values());
  }
  
  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.loaded;
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.loaded = false;
  }
  
  /**
   * 重新加载
   */
  async reload(): Promise<LoadResult> {
    this.clearCache();
    return this.scanAll();
  }
}

export default SteeringLoader;

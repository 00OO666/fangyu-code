/**
 * PreciseFileOps - 精确文件操作
 * 
 * 实现 strReplace 功能，唯一匹配验证和精确替换
 * 
 * Requirements: 15.1, 15.2, 15.5
 */

import {
  StrReplaceOptions,
  StrReplaceResult,
  FileEncoding
} from '../types/unified-agent';

// 文件系统接口（用于依赖注入）
export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  detectEncoding(path: string): Promise<FileEncoding>;
}

// Mock 文件系统（用于测试）
export class MockFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private encodings: Map<string, FileEncoding> = new Map();
  
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  
  setEncoding(path: string, encoding: FileEncoding): void {
    this.encodings.set(path, encoding);
  }
  
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }
  
  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
  
  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
  
  async detectEncoding(path: string): Promise<FileEncoding> {
    return this.encodings.get(path) ?? {
      encoding: 'utf-8',
      bom: false,
      lineEnding: 'lf'
    };
  }
}

/**
 * PreciseFileOps 类
 */
export class PreciseFileOps {
  private fs: FileSystem;
  
  constructor(fs?: FileSystem) {
    this.fs = fs ?? new MockFileSystem();
  }
  
  /**
   * 精确字符串替换
   * Requirements: 15.1, 15.2
   */
  async strReplace(options: StrReplaceOptions): Promise<StrReplaceResult> {
    const { path, oldStr, newStr } = options;
    
    // 验证参数
    if (!oldStr) {
      return {
        success: false,
        matchCount: 0,
        error: 'oldStr cannot be empty'
      };
    }
    
    if (oldStr === newStr) {
      return {
        success: false,
        matchCount: 0,
        error: 'oldStr and newStr are identical'
      };
    }
    
    // 检查文件是否存在
    const exists = await this.fs.exists(path);
    if (!exists) {
      return {
        success: false,
        matchCount: 0,
        error: `File not found: ${path}`
      };
    }
    
    // 读取文件内容
    const content = await this.fs.readFile(path);
    
    // 计算匹配数量
    const matchCount = this.countMatches(content, oldStr);
    
    // 验证唯一匹配
    if (matchCount === 0) {
      return {
        success: false,
        matchCount: 0,
        error: 'No matches found for oldStr'
      };
    }
    
    if (matchCount > 1) {
      return {
        success: false,
        matchCount,
        error: `Multiple matches found (${matchCount}). oldStr must uniquely identify a single location.`
      };
    }
    
    // 执行替换 - 使用函数形式避免 $ 特殊字符问题
    const newContent = content.replace(oldStr, () => newStr);
    
    // 保持原始编码
    await this.writeWithEncoding(path, newContent);
    
    return {
      success: true,
      matchCount: 1
    };
  }
  
  /**
   * 批量字符串替换（每个替换必须唯一匹配）
   */
  async strReplaceMultiple(
    replacements: StrReplaceOptions[]
  ): Promise<Map<string, StrReplaceResult>> {
    const results = new Map<string, StrReplaceResult>();
    
    for (const replacement of replacements) {
      const key = `${replacement.path}:${replacement.oldStr.slice(0, 20)}`;
      const result = await this.strReplace(replacement);
      results.set(key, result);
    }
    
    return results;
  }
  
  /**
   * 查找字符串在文件中的位置
   */
  async findString(
    path: string,
    searchStr: string
  ): Promise<Array<{ line: number; column: number; context: string }>> {
    const content = await this.fs.readFile(path);
    const lines = content.split('\n');
    const results: Array<{ line: number; column: number; context: string }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      let column = 0;
      let line = lines[i];
      
      while ((column = line.indexOf(searchStr, column)) !== -1) {
        results.push({
          line: i + 1,
          column: column + 1,
          context: this.getContext(lines, i, column, searchStr.length)
        });
        column += searchStr.length;
      }
    }
    
    return results;
  }
  
  /**
   * 验证替换是否会成功（不实际执行）
   */
  async validateReplace(options: StrReplaceOptions): Promise<{
    valid: boolean;
    matchCount: number;
    error?: string;
    preview?: string;
  }> {
    const { path, oldStr, newStr } = options;
    
    if (!oldStr) {
      return { valid: false, matchCount: 0, error: 'oldStr cannot be empty' };
    }
    
    if (oldStr === newStr) {
      return { valid: false, matchCount: 0, error: 'oldStr and newStr are identical' };
    }
    
    const exists = await this.fs.exists(path);
    if (!exists) {
      return { valid: false, matchCount: 0, error: `File not found: ${path}` };
    }
    
    const content = await this.fs.readFile(path);
    const matchCount = this.countMatches(content, oldStr);
    
    if (matchCount === 0) {
      return { valid: false, matchCount: 0, error: 'No matches found' };
    }
    
    if (matchCount > 1) {
      return {
        valid: false,
        matchCount,
        error: `Multiple matches found (${matchCount})`
      };
    }
    
    // 生成预览
    const preview = content.replace(oldStr, newStr);
    const previewLines = this.generateDiffPreview(content, preview, oldStr, newStr);
    
    return {
      valid: true,
      matchCount: 1,
      preview: previewLines
    };
  }
  
  /**
   * 检测文件编码
   * Requirements: 15.5
   */
  async detectEncoding(path: string): Promise<FileEncoding> {
    return this.fs.detectEncoding(path);
  }
  
  /**
   * 读取文件并保留编码信息
   */
  async readWithEncoding(path: string): Promise<{
    content: string;
    encoding: FileEncoding;
  }> {
    const content = await this.fs.readFile(path);
    const encoding = await this.fs.detectEncoding(path);
    
    return { content, encoding };
  }
  
  /**
   * 写入文件并保持原始编码
   * Requirements: 15.5
   */
  async writeWithEncoding(path: string, content: string): Promise<void> {
    // 获取原始编码
    let encoding: FileEncoding;
    try {
      encoding = await this.fs.detectEncoding(path);
    } catch {
      encoding = { encoding: 'utf-8', bom: false, lineEnding: 'lf' };
    }
    
    // 转换行尾
    let finalContent = content;
    if (encoding.lineEnding === 'crlf') {
      finalContent = content.replace(/\r?\n/g, '\r\n');
    } else {
      finalContent = content.replace(/\r\n/g, '\n');
    }
    
    await this.fs.writeFile(path, finalContent);
  }
  
  /**
   * 追加内容到文件
   */
  async append(path: string, content: string): Promise<void> {
    const exists = await this.fs.exists(path);
    
    if (!exists) {
      await this.fs.writeFile(path, content);
      return;
    }
    
    const existing = await this.fs.readFile(path);
    
    // 确保有换行符分隔
    let newContent: string;
    if (existing.endsWith('\n') || existing.endsWith('\r\n')) {
      newContent = existing + content;
    } else {
      newContent = existing + '\n' + content;
    }
    
    await this.writeWithEncoding(path, newContent);
  }
  
  /**
   * 在指定行插入内容
   */
  async insertAtLine(
    path: string,
    lineNumber: number,
    content: string
  ): Promise<boolean> {
    const fileContent = await this.fs.readFile(path);
    const lines = fileContent.split('\n');
    
    if (lineNumber < 1 || lineNumber > lines.length + 1) {
      return false;
    }
    
    lines.splice(lineNumber - 1, 0, content);
    await this.writeWithEncoding(path, lines.join('\n'));
    
    return true;
  }
  
  /**
   * 删除指定行
   */
  async deleteLine(path: string, lineNumber: number): Promise<boolean> {
    const fileContent = await this.fs.readFile(path);
    const lines = fileContent.split('\n');
    
    if (lineNumber < 1 || lineNumber > lines.length) {
      return false;
    }
    
    lines.splice(lineNumber - 1, 1);
    await this.writeWithEncoding(path, lines.join('\n'));
    
    return true;
  }
  
  /**
   * 删除行范围
   */
  async deleteLines(
    path: string,
    startLine: number,
    endLine: number
  ): Promise<boolean> {
    const fileContent = await this.fs.readFile(path);
    const lines = fileContent.split('\n');
    
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      return false;
    }
    
    lines.splice(startLine - 1, endLine - startLine + 1);
    await this.writeWithEncoding(path, lines.join('\n'));
    
    return true;
  }
  
  // ============================================================================
  // 私有方法
  // ============================================================================
  
  private countMatches(content: string, searchStr: string): number {
    let count = 0;
    let pos = 0;
    
    while ((pos = content.indexOf(searchStr, pos)) !== -1) {
      count++;
      pos += searchStr.length;
    }
    
    return count;
  }
  
  private getContext(
    lines: string[],
    lineIndex: number,
    column: number,
    matchLength: number
  ): string {
    const line = lines[lineIndex];
    const start = Math.max(0, column - 20);
    const end = Math.min(line.length, column + matchLength + 20);
    
    let context = line.slice(start, end);
    if (start > 0) context = '...' + context;
    if (end < line.length) context = context + '...';
    
    return context;
  }
  
  private generateDiffPreview(
    oldContent: string,
    newContent: string,
    oldStr: string,
    newStr: string
  ): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // 找到变化的行
    const matchIndex = oldContent.indexOf(oldStr);
    const linesBefore = oldContent.slice(0, matchIndex).split('\n').length - 1;
    
    const contextLines = 2;
    const startLine = Math.max(0, linesBefore - contextLines);
    const endLine = Math.min(oldLines.length, linesBefore + contextLines + 1);
    
    const preview: string[] = [];
    
    for (let i = startLine; i < endLine; i++) {
      if (i === linesBefore) {
        preview.push(`- ${oldLines[i]}`);
        preview.push(`+ ${newLines[i]}`);
      } else {
        preview.push(`  ${oldLines[i]}`);
      }
    }
    
    return preview.join('\n');
  }
}

export default PreciseFileOps;

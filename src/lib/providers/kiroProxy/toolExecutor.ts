/**
 * Tool Executor - 本地工具执行器
 */

import type { ToolCall, ToolResult, ToolHandler, ExecutionContext } from './types';
import { invoke } from '@tauri-apps/api/core';
import * as path from 'path';

// 工具注册表
const toolRegistry: Map<string, ToolHandler> = new Map();

/**
 * 注册工具
 */
function registerTool(name: string, handler: ToolHandler): void {
  toolRegistry.set(name, handler);
}

/**
 * 执行工具调用
 */
async function execute(toolCall: ToolCall, context: ExecutionContext): Promise<ToolResult> {
  const handler = toolRegistry.get(toolCall.name);
  
  if (!handler) {
    return {
      success: false,
      content: '',
      error: `Unknown tool: ${toolCall.name}`,
    };
  }
  
  try {
    return await handler(toolCall.input, context);
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================
// 内置工具实现
// ============================================================

/**
 * readFile - 读取文件内容
 */
const readFileHandler: ToolHandler = async (input, context) => {
  const filePath = input.path as string;
  if (!filePath) {
    return { success: false, content: '', error: 'Missing required parameter: path' };
  }
  
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(context.workspaceRoot, filePath);
    const content = await invoke<string>('read_file_content', { path: fullPath });
    return { success: true, content };
  } catch (error) {
    return { success: false, content: '', error: `Failed to read file: ${error}` };
  }
};

/**
 * writeFile - 写入文件
 */
const writeFileHandler: ToolHandler = async (input, context) => {
  const filePath = input.path as string;
  const content = input.content as string;
  
  if (!filePath) {
    return { success: false, content: '', error: 'Missing required parameter: path' };
  }
  if (content === undefined) {
    return { success: false, content: '', error: 'Missing required parameter: content' };
  }
  
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(context.workspaceRoot, filePath);
    await invoke('write_file_content', { path: fullPath, content });
    return { success: true, content: `File written: ${filePath}` };
  } catch (error) {
    return { success: false, content: '', error: `Failed to write file: ${error}` };
  }
};

/**
 * strReplace - 字符串替换
 */
const strReplaceHandler: ToolHandler = async (input, context) => {
  const filePath = input.path as string;
  const oldStr = input.oldStr as string;
  const newStr = input.newStr as string;
  
  if (!filePath || oldStr === undefined || newStr === undefined) {
    return { success: false, content: '', error: 'Missing required parameters: path, oldStr, newStr' };
  }
  
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(context.workspaceRoot, filePath);
    const content = await invoke<string>('read_file_content', { path: fullPath });
    
    if (!content.includes(oldStr)) {
      return { success: false, content: '', error: `String not found in file: ${oldStr.substring(0, 50)}...` };
    }
    
    const newContent = content.replace(oldStr, newStr);
    await invoke('write_file_content', { path: fullPath, content: newContent });
    return { success: true, content: `Replaced in ${filePath}` };
  } catch (error) {
    return { success: false, content: '', error: `Failed to replace: ${error}` };
  }
};

/**
 * bash / executePwsh - 执行命令
 */
const bashHandler: ToolHandler = async (input, context) => {
  const command = input.command as string;
  const cwd = (input.cwd as string) || context.workspaceRoot;
  const timeout = (input.timeout as number) || 60000;
  
  if (!command) {
    return { success: false, content: '', error: 'Missing required parameter: command' };
  }
  
  try {
    const result = await invoke<{ stdout: string; stderr: string; exitCode: number }>('execute_command', {
      command,
      cwd,
      timeout,
    });
    
    const output = result.stdout + (result.stderr ? `\nStderr: ${result.stderr}` : '');
    return {
      success: result.exitCode === 0,
      content: output || '(no output)',
      error: result.exitCode !== 0 ? `Exit code: ${result.exitCode}` : undefined,
    };
  } catch (error) {
    return { success: false, content: '', error: `Command failed: ${error}` };
  }
};

/**
 * fileSearch - 搜索文件
 */
const fileSearchHandler: ToolHandler = async (input, context) => {
  const query = input.query as string;
  const pattern = input.pattern as string;
  
  if (!query && !pattern) {
    return { success: false, content: '', error: 'Missing required parameter: query or pattern' };
  }
  
  try {
    const results = await invoke<string[]>('search_files', {
      root: context.workspaceRoot,
      query: query || pattern,
    });
    
    if (results.length === 0) {
      return { success: true, content: 'No files found' };
    }
    
    return { success: true, content: results.join('\n') };
  } catch (error) {
    return { success: false, content: '', error: `Search failed: ${error}` };
  }
};

/**
 * grepSearch - 搜索内容
 */
const grepSearchHandler: ToolHandler = async (input, context) => {
  const query = input.query as string;
  const includePattern = input.includePattern as string;
  
  if (!query) {
    return { success: false, content: '', error: 'Missing required parameter: query' };
  }
  
  try {
    const results = await invoke<Array<{ file: string; line: number; content: string }>>('grep_search', {
      root: context.workspaceRoot,
      query,
      includePattern,
    });
    
    if (results.length === 0) {
      return { success: true, content: 'No matches found' };
    }
    
    const formatted = results.map(r => `${r.file}:${r.line}: ${r.content}`).join('\n');
    return { success: true, content: formatted };
  } catch (error) {
    return { success: false, content: '', error: `Grep failed: ${error}` };
  }
};

/**
 * listDirectory - 列出目录
 */
const listDirectoryHandler: ToolHandler = async (input, context) => {
  const dirPath = (input.path as string) || '.';
  const depth = (input.depth as number) || 1;
  
  try {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(context.workspaceRoot, dirPath);
    const entries = await invoke<Array<{ name: string; isDir: boolean; size: number }>>('list_directory', {
      path: fullPath,
      depth,
    });
    
    const formatted = entries.map(e => {
      const prefix = e.isDir ? '[DIR] ' : '      ';
      return `${prefix}${e.name}`;
    }).join('\n');
    
    return { success: true, content: formatted || '(empty directory)' };
  } catch (error) {
    return { success: false, content: '', error: `Failed to list directory: ${error}` };
  }
};

// 注册所有内置工具
registerTool('readFile', readFileHandler);
registerTool('read_file', readFileHandler);
registerTool('writeFile', writeFileHandler);
registerTool('write_file', writeFileHandler);
registerTool('fsWrite', writeFileHandler);
registerTool('strReplace', strReplaceHandler);
registerTool('str_replace', strReplaceHandler);
registerTool('bash', bashHandler);
registerTool('executePwsh', bashHandler);
registerTool('execute_command', bashHandler);
registerTool('fileSearch', fileSearchHandler);
registerTool('file_search', fileSearchHandler);
registerTool('grepSearch', grepSearchHandler);
registerTool('grep_search', grepSearchHandler);
registerTool('listDirectory', listDirectoryHandler);
registerTool('list_directory', listDirectoryHandler);

export const toolExecutor = {
  execute,
  registerTool,
  getRegisteredTools: () => Array.from(toolRegistry.keys()),
};

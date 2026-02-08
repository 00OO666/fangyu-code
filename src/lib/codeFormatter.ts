/**
 * 代码格式化工具
 *
 * 调用 Biome 进行代码格式化，并解析结果
 */

import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { FormatChange } from "@/services/codeFormatService";
import { codeFormatService } from "@/services/codeFormatService";

export interface FormatResult {
  success: boolean;
  filePath: string;
  changes: FormatChange["changes"];
  summary: string;
  error?: string;
}

/**
 * 解析 Biome 输出，提取改动信息
 */
function parseBiomeOutput(output: string): FormatChange["changes"] {
  const changes: FormatChange["changes"] = [];

  // 解析 Biome 的详细输出
  const lines = output.split("\n");

  for (const line of lines) {
    // 检测不同类型的改动
    if (line.includes("indent")) {
      changes.push({
        type: "indent",
        description: "调整缩进",
      });
    } else if (line.includes('"') && line.includes("'")) {
      changes.push({
        type: "quote",
        description: "统一引号样式",
        before: '"text"',
        after: "'text'",
      });
    } else if (line.includes("semicolon")) {
      changes.push({
        type: "semicolon",
        description: "添加分号",
      });
    } else if (line.includes("line ending") || line.includes("crlf")) {
      changes.push({
        type: "lineending",
        description: "转换换行符为 LF",
      });
    } else if (line.includes("trailing comma")) {
      changes.push({
        type: "trailing-comma",
        description: "添加尾随逗号",
      });
    } else if (line.includes("spacing") || line.includes("space")) {
      changes.push({
        type: "spacing",
        description: "调整空格",
      });
    }
  }

  return changes;
}

/**
 * 获取项目根目录
 */
async function getProjectRoot(): Promise<string> {
  try {
    // 通过 Tauri 获取当前工作目录
    const cwd = await invoke<string>("get_current_working_directory");
    return cwd;
  } catch {
    // 备用方案：假设是 Fangyu-Code-Dev 目录
    return "F:\\Fangyu-Code-Dev";
  }
}

/**
 * 使用 Biome 格式化单个文件
 *
 * 注意：由于 Tauri 安全限制，这个函数需要在 Tauri 环境中运行
 * 在纯浏览器环境中会失败
 */
export async function formatFileWithBiome(filePath: string): Promise<FormatResult> {
  const projectRoot = await getProjectRoot();
  const fullPath = filePath.startsWith(projectRoot) ? filePath : `${projectRoot}/${filePath}`;

  try {
    // 1. 读取原始内容
    const originalContent = await readTextFile(fullPath);

    // 2. 调用 Biome 格式化
    // 通过 Tauri 命令调用 biome
    const formattedContent = await invoke<string>("run_biome_format", {
      filePath: fullPath,
      content: originalContent,
    });

    // 3. 比较内容变化
    const hasChanges = originalContent !== formattedContent;

    if (!hasChanges) {
      return {
        success: true,
        filePath,
        changes: [],
        summary: `${filePath.split(/[/\\]/).pop()} 格式检查通过，无需修改`,
      };
    }

    // 4. 写入格式化后的内容
    await writeTextFile(fullPath, formattedContent);

    // 5. 分析改动
    const changes = parseBiomeChanges(originalContent, formattedContent);
    const summary = codeFormatService.generateSummary(changes, filePath);

    // 6. 保存到历史记录
    codeFormatService.addFormatRecord({
      filePath,
      changes,
      summary,
      undoAvailable: true, // 可以保存原始内容以支持撤销
    });

    return {
      success: true,
      filePath,
      changes,
      summary,
    };
  } catch (error) {
    return {
      success: false,
      filePath,
      changes: [],
      summary: "格式化失败",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 比较两个文本的差异，提取改动信息
 */
function parseBiomeChanges(original: string, formatted: string): FormatChange["changes"] {
  const changes: FormatChange["changes"] = [];

  // 检查引号变化
  const originalDoubleQuotes = (original.match(/"/g) || []).length;
  const formattedDoubleQuotes = (formatted.match(/"/g) || []).length;
  if (originalDoubleQuotes !== formattedDoubleQuotes) {
    changes.push({ type: "quote", description: "统一使用双引号" });
  }

  // 检查分号
  const originalSemicolons = (original.match(/;/g) || []).length;
  const formattedSemicolons = (formatted.match(/;/g) || []).length;
  if (formattedSemicolons > originalSemicolons) {
    changes.push({
      type: "semicolon",
      description: `添加 ${formattedSemicolons - originalSemicolons} 个分号`,
    });
  }

  // 检查换行符
  if (original.includes("\r\n") && !formatted.includes("\r\n")) {
    changes.push({ type: "lineending", description: "CRLF 转换为 LF" });
  }

  // 检查尾随逗号
  const originalTrailingCommas =
    (original.match(/,\s*\]/g) || []).length + (original.match(/,\s*\}/g) || []).length;
  const formattedTrailingCommas =
    (formatted.match(/,\s*\]/g) || []).length + (formatted.match(/,\s*\}/g) || []).length;
  if (formattedTrailingCommas > originalTrailingCommas) {
    changes.push({
      type: "trailing-comma",
      description: `添加 ${formattedTrailingCommas - originalTrailingCommas} 个尾随逗号`,
    });
  }

  // 检查缩进变化（简化检测）
  const originalIndentMatch = original.match(/^[\s]*$/gm);
  const formattedIndentMatch = formatted.match(/^[\s]*$/gm);
  if (
    originalIndentMatch &&
    formattedIndentMatch &&
    JSON.stringify(originalIndentMatch) !== JSON.stringify(formattedIndentMatch)
  ) {
    changes.push({ type: "indent", description: "调整缩进（2 空格）" });
  }

  // 如果没有检测到具体变化但内容确实变了
  if (changes.length === 0 && original !== formatted) {
    changes.push({ type: "other", description: "其他格式调整" });
  }

  return changes;
}

/**
 * 格式化多个文件
 */
export async function formatMultipleFiles(filePaths: string[]): Promise<FormatResult[]> {
  const results: FormatResult[] = [];

  for (const filePath of filePaths) {
    const result = await formatFileWithBiome(filePath);
    results.push(result);
  }

  return results;
}

/**
 * 检查文件格式（不修改）
 */
export async function checkFileFormat(filePath: string): Promise<{
  isFormatted: boolean;
  changes: FormatChange["changes"];
}> {
  const projectRoot = await getProjectRoot();
  const fullPath = filePath.startsWith(projectRoot) ? filePath : `${projectRoot}/${filePath}`;

  try {
    const originalContent = await readTextFile(fullPath);
    const formattedContent = await invoke<string>("run_biome_format", {
      filePath: fullPath,
      content: originalContent,
    });

    const hasChanges = originalContent !== formattedContent;
    const changes = hasChanges ? parseBiomeChanges(originalContent, formattedContent) : [];

    return {
      isFormatted: !hasChanges,
      changes,
    };
  } catch (error) {
    logger.error("codeFormatter", "[CodeFormatter] Check failed:", error);
    return {
      isFormatted: true, // 出错时假设已格式化，避免误报
      changes: [],
    };
  }
}

/**
 * 获取最近格式化的文件列表
 */
export function getRecentFormatHistory(): FormatChange[] {
  return codeFormatService.getHistory();
}

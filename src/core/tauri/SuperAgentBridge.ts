/**
 * SuperAgentBridge - Tauri 前后端桥接层
 *
 * 提供类型安全的 Tauri invoke 封装
 *
 * Requirements: 8.4
 */

import { invoke } from "@tauri-apps/api/core";

// =============================================================================
// 类型定义
// =============================================================================

/** 操作风险级别 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** 操作类型 */
export type OperationType =
  | "file_create"
  | "file_modify"
  | "file_delete"
  | "command_execute"
  | "git_commit"
  | "git_push"
  | "install_package"
  | "config_change"
  | "network_request";

/** 文件操作结果 */
export interface FileOperationResult {
  success: boolean;
  path: string;
  error?: string;
  content?: string;
}

/** 命令执行结果 */
export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code?: number;
  duration_ms: number;
}

/** 二进制检测结果 */
export interface BinaryCheckResult {
  installed: boolean;
  path?: string;
  version?: string;
  source?: string;
}

/** 进程信息 */
export interface ProcessInfo {
  id: number;
  command: string;
  status: string;
  started_at: number;
}

/** 安全验证结果 */
export interface SecurityValidation {
  valid: boolean;
  risk_level: RiskLevel;
  warnings: string[];
  blocked_reason?: string;
}

// =============================================================================
// 文件操作
// =============================================================================

/**
 * 读取文件内容
 */
export async function readFile(path: string): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("super_agent_read_file", { path });
}

/**
 * 写入文件内容
 */
export async function writeFile(path: string, content: string): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("super_agent_write_file", { path, content });
}

/**
 * 删除文件
 */
export async function deleteFile(path: string): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("super_agent_delete_file", { path });
}

/**
 * 字符串替换（精确替换）
 */
export async function strReplace(
  path: string,
  oldStr: string,
  newStr: string
): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("super_agent_str_replace", {
    path,
    old_str: oldStr,
    new_str: newStr,
  });
}

// =============================================================================
// Shell 执行
// =============================================================================

/**
 * 执行 Shell 命令
 */
export async function executeCommand(
  command: string,
  options?: {
    cwd?: string;
    timeoutMs?: number;
  }
): Promise<CommandResult> {
  return invoke<CommandResult>("super_agent_execute_command", {
    command,
    cwd: options?.cwd,
    timeout_ms: options?.timeoutMs,
  });
}

/**
 * 检测二进制是否可用（用于 Node/npm 等）
 */
export async function checkBinary(tool: string): Promise<BinaryCheckResult> {
  return invoke<BinaryCheckResult>("super_agent_check_binary", { tool });
}

/**
 * 检查命令是否为长时间运行命令
 */
export async function isLongRunning(command: string): Promise<boolean> {
  return invoke<boolean>("super_agent_is_long_running", { command });
}

// =============================================================================
// 安全验证
// =============================================================================

/**
 * 验证命令安全性
 */
export async function validateCommand(command: string): Promise<SecurityValidation> {
  return invoke<SecurityValidation>("super_agent_validate_command", { command });
}

/**
 * 验证路径安全性
 */
export async function validatePath(path: string): Promise<SecurityValidation> {
  return invoke<SecurityValidation>("super_agent_validate_path", { path });
}

/**
 * 评估操作风险
 */
export async function assessRisk(
  operationType: OperationType,
  details?: Record<string, string>
): Promise<RiskLevel> {
  return invoke<RiskLevel>("super_agent_assess_risk", {
    operation_type: operationType,
    details,
  });
}

/**
 * 脱敏敏感信息
 */
export async function redactSensitive(text: string): Promise<string> {
  return invoke<string>("super_agent_redact_sensitive", { text });
}

// =============================================================================
// 高级封装
// =============================================================================

/**
 * 安全执行命令（带验证）
 */
export async function safeExecuteCommand(
  command: string,
  options?: {
    cwd?: string;
    timeoutMs?: number;
    allowHighRisk?: boolean;
  }
): Promise<CommandResult & { validation: SecurityValidation }> {
  const validation = await validateCommand(command);

  if (!validation.valid) {
    return {
      success: false,
      stdout: "",
      stderr: validation.blocked_reason ?? "Command blocked",
      duration_ms: 0,
      validation,
    };
  }

  if (
    !options?.allowHighRisk &&
    (validation.risk_level === "high" || validation.risk_level === "critical")
  ) {
    return {
      success: false,
      stdout: "",
      stderr: `Command blocked due to ${validation.risk_level} risk level`,
      duration_ms: 0,
      validation,
    };
  }

  const result = await executeCommand(command, options);
  return { ...result, validation };
}

/**
 * 安全写入文件（带验证）
 */
export async function safeWriteFile(
  path: string,
  content: string
): Promise<FileOperationResult & { validation: SecurityValidation }> {
  const validation = await validatePath(path);

  if (!validation.valid) {
    return {
      success: false,
      path,
      error: validation.blocked_reason ?? "Path blocked",
      validation,
    };
  }

  const result = await writeFile(path, content);
  return { ...result, validation };
}

/**
 * 安全删除文件（带验证）
 */
export async function safeDeleteFile(
  path: string
): Promise<FileOperationResult & { validation: SecurityValidation }> {
  const validation = await validatePath(path);

  if (!validation.valid) {
    return {
      success: false,
      path,
      error: validation.blocked_reason ?? "Path blocked",
      validation,
    };
  }

  const result = await deleteFile(path);
  return { ...result, validation };
}

// =============================================================================
// 导出
// =============================================================================

export const SuperAgentBridge = {
  // 文件操作
  readFile,
  writeFile,
  deleteFile,
  strReplace,
  safeWriteFile,
  safeDeleteFile,

  // Shell 执行
  executeCommand,
  isLongRunning,
  safeExecuteCommand,

  // 安全验证
  validateCommand,
  validatePath,
  assessRisk,
  redactSensitive,
};

export default SuperAgentBridge;

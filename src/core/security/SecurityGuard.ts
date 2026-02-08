/**
 * SecurityGuard - 安全防护层
 *
 * 实现路径验证、命令安全检查、敏感信息脱敏、审计日志
 *
 * Requirements: 12.1-12.7
 */

import {
  SecurityConfig,
  ValidationResult,
  SensitiveMatch,
  Operation,
  OperationType,
  AuditEntry,
} from "../types/unified-agent";

// 默认危险命令列表
export const DEFAULT_DANGEROUS_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "rm -rf ~",
  "rm -rf ~/*",
  "dd if=/dev/zero",
  "mkfs",
  ":(){:|:&};:",
  "chmod -R 777 /",
  "chown -R",
  "> /dev/sda",
  "mv /* /dev/null",
  "wget http",
  "curl http",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "init 0",
  "init 6",
  "format c:",
  "del /f /s /q c:\\*",
  "rd /s /q c:\\",
];

// 默认敏感信息模式
export const DEFAULT_SENSITIVE_PATTERNS: RegExp[] = [
  // API Keys
  /(?:api[_-]?key|apikey)[=:\s]+['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
  // AWS Keys
  /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
  // AWS Secret
  /(?:aws[_-]?secret[_-]?access[_-]?key)[=:\s]+['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
  // Private Keys
  /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  // Passwords
  /(?:password|passwd|pwd)[=:\s]+['"]?([^\s'"]{8,})['"]?/gi,
  // Tokens
  /(?:token|bearer|auth)[=:\s]+['"]?([a-zA-Z0-9_.-]{20,})['"]?/gi,
  // Database URLs
  /(?:mongodb|mysql|postgres|redis):\/\/[^\s]+/gi,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Phone numbers
  /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  // Credit card numbers
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  // SSN
  /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g,
  // IP addresses (private)
  /\b(?:10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)[0-9]{1,3}\.[0-9]{1,3}\b/g,
];

// 脱敏类型映射
const REDACTION_LABELS: Record<string, string> = {
  api_key: "[REDACTED_API_KEY]",
  aws_key: "[REDACTED_AWS_KEY]",
  private_key: "[REDACTED_PRIVATE_KEY]",
  password: "[REDACTED_PASSWORD]",
  token: "[REDACTED_TOKEN]",
  database_url: "[REDACTED_DB_URL]",
  email: "[REDACTED_EMAIL]",
  phone: "[REDACTED_PHONE]",
  credit_card: "[REDACTED_CC]",
  ssn: "[REDACTED_SSN]",
  ip_address: "[REDACTED_IP]",
};

/**
 * SecurityGuard 类
 */
export class SecurityGuard {
  private config: SecurityConfig;
  private auditLog: AuditEntry[] = [];
  private operationCounter = 0;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      workspaceBoundary: config.workspaceBoundary ?? process.cwd(),
      dangerousCommands: config.dangerousCommands ?? DEFAULT_DANGEROUS_COMMANDS,
      sensitivePatterns: config.sensitivePatterns ?? DEFAULT_SENSITIVE_PATTERNS,
      commandWhitelist: config.commandWhitelist,
    };
  }

  /**
   * 验证路径是否在工作区内
   * Requirements: 12.1, 12.2
   */
  validatePath(path: string): ValidationResult {
    // 规范化路径
    const normalizedPath = this.normalizePath(path);
    const normalizedBoundary = this.normalizePath(this.config.workspaceBoundary);

    // 检查路径遍历攻击
    if (this.hasPathTraversal(path)) {
      return {
        valid: false,
        reason: "Path contains traversal sequences (..)",
        severity: "error",
      };
    }

    // 检查是否在工作区边界内
    if (!this.isWithinWorkspace(normalizedPath, normalizedBoundary)) {
      return {
        valid: false,
        reason: `Path is outside workspace boundary: ${this.config.workspaceBoundary}`,
        severity: "error",
      };
    }

    // 检查敏感系统路径
    if (this.isSensitiveSystemPath(normalizedPath)) {
      return {
        valid: false,
        reason: "Access to sensitive system path is not allowed",
        severity: "error",
      };
    }

    return { valid: true };
  }

  /**
   * 检查路径是否在工作区内
   */
  isWithinWorkspace(path: string, boundary?: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const normalizedBoundary = this.normalizePath(boundary ?? this.config.workspaceBoundary);

    // 确保边界以 / 结尾进行比较，避免 /workspaceother 被误判为在 /workspace 内
    const boundaryWithSlash = normalizedBoundary.endsWith("/")
      ? normalizedBoundary
      : normalizedBoundary + "/";

    // 路径完全等于边界，或者路径以边界+/开头
    return normalizedPath === normalizedBoundary || normalizedPath.startsWith(boundaryWithSlash);
  }

  /**
   * 验证命令是否安全
   * Requirements: 12.3, 12.6
   */
  validateCommand(command: string): ValidationResult {
    // 检查是否在白名单中
    if (this.config.commandWhitelist) {
      const isWhitelisted = this.config.commandWhitelist.some(
        (pattern) => command.startsWith(pattern) || new RegExp(pattern).test(command)
      );
      if (isWhitelisted) {
        return { valid: true };
      }
    }

    // 检查是否是危险命令
    if (this.isDangerousCommand(command)) {
      return {
        valid: false,
        reason: "Command is potentially dangerous",
        severity: "error",
      };
    }

    // 检查命令注入
    if (this.hasCommandInjection(command)) {
      return {
        valid: false,
        reason: "Command contains potential injection patterns",
        severity: "error",
      };
    }

    return { valid: true };
  }

  /**
   * 检查是否是危险命令
   * Requirements: 12.7
   */
  isDangerousCommand(command: string): boolean {
    const lowerCommand = command.toLowerCase();

    return this.config.dangerousCommands.some((dangerous) => {
      const lowerDangerous = dangerous.toLowerCase();
      return (
        lowerCommand.includes(lowerDangerous) ||
        lowerCommand.startsWith(lowerDangerous.split(" ")[0])
      );
    });
  }

  /**
   * 检测敏感信息
   * Requirements: 12.4
   */
  detectSensitiveInfo(text: string): SensitiveMatch[] {
    const matches: SensitiveMatch[] = [];

    for (let i = 0; i < this.config.sensitivePatterns.length; i++) {
      const pattern = this.config.sensitivePatterns[i];
      const type = this.getPatternType(i);

      // 重置正则表达式状态
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          type,
          start: match.index,
          end: match.index + match[0].length,
          redacted: REDACTION_LABELS[type] ?? "[REDACTED]",
        });
      }
    }

    // 按位置排序并去重
    return this.deduplicateMatches(matches);
  }

  /**
   * 脱敏敏感信息
   * Requirements: 12.4
   */
  redactSensitiveInfo(text: string): string {
    const matches = this.detectSensitiveInfo(text);

    if (matches.length === 0) {
      return text;
    }

    // 从后向前替换，避免位置偏移
    let result = text;
    const sortedMatches = [...matches].sort((a, b) => b.start - a.start);

    for (const match of sortedMatches) {
      result = result.slice(0, match.start) + match.redacted + result.slice(match.end);
    }

    return result;
  }

  /**
   * 记录操作到审计日志
   * Requirements: 12.5
   */
  logOperation(
    operation: Operation,
    result: "success" | "failure" | "blocked",
    duration: number,
    error?: string
  ): AuditEntry {
    const entry: AuditEntry = {
      id: `audit-${++this.operationCounter}-${Date.now()}`,
      operation,
      result,
      duration,
      error,
    };

    this.auditLog.push(entry);

    // 限制日志大小
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }

    return entry;
  }

  /**
   * 获取审计日志
   */
  getAuditLog(options?: {
    limit?: number;
    offset?: number;
    type?: OperationType;
    result?: "success" | "failure" | "blocked";
    since?: number;
  }): AuditEntry[] {
    let entries = [...this.auditLog];

    // 按类型过滤
    if (options?.type) {
      entries = entries.filter((e) => e.operation.type === options.type);
    }

    // 按结果过滤
    if (options?.result) {
      entries = entries.filter((e) => e.result === options.result);
    }

    // 按时间过滤
    if (options?.since) {
      const sinceTime = options.since;
      entries = entries.filter((e) => e.operation.timestamp >= sinceTime);
    }

    // 分页
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? entries.length;

    return entries.slice(offset, offset + limit);
  }

  /**
   * 清除审计日志
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * 获取审计统计
   */
  getAuditStats(): {
    total: number;
    success: number;
    failure: number;
    blocked: number;
    byType: Record<OperationType, number>;
  } {
    const stats = {
      total: this.auditLog.length,
      success: 0,
      failure: 0,
      blocked: 0,
      byType: {} as Record<OperationType, number>,
    };

    for (const entry of this.auditLog) {
      if (entry.result === "success") stats.success++;
      else if (entry.result === "failure") stats.failure++;
      else if (entry.result === "blocked") stats.blocked++;

      const type = entry.operation.type;
      stats.byType[type] = (stats.byType[type] ?? 0) + 1;
    }

    return stats;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    if (config.workspaceBoundary !== undefined) {
      this.config.workspaceBoundary = config.workspaceBoundary;
    }
    if (config.dangerousCommands !== undefined) {
      this.config.dangerousCommands = config.dangerousCommands;
    }
    if (config.sensitivePatterns !== undefined) {
      this.config.sensitivePatterns = config.sensitivePatterns;
    }
    if (config.commandWhitelist !== undefined) {
      this.config.commandWhitelist = config.commandWhitelist;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private normalizePath(path: string): string {
    // 统一路径分隔符
    let normalized = path.replace(/\\/g, "/");

    // 移除末尾斜杠
    while (normalized.endsWith("/") && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }

    // 转换为小写（Windows 不区分大小写）
    if (process.platform === "win32") {
      normalized = normalized.toLowerCase();
    }

    return normalized;
  }

  private hasPathTraversal(path: string): boolean {
    // 检查 .. 序列
    return /(?:^|[/\\])\.\.(?:[/\\]|$)/.test(path);
  }

  private isSensitiveSystemPath(path: string): boolean {
    const sensitivePaths = [
      "/etc/passwd",
      "/etc/shadow",
      "/etc/sudoers",
      "/root",
      "/var/log",
      "c:/windows/system32",
      "c:/windows/syswow64",
      "c:/program files",
      "c:/programdata",
    ];

    const lowerPath = path.toLowerCase();
    return sensitivePaths.some((sensitive) => lowerPath.startsWith(sensitive));
  }

  private hasCommandInjection(command: string): boolean {
    // 检查常见的命令注入模式
    const injectionPatterns = [
      /[;&|`$]/, // 命令分隔符和替换
      /\$\(.*\)/, // 命令替换
      /`.*`/, // 反引号命令替换
      />\s*\/dev\//, // 重定向到设备
      /\|\s*(?:sh|bash|zsh|cmd|powershell)/, // 管道到 shell
      /eval\s+/, // eval 命令
      /exec\s+/, // exec 命令
    ];

    return injectionPatterns.some((pattern) => pattern.test(command));
  }

  private getPatternType(index: number): string {
    const types = [
      "api_key",
      "aws_key",
      "aws_secret",
      "private_key",
      "password",
      "token",
      "database_url",
      "email",
      "phone",
      "credit_card",
      "ssn",
      "ip_address",
    ];
    return types[index] ?? "unknown";
  }

  private deduplicateMatches(matches: SensitiveMatch[]): SensitiveMatch[] {
    // 按起始位置排序
    const sorted = [...matches].sort((a, b) => a.start - b.start);

    // 去除重叠的匹配
    const result: SensitiveMatch[] = [];
    let lastEnd = -1;

    for (const match of sorted) {
      if (match.start >= lastEnd) {
        result.push(match);
        lastEnd = match.end;
      }
    }

    return result;
  }
}

export default SecurityGuard;

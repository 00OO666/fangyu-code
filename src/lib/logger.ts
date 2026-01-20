/**
 * Logger Service
 *
 * 统一的日志管理服务，替代分散的 console.log
 *
 * 功能：
 * - 日志级别控制（debug, info, warn, error）
 * - 开发/生产环境区分
 * - 日志格式化
 * - 性能监控
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  showTimestamp: boolean;
  showCaller: boolean }

class LoggerService {
  private config: LoggerConfig = {
    enabled: import.meta.env.DEV,
    level: 'debug',
    showTimestamp: true,
    showCaller: false,
  };

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * 配置日志服务
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config } }

  /**
   * 检查是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return this.levelPriority[level] >= this.levelPriority[this.config.level] }

  /**
   * 格式化日志消息
   */
  private format(level: LogLevel, module: string, message: string, ...args: any[]): string {
    const parts: string[] = [];

    if (this.config.showTimestamp) {
      const now = new Date();
      const time = now.toLocaleTimeString('zh-CN', { hour12: false });
      parts.push(`[${time}]`) }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(`[${module}]`);
    parts.push(message);

    return parts.join(' ') }

  /**
   * Debug 日志（仅开发环境）
   */
  debug(module: string, message: string, ...args: any[]): void {
    if (!this.shouldLog('debug')) return;
    const formatted = this.format('debug', module, message);
    console.debug(formatted, ...args) }

  /**
   * Info 日志
   */
  info(module: string, message: string, ...args: any[]): void {
    if (!this.shouldLog('info')) return;
    const formatted = this.format('info', module, message);
    console.info(formatted, ...args) }

  /**
   * Warning 日志
   */
  warn(module: string, message: string, ...args: any[]): void {
    if (!this.shouldLog('warn')) return;
    const formatted = this.format('warn', module, message);
    console.warn(formatted, ...args) }

  /**
   * Error 日志（始终输出）
   */
  error(module: string, message: string, error?: Error | unknown, ...args: any[]): void {
    if (!this.shouldLog('error')) return;
    const formatted = this.format('error', module, message);

    if (error instanceof Error) {
      console.error(formatted, error.message, error.stack, ...args) } else {
      console.error(formatted, error, ...args) }
  }

  /**
   * 性能监控
   */
  time(label: string): void {
    if (!this.config.enabled) return;
    console.time(label) }

  timeEnd(label: string): void {
    if (!this.config.enabled) return;
    console.timeEnd(label) }

  /**
   * 分组日志
   */
  group(label: string): void {
    if (!this.config.enabled) return;
    console.group(label) }

  groupEnd(): void {
    if (!this.config.enabled) return;
    console.groupEnd() }
}

// 单例实例
export const logger = new LoggerService();

// 便捷导出
export default logger;

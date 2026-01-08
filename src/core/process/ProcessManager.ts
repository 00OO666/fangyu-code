/**
 * ProcessManager - 进程管理系统
 * 
 * 实现 execute、startBackground、stopBackground、listProcesses、getOutput 方法
 * 
 * Requirements: 13.1-13.7
 */

import {
  BackgroundProcess,
  ProcessStatus,
  ExecuteOptions,
  ExecuteResult
} from '../types/unified-agent';

// 长时间运行命令模式
const LONG_RUNNING_PATTERNS = [
  /^npm\s+run\s+(dev|start|watch|serve)/i,
  /^yarn\s+(dev|start|watch|serve)/i,
  /^pnpm\s+(dev|start|watch|serve)/i,
  /^node\s+.*--watch/i,
  /^nodemon/i,
  /^webpack\s+.*--watch/i,
  /^vite(\s|$)/i,
  /^next\s+dev/i,
  /^nuxt\s+dev/i,
  /^gatsby\s+develop/i,
  /^python\s+.*manage\.py\s+runserver/i,
  /^flask\s+run/i,
  /^uvicorn/i,
  /^gunicorn/i,
  /^rails\s+server/i,
  /^php\s+artisan\s+serve/i,
  /^cargo\s+watch/i,
  /^go\s+run\s+.*--watch/i,
  /^jest\s+--watch/i,
  /^vitest(\s|$)(?!.*--run)/i,
  /^mocha\s+--watch/i,
  /^tsc\s+--watch/i,
  /^tailwindcss\s+.*--watch/i
];

// 进程执行器接口（用于依赖注入）
export interface ProcessExecutor {
  execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;
  spawn(command: string, options?: ExecuteOptions): Promise<number>;
  kill(pid: number): Promise<boolean>;
  getOutput(pid: number, lines?: number): Promise<string[]>;
  isRunning(pid: number): Promise<boolean>;
}

// Mock 进程执行器（用于测试）
export class MockProcessExecutor implements ProcessExecutor {
  private processes: Map<number, {
    command: string;
    status: ProcessStatus;
    output: string[];
    exitCode?: number;
  }> = new Map();
  private nextPid = 1000;
  private executeResults: Map<string, ExecuteResult> = new Map();
  
  setExecuteResult(command: string, result: ExecuteResult): void {
    this.executeResults.set(command, result);
  }
  
  async execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult> {
    const result = this.executeResults.get(command);
    if (result) {
      return result;
    }
    
    // 默认成功结果
    return {
      success: true,
      stdout: `Executed: ${command}`,
      stderr: '',
      exitCode: 0,
      duration: 100
    };
  }
  
  async spawn(command: string, options?: ExecuteOptions): Promise<number> {
    const pid = this.nextPid++;
    this.processes.set(pid, {
      command,
      status: 'running',
      output: [`[${pid}] Started: ${command}`]
    });
    return pid;
  }
  
  async kill(pid: number): Promise<boolean> {
    const process = this.processes.get(pid);
    if (!process) return false;
    
    process.status = 'stopped';
    process.output.push(`[${pid}] Stopped`);
    return true;
  }
  
  async getOutput(pid: number, lines?: number): Promise<string[]> {
    const process = this.processes.get(pid);
    if (!process) return [];
    
    if (lines) {
      return process.output.slice(-lines);
    }
    return [...process.output];
  }
  
  async isRunning(pid: number): Promise<boolean> {
    const process = this.processes.get(pid);
    return process?.status === 'running';
  }
  
  // 测试辅助方法
  addOutput(pid: number, line: string): void {
    const process = this.processes.get(pid);
    if (process) {
      process.output.push(line);
    }
  }
  
  setStatus(pid: number, status: ProcessStatus): void {
    const process = this.processes.get(pid);
    if (process) {
      process.status = status;
    }
  }
}

/**
 * ProcessManager 类
 */
export class ProcessManager {
  private executor: ProcessExecutor;
  private backgroundProcesses: Map<number, BackgroundProcess> = new Map();
  private processIdCounter = 0;
  private defaultTimeout: number;
  private maxBackgroundProcesses: number;
  
  constructor(
    executor?: ProcessExecutor,
    options?: {
      defaultTimeout?: number;
      maxBackgroundProcesses?: number;
    }
  ) {
    this.executor = executor ?? new MockProcessExecutor();
    this.defaultTimeout = options?.defaultTimeout ?? 30000;
    this.maxBackgroundProcesses = options?.maxBackgroundProcesses ?? 10;
  }
  
  /**
   * 执行命令
   * Requirements: 13.1
   */
  async execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult> {
    // 检查是否是长时间运行命令
    if (this.isLongRunning(command) && !options?.background) {
      return {
        success: false,
        stdout: '',
        stderr: `Command "${command}" appears to be long-running. Use startBackground() instead or set background: true.`,
        exitCode: 1,
        duration: 0
      };
    }
    
    const startTime = Date.now();
    
    try {
      const result = await this.executor.execute(command, {
        ...options,
        timeout: options?.timeout ?? this.defaultTimeout
      });
      
      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * 启动后台进程
   * Requirements: 13.2
   */
  async startBackground(command: string, path?: string): Promise<BackgroundProcess> {
    // 检查是否达到最大进程数
    const runningCount = this.getRunningProcessCount();
    if (runningCount >= this.maxBackgroundProcesses) {
      throw new Error(`Maximum background processes (${this.maxBackgroundProcesses}) reached`);
    }
    
    // 检查是否已有相同命令在运行
    const existing = this.findExistingProcess(command, path);
    if (existing) {
      return existing;
    }
    
    const pid = await this.executor.spawn(command, { cwd: path });
    const processId = ++this.processIdCounter;
    
    const bgProcess: BackgroundProcess = {
      id: processId,
      command,
      path: path ?? '.',
      status: 'running',
      startTime: Date.now(),
      output: [],
      pid
    };
    
    this.backgroundProcesses.set(processId, bgProcess);
    
    return bgProcess;
  }
  
  /**
   * 停止后台进程
   * Requirements: 13.3
   */
  async stopBackground(processId: number): Promise<boolean> {
    const process = this.backgroundProcesses.get(processId);
    if (!process) {
      return false;
    }
    
    if (process.pid) {
      await this.executor.kill(process.pid);
    }
    
    process.status = 'stopped';
    return true;
  }
  
  /**
   * 列出所有后台进程
   * Requirements: 13.4
   */
  listProcesses(): BackgroundProcess[] {
    return Array.from(this.backgroundProcesses.values());
  }
  
  /**
   * 获取进程输出
   * Requirements: 13.6
   */
  async getOutput(processId: number, lines?: number): Promise<string[]> {
    const process = this.backgroundProcesses.get(processId);
    if (!process || !process.pid) {
      return [];
    }
    
    const output = await this.executor.getOutput(process.pid, lines);
    process.output = output;
    return output;
  }
  
  /**
   * 检查是否是长时间运行命令
   * Requirements: 13.5
   */
  isLongRunning(command: string): boolean {
    return LONG_RUNNING_PATTERNS.some(pattern => pattern.test(command));
  }
  
  /**
   * 建议使用后台模式
   */
  suggestBackgroundMode(command: string): string | null {
    if (this.isLongRunning(command)) {
      return `Command "${command}" appears to be long-running. Consider using background mode for better control.`;
    }
    return null;
  }
  
  /**
   * 获取进程状态
   */
  async getProcessStatus(processId: number): Promise<ProcessStatus | null> {
    const process = this.backgroundProcesses.get(processId);
    if (!process) {
      return null;
    }
    
    // 更新状态
    if (process.pid && process.status === 'running') {
      const isRunning = await this.executor.isRunning(process.pid);
      if (!isRunning) {
        process.status = 'stopped';
      }
    }
    
    return process.status;
  }
  
  /**
   * 获取进程详情
   */
  getProcess(processId: number): BackgroundProcess | null {
    return this.backgroundProcesses.get(processId) ?? null;
  }
  
  /**
   * 清理已停止的进程
   */
  cleanupStopped(): number {
    let cleaned = 0;
    
    for (const [id, process] of this.backgroundProcesses) {
      if (process.status === 'stopped') {
        this.backgroundProcesses.delete(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  /**
   * 停止所有后台进程
   */
  async stopAll(): Promise<number> {
    let stopped = 0;
    
    for (const [id, process] of this.backgroundProcesses) {
      if (process.status === 'running') {
        await this.stopBackground(id);
        stopped++;
      }
    }
    
    return stopped;
  }
  
  /**
   * 获取运行中的进程数量
   */
  getRunningProcessCount(): number {
    let count = 0;
    for (const process of this.backgroundProcesses.values()) {
      if (process.status === 'running') {
        count++;
      }
    }
    return count;
  }
  
  // ============================================================================
  // 私有方法
  // ============================================================================
  
  private findExistingProcess(command: string, path?: string): BackgroundProcess | null {
    for (const process of this.backgroundProcesses.values()) {
      if (process.command === command && 
          process.path === (path ?? '.') && 
          process.status === 'running') {
        return process;
      }
    }
    return null;
  }
}

export default ProcessManager;

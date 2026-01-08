/**
 * ProcessManager 属性测试
 * 
 * Validates: Requirements 13.1-13.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ProcessManager, MockProcessExecutor } from './ProcessManager';

// 生成安全的命令
const safeCommandArb = fc.constantFrom(
  'echo hello',
  'ls -la',
  'cat file.txt',
  'npm install',
  'git status',
  'node --version',
  'python --version'
);

// 生成长时间运行命令
const longRunningCommandArb = fc.constantFrom(
  'npm run dev',
  'npm run start',
  'yarn dev',
  'vite',
  'next dev',
  'nodemon app.js',
  'webpack --watch',
  'jest --watch',
  'vitest'
);

// 生成路径
const pathArb = fc.constantFrom(
  '/workspace',
  '/workspace/src',
  '/workspace/packages/app',
  '.'
);

describe('ProcessManager Property Tests', () => {
  let executor: MockProcessExecutor;
  let manager: ProcessManager;
  
  beforeEach(() => {
    executor = new MockProcessExecutor();
    manager = new ProcessManager(executor, {
      defaultTimeout: 5000,
      maxBackgroundProcesses: 5
    });
  });
  
  describe('Execute Properties (13.1)', () => {
    it('Property: 安全命令应成功执行', async () => {
      await fc.assert(
        fc.asyncProperty(safeCommandArb, async (command) => {
          const result = await manager.execute(command);
          expect(result.success).toBe(true);
          expect(result.exitCode).toBe(0);
        }),
        { numRuns: 20 }
      );
    });
    
    it('Property: 执行结果应包含 duration', async () => {
      const result = await manager.execute('echo test');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
    
    it('Property: 失败的命令应返回错误信息', async () => {
      executor.setExecuteResult('fail-command', {
        success: false,
        stdout: '',
        stderr: 'Command failed',
        exitCode: 1,
        duration: 50
      });
      
      const result = await manager.execute('fail-command');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });
  
  describe('Long Running Detection Properties (13.5)', () => {
    it('Property: 长时间运行命令应被检测', () => {
      fc.assert(
        fc.property(longRunningCommandArb, (command) => {
          expect(manager.isLongRunning(command)).toBe(true);
        }),
        { numRuns: 20 }
      );
    });
    
    it('Property: 普通命令不应被标记为长时间运行', () => {
      fc.assert(
        fc.property(safeCommandArb, (command) => {
          expect(manager.isLongRunning(command)).toBe(false);
        }),
        { numRuns: 20 }
      );
    });
    
    it('Property: 长时间运行命令直接执行应返回错误', async () => {
      await fc.assert(
        fc.asyncProperty(longRunningCommandArb, async (command) => {
          const result = await manager.execute(command);
          expect(result.success).toBe(false);
          expect(result.stderr).toContain('long-running');
        }),
        { numRuns: 10 }
      );
    });
    
    it('Property: suggestBackgroundMode 应为长时间运行命令返回建议', () => {
      fc.assert(
        fc.property(longRunningCommandArb, (command) => {
          const suggestion = manager.suggestBackgroundMode(command);
          expect(suggestion).not.toBeNull();
          expect(suggestion).toContain('background');
        }),
        { numRuns: 10 }
      );
    });
  });
  
  describe('Background Process Properties (13.2-13.4)', () => {
    it('Property: 后台进程应成功启动', async () => {
      await fc.assert(
        fc.asyncProperty(safeCommandArb, pathArb, async (command, path) => {
          const testManager = new ProcessManager(new MockProcessExecutor());
          const process = await testManager.startBackground(command, path);
          
          expect(process.id).toBeGreaterThan(0);
          expect(process.command).toBe(command);
          expect(process.status).toBe('running');
        }),
        { numRuns: 20 }
      );
    });
    
    it('Property: 相同命令和路径应复用进程', async () => {
      const process1 = await manager.startBackground('npm run dev', '/workspace');
      const process2 = await manager.startBackground('npm run dev', '/workspace');
      
      expect(process1.id).toBe(process2.id);
    });
    
    it('Property: 不同命令应创建不同进程', async () => {
      const process1 = await manager.startBackground('npm run dev', '/workspace');
      const process2 = await manager.startBackground('npm run build', '/workspace');
      
      expect(process1.id).not.toBe(process2.id);
    });
    
    it('Property: listProcesses 应返回所有进程', async () => {
      await manager.startBackground('cmd1');
      await manager.startBackground('cmd2');
      await manager.startBackground('cmd3');
      
      const processes = manager.listProcesses();
      expect(processes.length).toBe(3);
    });
    
    it('Property: 达到最大进程数应抛出错误', async () => {
      // 启动 5 个进程（最大值）
      for (let i = 0; i < 5; i++) {
        await manager.startBackground(`cmd${i}`);
      }
      
      // 第 6 个应该失败
      await expect(manager.startBackground('cmd6')).rejects.toThrow('Maximum');
    });
  });
  
  describe('Stop Process Properties (13.3)', () => {
    it('Property: 停止进程应成功', async () => {
      const process = await manager.startBackground('npm run dev');
      
      const stopped = await manager.stopBackground(process.id);
      expect(stopped).toBe(true);
      
      const status = await manager.getProcessStatus(process.id);
      expect(status).toBe('stopped');
    });
    
    it('Property: 停止不存在的进程应返回 false', async () => {
      const stopped = await manager.stopBackground(99999);
      expect(stopped).toBe(false);
    });
    
    it('Property: stopAll 应停止所有运行中的进程', async () => {
      await manager.startBackground('cmd1');
      await manager.startBackground('cmd2');
      await manager.startBackground('cmd3');
      
      const stopped = await manager.stopAll();
      expect(stopped).toBe(3);
      expect(manager.getRunningProcessCount()).toBe(0);
    });
  });
  
  describe('Output Properties (13.6)', () => {
    it('Property: 应能获取进程输出', async () => {
      const process = await manager.startBackground('npm run dev');
      
      // 添加一些输出
      if (process.pid) {
        executor.addOutput(process.pid, 'Line 1');
        executor.addOutput(process.pid, 'Line 2');
        executor.addOutput(process.pid, 'Line 3');
      }
      
      const output = await manager.getOutput(process.id);
      expect(output.length).toBeGreaterThan(0);
    });
    
    it('Property: 限制输出行数应生效', async () => {
      const process = await manager.startBackground('npm run dev');
      
      // 添加多行输出
      if (process.pid) {
        for (let i = 0; i < 10; i++) {
          executor.addOutput(process.pid, `Line ${i}`);
        }
      }
      
      const output = await manager.getOutput(process.id, 3);
      expect(output.length).toBeLessThanOrEqual(3);
    });
    
    it('Property: 不存在的进程应返回空输出', async () => {
      const output = await manager.getOutput(99999);
      expect(output).toEqual([]);
    });
  });
  
  describe('Cleanup Properties', () => {
    it('Property: cleanupStopped 应清理已停止的进程', async () => {
      const p1 = await manager.startBackground('cmd1');
      const p2 = await manager.startBackground('cmd2');
      await manager.startBackground('cmd3');
      
      await manager.stopBackground(p1.id);
      await manager.stopBackground(p2.id);
      
      const cleaned = manager.cleanupStopped();
      expect(cleaned).toBe(2);
      expect(manager.listProcesses().length).toBe(1);
    });
  });
  
  describe('Process Status Properties', () => {
    it('Property: 运行中的进程状态应为 running', async () => {
      const process = await manager.startBackground('npm run dev');
      const status = await manager.getProcessStatus(process.id);
      expect(status).toBe('running');
    });
    
    it('Property: 不存在的进程状态应为 null', async () => {
      const status = await manager.getProcessStatus(99999);
      expect(status).toBeNull();
    });
    
    it('Property: getProcess 应返回进程详情', async () => {
      const process = await manager.startBackground('npm run dev', '/workspace');
      const details = manager.getProcess(process.id);
      
      expect(details).not.toBeNull();
      expect(details?.command).toBe('npm run dev');
      expect(details?.path).toBe('/workspace');
    });
  });
});

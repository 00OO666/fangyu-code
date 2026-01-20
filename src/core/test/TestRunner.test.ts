/**
 * TestRunner 测试
 */

import { describe, it, expect } from 'vitest';
import { TestRunner } from './TestRunner';

describe('TestRunner', () => {
  it('应该能够创建TestRunner实例', () => {
    const runner = new TestRunner();
    expect(runner).toBeDefined();
  });

  it('应该能够获取测试框架', () => {
    const runner = new TestRunner('vitest');
    expect(runner.getFramework()).toBe('vitest');
  });

  it('应该能够设置测试框架', () => {
    const runner = new TestRunner();
    runner.setFramework('jest');
    expect(runner.getFramework()).toBe('jest');
  });

  it('应该能够运行测试', async () => {
    const runner = new TestRunner();
    const result = await runner.runTests();
    expect(result).toBeDefined();
    expect(result.name).toBeDefined();
  });

  it('应该能够获取覆盖率', async () => {
    const runner = new TestRunner();
    const coverage = await runner.getCoverage();
    expect(coverage).toBeDefined();
    expect(typeof coverage.lines).toBe('number');
  });
});

/**
 * E2E Tests: Agent Flow
 * 测试 Agent 任务分配和执行流程
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedAgentOrchestrator } from '../../core/agents/UnifiedAgentOrchestrator';
import { TaskQueue } from '../../core/agents/TaskQueue';
import { mockServer } from './MockAPIServer';

// 简化的 Agent Registry 用于测试
class TestAgentRegistry {
  private agents = new Map<string, TestAgent>();

  register(agent: TestAgent): void {
    this.agents.set(agent.id, agent);
  }

  get(id: string): TestAgent | undefined {
    return this.agents.get(id);
  }

  findByCapability(capability: string): TestAgent[] {
    return Array.from(this.agents.values()).filter(a => 
      a.capabilities.includes(capability)
    );
  }

  getAll(): TestAgent[] {
    return Array.from(this.agents.values());
  }
}

// 简化的 Context Manager 用于测试
class TestContextManager {
  private context = new Map<string, unknown>();

  set(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  get(key: string): unknown {
    return this.context.get(key);
  }

  clear(key: string): void {
    this.context.delete(key);
  }

  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.context);
  }
}

interface TestAgent {
  id: string;
  name: string;
  capabilities: string[];
  priority: number;
  execute: (task: TestTask) => Promise<{ success: boolean; result?: unknown; error?: string }>;
}

interface TestTask {
  id: string;
  type: string;
  priority: number;
  payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// 简化的 Orchestrator 用于测试
class TestOrchestrator {
  constructor(
    private registry: TestAgentRegistry,
    private taskQueue: TaskQueue,
    private contextManager: TestContextManager
  ) {}

  async assignTask(task: TestTask): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const agents = this.registry.findByCapability(task.type);
    if (agents.length === 0) {
      return { success: false, error: 'No agent found for task type' };
    }

    const agent = agents[0];
    try {
      return await agent.execute(task);
    } catch (error) {
      return { success: false, error: `Task execution failed: ${error}` };
    }
  }
}

describe('E2E: Agent Flow', () => {
  let orchestrator: TestOrchestrator;
  let registry: TestAgentRegistry;
  let taskQueue: TaskQueue;
  let contextManager: TestContextManager;

  beforeEach(() => {
    mockServer.reset();
    registry = new TestAgentRegistry();
    taskQueue = new TaskQueue();
    contextManager = new TestContextManager();
    orchestrator = new TestOrchestrator(registry, taskQueue, contextManager);
  });

  describe('Agent 注册和发现', () => {
    it('应该能够注册和获取 Agent', () => {
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        capabilities: ['code-review', 'testing'],
        priority: 1,
        execute: async () => ({ success: true, result: 'done' })
      };

      registry.register(agent);
      const found = registry.get('test-agent');

      expect(found).toBeDefined();
      expect(found?.name).toBe('Test Agent');
    });

    it('应该能够按能力查找 Agent', () => {
      registry.register({
        id: 'code-agent',
        name: 'Code Agent',
        capabilities: ['code-review', 'refactoring'],
        priority: 1,
        execute: async () => ({ success: true, result: 'done' })
      });

      registry.register({
        id: 'test-agent',
        name: 'Test Agent',
        capabilities: ['testing', 'debugging'],
        priority: 2,
        execute: async () => ({ success: true, result: 'done' })
      });

      const codeAgents = registry.findByCapability('code-review');
      const testAgents = registry.findByCapability('testing');

      expect(codeAgents).toHaveLength(1);
      expect(codeAgents[0].id).toBe('code-agent');
      expect(testAgents).toHaveLength(1);
      expect(testAgents[0].id).toBe('test-agent');
    });
  });

  describe('任务队列管理', () => {
    it('应该能够添加和获取任务', () => {
      const task = {
        id: 'task-1',
        type: 'code-review' as const,
        priority: 1,
        payload: { file: 'test.ts' },
        status: 'pending' as const
      };

      taskQueue.enqueue(task);
      const next = taskQueue.peek();

      expect(next).toBeDefined();
      expect(next?.id).toBe('task-1');
    });

    it('应该按优先级排序任务', () => {
      // TaskQueue 默认使用 fifoComparator，高优先级数字 = 高优先级
      taskQueue.enqueue({
        id: 'low-priority',
        type: 'code-review',
        priority: 1,  // 低优先级
        payload: {},
        status: 'pending'
      });

      taskQueue.enqueue({
        id: 'high-priority',
        type: 'code-review',
        priority: 10,  // 高优先级
        payload: {},
        status: 'pending'
      });

      taskQueue.enqueue({
        id: 'medium-priority',
        type: 'code-review',
        priority: 5,  // 中优先级
        payload: {},
        status: 'pending'
      });

      const first = taskQueue.dequeue();
      const second = taskQueue.dequeue();
      const third = taskQueue.dequeue();

      expect(first?.id).toBe('high-priority');
      expect(second?.id).toBe('medium-priority');
      expect(third?.id).toBe('low-priority');
    });
  });

  describe('任务执行流程', () => {
    it('应该能够分配任务给合适的 Agent', async () => {
      const executionLog: string[] = [];

      registry.register({
        id: 'code-agent',
        name: 'Code Agent',
        capabilities: ['code-review'],
        priority: 1,
        execute: async (task) => {
          executionLog.push(`code-agent executed ${task.id}`);
          return { success: true, result: 'reviewed' };
        }
      });

      const task = {
        id: 'review-task',
        type: 'code-review' as const,
        priority: 1,
        payload: { file: 'test.ts' },
        status: 'pending' as const
      };

      const result = await orchestrator.assignTask(task);

      expect(result.success).toBe(true);
      expect(executionLog).toContain('code-agent executed review-task');
    });

    it('应该处理任务执行失败', async () => {
      registry.register({
        id: 'failing-agent',
        name: 'Failing Agent',
        capabilities: ['failing-task'],
        priority: 1,
        execute: async () => {
          throw new Error('Task execution failed');
        }
      });

      const task = {
        id: 'fail-task',
        type: 'failing-task' as const,
        priority: 1,
        payload: {},
        status: 'pending' as const
      };

      const result = await orchestrator.assignTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
    });
  });

  describe('上下文管理', () => {
    it('应该能够设置和获取上下文', () => {
      contextManager.set('currentFile', 'src/test.ts');
      contextManager.set('projectRoot', '/workspace');

      expect(contextManager.get('currentFile')).toBe('src/test.ts');
      expect(contextManager.get('projectRoot')).toBe('/workspace');
    });

    it('应该能够清除上下文', () => {
      contextManager.set('temp', 'value');
      contextManager.clear('temp');

      expect(contextManager.get('temp')).toBeUndefined();
    });

    it('应该支持上下文快照', () => {
      contextManager.set('key1', 'value1');
      contextManager.set('key2', 'value2');

      const snapshot = contextManager.snapshot();

      expect(snapshot).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });
  });

  describe('完整工作流程', () => {
    it('应该完成从任务创建到执行的完整流程', async () => {
      const results: string[] = [];

      // 注册 Agent
      registry.register({
        id: 'workflow-agent',
        name: 'Workflow Agent',
        capabilities: ['workflow'],
        priority: 1,
        execute: async (task) => {
          results.push(`Started: ${task.id}`);
          // 模拟工作
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push(`Completed: ${task.id}`);
          return { success: true, result: task.payload };
        }
      });

      // 设置上下文
      contextManager.set('workflowId', 'wf-123');

      // 创建任务
      const task = {
        id: 'workflow-task',
        type: 'workflow' as const,
        priority: 1,
        payload: { action: 'process' },
        status: 'pending' as const
      };

      // 执行任务
      const result = await orchestrator.assignTask(task);

      expect(result.success).toBe(true);
      expect(results).toContain('Started: workflow-task');
      expect(results).toContain('Completed: workflow-task');
    });

    it('应该支持批量任务处理', async () => {
      const completedTasks: string[] = [];

      registry.register({
        id: 'batch-agent',
        name: 'Batch Agent',
        capabilities: ['batch'],
        priority: 1,
        execute: async (task) => {
          completedTasks.push(task.id);
          return { success: true, result: 'done' };
        }
      });

      // 添加多个任务
      for (let i = 0; i < 5; i++) {
        taskQueue.enqueue({
          id: `batch-task-${i}`,
          type: 'batch' as const,
          priority: i,
          payload: {},
          status: 'pending' as const
        });
      }

      // 处理所有任务 (isEmpty 是 getter 属性)
      while (!taskQueue.isEmpty) {
        const task = taskQueue.dequeue();
        if (task) {
          await orchestrator.assignTask(task as unknown as TestTask);
        }
      }

      expect(completedTasks).toHaveLength(5);
    });
  });
});

/**
 * TaskQueue Property-Based Tests
 * 
 * Property 4: 任务队列优先级排序
 * - 高优先级任务总是先出队
 * - 同优先级按 FIFO 顺序
 * - 依赖未满足的任务不会出队
 * 
 * NOTE: Using reduced numRuns to prevent test hangs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Fast-check configuration to prevent infinite loops
const FC_OPTIONS = { numRuns: 20, timeout: 5000 };
const FC_FAST_OPTIONS = { numRuns: 10, timeout: 3000 };
import {
  TaskQueue,
  createPriorityQueue,
  createFifoQueue,
  createDeadlineQueue,
} from './TaskQueue';
import type { Task } from '../types/unified-agent';

// ============================================================================
// Test Generators
// ============================================================================

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  description: 'Test task',
  type: 'general',
  priority: 5,
  status: 'pending',
  dependencies: [],
  createdAt: Date.now(),
  isBackground: false,
  ...overrides,
});

const taskArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  type: fc.constantFrom('frontend', 'backend', 'docs', 'testing', 'review', 'devops', 'research', 'general'),
  priority: fc.integer({ min: 1, max: 10 }),
  status: fc.constant('pending' as const),
  dependencies: fc.constant([] as string[]),
  createdAt: fc.integer({ min: 0 }),
  isBackground: fc.boolean(),
}).map((t) => t as Task);

const uniqueTasksArb = fc.array(taskArb, { minLength: 1, maxLength: 20 })
  .map((tasks) => tasks.map((task, i) => ({ ...task, id: `task-${i}` })));

// ============================================================================
// Property Tests
// ============================================================================

describe('TaskQueue Property Tests', () => {
  describe('Property 4.1: 高优先级任务总是先出队', () => {
    it('dequeue returns highest priority task first', () => {
      fc.assert(
        fc.property(uniqueTasksArb, (tasks) => {
          const queue = createPriorityQueue();
          
          // Enqueue all tasks
          for (const task of tasks) {
            queue.enqueue(task);
          }
          
          // Dequeue and verify priority order
          let lastPriority = Infinity;
          while (!queue.isEmpty) {
            const task = queue.dequeue();
            if (task) {
              expect(task.priority).toBeLessThanOrEqual(lastPriority);
              lastPriority = task.priority;
            }
          }
        }),
        FC_OPTIONS
      );
    });

    it('higher priority tasks always dequeue before lower priority', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 6, max: 10 }),
          (lowPriority, highPriority) => {
            const queue = createPriorityQueue();
            
            // Add low priority first
            const lowTask = createTask({ id: 'low', priority: lowPriority });
            const highTask = createTask({ id: 'high', priority: highPriority });
            
            queue.enqueue(lowTask);
            queue.enqueue(highTask);
            
            // High priority should come out first
            const first = queue.dequeue();
            expect(first?.id).toBe('high');
            expect(first?.priority).toBe(highPriority);
          }
        ),
        FC_OPTIONS
      );
    });
  });

  describe('Property 4.2: 同优先级按 FIFO 顺序', () => {
    it('tasks with same priority dequeue in FIFO order', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 2, max: 10 }),
          (priority, count) => {
            const queue = createFifoQueue();
            const taskIds: string[] = [];
            
            // Enqueue tasks with same priority
            for (let i = 0; i < count; i++) {
              const task = createTask({ id: `task-${i}`, priority });
              queue.enqueue(task);
              taskIds.push(task.id);
            }
            
            // Dequeue and verify FIFO order
            const dequeuedIds: string[] = [];
            while (!queue.isEmpty) {
              const task = queue.dequeue();
              if (task) {
                dequeuedIds.push(task.id);
              }
            }
            
            expect(dequeuedIds).toEqual(taskIds);
          }
        ),
        FC_OPTIONS
      );
    });
  });

  describe('Property 4.3: 依赖未满足的任务不会出队', () => {
    it('tasks with unsatisfied dependencies are skipped', () => {
      const queue = new TaskQueue();
      
      // Task B depends on Task A
      const taskA = createTask({ id: 'task-a', priority: 5 });
      const taskB = createTask({ id: 'task-b', priority: 10, dependencies: ['task-a'] });
      
      queue.enqueue(taskA);
      queue.enqueue(taskB);
      
      // Even though B has higher priority, A should come first
      const first = queue.dequeue();
      expect(first?.id).toBe('task-a');
      
      // B still can't dequeue because A isn't completed
      const second = queue.dequeue();
      expect(second).toBeUndefined();
      
      // Mark A as completed
      queue.markCompleted('task-a');
      
      // Now B can dequeue
      const third = queue.dequeue();
      expect(third?.id).toBe('task-b');
    });

    it('dependency chain is respected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (chainLength) => {
            const queue = new TaskQueue();
            const tasks: Task[] = [];
            
            // Create a chain: task-0 <- task-1 <- task-2 <- ...
            for (let i = 0; i < chainLength; i++) {
              const task = createTask({
                id: `task-${i}`,
                priority: chainLength - i, // Higher priority for later tasks
                dependencies: i > 0 ? [`task-${i - 1}`] : [],
              });
              tasks.push(task);
              queue.enqueue(task);
            }
            
            // Dequeue should follow dependency order, not priority
            for (let i = 0; i < chainLength; i++) {
              const task = queue.dequeue();
              expect(task?.id).toBe(`task-${i}`);
              queue.markCompleted(task!.id);
            }
          }
        ),
        FC_FAST_OPTIONS
      );
    });
  });

  describe('Property 4.4: 队列容量限制', () => {
    it('queue respects max size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 5, max: 30 }),
          (maxSize, taskCount) => {
            const queue = new TaskQueue({ maxQueueSize: maxSize });
            let enqueued = 0;
            
            for (let i = 0; i < taskCount; i++) {
              const task = createTask({ id: `task-${i}` });
              if (queue.enqueue(task)) {
                enqueued++;
              }
            }
            
            expect(enqueued).toBeLessThanOrEqual(maxSize);
            expect(queue.length).toBeLessThanOrEqual(maxSize);
          }
        ),
        FC_OPTIONS
      );
    });
  });

  describe('Property 4.5: 任务唯一性', () => {
    it('duplicate task IDs are rejected', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 2, max: 10 }),
          (taskId, duplicateCount) => {
            const queue = new TaskQueue();
            let successCount = 0;
            
            for (let i = 0; i < duplicateCount; i++) {
              const task = createTask({ id: taskId, priority: i + 1 });
              if (queue.enqueue(task)) {
                successCount++;
              }
            }
            
            // Only first enqueue should succeed
            expect(successCount).toBe(1);
            expect(queue.length).toBe(1);
          }
        ),
        FC_OPTIONS
      );
    });
  });

  describe('Property 4.6: 优先级更新', () => {
    it('priority update reorders queue correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 6, max: 10 }),
          (initialPriority, newPriority) => {
            const queue = createPriorityQueue();
            
            const task1 = createTask({ id: 'task-1', priority: 5 });
            const task2 = createTask({ id: 'task-2', priority: initialPriority });
            
            queue.enqueue(task1);
            queue.enqueue(task2);
            
            // Update task2 to higher priority
            queue.updatePriority('task-2', newPriority);
            
            // task2 should now be first
            const first = queue.dequeue();
            expect(first?.id).toBe('task-2');
            expect(first?.priority).toBe(newPriority);
          }
        ),
        FC_OPTIONS
      );
    });
  });

  describe('Property 4.7: 队列统计准确性', () => {
    it('stats reflect actual queue state', () => {
      fc.assert(
        fc.property(uniqueTasksArb, (tasks) => {
          const queue = new TaskQueue();
          
          for (const task of tasks) {
            queue.enqueue(task);
          }
          
          const stats = queue.getStats();
          
          expect(stats.total).toBe(queue.length);
          expect(stats.total).toBe(tasks.length);
          
          if (tasks.length > 0) {
            const priorities = tasks.map((t) => t.priority);
            expect(stats.highestPriority).toBe(Math.max(...priorities));
            expect(stats.lowestPriority).toBe(Math.min(...priorities));
          }
        }),
        FC_OPTIONS
      );
    });
  });

  describe('Property 4.8: 事件发射', () => {
    it('events are emitted for all queue operations', () => {
      const queue = new TaskQueue();
      const events: string[] = [];
      
      queue.on((event) => events.push(event.type));
      
      const task = createTask({ id: 'test-task' });
      
      queue.enqueue(task);
      expect(events).toContain('enqueued');
      
      queue.updatePriority('test-task', 10);
      expect(events).toContain('priority_changed');
      
      expect(events).toContain('dequeued');
      
      queue.enqueue(createTask({ id: 'task-2' }));
      queue.markCompleted('task-2');
      expect(events).toContain('completed');
    });
  });

  describe('Property 4.9: Deadline 队列排序', () => {
    it('deadline queue prioritizes by deadline', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              deadline: fc.integer({ min: 1000, max: 10000 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (taskData) => {
            const queue = createDeadlineQueue();
            
            for (const { id, deadline } of taskData) {
              const task = createTask({
                id,
                priority: 5,
                metadata: { deadline },
              });
              queue.enqueue(task);
            }
            
            // Dequeue and verify deadline order
            let lastDeadline = 0;
            while (!queue.isEmpty) {
              const task = queue.dequeue();
              if (task) {
                const deadline = task.metadata?.deadline as number;
                expect(deadline).toBeGreaterThanOrEqual(lastDeadline);
                lastDeadline = deadline;
              }
            }
          }
        ),
        FC_OPTIONS
      );
    });
  });
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('TaskQueue Unit Tests', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe('enqueue/dequeue', () => {
    it('should enqueue and dequeue tasks', () => {
      const task = createTask({ id: 'task-1' });
      expect(queue.enqueue(task)).toBe(true);
      expect(queue.length).toBe(1);
      
      const dequeued = queue.dequeue();
      expect(dequeued?.id).toBe('task-1');
      expect(queue.length).toBe(0);
    });

    it('should return undefined when queue is empty', () => {
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('peek', () => {
    it('should peek without removing', () => {
      const task = createTask({ id: 'task-1' });
      queue.enqueue(task);
      
      expect(queue.peek()?.id).toBe('task-1');
      expect(queue.length).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove task by id', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));
      
      expect(queue.remove('task-1')).toBe(true);
      expect(queue.length).toBe(1);
      expect(queue.dequeue()?.id).toBe('task-2');
    });

    it('should return false for non-existent task', () => {
      expect(queue.remove('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all tasks', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));
      
      queue.clear();
      expect(queue.isEmpty).toBe(true);
    });
  });

  describe('getByStatus', () => {
    it('should filter tasks by status', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));
      
      const queued = queue.getByStatus('queued');
      expect(queued.length).toBe(2);
    });
  });

  describe('getByPriorityRange', () => {
    it('should filter tasks by priority range', () => {
      queue.enqueue(createTask({ id: 'task-1', priority: 3 }));
      queue.enqueue(createTask({ id: 'task-2', priority: 7 }));
      queue.enqueue(createTask({ id: 'task-3', priority: 5 }));
      
      const highPriority = queue.getByPriorityRange(5, 10);
      expect(highPriority.length).toBe(2);
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed tasks up to maxRetries', () => {
      const queue = new TaskQueue({ maxRetries: 2 });
      const task = createTask({ id: 'task-1' });
      
      queue.enqueue(task);
      queue.dequeue(); // First attempt
      
      queue.markFailed('task-1', 'Error 1');
      expect(queue.length).toBe(1); // Still in queue for retry
      
      queue.dequeue(); // Second attempt
      queue.markFailed('task-1', 'Error 2');
      expect(queue.length).toBe(0); // Max retries exceeded
      
      const failed = queue.getFailed();
      expect(failed.length).toBe(1);
      expect(failed[0].error).toBe('Error 2');
    });
  });
});

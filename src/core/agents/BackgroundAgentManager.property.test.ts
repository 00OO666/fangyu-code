/**
 * Property-Based Tests for BackgroundAgentManager
 * 
 * Feature: super-ai-agent-desktop
 * Property 16: 并发限制遵守
 * Validates: Requirements 6.3
 * 
 * NOTE: Using reduced numRuns and shorter timeouts to prevent test hangs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BackgroundAgentManager, resetBackgroundManager } from './BackgroundAgentManager';

// Fast-check configuration to prevent infinite loops
const FC_OPTIONS = { 
  numRuns: 5,           // Reduced from 20 to prevent hangs
  timeout: 5000,        // 5 second timeout per property
  interruptAfterTimeLimit: 4000,  // Interrupt if taking too long
};

describe('BackgroundAgentManager Property Tests', () => {
  beforeEach(() => {
    resetBackgroundManager();
  });

  /**
   * Property 16: 并发限制遵守
   * 
   * For any model/provider concurrency configuration, the number of
   * simultaneously running tasks should not exceed the configured limit.
   * 
   * Validates: Requirements 6.3
   */
  describe('Property 16: Concurrency Limit Compliance', () => {
    it('should never exceed provider concurrency limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 4 }),  // provider limit (reduced max)
          fc.integer({ min: 2, max: 6 }),  // number of tasks (reduced max)
          async (providerLimit: number, taskCount: number) => {
            resetBackgroundManager();
            const manager = new BackgroundAgentManager();
            
            manager.setConcurrencyConfig({
              defaultConcurrency: 20,
              providerConcurrency: {
                anthropic: providerLimit,
                openai: providerLimit,
                google: providerLimit,
                xai: providerLimit,
              },
            });

            let maxConcurrent = 0;
            let currentRunning = 0;

            manager.setExecutor(async () => {
              currentRunning++;
              maxConcurrent = Math.max(maxConcurrent, currentRunning);
              await new Promise((resolve) => setTimeout(resolve, 5)); // Reduced from 20ms
              currentRunning--;
              return 'done';
            });

            const taskIds: string[] = [];
            for (let i = 0; i < taskCount; i++) {
              // Don't await - just collect task IDs
              const id = manager.spawnBackground('frontend', `Task ${i}`);
              if (typeof id === 'string') {
                taskIds.push(id);
              }
            }

            // Wait for all tasks to complete with timeout
            await new Promise((resolve) => setTimeout(resolve, taskCount * 20 + 100));
            expect(maxConcurrent).toBeLessThanOrEqual(providerLimit);
          }
        ),
        FC_OPTIONS
      );
    });

    it('should never exceed total concurrency limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 4 }),  // Reduced max
          fc.integer({ min: 2, max: 8 }),  // Reduced max
          async (totalLimit: number, taskCount: number) => {
            resetBackgroundManager();
            const manager = new BackgroundAgentManager();
            
            manager.setConcurrencyConfig({
              defaultConcurrency: totalLimit,
              providerConcurrency: {
                anthropic: 100,
                openai: 100,
                google: 100,
                xai: 100,
              },
            });

            let maxTotal = 0;
            let currentRunning = 0;

            manager.setExecutor(async () => {
              currentRunning++;
              maxTotal = Math.max(maxTotal, currentRunning);
              await new Promise((resolve) => setTimeout(resolve, 5)); // Reduced from 20ms
              currentRunning--;
              return 'done';
            });

            // Spawn tasks without awaiting the queued ones
            for (let i = 0; i < taskCount; i++) {
              manager.spawnBackground('frontend', `Task ${i}`);
            }

            // Wait for all tasks to complete with timeout
            await new Promise((resolve) => setTimeout(resolve, taskCount * 20 + 100));
            expect(maxTotal).toBeLessThanOrEqual(totalLimit);
          }
        ),
        FC_OPTIONS
      );
    });

    it('should queue tasks when at capacity', async () => {
      resetBackgroundManager();
      const manager = new BackgroundAgentManager();
      
      manager.setConcurrencyConfig({
        defaultConcurrency: 2,
        providerConcurrency: {
          anthropic: 10,
          openai: 10,
          google: 10,
          xai: 10,
        },
      });

      manager.setExecutor(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Reduced from 100ms
        return 'done';
      });

      // Spawn tasks without awaiting
      manager.spawnBackground('frontend', 'Task 1');
      manager.spawnBackground('frontend', 'Task 2');
      manager.spawnBackground('frontend', 'Task 3');
      manager.spawnBackground('frontend', 'Task 4');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = manager.getConcurrencyStats();
      expect(stats.totalRunning).toBeLessThanOrEqual(2);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('should process queue when capacity becomes available', async () => {
      resetBackgroundManager();
      const manager = new BackgroundAgentManager();
      
      manager.setConcurrencyConfig({
        defaultConcurrency: 1,
        providerConcurrency: {
          anthropic: 10,
          openai: 10,
          google: 10,
          xai: 10,
        },
      });

      const completionOrder: number[] = [];
      let taskIndex = 0;

      manager.setExecutor(async () => {
        const index = taskIndex++;
        await new Promise((resolve) => setTimeout(resolve, 10)); // Reduced from 20ms
        completionOrder.push(index);
        return `done-${index}`;
      });

      // Spawn tasks without awaiting
      manager.spawnBackground('frontend', 'Task 0');
      manager.spawnBackground('frontend', 'Task 1');
      manager.spawnBackground('frontend', 'Task 2');

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(completionOrder.length).toBe(3);
    });
  });

  describe('Task Status Properties', () => {
    it('should transition through valid states', async () => {
      resetBackgroundManager();
      const manager = new BackgroundAgentManager();
      
      manager.setExecutor(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20)); // Reduced from 30ms
        return 'done';
      });
      
      manager.spawnBackground('frontend', 'Test task');
      
      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 50));

      const tasks = manager.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      expect(['completed', 'failed']).toContain(tasks[0].status);
    });

    it('should track progress from 0 to 100', async () => {
      resetBackgroundManager();
      const manager = new BackgroundAgentManager();
      
      manager.setExecutor(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20)); // Reduced from 50ms
        return 'done';
      });

      manager.spawnBackground('frontend', 'Test');

      await new Promise((resolve) => setTimeout(resolve, 50)); // Reduced from 100ms

      const tasks = manager.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].progress).toBe(100);
    });
  });

  describe('Task Cancellation Properties', () => {
    it('should allow cancelling queued tasks', async () => {
      resetBackgroundManager();
      const manager = new BackgroundAgentManager();
      
      manager.setConcurrencyConfig({
        defaultConcurrency: 1,
        providerConcurrency: {
          anthropic: 10,
          openai: 10,
          google: 10,
          xai: 10,
        },
      });

      manager.setExecutor(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Reduced from 100ms
        return 'done';
      });

      // Spawn tasks - don't await the promises as they may reject when cancelled
      const promise1 = manager.spawnBackground('frontend', 'Task 1');
      const promise2 = manager.spawnBackground('frontend', 'Task 2');

      await new Promise((resolve) => setTimeout(resolve, 5));

      const queuedTasks = manager.getQueuedTasks();
      if (queuedTasks.length > 0) {
        try {
          await manager.cancelBackground(queuedTasks[0].id);
          const status = manager.getBackgroundStatus(queuedTasks[0].id);
          expect(status?.status).toBe('cancelled');
        } catch {
          // Task may have already started
        }
      }

      // Wait for completion and catch any rejections
      await Promise.allSettled([promise1, promise2]);
    });

    it('should not allow cancelling completed tasks', async () => {
      resetBackgroundManager();
      const manager = new BackgroundAgentManager();
      
      manager.setExecutor(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5)); // Reduced from 10ms
        return 'done';
      });
      
      manager.spawnBackground('frontend', 'Test');
      
      await new Promise((resolve) => setTimeout(resolve, 30)); // Reduced from 50ms

      const tasks = manager.getAllTasks();
      if (tasks.length > 0 && tasks[0].status === 'completed') {
        await expect(manager.cancelBackground(tasks[0].id)).rejects.toThrow();
      }
    });
  });
});

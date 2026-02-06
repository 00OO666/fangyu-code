/**
 * Test Utilities
 * 
 * Helper functions for testing Super AI Agent Desktop components.
 */

import { vi } from 'vitest';
import type {
  Agent,
  AgentRole,
  Task,
  TaskStatus,
  ContextSource,
  SteeringRule,
} from '@/core/types/unified-agent';

// ============================================================================
// Factory Functions
// ============================================================================

export function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    role: createMockAgentRole(),
    status: 'idle',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    metrics: {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalTokensUsed: 0,
      averageCompletionTime: 0,
      successRate: 1,
    },
    ...overrides,
  };
}

export function createMockAgentRole(overrides: Partial<AgentRole> = {}): AgentRole {
  return {
    id: 'orchestrator',
    name: 'Sisyphus',
    type: 'orchestrator',
    model: {
      provider: 'anthropic',
      model: 'claude-opus-4-5',
      temperature: 0.1,
    },
    capabilities: {
      languages: ['*'],
      frameworks: ['*'],
      tools: ['*'],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
    },
    prompt: 'You are the main orchestrator...',
    temperature: 0.1,
    ...overrides,
  };
}

export function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    description: 'Test task',
    type: 'general',
    priority: 5,
    status: 'pending',
    dependencies: [],
    createdAt: Date.now(),
    isBackground: false,
    ...overrides,
  };
}

export function createMockContextSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: 'source-1',
    type: 'system',
    content: 'Test content',
    tokens: 100,
    priority: 50,
    compressible: true,
    ...overrides,
  };
}

export function createMockSteeringRule(overrides: Partial<SteeringRule> = {}): SteeringRule {
  return {
    id: 'rule-1',
    content: '# Test Rule\n\nThis is a test steering rule.',
    inclusion: 'always',
    priority: 50,
    source: '.fangyu/steering/test.md',
    ...overrides,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export function expectTaskStatus(task: Task, expectedStatus: TaskStatus): void {
  if (task.status !== expectedStatus) {
    throw new Error(`Expected task status to be ${expectedStatus}, but got ${task.status}`);
  }
}

export function expectSortedByPriority(tasks: Task[]): void {
  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].priority > tasks[i - 1].priority) {
      throw new Error(
        `Tasks not sorted by priority: task ${i} has priority ${tasks[i].priority} > task ${i - 1} priority ${tasks[i - 1].priority}`
      );
    }
  }
}

export function expectNoDuplicates<T>(items: T[], keyFn: (item: T) => string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      throw new Error(`Duplicate item found: ${key}`);
    }
    seen.add(key);
  }
}

// ============================================================================
// Mock Helpers
// ============================================================================

export function createMockFileSystem(): {
  files: Map<string, string>;
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
} {
  const files = new Map<string, string>();

  const readFile = vi.fn((path: string) => {
    if (files.has(path)) {
      return Promise.resolve(files.get(path));
    }
    return Promise.reject(new Error(`File not found: ${path}`));
  });

  const writeFile = vi.fn((path: string, content: string) => {
    files.set(path, content);
    return Promise.resolve();
  });

  const exists = vi.fn((path: string) => {
    return Promise.resolve(files.has(path));
  });

  return { files, readFile, writeFile, exists };
}

export function createMockShell(): {
  execute: ReturnType<typeof vi.fn>;
  outputs: Map<string, { stdout: string; stderr: string; exitCode: number }>;
} {
  const outputs = new Map<string, { stdout: string; stderr: string; exitCode: number }>();

  const execute = vi.fn((command: string) => {
    const output = outputs.get(command) || { stdout: '', stderr: '', exitCode: 0 };
    return Promise.resolve(output);
  });

  return { execute, outputs };
}

// ============================================================================
// Timing Helpers
// ============================================================================

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Token Counting Helpers
// ============================================================================

export function estimateTokens(text: string): number {
  // Simple estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export function createContentWithTokens(targetTokens: number): string {
  const chars = targetTokens * 4;
  return 'x'.repeat(chars);
}

// ============================================================================
// Path Helpers
// ============================================================================

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function isPathTraversal(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.includes('..') || normalized.startsWith('/');
}

export function isWithinWorkspace(path: string, workspace: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedWorkspace = normalizePath(workspace);
  
  if (isPathTraversal(normalizedPath)) {
    return false;
  }
  
  // Simple check: path should not escape workspace
  const fullPath = `${normalizedWorkspace}/${normalizedPath}`;
  return !fullPath.includes('..');
}

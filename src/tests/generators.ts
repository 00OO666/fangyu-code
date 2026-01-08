/**
 * Property-Based Testing Generators
 * 
 * Custom fast-check arbitraries for Super AI Agent Desktop types.
 */

import * as fc from 'fast-check';
import type {
  AgentRoleType,
  TaskType,
  TaskStatus,
  Task,
  AgentRole,
  ModelProvider,
  HookEventType,
  SteeringInclusion,
  SteeringRule,
  ContextSourceType,
  ContextSource,
  ReferenceType,
  Reference,
  OperationType,
  Operation,
} from '@core/types/unified-agent';

// ============================================================================
// Agent Generators
// ============================================================================

export const agentRoleTypeArb: fc.Arbitrary<AgentRoleType> = fc.constantFrom(
  'orchestrator',
  'oracle',
  'librarian',
  'explorer',
  'frontend',
  'backend',
  'docs',
  'testing',
  'review',
  'devops'
);

export const modelProviderArb: fc.Arbitrary<ModelProvider> = fc.constantFrom(
  'anthropic',
  'openai',
  'google',
  'xai'
);

export const agentRoleArb: fc.Arbitrary<AgentRole> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: agentRoleTypeArb,
  model: fc.record({
    provider: modelProviderArb,
    model: fc.string({ minLength: 1, maxLength: 50 }),
    temperature: fc.float({ min: 0, max: 2 }),
    maxTokens: fc.integer({ min: 1000, max: 200000 }),
  }),
  capabilities: fc.record({
    languages: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
    frameworks: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
    tools: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
  }),
  tools: fc.record({
    read: fc.boolean(),
    write: fc.boolean(),
    execute: fc.boolean(),
  }),
  prompt: fc.string({ minLength: 10, maxLength: 500 }),
  temperature: fc.float({ min: 0, max: 2 }),
});

// ============================================================================
// Task Generators
// ============================================================================

export const taskTypeArb: fc.Arbitrary<TaskType> = fc.constantFrom(
  'frontend',
  'backend',
  'docs',
  'testing',
  'review',
  'devops',
  'research',
  'general'
);

export const taskStatusArb: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  'pending',
  'queued',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
);

export const taskArb: fc.Arbitrary<Task> = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  type: taskTypeArb,
  priority: fc.integer({ min: 1, max: 10 }),
  status: taskStatusArb,
  dependencies: fc.array(fc.uuid(), { maxLength: 5 }),
  assignedAgent: fc.option(fc.uuid(), { nil: undefined }),
  createdAt: fc.integer({ min: 0 }),
  startedAt: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
  completedAt: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
  isBackground: fc.boolean(),
  metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
});

// ============================================================================
// Hook Generators
// ============================================================================

export const hookEventTypeArb: fc.Arbitrary<HookEventType> = fc.constantFrom(
  'onMessage',
  'onComplete',
  'onSessionCreate',
  'onFileSave',
  'manual',
  'tool.execute.before',
  'tool.execute.after',
  'chat.message',
  'session.idle',
  'session.error',
  'agent.spawn',
  'agent.complete',
  'task.start',
  'task.complete',
  'context.threshold'
);

export const steeringInclusionArb: fc.Arbitrary<SteeringInclusion> = fc.constantFrom(
  'always',
  'fileMatch',
  'manual'
);

export const steeringRuleArb: fc.Arbitrary<SteeringRule> = fc.record({
  id: fc.uuid(),
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  inclusion: steeringInclusionArb,
  fileMatchPattern: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  priority: fc.integer({ min: 0, max: 100 }),
  source: fc.string({ minLength: 1, maxLength: 200 }),
});

// ============================================================================
// Context Generators
// ============================================================================

export const contextSourceTypeArb: fc.Arbitrary<ContextSourceType> = fc.constantFrom(
  'system',
  'steering',
  'environment',
  'history',
  'tools',
  'reference'
);

export const contextSourceArb: fc.Arbitrary<ContextSource> = fc.record({
  id: fc.uuid(),
  type: contextSourceTypeArb,
  content: fc.string({ minLength: 1, maxLength: 5000 }),
  tokens: fc.integer({ min: 1, max: 10000 }),
  priority: fc.integer({ min: 0, max: 100 }),
  compressible: fc.boolean(),
  hash: fc.option(fc.hexaString({ minLength: 32, maxLength: 32 }), { nil: undefined }),
});

// ============================================================================
// Reference Generators
// ============================================================================

export const referenceTypeArb: fc.Arbitrary<ReferenceType> = fc.constantFrom(
  'file',
  'folder',
  'problems',
  'terminal',
  'gitDiff',
  'codebase'
);

export const referenceArb: fc.Arbitrary<Reference> = fc.record({
  type: referenceTypeArb,
  target: fc.string({ minLength: 1, maxLength: 200 }),
  resolved: fc.option(fc.string({ minLength: 1, maxLength: 10000 }), { nil: undefined }),
  tokens: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
});

// ============================================================================
// Security Generators
// ============================================================================

export const operationTypeArb: fc.Arbitrary<OperationType> = fc.constantFrom(
  'file.read',
  'file.write',
  'file.delete',
  'command.execute',
  'network.request'
);

export const operationArb: fc.Arbitrary<Operation> = fc.record({
  type: operationTypeArb,
  target: fc.string({ minLength: 1, maxLength: 500 }),
  params: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
  timestamp: fc.integer({ min: 0 }),
  agentId: fc.option(fc.uuid(), { nil: undefined }),
});

// ============================================================================
// File Path Generators
// ============================================================================

export const safeFileNameArb: fc.Arbitrary<string> = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')),
  { minLength: 1, maxLength: 50 }
);

export const safeFilePathArb: fc.Arbitrary<string> = fc
  .array(safeFileNameArb, { minLength: 1, maxLength: 5 })
  .map((parts) => parts.join('/'));

export const pathTraversalArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom('..', '.', 'normal', 'path', 'file'), { minLength: 1, maxLength: 5 })
  .map((parts) => parts.join('/'));

// ============================================================================
// Sensitive Data Generators
// ============================================================================

export const apiKeyArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant('sk-').chain((prefix) =>
    fc.hexaString({ minLength: 32, maxLength: 64 }).map((s) => prefix + s)
  ),
  fc.constant('AKIA').chain((prefix) =>
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
      minLength: 16,
      maxLength: 16,
    }).map((s) => prefix + s)
  )
);

export const passwordArb: fc.Arbitrary<string> = fc.string({ minLength: 8, maxLength: 32 });

export const contentWithSensitiveDataArb: fc.Arbitrary<string> = fc.tuple(
  fc.string({ minLength: 10, maxLength: 100 }),
  apiKeyArb,
  fc.string({ minLength: 10, maxLength: 100 })
).map(([before, key, after]) => `${before} API_KEY=${key} ${after}`);

// ============================================================================
// Shell Command Generators
// ============================================================================

export const safeCommandArb: fc.Arbitrary<string> = fc.constantFrom(
  'ls',
  'pwd',
  'echo hello',
  'cat file.txt',
  'npm run build',
  'git status'
);

export const dangerousCommandArb: fc.Arbitrary<string> = fc.constantFrom(
  'rm -rf /',
  'rm -rf ~',
  'format c:',
  'del /f /s /q c:\\*',
  'sudo rm -rf /',
  ':(){:|:&};:',
  'mkfs.ext4 /dev/sda'
);

// ============================================================================
// Priority Queue Generators
// ============================================================================

export const priorityTasksArb: fc.Arbitrary<Task[]> = fc
  .array(taskArb, { minLength: 1, maxLength: 20 })
  .map((tasks) =>
    tasks.map((task, index) => ({
      ...task,
      priority: Math.floor(Math.random() * 10) + 1,
      id: `task-${index}`,
    }))
  );

// ============================================================================
// Token/Context Generators
// ============================================================================

export const tokenCountArb: fc.Arbitrary<number> = fc.integer({ min: 100, max: 200000 });

export const contextPercentageArb: fc.Arbitrary<number> = fc.float({ min: 0, max: 1 });

export const thresholdTestArb: fc.Arbitrary<{ used: number; total: number }> = fc.record({
  used: fc.integer({ min: 0, max: 200000 }),
  total: fc.integer({ min: 50000, max: 200000 }),
}).filter(({ used, total }) => used <= total);

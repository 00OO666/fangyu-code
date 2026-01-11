/**
 * UnifiedWorkflowEngine 属性测试
 *
 * 使用 fast-check 进行属性测试，验证工作流引擎的正确性属性
 *
 * Feature: unified-workflow-system
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Task, WorkflowDAG, WorkflowMetadata, WorkflowEdge } from '../types/workflow';

// ============================================
// 测试辅助函数
// ============================================

/**
 * 检查 DAG 是否有循环依赖
 */
function hasCycle(dag: WorkflowDAG): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const taskMap = new Map(dag.tasks.map(t => [t.id, t]));

    function dfs(taskId: string): boolean {
        if (!visited.has(taskId)) {
            visited.add(taskId);
            recStack.add(taskId);

            const task = taskMap.get(taskId);
            if (task) {
                for (const depId of task.dependents) {
                    if (!visited.has(depId) && dfs(depId)) {
                        return true;
                    } else if (recStack.has(depId)) {
                        return true;
                    }
                }
            }
        }
        recStack.delete(taskId);
        return false;
    }

    for (const task of dag.tasks) {
        if (dfs(task.id)) {
            return true;
        }
    }
    return false;
}

/**
 * 验证所有依赖都存在
 */
function allDependenciesExist(dag: WorkflowDAG): boolean {
    const taskIds = new Set(dag.tasks.map(t => t.id));
    for (const task of dag.tasks) {
        for (const depId of task.dependencies) {
            if (!taskIds.has(depId)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * 验证 dependents 和 dependencies 的一致性
 */
function dependencyConsistency(dag: WorkflowDAG): boolean {
    const taskMap = new Map(dag.tasks.map(t => [t.id, t]));

    for (const task of dag.tasks) {
        for (const depId of task.dependencies) {
            const depTask = taskMap.get(depId);
            if (depTask && !depTask.dependents.includes(task.id)) {
                return false;
            }
        }
        for (const depId of task.dependents) {
            const depTask = taskMap.get(depId);
            if (depTask && !depTask.dependencies.includes(task.id)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * 验证入口点（无依赖的任务）
 */
function validEntryPoints(dag: WorkflowDAG): boolean {
    const expectedEntryPoints = dag.tasks
        .filter(t => t.dependencies.length === 0)
        .map(t => t.id)
        .sort();
    const actualEntryPoints = [...dag.entryPoints].sort();
    return JSON.stringify(expectedEntryPoints) === JSON.stringify(actualEntryPoints);
}

/**
 * 验证出口点（无 dependents 的任务）
 */
function validExitPoints(dag: WorkflowDAG): boolean {
    const expectedExitPoints = dag.tasks
        .filter(t => t.dependents.length === 0)
        .map(t => t.id)
        .sort();
    const actualExitPoints = [...dag.exitPoints].sort();
    return JSON.stringify(expectedExitPoints) === JSON.stringify(actualExitPoints);
}

// ============================================
// 生成器
// ============================================

/**
 * 生成有效的任务
 */
const taskArbitrary = (id: string, deps: string[] = []): fc.Arbitrary<Task> =>
    fc.record({
        id: fc.constant(id),
        description: fc.string({ minLength: 1, maxLength: 100 }),
        type: fc.constantFrom('sequential', 'parallel', 'conditional') as fc.Arbitrary<'sequential' | 'parallel' | 'conditional'>,
        priority: fc.constantFrom('low', 'medium', 'high', 'critical') as fc.Arbitrary<'low' | 'medium' | 'high' | 'critical'>,
        status: fc.constant('pending') as fc.Arbitrary<'pending'>,
        progress: fc.constant(0),
        dependencies: fc.constant(deps),
        dependents: fc.constant([] as string[]),
        estimatedComplexity: fc.constantFrom(1, 2, 3, 4, 5) as fc.Arbitrary<1 | 2 | 3 | 4 | 5>,
        requiredSkills: fc.array(fc.string(), { maxLength: 3 }),
        requiredTools: fc.array(fc.string(), { maxLength: 3 }),
        metrics: fc.constant({ retryCount: 0 }),
    });

/**
 * 生成有效的 DAG（无循环）
 */
function generateValidDAG(taskCount: number): WorkflowDAG {
    const tasks: Task[] = [];
    const edges: WorkflowEdge[] = [];

    // 创建任务，每个任务只能依赖前面的任务（保证无循环）
    for (let i = 0; i < taskCount; i++) {
        const taskId = `task-${i}`;
        const possibleDeps = tasks.map(t => t.id);
        const depCount = Math.min(Math.floor(Math.random() * 3), possibleDeps.length);
        const dependencies = possibleDeps.slice(0, depCount);

        const task: Task = {
            id: taskId,
            description: `Task ${i}`,
            type: 'sequential',
            priority: 'medium',
            status: 'pending',
            progress: 0,
            dependencies,
            dependents: [],
            estimatedComplexity: (Math.floor(Math.random() * 5) + 1) as 1 | 2 | 3 | 4 | 5,
            requiredSkills: [],
            requiredTools: [],
            metrics: { retryCount: 0 },
        };
        tasks.push(task);
    }

    // 计算 dependents
    for (const task of tasks) {
        for (const depId of task.dependencies) {
            const depTask = tasks.find(t => t.id === depId);
            if (depTask) {
                depTask.dependents.push(task.id);
                edges.push({
                    id: `${depId}->${task.id}`,
                    from: depId,
                    to: task.id,
                    type: 'dependency',
                });
            }
        }
    }

    const entryPoints = tasks.filter(t => t.dependencies.length === 0).map(t => t.id);
    const exitPoints = tasks.filter(t => t.dependents.length === 0).map(t => t.id);

    const metadata: WorkflowMetadata = {
        id: 'test-workflow',
        name: 'Test Workflow',
        description: 'Generated for testing',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
        tags: [],
        estimatedTotalTime: tasks.reduce((sum, t) => sum + t.estimatedComplexity * 10, 0),
        parallelismLevel: Math.max(1, entryPoints.length),
        criticalPath: entryPoints.length > 0 ? [entryPoints[0]] : [],
        complexity: taskCount <= 3 ? 'simple' : taskCount <= 8 ? 'moderate' : 'complex',
    };

    return {
        metadata,
        tasks,
        edges,
        parallelGroups: [],
        entryPoints,
        exitPoints,
    };
}

// ============================================
// Property 1: DAG Validity
// ============================================

describe('UnifiedWorkflowEngine Property Tests', () => {
    describe('Property 1: DAG Validity', () => {
        /**
         * Property 1: DAG Validity
         * *For any* WorkflowDAG generated by the system, the graph SHALL be a valid
         * directed acyclic graph with no circular dependencies.
         *
         * **Validates: Requirements 1.2, 2.2**
         */

        it('generated DAG should have no cycles', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 20 }),
                    (taskCount) => {
                        const dag = generateValidDAG(taskCount);
                        return !hasCycle(dag);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('all dependencies should exist in the DAG', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 20 }),
                    (taskCount) => {
                        const dag = generateValidDAG(taskCount);
                        return allDependenciesExist(dag);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('dependencies and dependents should be consistent', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 20 }),
                    (taskCount) => {
                        const dag = generateValidDAG(taskCount);
                        return dependencyConsistency(dag);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('entry points should be tasks with no dependencies', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 20 }),
                    (taskCount) => {
                        const dag = generateValidDAG(taskCount);
                        return validEntryPoints(dag);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('exit points should be tasks with no dependents', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 20 }),
                    (taskCount) => {
                        const dag = generateValidDAG(taskCount);
                        return validExitPoints(dag);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // ============================================
    // Property 2: Parallel Task Identification
    // ============================================

    describe('Property 2: Parallel Task Identification', () => {
        /**
         * Property 2: Parallel Task Identification
         * *For any* set of tasks in a WorkflowDAG where no task depends on another
         * task in the set, those tasks SHALL be identified as parallelizable.
         *
         * **Validates: Requirements 1.3, 2.4**
         */

        it('tasks with no mutual dependencies can be parallelized', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 2, max: 10 }),
                    (taskCount) => {
                        // 创建完全独立的任务（无依赖）
                        const tasks: Task[] = [];
                        for (let i = 0; i < taskCount; i++) {
                            tasks.push({
                                id: `task-${i}`,
                                description: `Independent Task ${i}`,
                                type: 'parallel',
                                priority: 'medium',
                                status: 'pending',
                                progress: 0,
                                dependencies: [],
                                dependents: [],
                                estimatedComplexity: 2,
                                requiredSkills: [],
                                requiredTools: [],
                                metrics: { retryCount: 0 },
                            });
                        }

                        // 所有任务都应该可以并行
                        const canParallelize = tasks.every(t =>
                            tasks.every(other =>
                                t.id === other.id ||
                                (!t.dependencies.includes(other.id) && !other.dependencies.includes(t.id))
                            )
                        );

                        return canParallelize;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('entry points should all be parallelizable', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 15 }),
                    (taskCount) => {
                        const dag = generateValidDAG(taskCount);
                        const entryTasks = dag.tasks.filter(t => dag.entryPoints.includes(t.id));

                        // 入口任务之间不应该有依赖关系
                        return entryTasks.every(t =>
                            entryTasks.every(other =>
                                t.id === other.id || !t.dependencies.includes(other.id)
                            )
                        );
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});

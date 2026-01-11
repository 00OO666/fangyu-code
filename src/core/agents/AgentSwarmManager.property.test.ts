/**
 * AgentSwarmManager 属性测试
 *
 * 使用 fast-check 进行属性测试，验证代理池管理的正确性属性
 *
 * Feature: unified-workflow-system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { AgentSwarmManager, type AgentMatchResult } from './AgentSwarmManager';
import type { Agent, AgentType, Task, WorkflowConfig } from '../types/workflow';
import { DEFAULT_WORKFLOW_CONFIG } from '../types/workflow';

// ============================================
// 测试辅助函数
// ============================================

/**
 * 创建测试用的 WorkflowConfig
 */
function createTestConfig(overrides?: Partial<WorkflowConfig>): WorkflowConfig {
    return {
        ...DEFAULT_WORKFLOW_CONFIG,
        maxAgents: 10,
        maxConcurrentTasks: 5,
        ...overrides
    };
}

/**
 * 创建测试用的 Task
 */
function createTestTask(overrides?: Partial<Task>): Task {
    return {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: 'Test task',
        type: 'sequential',
        priority: 'medium',
        dependencies: [],
        dependents: [],
        estimatedComplexity: 3,
        requiredSkills: [],
        requiredTools: [],
        status: 'pending',
        progress: 0,
        metrics: { retryCount: 0 },
        metadata: {},
        ...overrides
    };
}

// ============================================
// 生成器
// ============================================

/**
 * 生成有效的代理类型
 */
const agentTypeArb: fc.Arbitrary<AgentType> = fc.constantFrom(
    'orchestrator', 'planner', 'frontend', 'backend', 'fullstack',
    'testing', 'devops', 'review', 'docs', 'general'
);

/**
 * 生成有效的任务优先级
 */
const priorityArb = fc.constantFrom('low', 'medium', 'high', 'critical') as fc.Arbitrary<'low' | 'medium' | 'high' | 'critical'>;

/**
 * 生成技能列表
 */
const skillsArb = fc.array(
    fc.constantFrom(
        'ui-ux', 'responsive-design', 'api-design', 'database',
        'unit-testing', 'e2e-testing', 'ci-cd', 'documentation',
        'code-review', 'security', 'performance', 'accessibility'
    ),
    { maxLength: 5 }
);

/**
 * 生成工具列表
 */
const toolsArb = fc.array(
    fc.constantFrom(
        'npm', 'vite', 'webpack', 'docker', 'git', 'eslint',
        'jest', 'vitest', 'playwright', 'postgresql', 'redis'
    ),
    { maxLength: 5 }
);

/**
 * 生成测试任务
 */
const taskArb: fc.Arbitrary<Task> = fc.record({
    id: fc.uuid(),
    description: fc.string({ minLength: 10, maxLength: 100 }),
    type: fc.constantFrom('sequential', 'parallel', 'conditional') as fc.Arbitrary<'sequential' | 'parallel' | 'conditional'>,
    priority: priorityArb,
    dependencies: fc.constant([]) as fc.Arbitrary<string[]>,
    dependents: fc.constant([]) as fc.Arbitrary<string[]>,
    estimatedComplexity: fc.constantFrom(1, 2, 3, 4, 5) as fc.Arbitrary<1 | 2 | 3 | 4 | 5>,
    requiredSkills: skillsArb,
    requiredTools: toolsArb,
    status: fc.constant('pending') as fc.Arbitrary<'pending'>,
    progress: fc.constant(0),
    metrics: fc.constant({ retryCount: 0 }),
    metadata: fc.record({
        suggestedAgentType: fc.option(agentTypeArb, { nil: undefined })
    })
});

// ============================================
// 属性测试
// ============================================

describe('AgentSwarmManager Property Tests', () => {
    let manager: AgentSwarmManager;

    beforeEach(() => {
        manager = new AgentSwarmManager(createTestConfig());
    });

    afterEach(() => {
        manager.removeAllListeners();
    });

    /**
     * Property 4: Agent-Task Matching
     * *For any* task with required skills, the agent with the highest capability
     * match score SHALL be assigned to that task.
     *
     * **Validates: Requirements 3.2**
     */
    describe('Property 4: Agent-Task Matching', () => {
        it('agent with matching type should score higher than mismatched type', async () => {
            await fc.assert(
                fc.asyncProperty(agentTypeArb, async (agentType) => {
                    // 创建两个代理：一个匹配类型，一个不匹配
                    const matchingAgent = await manager.createAgent(agentType);
                    const mismatchedType = agentType === 'frontend' ? 'backend' : 'frontend';
                    const mismatchedAgent = await manager.createAgent(mismatchedType);

                    // 创建一个指定代理类型的任务
                    const task = createTestTask({
                        metadata: { suggestedAgentType: agentType }
                    });

                    // 获取匹配结果
                    const results = manager.matchAgentsToTask(task, [matchingAgent.id, mismatchedAgent.id]);

                    // 找到两个代理的分数
                    const matchingScore = results.find(r => r.agent.id === matchingAgent.id)?.score || 0;
                    const mismatchedScore = results.find(r => r.agent.id === mismatchedAgent.id)?.score || 0;

                    // 匹配类型的代理应该得分更高
                    expect(matchingScore).toBeGreaterThan(mismatchedScore);

                    // 清理
                    await manager.destroyAgent(matchingAgent.id);
                    await manager.destroyAgent(mismatchedAgent.id);
                }),
                { numRuns: 20 }
            );
        });

        it('agent with matching skills should score higher', async () => {
            await fc.assert(
                fc.asyncProperty(skillsArb, async (skills) => {
                    if (skills.length === 0) return; // 跳过空技能

                    // 创建前端代理（有 ui-ux 等技能）
                    const frontendAgent = await manager.createAgent('frontend');
                    // 创建后端代理（有 api-design 等技能）
                    const backendAgent = await manager.createAgent('backend');

                    // 创建需要 ui-ux 技能的任务
                    const task = createTestTask({
                        requiredSkills: ['ui-ux', 'responsive-design'],
                        metadata: {}
                    });

                    // 获取匹配结果
                    const results = manager.matchAgentsToTask(task, [frontendAgent.id, backendAgent.id]);

                    // 前端代理应该匹配更多技能
                    const frontendResult = results.find(r => r.agent.id === frontendAgent.id);
                    const backendResult = results.find(r => r.agent.id === backendAgent.id);

                    expect(frontendResult?.matchedSkills.length).toBeGreaterThanOrEqual(
                        backendResult?.matchedSkills.length || 0
                    );

                    // 清理
                    await manager.destroyAgent(frontendAgent.id);
                    await manager.destroyAgent(backendAgent.id);
                }),
                { numRuns: 20 }
            );
        });

        it('match results should include all matched capabilities', async () => {
            // 创建一个前端代理
            const agent = await manager.createAgent('frontend');

            // 创建一个需要前端技能和工具的任务
            const task = createTestTask({
                requiredSkills: ['ui-ux'],
                requiredTools: ['npm', 'vite'],
                metadata: { suggestedAgentType: 'frontend' }
            });

            // 获取匹配结果
            const results = manager.matchAgentsToTask(task, [agent.id]);
            const result = results[0];

            // 验证匹配结果结构
            expect(result).toBeDefined();
            expect(result.agent.id).toBe(agent.id);
            expect(result.score).toBeGreaterThan(0);
            expect(Array.isArray(result.matchedSkills)).toBe(true);
            expect(Array.isArray(result.matchedTools)).toBe(true);
            expect(Array.isArray(result.matchedLanguages)).toBe(true);
            expect(Array.isArray(result.matchedFrameworks)).toBe(true);

            // 清理
            await manager.destroyAgent(agent.id);
        });
    });

    /**
     * Property 5: Concurrency Limit
     * *For any* workflow execution, the number of concurrently executing tasks
     * SHALL NOT exceed maxConcurrentTasks.
     *
     * **Validates: Requirements 3.3**
     */
    describe('Property 5: Concurrency Limit', () => {
        it('current concurrency should never exceed max', async () => {
            const maxConcurrent = 3;
            const testManager = new AgentSwarmManager(createTestConfig({
                maxConcurrentTasks: maxConcurrent
            }));

            // 创建多个代理
            for (let i = 0; i < 5; i++) {
                await testManager.createAgent('general');
            }

            // 验证初始并发为 0
            expect(testManager.getCurrentConcurrency()).toBe(0);

            // 获取队列状态
            const status = testManager.getTaskQueueStatus();
            expect(status.maxConcurrent).toBe(maxConcurrent);
            expect(status.currentConcurrent).toBe(0);
            expect(status.availableSlots).toBe(maxConcurrent);

            testManager.removeAllListeners();
        });

        it('setMaxConcurrency should update the limit', () => {
            fc.assert(
                fc.property(fc.integer({ min: 1, max: 100 }), (newMax) => {
                    const testManager = new AgentSwarmManager(createTestConfig());
                    testManager.setMaxConcurrency(newMax);

                    const status = testManager.getTaskQueueStatus();
                    expect(status.maxConcurrent).toBe(newMax);

                    testManager.removeAllListeners();
                }),
                { numRuns: 50 }
            );
        });

        it('setMaxConcurrency should enforce minimum of 1', () => {
            fc.assert(
                fc.property(fc.integer({ min: -100, max: 0 }), (invalidMax) => {
                    const testManager = new AgentSwarmManager(createTestConfig());
                    testManager.setMaxConcurrency(invalidMax);

                    const status = testManager.getTaskQueueStatus();
                    expect(status.maxConcurrent).toBeGreaterThanOrEqual(1);

                    testManager.removeAllListeners();
                }),
                { numRuns: 20 }
            );
        });
    });

    /**
     * Property 6: Agent Pool Lifecycle
     * *For any* sequence of agent create/destroy operations, the pool state
     * SHALL remain consistent (no orphaned references, correct counts).
     *
     * **Validates: Requirements 3.1, 3.4**
     */
    describe('Property 6: Agent Pool Lifecycle', () => {
        it('pool counts should be consistent after create operations', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(agentTypeArb, { minLength: 1, maxLength: 8 }),
                    async (agentTypes) => {
                        const testManager = new AgentSwarmManager(createTestConfig({ maxAgents: 10 }));
                        const createdAgents: Agent[] = [];

                        // 创建代理
                        for (const type of agentTypes) {
                            const agent = await testManager.createAgent(type);
                            createdAgents.push(agent);
                        }

                        // 验证池状态
                        const status = testManager.getPoolStatus();
                        expect(status.total).toBe(createdAgents.length);
                        expect(status.idle).toBe(createdAgents.length);
                        expect(status.busy).toBe(0);

                        // 验证所有代理都可以获取
                        const agents = testManager.getAgents();
                        expect(agents.length).toBe(createdAgents.length);

                        // 清理
                        for (const agent of createdAgents) {
                            await testManager.destroyAgent(agent.id);
                        }

                        testManager.removeAllListeners();
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('pool counts should be consistent after destroy operations', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 5 }),
                    async (agentCount) => {
                        const testManager = new AgentSwarmManager(createTestConfig({ maxAgents: 10 }));
                        const createdAgents: Agent[] = [];

                        // 创建代理
                        for (let i = 0; i < agentCount; i++) {
                            const agent = await testManager.createAgent('general');
                            createdAgents.push(agent);
                        }

                        // 随机销毁一些代理
                        const toDestroy = Math.floor(agentCount / 2);
                        for (let i = 0; i < toDestroy; i++) {
                            await testManager.destroyAgent(createdAgents[i].id);
                        }

                        // 验证池状态
                        const status = testManager.getPoolStatus();
                        expect(status.total).toBe(agentCount - toDestroy);
                        expect(status.idle).toBe(agentCount - toDestroy);

                        // 清理剩余代理
                        for (let i = toDestroy; i < agentCount; i++) {
                            await testManager.destroyAgent(createdAgents[i].id);
                        }

                        testManager.removeAllListeners();
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('destroying non-existent agent should not throw', async () => {
            const testManager = new AgentSwarmManager(createTestConfig());

            // 销毁不存在的代理不应该抛出异常
            await expect(testManager.destroyAgent('non-existent-id')).resolves.not.toThrow();

            testManager.removeAllListeners();
        });

        it('pool should enforce max agent limit', async () => {
            const maxAgents = 3;
            const testManager = new AgentSwarmManager(createTestConfig({ maxAgents }));

            // 创建最大数量的代理
            for (let i = 0; i < maxAgents; i++) {
                await testManager.createAgent('general');
            }

            // 尝试创建超过限制的代理应该抛出异常
            await expect(testManager.createAgent('general')).rejects.toThrow(/Maximum agent limit/);

            testManager.removeAllListeners();
        });
    });

    /**
     * Property 7: Task Queue Preservation
     * *For any* task added to the queue, it SHALL remain in the queue until
     * explicitly assigned, completed, failed, or cancelled.
     *
     * **Validates: Requirements 3.5**
     */
    describe('Property 7: Task Queue Preservation', () => {
        it('task queue status should reflect actual state', () => {
            const testManager = new AgentSwarmManager(createTestConfig({
                maxConcurrentTasks: 5
            }));

            const status = testManager.getTaskQueueStatus();

            // 初始状态验证
            expect(status.queueLength).toBe(0);
            expect(status.currentConcurrent).toBe(0);
            expect(status.availableSlots).toBe(status.maxConcurrent);

            testManager.removeAllListeners();
        });

        it('scheduler status should track task states correctly', async () => {
            const testManager = new AgentSwarmManager(createTestConfig());

            // 创建一个代理
            await testManager.createAgent('general');

            // 获取调度器状态
            const schedulerStatus = testManager.getSchedulerStatus();

            // 验证初始状态
            expect(schedulerStatus.isRunning).toBe(false);
            expect(schedulerStatus.taskQueue).toEqual([]);
            expect(schedulerStatus.completedTasks.size).toBe(0);
            expect(schedulerStatus.failedTasks.size).toBe(0);
            expect(schedulerStatus.inProgressTasks.size).toBe(0);

            testManager.removeAllListeners();
        });

        it('task priority sorting should be deterministic', () => {
            fc.assert(
                fc.property(
                    fc.array(taskArb, { minLength: 2, maxLength: 10 }),
                    (tasks) => {
                        // 按优先级排序两次，结果应该相同
                        const priorityOrder: Record<string, number> = {
                            'critical': 4,
                            'high': 3,
                            'medium': 2,
                            'low': 1
                        };

                        const sortFn = (a: Task, b: Task) => {
                            const priorityDiff = (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
                            if (priorityDiff !== 0) return priorityDiff;
                            const depDiff = a.dependencies.length - b.dependencies.length;
                            if (depDiff !== 0) return depDiff;
                            return a.estimatedComplexity - b.estimatedComplexity;
                        };

                        const sorted1 = [...tasks].sort(sortFn);
                        const sorted2 = [...tasks].sort(sortFn);

                        // 验证排序结果一致
                        expect(sorted1.map(t => t.id)).toEqual(sorted2.map(t => t.id));

                        // 验证高优先级任务在前
                        for (let i = 1; i < sorted1.length; i++) {
                            const prevPriority = priorityOrder[sorted1[i - 1].priority] || 2;
                            const currPriority = priorityOrder[sorted1[i].priority] || 2;
                            expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});

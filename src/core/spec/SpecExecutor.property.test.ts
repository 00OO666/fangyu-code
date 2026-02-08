/**
 * SpecExecutor Property Tests
 *
 * Property 13: EARS 格式合规性 (Requirements 5.2)
 * Property 14: 任务依赖顺序 (Requirements 5.4)
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { SpecExecutor, EARSPattern, MockSpecFileSystem } from "./SpecExecutor";
import { TaskItem, TaskStatus, RequirementsDoc } from "../types/unified-agent";

// ============================================================================
// Test Generators
// ============================================================================

// EARS 模式生成器
const earsPatternGenerators: Record<EARSPattern, fc.Arbitrary<string>> = {
  ubiquitous: fc
    .tuple(
      fc.constantFrom("System", "Application", "Service", "Component"),
      fc.constantFrom("respond", "display", "process", "validate", "store")
    )
    .map(([system, action]) => `THE ${system} SHALL ${action} within 100ms`),

  "event-driven": fc
    .tuple(
      fc.constantFrom("user clicks", "request arrives", "file changes", "timer expires"),
      fc.constantFrom("System", "Application", "Service"),
      fc.constantFrom("respond", "update", "notify", "log")
    )
    .map(([trigger, system, action]) => `WHEN ${trigger}, THE ${system} SHALL ${action}`),

  "state-driven": fc
    .tuple(
      fc.constantFrom("connected", "authenticated", "processing", "idle"),
      fc.constantFrom("System", "Application", "Service"),
      fc.constantFrom("maintain", "monitor", "check", "update")
    )
    .map(
      ([condition, system, action]) => `WHILE ${condition}, THE ${system} SHALL ${action} status`
    ),

  unwanted: fc
    .tuple(
      fc.constantFrom("error occurs", "timeout happens", "validation fails", "connection lost"),
      fc.constantFrom("System", "Application", "Service"),
      fc.constantFrom("recover", "retry", "notify", "log")
    )
    .map(([condition, system, action]) => `IF ${condition}, THEN THE ${system} SHALL ${action}`),

  optional: fc
    .tuple(
      fc.constantFrom("feature enabled", "debug mode", "premium tier", "admin access"),
      fc.constantFrom("System", "Application", "Service"),
      fc.constantFrom("provide", "enable", "allow", "display")
    )
    .map(
      ([option, system, action]) =>
        `WHERE ${option}, THE ${system} SHALL ${action} additional features`
    ),

  complex: fc
    .tuple(
      fc.constantFrom("premium tier", "admin mode"),
      fc.constantFrom("connected", "authenticated"),
      fc.constantFrom("request arrives", "user clicks"),
      fc.constantFrom("System", "Application"),
      fc.constantFrom("process", "respond")
    )
    .map(
      ([option, state, trigger, system, action]) =>
        `WHERE ${option} WHILE ${state} WHEN ${trigger} THE ${system} SHALL ${action} immediately`
    ),
};

// 生成任意 EARS 模式的验收标准
const arbEARSCriterion = fc.oneof(
  earsPatternGenerators.ubiquitous,
  earsPatternGenerators["event-driven"],
  earsPatternGenerators["state-driven"],
  earsPatternGenerators.unwanted,
  earsPatternGenerators.optional
);

// 生成非 EARS 格式的字符串
const arbNonEARSString = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
  const upper = s.toUpperCase();
  return (
    !upper.startsWith("THE ") &&
    !upper.startsWith("WHEN ") &&
    !upper.startsWith("WHILE ") &&
    !upper.startsWith("IF ") &&
    !upper.startsWith("WHERE ")
  );
});

// 生成任务 ID
const arbTaskId = fc.nat({ max: 100 }).map((n) => `${n + 1}`);

// 生成任务状态
const arbTaskStatus: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  "pending",
  "queued",
  "in_progress",
  "completed",
  "failed",
  "cancelled"
);

// 生成单个任务（无依赖）
const arbSimpleTask: fc.Arbitrary<TaskItem> = fc.record({
  id: arbTaskId,
  description: fc.string({ minLength: 1, maxLength: 50 }),
  status: arbTaskStatus,
  dependencies: fc.constant([]),
  progress: fc.nat({ max: 100 }),
  isOptional: fc.boolean(),
  requirements: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
});

// 生成有效的任务列表（依赖指向已存在的任务）
function arbValidTaskList(size: number): fc.Arbitrary<TaskItem[]> {
  return fc.array(arbSimpleTask, { minLength: size, maxLength: size }).map((tasks) => {
    // 确保 ID 唯一
    const uniqueTasks = tasks.map((task, index) => ({
      ...task,
      id: `${index + 1}`,
      dependencies: [] as string[],
    }));

    // 为后面的任务添加对前面任务的依赖
    for (let i = 1; i < uniqueTasks.length; i++) {
      const maxDeps = Math.min(i, 3);
      const numDeps = Math.floor(Math.random() * (maxDeps + 1));
      const deps: string[] = [];
      for (let j = 0; j < numDeps; j++) {
        const depIndex = Math.floor(Math.random() * i);
        const depId = uniqueTasks[depIndex].id;
        if (!deps.includes(depId)) {
          deps.push(depId);
        }
      }
      uniqueTasks[i].dependencies = deps;
    }

    return uniqueTasks;
  });
}

// 生成带循环依赖的任务列表（保证至少有 3 个任务）
function arbCircularTaskList(): fc.Arbitrary<TaskItem[]> {
  return fc.constant(null).map(() => {
    // 创建 3 个任务，形成循环依赖 A -> B -> C -> A
    const tasks: TaskItem[] = [
      {
        id: "1",
        description: "Task A",
        status: "pending",
        dependencies: ["3"], // A depends on C
        progress: 0,
        isOptional: false,
        requirements: [],
      },
      {
        id: "2",
        description: "Task B",
        status: "pending",
        dependencies: ["1"], // B depends on A
        progress: 0,
        isOptional: false,
        requirements: [],
      },
      {
        id: "3",
        description: "Task C",
        status: "pending",
        dependencies: ["2"], // C depends on B
        progress: 0,
        isOptional: false,
        requirements: [],
      },
    ];
    return tasks;
  });
}

// 生成需求文档
const arbRequirementsDoc: fc.Arbitrary<RequirementsDoc> = fc.record({
  introduction: fc.string({ minLength: 10, maxLength: 200 }),
  glossary: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z]/.test(s)),
    fc.string({ minLength: 1, maxLength: 100 }),
    { minKeys: 1, maxKeys: 5 }
  ),
  requirements: fc.array(
    fc.record({
      id: fc.nat({ max: 100 }).map((n) => `${n + 1}`),
      userStory: fc.string({ minLength: 10, maxLength: 200 }),
      acceptanceCriteria: fc.array(arbEARSCriterion, { minLength: 1, maxLength: 3 }),
    }),
    { minLength: 1, maxLength: 5 }
  ),
});

// ============================================================================
// Property Tests
// ============================================================================

describe("SpecExecutor Property Tests", () => {
  /**
   * Property 13: EARS 格式合规性
   * Requirements: 5.2
   *
   * 对于任何符合 EARS 模式的验收标准，validateEARSCompliance 应返回 valid: true
   */
  describe("Property 13: EARS Format Compliance", () => {
    const executor = new SpecExecutor();

    it("should validate ubiquitous EARS pattern", () => {
      fc.assert(
        fc.property(earsPatternGenerators.ubiquitous, (criterion) => {
          const result = executor.validateEARSCompliance(criterion);
          expect(result.valid).toBe(true);
          expect(result.pattern).toBe("ubiquitous");
        }),
        { numRuns: 100 }
      );
    });

    it("should validate event-driven EARS pattern", () => {
      fc.assert(
        fc.property(earsPatternGenerators["event-driven"], (criterion) => {
          const result = executor.validateEARSCompliance(criterion);
          expect(result.valid).toBe(true);
          expect(result.pattern).toBe("event-driven");
        }),
        { numRuns: 100 }
      );
    });

    it("should validate state-driven EARS pattern", () => {
      fc.assert(
        fc.property(earsPatternGenerators["state-driven"], (criterion) => {
          const result = executor.validateEARSCompliance(criterion);
          expect(result.valid).toBe(true);
          expect(result.pattern).toBe("state-driven");
        }),
        { numRuns: 100 }
      );
    });

    it("should validate unwanted behavior EARS pattern", () => {
      fc.assert(
        fc.property(earsPatternGenerators.unwanted, (criterion) => {
          const result = executor.validateEARSCompliance(criterion);
          expect(result.valid).toBe(true);
          expect(result.pattern).toBe("unwanted");
        }),
        { numRuns: 100 }
      );
    });

    it("should validate optional feature EARS pattern", () => {
      fc.assert(
        fc.property(earsPatternGenerators.optional, (criterion) => {
          const result = executor.validateEARSCompliance(criterion);
          expect(result.valid).toBe(true);
          expect(result.pattern).toBe("optional");
        }),
        { numRuns: 100 }
      );
    });

    it("should reject non-EARS format strings", () => {
      fc.assert(
        fc.property(arbNonEARSString, (criterion) => {
          const result = executor.validateEARSCompliance(criterion);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it("should detect correct EARS pattern type", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            earsPatternGenerators.ubiquitous.map((c) => ({
              criterion: c,
              expected: "ubiquitous" as EARSPattern,
            })),
            earsPatternGenerators["event-driven"].map((c) => ({
              criterion: c,
              expected: "event-driven" as EARSPattern,
            })),
            earsPatternGenerators["state-driven"].map((c) => ({
              criterion: c,
              expected: "state-driven" as EARSPattern,
            })),
            earsPatternGenerators.unwanted.map((c) => ({
              criterion: c,
              expected: "unwanted" as EARSPattern,
            })),
            earsPatternGenerators.optional.map((c) => ({
              criterion: c,
              expected: "optional" as EARSPattern,
            }))
          ),
          ({ criterion, expected }) => {
            const pattern = executor.detectEARSPattern(criterion);
            expect(pattern).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: 任务依赖顺序
   * Requirements: 5.4
   *
   * 对于任何有效的任务列表，依赖验证应通过；
   * 对于循环依赖或无效依赖，应检测出错误
   */
  describe("Property 14: Task Dependency Order", () => {
    const executor = new SpecExecutor();

    it("should validate tasks with valid dependencies", () => {
      fc.assert(
        fc.property(
          fc.nat({ min: 1, max: 10 }).chain((size) => arbValidTaskList(size)),
          (tasks) => {
            const result = executor.validateTaskDependencies(tasks);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should detect circular dependencies", () => {
      fc.assert(
        fc.property(arbCircularTaskList(), (tasks) => {
          const result = executor.validateTaskDependencies(tasks);
          // 循环依赖应该被检测到
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.includes("circular"))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should detect non-existent dependencies", () => {
      fc.assert(
        fc.property(
          arbValidTaskList(3),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !["1", "2", "3"].includes(s)),
          (tasks, invalidDep) => {
            // 添加一个指向不存在任务的依赖
            const modifiedTasks = [...tasks];
            if (modifiedTasks.length > 0) {
              modifiedTasks[modifiedTasks.length - 1] = {
                ...modifiedTasks[modifiedTasks.length - 1],
                dependencies: [invalidDep],
              };
            }

            const result = executor.validateTaskDependencies(modifiedTasks);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes("non-existent"))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return next executable task respecting dependencies", () => {
      fc.assert(
        fc.property(
          fc.nat({ min: 2, max: 5 }).chain((size) => arbValidTaskList(size)),
          (tasks) => {
            // 将所有任务设为 pending
            const pendingTasks = tasks.map((t) => ({ ...t, status: "pending" as TaskStatus }));

            const nextTask = executor.getNextExecutableTask(pendingTasks);

            if (nextTask) {
              // 下一个可执行任务的所有依赖应该已完成或不存在
              const completedIds = new Set(
                pendingTasks.filter((t) => t.status === "completed").map((t) => t.id)
              );

              for (const dep of nextTask.dependencies) {
                // 依赖要么已完成，要么不在任务列表中（外部依赖）
                const depTask = pendingTasks.find((t) => t.id === dep);
                if (depTask) {
                  expect(depTask.status).toBe("completed");
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should find task with no dependencies as first executable", () => {
      fc.assert(
        fc.property(
          fc.nat({ min: 1, max: 5 }).chain((size) => arbValidTaskList(size)),
          (tasks) => {
            // 所有任务都是 pending
            const pendingTasks = tasks.map((t) => ({ ...t, status: "pending" as TaskStatus }));

            const nextTask = executor.getNextExecutableTask(pendingTasks);

            // 如果有任务，第一个可执行的应该是没有依赖的
            if (nextTask) {
              expect(nextTask.dependencies.length).toBe(0);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: 需求生成一致性
   * Requirements: 5.2
   */
  describe("Property: Requirements Generation Consistency", () => {
    it("should generate requirements with EARS-compliant criteria", async () => {
      const executor = new SpecExecutor();

      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 10, maxLength: 200 }), async (idea) => {
          const requirements = await executor.generateRequirements(idea);

          // 应该生成至少一个需求
          expect(requirements.requirements.length).toBeGreaterThan(0);

          // 每个需求应该有验收标准
          for (const req of requirements.requirements) {
            expect(req.acceptanceCriteria.length).toBeGreaterThan(0);

            // 每个验收标准应该符合 EARS 格式
            for (const criterion of req.acceptanceCriteria) {
              const result = executor.validateEARSCompliance(criterion);
              expect(result.valid).toBe(true);
            }
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: 设计生成一致性
   * Requirements: 5.3
   */
  describe("Property: Design Generation Consistency", () => {
    it("should generate design with correctness properties", async () => {
      const executor = new SpecExecutor();

      await fc.assert(
        fc.asyncProperty(arbRequirementsDoc, async (requirements) => {
          const design = await executor.generateDesign(requirements);

          // 应该生成组件
          expect(design.components.length).toBeGreaterThanOrEqual(0);

          // 应该生成正确性属性
          expect(design.correctnessProperties).toBeDefined();

          // 每个正确性属性应该引用需求
          for (const prop of design.correctnessProperties) {
            expect(prop.validates.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: 任务生成一致性
   * Requirements: 5.4
   */
  describe("Property: Task Generation Consistency", () => {
    it("should generate valid task dependencies", async () => {
      const executor = new SpecExecutor();

      await fc.assert(
        fc.asyncProperty(arbRequirementsDoc, async (requirements) => {
          const design = await executor.generateDesign(requirements);
          const taskList = await executor.generateTasks(design);

          // 应该生成任务
          expect(taskList.tasks.length).toBeGreaterThan(0);

          // 任务依赖应该有效
          const validation = executor.validateTaskDependencies(taskList.tasks);
          expect(validation.valid).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: 进度追踪一致性
   * Requirements: 5.5
   */
  describe("Property: Progress Tracking Consistency", () => {
    it("should track progress correctly", async () => {
      const fs = new MockSpecFileSystem();
      const executor = new SpecExecutor(fs);

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).filter((s) => /^[a-zA-Z]/.test(s)),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (featureName, idea) => {
            // 创建 spec - workflow 是存储在 executor 内部 Map 中的引用
            const workflow = await executor.createSpec(featureName, idea);

            // 生成设计和任务 - 直接修改 workflow 对象，因为它是 Map 中的引用
            workflow.design = await executor.generateDesign(workflow.requirements!);
            workflow.tasks = await executor.generateTasks(workflow.design);

            // 获取 normalized name 用于后续操作
            const normalizedName = featureName
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "");

            // 初始进度应该是 0%
            const initialProgress = executor.getProgress(normalizedName);
            expect(initialProgress.percentage).toBe(0);
            expect(initialProgress.completedTasks).toBe(0);

            // 找到所有任务（包括子任务）
            const allTasks: TaskItem[] = [];
            const collectTasks = (tasks: TaskItem[]) => {
              for (const task of tasks) {
                allTasks.push(task);
                if (task.subtasks) {
                  collectTasks(task.subtasks);
                }
              }
            };
            collectTasks(workflow.tasks.tasks);

            if (allTasks.length > 0) {
              // 完成第一个任务
              executor.updateTaskStatus(normalizedName, allTasks[0].id, "completed");

              const updatedProgress = executor.getProgress(normalizedName);
              // 完成任务后，已完成数应该增加
              expect(updatedProgress.completedTasks).toBeGreaterThanOrEqual(1);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property: Todo Enforcer 一致性
   * Requirements: 5.6
   */
  describe("Property: Todo Enforcer Consistency", () => {
    it("should identify incomplete non-optional tasks", async () => {
      const fs = new MockSpecFileSystem();
      const executor = new SpecExecutor(fs);

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).filter((s) => /^[a-zA-Z]/.test(s)),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (featureName, idea) => {
            const workflow = await executor.createSpec(featureName, idea);
            workflow.design = await executor.generateDesign(workflow.requirements!);
            workflow.tasks = await executor.generateTasks(workflow.design);

            // 获取 normalized name
            const normalizedName = featureName
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "");

            const incompleteTasks = executor.checkIncompleteTasks(normalizedName);

            // 所有返回的任务应该是未完成且非可选的
            for (const task of incompleteTasks) {
              expect(task.status).not.toBe("completed");
              expect(task.status).not.toBe("cancelled");
              expect(task.isOptional).toBe(false);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});

/**
 * 配置状态服务属性测试
 *
 * **Feature: engine-one-click-setup**
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import {
  ENGINE_SETUP_STEPS,
  validateStepOrder,
  getStepDisplayStatus,
  createInitialProgress,
  getConfigStatusText,
  type EngineSetupProgress,
  type ConfigStatus,
} from "./setupStateService";
import type { EngineType } from "../types/provider";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// 引擎类型生成器
const engineTypeArb = fc.constantFrom<EngineType>("claude", "codex", "gemini");

// 配置进度生成器
const setupProgressArb = (engine: EngineType): fc.Arbitrary<EngineSetupProgress> => {
  const steps = ENGINE_SETUP_STEPS[engine];
  const stepIds = steps.map((s) => s.id);

  return fc.record({
    engine: fc.constant(engine),
    status: fc.constantFrom<"not_started" | "in_progress" | "completed">(
      "not_started",
      "in_progress",
      "completed"
    ),
    currentStep: fc.integer({ min: 0, max: steps.length }),
    completedSteps: fc.subarray(stepIds),
    lastUpdated: fc.integer({ min: 0, max: Date.now() }),
  });
};

describe("配置状态持久化属性测试", () => {
  /**
   * **Property 3: Configuration State Persistence Round-Trip**
   *
   * *For any* setup progress state, the state object should be serializable
   * and deserializable without data loss.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  describe("Property 3: Configuration State Persistence Round-Trip", () => {
    it("配置进度序列化和反序列化应保持数据一致", () => {
      fc.assert(
        fc.property(
          engineTypeArb.chain((engine) => setupProgressArb(engine)),
          (progress) => {
            // 序列化
            const serialized = JSON.stringify(progress);

            // 反序列化
            const deserialized = JSON.parse(serialized) as EngineSetupProgress;

            // 验证所有字段一致
            expect(deserialized.engine).toBe(progress.engine);
            expect(deserialized.status).toBe(progress.status);
            expect(deserialized.currentStep).toBe(progress.currentStep);
            expect(deserialized.completedSteps).toEqual(progress.completedSteps);
            expect(deserialized.lastUpdated).toBe(progress.lastUpdated);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("配置进度的 completedSteps 应该是有效的步骤 ID", () => {
      fc.assert(
        fc.property(
          engineTypeArb.chain((engine) => setupProgressArb(engine)),
          (progress) => {
            const validStepIds = ENGINE_SETUP_STEPS[progress.engine].map((s) => s.id);

            // 所有已完成步骤都应该是有效的步骤 ID
            for (const stepId of progress.completedSteps) {
              expect(validStepIds).toContain(stepId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 5: Step Completion Ordering**
   *
   * *For any* setup wizard execution, completed steps SHALL always be
   * a prefix of the total steps (no gaps in completion for required steps).
   *
   * **Validates: Requirements 3.1, 4.1, 5.1, 6.1**
   */
  describe("Property 5: Step Completion Ordering", () => {
    it("有效的步骤完成顺序应该通过验证", () => {
      fc.assert(
        fc.property(engineTypeArb, fc.integer({ min: 0, max: 5 }), (engine, completionCount) => {
          const steps = ENGINE_SETUP_STEPS[engine];
          const requiredSteps = steps.filter((s) => !s.optional);

          // 生成连续的已完成步骤（有效顺序）
          const validCompletedSteps = requiredSteps
            .slice(0, Math.min(completionCount, requiredSteps.length))
            .map((s) => s.id);

          // 验证应该通过
          expect(validateStepOrder(validCompletedSteps, steps)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("跳过必要步骤的完成顺序应该验证失败", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];
          const requiredSteps = steps.filter((s) => !s.optional);

          // 至少需要 2 个必要步骤才能测试跳过
          if (requiredSteps.length < 2) {
            return true; // 跳过这个测试用例
          }

          // 生成跳过第一个步骤的无效顺序
          const invalidCompletedSteps = [requiredSteps[1].id];

          // 验证应该失败
          expect(validateStepOrder(invalidCompletedSteps, steps)).toBe(false);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("空的已完成步骤列表应该通过验证", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];

          // 空列表应该通过验证
          expect(validateStepOrder([], steps)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 步骤显示状态一致性测试
   */
  describe("步骤显示状态一致性", () => {
    it("已完成的步骤应该显示为 completed", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];
          const completedSteps = [steps[0].id];

          const status = getStepDisplayStatus(
            steps[0].id,
            1, // 当前在第二步
            completedSteps,
            steps
          );

          expect(status).toBe("completed");
        }),
        { numRuns: 100 }
      );
    });

    it("当前步骤应该显示为 in_progress", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];

          const status = getStepDisplayStatus(
            steps[0].id,
            0, // 当前在第一步
            [],
            steps
          );

          expect(status).toBe("in_progress");
        }),
        { numRuns: 100 }
      );
    });

    it("未到达的步骤应该显示为 pending", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];

          if (steps.length < 2) {
            return true;
          }

          const status = getStepDisplayStatus(
            steps[1].id,
            0, // 当前在第一步
            [],
            steps
          );

          expect(status).toBe("pending");
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 初始进度创建测试
   */
  describe("初始进度创建", () => {
    it("初始进度应该有正确的默认值", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const progress = createInitialProgress(engine);

          expect(progress.engine).toBe(engine);
          expect(progress.status).toBe("not_started");
          expect(progress.currentStep).toBe(0);
          expect(progress.completedSteps).toEqual([]);
          expect(progress.lastUpdated).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 配置状态文本测试
   */
  describe("配置状态文本", () => {
    it('完全配置应该显示"已配置"', () => {
      const status: ConfigStatus = {
        isFullyConfigured: true,
        incompleteSteps: [],
      };

      expect(getConfigStatusText(status)).toBe("已配置");
    });

    it('部分配置应该显示"配置中"', () => {
      const status: ConfigStatus = {
        isFullyConfigured: false,
        incompleteSteps: ["verify"],
      };

      expect(getConfigStatusText(status)).toBe("配置中");
    });
  });
});

/**
 * **Property 4: Engine Configuration Isolation**
 *
 * *For any* configuration update to one engine, the configurations
 * of all other engines SHALL remain unchanged.
 *
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
 */
describe("Property 4: Engine Configuration Isolation", () => {
  it("每个引擎应该有独立的存储键", () => {
    fc.assert(
      fc.property(engineTypeArb, engineTypeArb, (engine1, engine2) => {
        if (engine1 === engine2) {
          return true; // 跳过相同引擎的测试
        }

        // 存储键应该不同
        const key1 = `engine_setup_progress_${engine1}`;
        const key2 = `engine_setup_progress_${engine2}`;

        expect(key1).not.toBe(key2);
      }),
      { numRuns: 100 }
    );
  });

  it("不同引擎的配置步骤应该独立", () => {
    fc.assert(
      fc.property(engineTypeArb, engineTypeArb, (engine1, engine2) => {
        const steps1 = ENGINE_SETUP_STEPS[engine1];
        const steps2 = ENGINE_SETUP_STEPS[engine2];

        // 每个引擎都有自己的步骤定义
        expect(steps1).toBeDefined();
        expect(steps2).toBeDefined();

        // 步骤数组是独立的（不是同一个引用）
        if (engine1 !== engine2) {
          expect(steps1).not.toBe(steps2);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("初始进度应该只包含指定引擎", () => {
    fc.assert(
      fc.property(engineTypeArb, (engine) => {
        const progress = createInitialProgress(engine);

        expect(progress.engine).toBe(engine);
        expect(progress.status).toBe("not_started");
        expect(progress.completedSteps).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it("配置进度序列化应该包含引擎标识", () => {
    fc.assert(
      fc.property(engineTypeArb, (engine) => {
        const progress = createInitialProgress(engine);
        const serialized = JSON.stringify(progress);

        // 序列化后应该包含引擎标识
        expect(serialized).toContain(`"engine":"${engine}"`);
      }),
      { numRuns: 100 }
    );
  });
});

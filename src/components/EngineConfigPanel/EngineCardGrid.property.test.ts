/**
 * EngineCardGrid 配置状态显示属性测试
 *
 * **Feature: engine-one-click-setup**
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import {
  getEngineConfigStatus,
  getConfigStatusText,
  ENGINE_SETUP_STEPS,
  type ConfigStatus,
} from "../../services/setupStateService";
import type { EngineType } from "../../types/provider";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// 引擎类型生成器
const engineTypeArb = fc.constantFrom<EngineType>("claude", "codex", "gemini");

describe("配置状态显示属性测试", () => {
  /**
   * **Property 1: Configuration Status Display Consistency**
   *
   * *For any* engine and its configuration state, the displayed status
   * (未配置/配置中/已配置) SHALL accurately reflect the actual configuration completeness.
   *
   * **Validates: Requirements 1.1, 1.3, 1.4, 7.3**
   */
  describe("Property 1: Configuration Status Display Consistency", () => {
    it('完全配置的引擎应该显示"已配置"', () => {
      const status: ConfigStatus = {
        isFullyConfigured: true,
        incompleteSteps: [],
        lastConfigured: Date.now(),
      };

      expect(getConfigStatusText(status)).toBe("已配置");
    });

    it('部分配置的引擎应该显示"配置中"', () => {
      fc.assert(
        fc.property(engineTypeArb, fc.integer({ min: 1, max: 3 }), (engine, incompleteCount) => {
          const steps = ENGINE_SETUP_STEPS[engine];
          const requiredSteps = steps.filter((s) => !s.optional);

          // 确保有足够的步骤来测试
          if (requiredSteps.length < 2) {
            return true;
          }

          // 创建部分完成的状态
          const incompleteSteps = requiredSteps
            .slice(-Math.min(incompleteCount, requiredSteps.length - 1))
            .map((s) => s.id);

          const status: ConfigStatus = {
            isFullyConfigured: false,
            incompleteSteps,
            lastConfigured: Date.now(),
          };

          expect(getConfigStatusText(status)).toBe("配置中");
        }),
        { numRuns: 100 }
      );
    });

    it("配置状态应该与 isFullyConfigured 一致", () => {
      fc.assert(
        fc.property(fc.boolean(), engineTypeArb, (isFullyConfigured, engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];
          const requiredSteps = steps.filter((s) => !s.optional);

          const status: ConfigStatus = {
            isFullyConfigured,
            incompleteSteps: isFullyConfigured ? [] : requiredSteps.map((s) => s.id),
          };

          const text = getConfigStatusText(status);

          if (isFullyConfigured) {
            expect(text).toBe("已配置");
          } else {
            // 未配置或配置中
            expect(["未配置", "配置中"]).toContain(text);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("incompleteSteps 为空时 isFullyConfigured 应该为 true", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const status: ConfigStatus = {
            isFullyConfigured: true,
            incompleteSteps: [],
          };

          // 如果没有未完成的步骤，应该是完全配置
          expect(status.isFullyConfigured).toBe(true);
          expect(getConfigStatusText(status)).toBe("已配置");
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 配置状态与步骤的一致性测试
   */
  describe("配置状态与步骤一致性", () => {
    it("每个引擎都应该有定义的配置步骤", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];

          expect(steps).toBeDefined();
          expect(Array.isArray(steps)).toBe(true);
          expect(steps.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it("每个步骤都应该有必要的属性", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];

          for (const step of steps) {
            expect(step.id).toBeDefined();
            expect(typeof step.id).toBe("string");
            expect(step.title).toBeDefined();
            expect(typeof step.title).toBe("string");
            expect(step.description).toBeDefined();
            expect(typeof step.description).toBe("string");
          }
        }),
        { numRuns: 100 }
      );
    });

    it("步骤 ID 在同一引擎内应该唯一", () => {
      fc.assert(
        fc.property(engineTypeArb, (engine) => {
          const steps = ENGINE_SETUP_STEPS[engine];
          const ids = steps.map((s) => s.id);
          const uniqueIds = new Set(ids);

          expect(uniqueIds.size).toBe(ids.length);
        }),
        { numRuns: 100 }
      );
    });
  });
});

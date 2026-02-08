/**
 * AutonomyController Property Tests
 *
 * Property 27: 自治模式切换 (Requirements 11.1, 11.2)
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AutonomyController, AutonomyMode, OperationType, RiskLevel } from "./AutonomyController";

// Test Generators
const arbMode: fc.Arbitrary<AutonomyMode> = fc.constantFrom("autopilot", "supervised");

const arbOperationType: fc.Arbitrary<OperationType> = fc.constantFrom(
  "file_create",
  "file_modify",
  "file_delete",
  "command_execute",
  "git_commit",
  "git_push",
  "install_package",
  "config_change",
  "network_request"
);

const arbRiskLevel: fc.Arbitrary<RiskLevel> = fc.constantFrom("low", "medium", "high", "critical");

// Property Tests
describe("AutonomyController Property Tests", () => {
  let controller: AutonomyController;

  beforeEach(() => {
    controller = new AutonomyController();
  });

  /**
   * Property 27: 自治模式切换
   * Requirements: 11.1, 11.2
   */
  describe("Property 27: Autonomy Mode Switching", () => {
    it("should correctly switch between modes", () => {
      fc.assert(
        fc.property(arbMode, (initialMode) => {
          const ctrl = new AutonomyController({ mode: initialMode });
          expect(ctrl.getMode()).toBe(initialMode);

          // Toggle should switch to opposite mode
          const newMode = ctrl.toggleMode();
          expect(newMode).toBe(initialMode === "autopilot" ? "supervised" : "autopilot");
          expect(ctrl.getMode()).toBe(newMode);

          // Toggle again should return to original
          const finalMode = ctrl.toggleMode();
          expect(finalMode).toBe(initialMode);
        }),
        { numRuns: 50 }
      );
    });

    it("should correctly report mode status", () => {
      fc.assert(
        fc.property(arbMode, (mode) => {
          const ctrl = new AutonomyController({ mode });

          if (mode === "autopilot") {
            expect(ctrl.isAutopilot()).toBe(true);
            expect(ctrl.isSupervised()).toBe(false);
          } else {
            expect(ctrl.isAutopilot()).toBe(false);
            expect(ctrl.isSupervised()).toBe(true);
          }
        }),
        { numRuns: 50 }
      );
    });

    it("should allow setting mode directly", () => {
      fc.assert(
        fc.property(arbMode, arbMode, (initial, target) => {
          const ctrl = new AutonomyController({ mode: initial });
          ctrl.setMode(target);
          expect(ctrl.getMode()).toBe(target);
        }),
        { numRuns: 50 }
      );
    });
  });

  // Risk Assessment Tests
  describe("Risk Assessment", () => {
    it("should assess risk based on operation type", () => {
      fc.assert(
        fc.property(arbOperationType, (type) => {
          const risk = controller.assessRisk(type);
          expect(["low", "medium", "high", "critical"]).toContain(risk);
        }),
        { numRuns: 50 }
      );
    });

    it("should elevate risk for dangerous commands", () => {
      const dangerousCommands = [
        "rm -rf /",
        "del /s /q C:\\",
        "DROP DATABASE users",
        "git push --force",
        "sudo rm -rf",
      ];

      for (const command of dangerousCommands) {
        const risk = controller.assessRisk("command_execute", { command });
        expect(["high", "critical"]).toContain(risk);
      }
    });

    it("should elevate risk for sensitive file paths", () => {
      const sensitivePaths = ["/etc/config.json", ".env.production", "secrets/api-keys.json"];

      for (const path of sensitivePaths) {
        const risk = controller.assessRisk("file_modify", { path });
        expect(["medium", "high", "critical"]).toContain(risk);
      }
    });
  });

  // Operation Request Tests
  describe("Operation Request Handling", () => {
    it("should auto-approve low risk operations in autopilot mode", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant("file_create" as OperationType),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (type, description) => {
            const ctrl = new AutonomyController({
              mode: "autopilot",
              autoApproveRiskLevels: ["low", "medium"],
            });

            const result = await ctrl.requestOperation(type, description);
            expect(result.approved).toBe(true);
            expect(result.operationId).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it("should require confirmation for high risk operations", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 50 }), async (description) => {
          const ctrl = new AutonomyController({
            mode: "autopilot",
            autoApproveRiskLevels: ["low"],
          });

          // Set up confirmation callback that rejects
          ctrl.setConfirmationCallback(async () => ({
            approved: false,
            reason: "Test rejection",
          }));

          const result = await ctrl.requestOperation("file_delete", description, {
            path: "/important/file.txt",
          });

          expect(result.approved).toBe(false);
        }),
        { numRuns: 15 }
      );
    });

    it("should track all requested operations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: arbOperationType,
              description: fc.string({ minLength: 1, maxLength: 30 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (operations) => {
            const ctrl = new AutonomyController({ mode: "autopilot" });

            for (const { type, description } of operations) {
              await ctrl.requestOperation(type, description);
            }

            const history = ctrl.getOperationHistory();
            expect(history.length).toBe(operations.length);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  // Rollback Tests
  describe("Rollback Functionality", () => {
    it("should track reversible operations for rollback", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.jsonValue(),
          async (description, rollbackData) => {
            const ctrl = new AutonomyController({
              mode: "autopilot",
              enableRollback: true,
            });

            const result = await ctrl.requestOperation(
              "file_create",
              description,
              {},
              rollbackData
            );

            ctrl.markExecuted(result.operationId, true);

            const rollbackable = ctrl.getRollbackableOperations();
            expect(rollbackable.length).toBe(1);
            expect(rollbackable[0].rollbackData).toEqual(rollbackData);
          }
        ),
        { numRuns: 15 }
      );
    });

    it("should rollback last operation correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              description: fc.string({ minLength: 1, maxLength: 20 }),
              data: fc.integer(),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (operations) => {
            const ctrl = new AutonomyController({
              mode: "autopilot",
              enableRollback: true,
            });

            for (const { description, data } of operations) {
              const result = await ctrl.requestOperation("file_create", description, {}, data);
              ctrl.markExecuted(result.operationId, true);
            }

            const initialCount = ctrl.getRollbackableOperations().length;
            const rollbackResult = await ctrl.rollbackLast();

            expect(rollbackResult.success).toBe(true);
            expect(ctrl.getRollbackableOperations().length).toBe(initialCount - 1);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  // Statistics Tests
  describe("Statistics Tracking", () => {
    it("should accurately track operation statistics", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbOperationType, { minLength: 1, maxLength: 10 }),
          async (types) => {
            const ctrl = new AutonomyController({ mode: "autopilot" });

            for (const type of types) {
              await ctrl.requestOperation(type, `Test ${type}`);
            }

            const stats = ctrl.getStats();
            expect(stats.totalOperations).toBe(types.length);

            // Verify type counts
            const typeCounts: Record<string, number> = {};
            for (const type of types) {
              typeCounts[type] = (typeCounts[type] ?? 0) + 1;
            }

            for (const [type, count] of Object.entries(typeCounts)) {
              expect(stats.byType[type as OperationType]).toBe(count);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  // Configuration Tests
  describe("Configuration Management", () => {
    it("should update configuration correctly", () => {
      fc.assert(
        fc.property(
          arbMode,
          fc.array(arbRiskLevel, { minLength: 1, maxLength: 4 }),
          fc.integer({ min: 1, max: 100 }),
          (mode, riskLevels, maxPending) => {
            const ctrl = new AutonomyController();

            ctrl.updateConfig({
              mode,
              autoApproveRiskLevels: riskLevels,
              maxPendingOperations: maxPending,
            });

            const config = ctrl.getConfig();
            expect(config.mode).toBe(mode);
            expect(config.autoApproveRiskLevels).toEqual(riskLevels);
            expect(config.maxPendingOperations).toBe(maxPending);
          }
        ),
        { numRuns: 30 }
      );
    });

    it("should manage confirmation requirements", () => {
      fc.assert(
        fc.property(fc.array(arbOperationType, { minLength: 1, maxLength: 5 }), (types) => {
          const ctrl = new AutonomyController({
            requireConfirmationFor: [],
          });

          // Add all types
          for (const type of types) {
            ctrl.addRequireConfirmation(type);
          }

          const config = ctrl.getConfig();
          const uniqueTypes = [...new Set(types)];
          expect(config.requireConfirmationFor.length).toBe(uniqueTypes.length);

          // Remove first type
          if (uniqueTypes.length > 0) {
            ctrl.removeRequireConfirmation(uniqueTypes[0]);
            const newConfig = ctrl.getConfig();
            expect(newConfig.requireConfirmationFor).not.toContain(uniqueTypes[0]);
          }
        }),
        { numRuns: 30 }
      );
    });
  });
});

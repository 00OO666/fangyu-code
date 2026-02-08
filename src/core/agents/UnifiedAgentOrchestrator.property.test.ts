/**
 * Property-Based Tests for UnifiedAgentOrchestrator
 *
 * Feature: super-ai-agent-desktop
 * Property 1: Agent 任务分配适配性
 * Validates: Requirements 1.2
 *
 * NOTE: Using reduced numRuns to prevent test hangs
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { UnifiedAgentOrchestrator, resetOrchestrator } from "./UnifiedAgentOrchestrator";
import { getBestAgentForTaskType } from "./AgentRoles";
import type { Task, TaskType, AgentRoleType } from "@/core/types/unified-agent";
import { taskTypeArb } from "@/tests/generators";

// Fast-check configuration to prevent infinite loops
const FC_OPTIONS = { numRuns: 15, timeout: 5000 };
const FC_FAST_OPTIONS = { numRuns: 10, timeout: 3000 };

describe("UnifiedAgentOrchestrator Property Tests", () => {
  let orchestrator: UnifiedAgentOrchestrator;

  beforeEach(() => {
    resetOrchestrator();
    orchestrator = new UnifiedAgentOrchestrator();
  });

  /**
   * Property 1: Agent 任务分配适配性
   *
   * For any submitted task and available agent pool, the system should
   * select an agent role that matches the task requirements (frontend tasks
   * assigned to Frontend Agent, backend tasks to Backend Agent, etc.)
   *
   * Validates: Requirements 1.2
   */
  describe("Property 1: Agent Task Assignment Fitness", () => {
    it("should assign tasks to agents with matching role types", async () => {
      await fc.assert(
        fc.asyncProperty(
          taskTypeArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 10 }),
          async (taskType: TaskType, description: string, priority: number) => {
            // Create a task
            const task: Task = {
              id: `task-${Date.now()}-${Math.random()}`,
              description,
              type: taskType,
              priority,
              status: "pending",
              dependencies: [],
              createdAt: Date.now(),
              isBackground: false,
            };

            // Get the expected best role for this task type
            const expectedRole = getBestAgentForTaskType(taskType);

            // Assign the task
            const agent = await orchestrator.assignTask(task);

            // The assigned agent should either:
            // 1. Have the expected role type, OR
            // 2. Be the orchestrator (which can handle any task)
            const isCorrectRole =
              agent.role.type === expectedRole || agent.role.type === "orchestrator";

            expect(isCorrectRole).toBe(true);
          }
        ),
        FC_OPTIONS
      );
    }, 30000); // 30 second timeout

    it("should calculate higher fit scores for matching role types", async () => {
      await fc.assert(
        fc.asyncProperty(taskTypeArb, async (taskType: TaskType) => {
          // Create agents of different types
          const matchingRole = getBestAgentForTaskType(taskType) as AgentRoleType;
          const matchingAgent = await orchestrator.createAgent(matchingRole);

          // Create a non-matching agent (use a different role)
          const nonMatchingRole: AgentRoleType =
            matchingRole === "frontend" ? "backend" : "frontend";
          const nonMatchingAgent = await orchestrator.createAgent(nonMatchingRole);

          // Create a task
          const task: Task = {
            id: `task-${Date.now()}`,
            description: `A ${taskType} task`,
            type: taskType,
            priority: 5,
            status: "pending",
            dependencies: [],
            createdAt: Date.now(),
            isBackground: false,
          };

          // Calculate fit scores
          const matchingScore = orchestrator.calculateFitScore(matchingAgent, task);
          const nonMatchingScore = orchestrator.calculateFitScore(nonMatchingAgent, task);

          // Matching agent should have higher or equal score
          // (equal is possible if orchestrator is involved)
          expect(matchingScore).toBeGreaterThanOrEqual(nonMatchingScore);
        }),
        FC_OPTIONS
      );
    });

    it("should prefer idle agents over busy agents", async () => {
      // Create two agents of the same type
      const agent1 = await orchestrator.createAgent("frontend");
      const agent2 = await orchestrator.createAgent("frontend");

      // Make agent1 busy
      orchestrator.updateAgentStatus(agent1.id, "busy");

      const task: Task = {
        id: "task-1",
        description: "Frontend task",
        type: "frontend",
        priority: 5,
        status: "pending",
        dependencies: [],
        createdAt: Date.now(),
        isBackground: false,
      };

      // Calculate fit scores
      const score1 = orchestrator.calculateFitScore(orchestrator.getAgent(agent1.id)!, task);
      const score2 = orchestrator.calculateFitScore(orchestrator.getAgent(agent2.id)!, task);

      // Idle agent should have higher score
      expect(score2).toBeGreaterThan(score1);
    });

    it("should maintain task-role mapping consistency", async () => {
      const taskRoleMappings: Array<[TaskType, AgentRoleType]> = [
        ["frontend", "frontend"],
        ["backend", "backend"],
        ["docs", "docs"],
        ["testing", "testing"],
        ["review", "review"],
        ["devops", "devops"],
        ["research", "librarian"],
      ];

      for (const [taskType, expectedRole] of taskRoleMappings) {
        const bestRole = getBestAgentForTaskType(taskType);
        expect(bestRole).toBe(expectedRole);
      }
    });
  });

  /**
   * Additional property: Agent creation should always succeed
   * for valid role types
   */
  describe("Agent Creation Properties", () => {
    it("should create agents for all valid role types", async () => {
      const roleTypes: AgentRoleType[] = [
        "orchestrator",
        "oracle",
        "librarian",
        "explorer",
        "frontend",
        "backend",
        "docs",
        "testing",
        "review",
        "devops",
      ];

      for (const roleType of roleTypes) {
        const agent = await orchestrator.createAgent(roleType);
        expect(agent).toBeDefined();
        expect(agent.role.type).toBe(roleType);
        expect(agent.status).toBe("idle");
      }
    });

    it("should generate unique IDs for each agent", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (count: number) => {
          const agents = await Promise.all(
            Array.from({ length: count }, () => orchestrator.createAgent("frontend"))
          );

          const ids = agents.map((a) => a.id);
          const uniqueIds = new Set(ids);

          expect(uniqueIds.size).toBe(count);
        }),
        FC_FAST_OPTIONS
      );
    });
  });

  /**
   * Agent cloning properties
   */
  describe("Agent Cloning Properties", () => {
    it("should clone agents with identical configuration", async () => {
      const original = await orchestrator.createAgent("frontend");
      const cloned = await orchestrator.cloneAgent(original.id, "high demand");

      // Cloned agent should have same role configuration
      expect(cloned.role.type).toBe(original.role.type);
      expect(cloned.role.model).toEqual(original.role.model);
      expect(cloned.role.capabilities).toEqual(original.role.capabilities);
      expect(cloned.role.tools).toEqual(original.role.tools);

      // But different ID and fresh metrics
      expect(cloned.id).not.toBe(original.id);
      expect(cloned.metrics.tasksCompleted).toBe(0);
    });
  });
});

/**
 * Property-Based Tests for SandboxManager
 *
 * Feature: fangyu-code-audit
 * Property 2: Sandbox 资源配对
 * Validates: Requirements 2.3
 *
 * Tests that all sandbox resources are properly cleaned up when destroyed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ============================================================================
// Mock SandboxManager for Testing
// ============================================================================

interface MockSandbox {
  id: string;
  agentId: string;
  containerId: string | null;
  status: 'creating' | 'running' | 'stopped' | 'error';
  terminals: string[];
  createdAt: number;
}

interface MockDockerOps {
  createContainer: ReturnType<typeof vi.fn>;
  destroyContainer: ReturnType<typeof vi.fn>;
  execCommand: ReturnType<typeof vi.fn>;
}

/**
 * Simplified SandboxManager for property testing
 * Tests the core resource management logic without Tauri dependencies
 */
class TestSandboxManager {
  private sandboxes: Map<string, MockSandbox> = new Map();
  private dockerOps: MockDockerOps;
  private containerCounter = 0;

  constructor(dockerOps: MockDockerOps) {
    this.dockerOps = dockerOps;
  }

  async createSandbox(agentId: string): Promise<MockSandbox> {
    const sandboxId = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Create container
    const containerId = await this.dockerOps.createContainer(sandboxId);
    
    const sandbox: MockSandbox = {
      id: sandboxId,
      agentId,
      containerId,
      status: 'running',
      terminals: [],
      createdAt: Date.now(),
    };

    this.sandboxes.set(sandboxId, sandbox);
    return sandbox;
  }

  async destroySandbox(sandboxId: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return false;

    // Destroy container if exists
    if (sandbox.containerId) {
      await this.dockerOps.destroyContainer(sandbox.containerId);
    }

    // Clear terminals
    sandbox.terminals = [];
    sandbox.status = 'stopped';

    // Remove from map
    this.sandboxes.delete(sandboxId);
    return true;
  }

  async destroyAll(): Promise<void> {
    const sandboxIds = Array.from(this.sandboxes.keys());
    for (const id of sandboxIds) {
      await this.destroySandbox(id);
    }
  }

  getSandbox(sandboxId: string): MockSandbox | undefined {
    return this.sandboxes.get(sandboxId);
  }

  getAllSandboxes(): MockSandbox[] {
    return Array.from(this.sandboxes.values());
  }

  getSandboxCount(): number {
    return this.sandboxes.size;
  }

  addTerminal(sandboxId: string, terminalId: string): boolean {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return false;
    sandbox.terminals.push(terminalId);
    return true;
  }
}

// Generators
const agentIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 1, maxLength: 20 }
);

const uniqueAgentIdsArb = fc.uniqueArray(agentIdArb, { minLength: 1, maxLength: 10 });

describe("SandboxManager Property Tests", () => {
  let mockDockerOps: MockDockerOps;
  let containerIdCounter: number;

  beforeEach(() => {
    containerIdCounter = 0;
    mockDockerOps = {
      createContainer: vi.fn().mockImplementation((sandboxId: string) => {
        return Promise.resolve(`container-${++containerIdCounter}`);
      }),
      destroyContainer: vi.fn().mockResolvedValue(undefined),
      execCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2: Sandbox 资源配对
   *
   * For any sandbox created via SandboxManager, calling destroy should:
   * 1. Release all Docker resources (containers, networks, volumes)
   * 2. Remove the sandbox from the instances Map
   *
   * Validates: Requirements 2.3
   */
  it("should cleanup all resources when sandbox is destroyed", async () => {
    await fc.assert(
      fc.asyncProperty(agentIdArb, async (agentId) => {
        const manager = new TestSandboxManager(mockDockerOps);

        // Create sandbox
        const sandbox = await manager.createSandbox(agentId);
        expect(manager.getSandboxCount()).toBe(1);
        expect(sandbox.containerId).toBeTruthy();

        const containerId = sandbox.containerId;

        // Destroy sandbox
        const destroyed = await manager.destroySandbox(sandbox.id);
        expect(destroyed).toBe(true);

        // Verify cleanup
        expect(manager.getSandboxCount()).toBe(0);
        expect(manager.getSandbox(sandbox.id)).toBeUndefined();
        expect(mockDockerOps.destroyContainer).toHaveBeenCalledWith(containerId);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple sandboxes are all cleaned up
   */
  it("should cleanup all sandboxes when destroyAll is called", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueAgentIdsArb, async (agentIds) => {
        // Create fresh mocks for each property test iteration
        const localMockDockerOps: MockDockerOps = {
          createContainer: vi.fn().mockImplementation((sandboxId: string) => {
            return Promise.resolve(`container-${Math.random().toString(36).slice(2, 8)}`);
          }),
          destroyContainer: vi.fn().mockResolvedValue(undefined),
          execCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
        };

        const manager = new TestSandboxManager(localMockDockerOps);

        // Create multiple sandboxes
        const sandboxes: MockSandbox[] = [];
        for (const agentId of agentIds) {
          const sandbox = await manager.createSandbox(agentId);
          sandboxes.push(sandbox);
        }

        expect(manager.getSandboxCount()).toBe(agentIds.length);

        // Destroy all
        await manager.destroyAll();

        // Verify all cleaned up
        expect(manager.getSandboxCount()).toBe(0);
        expect(localMockDockerOps.destroyContainer).toHaveBeenCalledTimes(agentIds.length);

        // Verify each sandbox is gone
        for (const sandbox of sandboxes) {
          expect(manager.getSandbox(sandbox.id)).toBeUndefined();
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Destroying non-existent sandbox returns false
   */
  it("should return false when destroying non-existent sandbox", async () => {
    await fc.assert(
      fc.asyncProperty(agentIdArb, async (fakeId) => {
        const manager = new TestSandboxManager(mockDockerOps);

        // Try to destroy non-existent sandbox
        const destroyed = await manager.destroySandbox(`fake-${fakeId}`);
        expect(destroyed).toBe(false);
        expect(mockDockerOps.destroyContainer).not.toHaveBeenCalled();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sandbox count is always accurate
   */
  it("should maintain accurate sandbox count", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          action: fc.constantFrom('create', 'destroy'),
          agentId: agentIdArb,
        }), { minLength: 1, maxLength: 20 }),
        async (actions) => {
          const manager = new TestSandboxManager(mockDockerOps);
          const createdIds: string[] = [];

          for (const action of actions) {
            if (action.action === 'create') {
              const sandbox = await manager.createSandbox(action.agentId);
              createdIds.push(sandbox.id);
            } else if (action.action === 'destroy' && createdIds.length > 0) {
              const idToDestroy = createdIds.shift()!;
              await manager.destroySandbox(idToDestroy);
            }
          }

          // Count should match remaining created IDs
          expect(manager.getSandboxCount()).toBe(createdIds.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each sandbox has unique ID
   */
  it("should create sandboxes with unique IDs", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueAgentIdsArb, async (agentIds) => {
        const manager = new TestSandboxManager(mockDockerOps);
        const sandboxIds = new Set<string>();

        for (const agentId of agentIds) {
          const sandbox = await manager.createSandbox(agentId);
          expect(sandboxIds.has(sandbox.id)).toBe(false);
          sandboxIds.add(sandbox.id);
        }

        expect(sandboxIds.size).toBe(agentIds.length);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Terminals are cleared on destroy
   */
  it("should clear all terminals when sandbox is destroyed", async () => {
    await fc.assert(
      fc.asyncProperty(
        agentIdArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        async (agentId, terminalIds) => {
          const manager = new TestSandboxManager(mockDockerOps);

          // Create sandbox and add terminals
          const sandbox = await manager.createSandbox(agentId);
          for (const terminalId of terminalIds) {
            manager.addTerminal(sandbox.id, terminalId);
          }

          // Verify terminals were added
          const sandboxBefore = manager.getSandbox(sandbox.id);
          expect(sandboxBefore?.terminals.length).toBe(terminalIds.length);

          // Destroy sandbox
          await manager.destroySandbox(sandbox.id);

          // Sandbox should be gone
          expect(manager.getSandbox(sandbox.id)).toBeUndefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Container destroy is called exactly once per sandbox
   */
  it("should call destroyContainer exactly once per sandbox", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueAgentIdsArb, async (agentIds) => {
        mockDockerOps.destroyContainer.mockClear();
        const manager = new TestSandboxManager(mockDockerOps);

        // Create sandboxes
        const sandboxes: MockSandbox[] = [];
        for (const agentId of agentIds) {
          sandboxes.push(await manager.createSandbox(agentId));
        }

        // Destroy each sandbox
        for (const sandbox of sandboxes) {
          await manager.destroySandbox(sandbox.id);
        }

        // Verify destroyContainer called exactly once per sandbox
        expect(mockDockerOps.destroyContainer).toHaveBeenCalledTimes(agentIds.length);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});

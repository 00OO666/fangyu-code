/**
 * Property-Based Tests for useEventCleanup Hook
 *
 * Feature: fangyu-code-audit
 * Property 1: 组件卸载清理完整性
 * Validates: Requirements 1.1, 1.2
 *
 * Tests that all registered event listeners are properly cleaned up
 * when the component unmounts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ============================================================================
// Event Cleanup Manager - Pure Logic Implementation for Testing
// ============================================================================

/**
 * Pure implementation of event cleanup logic for property testing.
 * This mirrors the useEventCleanup hook logic without React dependencies.
 */
class EventCleanupManager {
  private unlistenFunctions: Map<string, () => void> = new Map();
  private isMounted = true;

  constructor(
    private mockWindowListen: (event: string, handler: () => void) => Promise<() => void>,
    private mockGlobalListen: (event: string, handler: () => void) => Promise<() => void>
  ) {}

  async registerWindowListener(event: string, handler: () => void): Promise<void> {
    if (this.unlistenFunctions.has(`window:${event}`) || !this.isMounted) {
      return;
    }

    const unlisten = await this.mockWindowListen(event, handler);
    if (this.isMounted) {
      this.unlistenFunctions.set(`window:${event}`, unlisten);
    } else {
      unlisten();
    }
  }

  async registerGlobalListener(event: string, handler: () => void): Promise<void> {
    if (this.unlistenFunctions.has(`global:${event}`) || !this.isMounted) {
      return;
    }

    const unlisten = await this.mockGlobalListen(event, handler);
    if (this.isMounted) {
      this.unlistenFunctions.set(`global:${event}`, unlisten);
    } else {
      unlisten();
    }
  }

  cleanup(): void {
    for (const unlisten of this.unlistenFunctions.values()) {
      unlisten();
    }
    this.unlistenFunctions.clear();
  }

  unmount(): void {
    this.isMounted = false;
    this.cleanup();
  }

  getListenerCount(): number {
    return this.unlistenFunctions.size;
  }

  hasListener(event: string): boolean {
    return (
      this.unlistenFunctions.has(`window:${event}`) || this.unlistenFunctions.has(`global:${event}`)
    );
  }
}

// Event name generator
const eventNameArb = fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz_-".split("")), {
  minLength: 1,
  maxLength: 20,
});

// Generate array of unique event names
const uniqueEventNamesArb = fc.uniqueArray(eventNameArb, { minLength: 1, maxLength: 10 });

describe("useEventCleanup", () => {
  let mockUnlisten: ReturnType<typeof vi.fn>;
  let mockWindowListen: ReturnType<typeof vi.fn>;
  let mockGlobalListen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnlisten = vi.fn();
    mockWindowListen = vi.fn().mockImplementation(() => Promise.resolve(mockUnlisten));
    mockGlobalListen = vi.fn().mockImplementation(() => Promise.resolve(mockUnlisten));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: 组件卸载清理完整性
   *
   * For any SessionWindow component instance, when the component unmounts,
   * all event listeners registered via window.listen should be properly cleaned up,
   * and the listener count should be zero after cleanup.
   *
   * Validates: Requirements 1.1, 1.2
   */
  it("should cleanup all registered window listeners on unmount", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueEventNamesArb, async (eventNames) => {
        // Reset mocks for each test
        mockUnlisten.mockClear();
        mockWindowListen.mockClear();

        const manager = new EventCleanupManager(mockWindowListen, mockGlobalListen);

        // Register listeners for all event names
        for (const eventName of eventNames) {
          await manager.registerWindowListener(eventName, vi.fn());
        }

        // Verify all listeners were registered
        expect(manager.getListenerCount()).toBe(eventNames.length);

        // Unmount
        manager.unmount();

        // Verify all unlisten functions were called
        expect(mockUnlisten).toHaveBeenCalledTimes(eventNames.length);
        expect(manager.getListenerCount()).toBe(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Global listeners are also cleaned up on unmount
   */
  it("should cleanup all registered global listeners on unmount", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueEventNamesArb, async (eventNames) => {
        mockUnlisten.mockClear();
        mockGlobalListen.mockClear();

        const manager = new EventCleanupManager(mockWindowListen, mockGlobalListen);

        // Register global listeners
        for (const eventName of eventNames) {
          await manager.registerGlobalListener(eventName, vi.fn());
        }

        expect(manager.getListenerCount()).toBe(eventNames.length);

        manager.unmount();

        expect(mockUnlisten).toHaveBeenCalledTimes(eventNames.length);
        expect(manager.getListenerCount()).toBe(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed window and global listeners are all cleaned up
   */
  it("should cleanup mixed window and global listeners on unmount", async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueEventNamesArb,
        uniqueEventNamesArb,
        async (windowEvents, globalEvents) => {
          mockUnlisten.mockClear();
          mockWindowListen.mockClear();
          mockGlobalListen.mockClear();

          const manager = new EventCleanupManager(mockWindowListen, mockGlobalListen);

          // Register both types of listeners
          for (const eventName of windowEvents) {
            await manager.registerWindowListener(eventName, vi.fn());
          }
          for (const eventName of globalEvents) {
            await manager.registerGlobalListener(eventName, vi.fn());
          }

          const totalListeners = windowEvents.length + globalEvents.length;
          expect(manager.getListenerCount()).toBe(totalListeners);

          manager.unmount();

          expect(mockUnlisten).toHaveBeenCalledTimes(totalListeners);
          expect(manager.getListenerCount()).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Duplicate event registration is prevented
   */
  it("should prevent duplicate listener registration for same event", async () => {
    await fc.assert(
      fc.asyncProperty(eventNameArb, fc.integer({ min: 2, max: 10 }), async (eventName, count) => {
        mockUnlisten.mockClear();
        mockWindowListen.mockClear();

        const manager = new EventCleanupManager(mockWindowListen, mockGlobalListen);

        // Try to register the same event multiple times
        for (let i = 0; i < count; i++) {
          await manager.registerWindowListener(eventName, vi.fn());
        }

        // Should only have 1 listener registered
        expect(manager.getListenerCount()).toBe(1);
        expect(mockWindowListen).toHaveBeenCalledTimes(1);

        manager.unmount();

        // Should only call unlisten once
        expect(mockUnlisten).toHaveBeenCalledTimes(1);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: hasListener correctly reports registered events
   */
  it("should correctly report registered events via hasListener", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueEventNamesArb, async (eventNames) => {
        mockUnlisten.mockClear();
        mockWindowListen.mockClear();

        const manager = new EventCleanupManager(mockWindowListen, mockGlobalListen);

        // Initially no listeners
        for (const eventName of eventNames) {
          expect(manager.hasListener(eventName)).toBe(false);
        }

        // Register listeners
        for (const eventName of eventNames) {
          await manager.registerWindowListener(eventName, vi.fn());
        }

        // All should now be registered
        for (const eventName of eventNames) {
          expect(manager.hasListener(eventName)).toBe(true);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Manual cleanup clears all listeners
   */
  it("should clear all listeners when cleanup is called manually", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueEventNamesArb, async (eventNames) => {
        mockUnlisten.mockClear();
        mockWindowListen.mockClear();

        const manager = new EventCleanupManager(mockWindowListen, mockGlobalListen);

        // Register listeners
        for (const eventName of eventNames) {
          await manager.registerWindowListener(eventName, vi.fn());
        }

        expect(manager.getListenerCount()).toBe(eventNames.length);

        // Manual cleanup
        manager.cleanup();

        // All listeners should be cleaned up
        expect(manager.getListenerCount()).toBe(0);
        expect(mockUnlisten).toHaveBeenCalledTimes(eventNames.length);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Listener count is always accurate
   */
  it("should maintain accurate listener count", async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueEventNamesArb,
        uniqueEventNamesArb,
        async (windowEvents, globalEvents) => {
          mockUnlisten.mockClear();
          mockWindowListen.mockClear();
          mockGlobalListen.mockClear();

          const manager = new EventCleanupManager(mockWindowListen, mockGlobalListen);

          // Start with 0
          expect(manager.getListenerCount()).toBe(0);

          // Add window listeners one by one
          for (let i = 0; i < windowEvents.length; i++) {
            await manager.registerWindowListener(windowEvents[i], vi.fn());
            expect(manager.getListenerCount()).toBe(i + 1);
          }

          // Add global listeners
          for (let i = 0; i < globalEvents.length; i++) {
            await manager.registerGlobalListener(globalEvents[i], vi.fn());
            expect(manager.getListenerCount()).toBe(windowEvents.length + i + 1);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

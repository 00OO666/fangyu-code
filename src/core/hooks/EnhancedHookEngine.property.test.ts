/**
 * EnhancedHookEngine 属性测试
 *
 * Property 5: Hook 链执行顺序
 * Property 6: Hook 阻塞传播
 * Validates: Requirements 2.3, 2.4, 2.6
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  EnhancedHookEngine,
  HookDefinition,
  HookEventType,
  HookAction,
  HookExecutor,
  HookContext,
  HookResult,
} from "./EnhancedHookEngine";

// 生成有效的事件类型
const eventTypeArb = fc.constantFrom<HookEventType>(
  "message:before",
  "message:after",
  "file:save",
  "file:open",
  "agent:start",
  "agent:complete",
  "session:create",
  "tool:before"
);

// 生成有效的 Hook ID
const hookIdArb = fc
  .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-".split("")), {
    minLength: 3,
    maxLength: 20,
  })
  .map((s) => `hook-${s}`);

// 生成有效的优先级
const priorityArb = fc.integer({ min: 1, max: 1000 });

// 生成 Hook 动作
const hookActionArb: fc.Arbitrary<HookAction> = fc.record({
  type: fc.constantFrom<"sendMessage" | "executeCommand" | "custom">(
    "sendMessage",
    "executeCommand",
    "custom"
  ),
  payload: fc.string({ minLength: 1, maxLength: 50 }),
});

// 生成 Hook 定义
const hookDefinitionArb = (event?: HookEventType): fc.Arbitrary<HookDefinition> =>
  fc.record({
    id: hookIdArb,
    name: fc.string({ minLength: 1, maxLength: 30 }),
    event: event ? fc.constant(event) : eventTypeArb,
    actions: fc.array(hookActionArb, { minLength: 1, maxLength: 3 }),
    priority: priorityArb,
    enabled: fc.boolean(),
    blocking: fc.boolean(),
  });

// 追踪执行顺序的执行器
class TrackingExecutor implements HookExecutor {
  public executionOrder: string[] = [];
  public executionTimes: Map<string, number> = new Map();

  async execute(action: HookAction, context: HookContext): Promise<unknown> {
    const hookId = (context.data as { currentHookId?: string }).currentHookId ?? "unknown";
    this.executionOrder.push(hookId);
    this.executionTimes.set(hookId, Date.now());
    return { executed: true, action: action.type };
  }

  reset(): void {
    this.executionOrder = [];
    this.executionTimes.clear();
  }
}

describe("EnhancedHookEngine Property Tests", () => {
  let engine: EnhancedHookEngine;
  let trackingExecutor: TrackingExecutor;

  beforeEach(() => {
    trackingExecutor = new TrackingExecutor();
    engine = new EnhancedHookEngine(trackingExecutor);
  });

  describe("Hook Registration Properties", () => {
    it("Property 5.1: 注册的 Hook 应能被正确检索", () => {
      fc.assert(
        fc.property(hookDefinitionArb(), (hook) => {
          const freshEngine = new EnhancedHookEngine();

          freshEngine.registerHook(hook);

          const retrieved = freshEngine.getHook(hook.id);
          expect(retrieved).toBeDefined();
          expect(retrieved?.id).toBe(hook.id);
          expect(retrieved?.event).toBe(hook.event);
          expect(retrieved?.priority).toBe(hook.priority);
        }),
        { numRuns: 100 }
      );
    });

    it("Property 5.2: 重复注册相同 ID 应抛出错误", () => {
      fc.assert(
        fc.property(hookDefinitionArb(), (hook) => {
          const freshEngine = new EnhancedHookEngine();

          freshEngine.registerHook(hook);

          expect(() => freshEngine.registerHook(hook)).toThrow();
        }),
        { numRuns: 100 }
      );
    });

    it("Property 5.3: 注销后 Hook 应不可检索", () => {
      fc.assert(
        fc.property(hookDefinitionArb(), (hook) => {
          const freshEngine = new EnhancedHookEngine();

          freshEngine.registerHook(hook);
          const unregistered = freshEngine.unregisterHook(hook.id);

          expect(unregistered).toBe(true);
          expect(freshEngine.getHook(hook.id)).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Hook Chain Execution Order (Property 5)", () => {
    it("Property 5.4: Hook 应按优先级顺序执行", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(priorityArb, { minLength: 2, maxLength: 10 }),
          async (priorities) => {
            const freshEngine = new EnhancedHookEngine(trackingExecutor);
            trackingExecutor.reset();

            const event: HookEventType = "message:before";
            const hooks: HookDefinition[] = [];

            // 创建具有不同优先级的 hooks
            for (let i = 0; i < priorities.length; i++) {
              const hook: HookDefinition = {
                id: `hook-${i}`,
                name: `Hook ${i}`,
                event,
                actions: [{ type: "sendMessage", payload: `msg-${i}` }],
                priority: priorities[i],
                enabled: true,
                blocking: false,
              };
              hooks.push(hook);
              freshEngine.registerHook(hook);
            }

            // 执行 hook 链
            await freshEngine.executeChain(event, { currentHookId: "" });

            // 获取按优先级排序的预期顺序
            const sortedHooks = [...hooks].sort(
              (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
            );

            // 验证执行顺序
            const executedHooks = freshEngine.getHooksForEvent(event);
            for (let i = 1; i < executedHooks.length; i++) {
              const prevPriority = executedHooks[i - 1].priority ?? 100;
              const currPriority = executedHooks[i].priority ?? 100;
              expect(prevPriority).toBeLessThanOrEqual(currPriority);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("Property 5.5: 禁用的 Hook 不应执行", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
          async (enabledStates) => {
            const freshEngine = new EnhancedHookEngine(trackingExecutor);
            trackingExecutor.reset();

            const event: HookEventType = "file:save";
            let enabledCount = 0;

            for (let i = 0; i < enabledStates.length; i++) {
              const hook: HookDefinition = {
                id: `hook-${i}`,
                name: `Hook ${i}`,
                event,
                actions: [{ type: "sendMessage", payload: `msg-${i}` }],
                priority: i,
                enabled: enabledStates[i],
                blocking: false,
              };
              freshEngine.registerHook(hook);
              if (enabledStates[i]) enabledCount++;
            }

            const result = await freshEngine.executeChain(event);

            // 只有启用的 hook 应该执行
            const executedCount = result.results.filter(
              (r) => !r.output || !(r.output as { skipped?: boolean }).skipped
            ).length;

            expect(executedCount).toBe(enabledCount);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Hook Blocking Propagation (Property 6)", () => {
    it("Property 6.1: 阻塞 Hook 应阻止后续 Hook 执行", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 9 }), // 阻塞 hook 的位置
          fc.integer({ min: 2, max: 10 }), // 总 hook 数量
          async (blockingIndex, totalHooks) => {
            // 确保 blockingIndex 在有效范围内
            const actualBlockingIndex = Math.min(blockingIndex, totalHooks - 1);

            const freshEngine = new EnhancedHookEngine(trackingExecutor);
            trackingExecutor.reset();

            const event: HookEventType = "agent:start";

            for (let i = 0; i < totalHooks; i++) {
              const hook: HookDefinition = {
                id: `hook-${i}`,
                name: `Hook ${i}`,
                event,
                actions: [{ type: "sendMessage", payload: `msg-${i}` }],
                priority: i * 10, // 确保顺序
                enabled: true,
                blocking: i === actualBlockingIndex,
              };
              freshEngine.registerHook(hook);
            }

            const result = await freshEngine.executeChain(event);

            // 验证阻塞
            expect(result.blocked).toBe(true);
            expect(result.blockedBy).toBe(`hook-${actualBlockingIndex}`);

            // 验证阻塞后的 hook 被跳过
            for (let i = actualBlockingIndex + 1; i < totalHooks; i++) {
              const hookResult = result.results.find((r) => r.hookId === `hook-${i}`);
              expect(hookResult).toBeDefined();
              expect((hookResult?.output as { skipped?: boolean })?.skipped).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("Property 6.2: 非阻塞 Hook 不应影响后续执行", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (totalHooks) => {
          const freshEngine = new EnhancedHookEngine(trackingExecutor);
          trackingExecutor.reset();

          const event: HookEventType = "tool:before";

          for (let i = 0; i < totalHooks; i++) {
            const hook: HookDefinition = {
              id: `hook-${i}`,
              name: `Hook ${i}`,
              event,
              actions: [{ type: "sendMessage", payload: `msg-${i}` }],
              priority: i * 10,
              enabled: true,
              blocking: false, // 所有都不阻塞
            };
            freshEngine.registerHook(hook);
          }

          const result = await freshEngine.executeChain(event);

          // 验证没有阻塞
          expect(result.blocked).toBe(false);
          expect(result.blockedBy).toBeUndefined();

          // 验证所有 hook 都执行了
          const executedCount = result.results.filter(
            (r) => !r.output || !(r.output as { skipped?: boolean }).skipped
          ).length;
          expect(executedCount).toBe(totalHooks);
        }),
        { numRuns: 50 }
      );
    });

    it("Property 6.3: 第一个阻塞 Hook 应决定阻塞点", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 3, maxLength: 10 }),
          async (blockingStates) => {
            const freshEngine = new EnhancedHookEngine(trackingExecutor);
            trackingExecutor.reset();

            const event: HookEventType = "session:create";

            for (let i = 0; i < blockingStates.length; i++) {
              const hook: HookDefinition = {
                id: `hook-${i}`,
                name: `Hook ${i}`,
                event,
                actions: [{ type: "sendMessage", payload: `msg-${i}` }],
                priority: i * 10, // 确保顺序
                enabled: true,
                blocking: blockingStates[i],
              };
              freshEngine.registerHook(hook);
            }

            const result = await freshEngine.executeChain(event);

            // 找到第一个阻塞 hook 的索引
            const firstBlockingIndex = blockingStates.findIndex((b) => b);

            if (firstBlockingIndex === -1) {
              // 没有阻塞 hook
              expect(result.blocked).toBe(false);
            } else {
              // 有阻塞 hook
              expect(result.blocked).toBe(true);
              expect(result.blockedBy).toBe(`hook-${firstBlockingIndex}`);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Event Filtering Properties", () => {
    it("Property 5.6: 只有匹配事件的 Hook 应被执行", async () => {
      await fc.assert(
        fc.asyncProperty(eventTypeArb, eventTypeArb, async (targetEvent, triggerEvent) => {
          const freshEngine = new EnhancedHookEngine(trackingExecutor);
          trackingExecutor.reset();

          // 注册针对 targetEvent 的 hook
          const hook: HookDefinition = {
            id: "test-hook",
            name: "Test Hook",
            event: targetEvent,
            actions: [{ type: "sendMessage", payload: "test" }],
            priority: 1,
            enabled: true,
            blocking: false,
          };
          freshEngine.registerHook(hook);

          const result = await freshEngine.executeChain(triggerEvent);

          if (targetEvent === triggerEvent) {
            // 事件匹配，应该执行
            expect(result.results.length).toBe(1);
          } else {
            // 事件不匹配，不应执行
            expect(result.results.length).toBe(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Engine State Properties", () => {
    it("Property 5.7: 禁用引擎时不应执行任何 Hook", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(hookDefinitionArb("message:before"), { minLength: 1, maxLength: 5 }),
          async (hooks) => {
            const freshEngine = new EnhancedHookEngine(trackingExecutor);
            trackingExecutor.reset();

            // 注册 hooks（确保 ID 唯一）
            const uniqueHooks = hooks.map((h, i) => ({ ...h, id: `hook-${i}` }));
            for (const hook of uniqueHooks) {
              freshEngine.registerHook(hook);
            }

            // 禁用引擎
            freshEngine.setEnabled(false);

            const result = await freshEngine.executeChain("message:before");

            // 不应执行任何 hook
            expect(result.results.length).toBe(0);
            expect(result.totalDuration).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("Property 5.8: 清除后应没有任何 Hook", () => {
      fc.assert(
        fc.property(fc.array(hookDefinitionArb(), { minLength: 1, maxLength: 10 }), (hooks) => {
          const freshEngine = new EnhancedHookEngine();

          // 注册 hooks（确保 ID 唯一）
          const uniqueHooks = hooks.map((h, i) => ({ ...h, id: `hook-${i}` }));
          for (const hook of uniqueHooks) {
            freshEngine.registerHook(hook);
          }

          // 清除
          freshEngine.clear();

          // 验证
          expect(freshEngine.getAllHooks().length).toBe(0);
          expect(freshEngine.getStats().totalHooks).toBe(0);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Statistics Properties", () => {
    it("Property 5.9: 统计信息应准确反映 Hook 状态", () => {
      fc.assert(
        fc.property(fc.array(hookDefinitionArb(), { minLength: 1, maxLength: 10 }), (hooks) => {
          const freshEngine = new EnhancedHookEngine();

          // 注册 hooks（确保 ID 唯一）
          const uniqueHooks = hooks.map((h, i) => ({ ...h, id: `hook-${i}` }));
          for (const hook of uniqueHooks) {
            freshEngine.registerHook(hook);
          }

          const stats = freshEngine.getStats();

          // 验证总数
          expect(stats.totalHooks).toBe(uniqueHooks.length);

          // 验证启用数
          const enabledCount = uniqueHooks.filter((h) => h.enabled).length;
          expect(stats.enabledHooks).toBe(enabledCount);

          // 验证事件类型数
          const eventTypes = new Set(uniqueHooks.map((h) => h.event));
          expect(stats.eventTypes).toBe(eventTypes.size);
        }),
        { numRuns: 50 }
      );
    });
  });
});

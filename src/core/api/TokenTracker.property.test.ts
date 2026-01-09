/**
 * TokenTracker 属性测试
 * 
 * Property 5: Token 统计准确性
 * 
 * Validates: Requirements 1.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  TokenTracker,
  TokenUsage,
  MODEL_PRICING,
  createTokenTracker,
  formatTokenCount,
  formatCost,
  estimateTokens,
} from './TokenTracker';

// =============================================================================
// 测试生成器
// =============================================================================

/** 生成模型名称 */
const modelArb = fc.constantFrom(
  'claude-3-5-sonnet-20241022',
  'claude-3-opus-20240229',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4o-mini',
  'gemini-2.5-pro-preview-05-06',
  'gemini-1.5-pro'
);

/** 生成 Token 使用记录（不含 timestamp） */
const tokenUsageArb: fc.Arbitrary<Omit<TokenUsage, 'timestamp'>> = fc.record({
  promptTokens: fc.integer({ min: 1, max: 100000 }),
  completionTokens: fc.integer({ min: 1, max: 50000 }),
  totalTokens: fc.integer({ min: 2, max: 150000 }),
  model: modelArb,
  requestId: fc.option(fc.uuid(), { nil: undefined }),
});

/** 生成多个 Token 使用记录 */
const tokenUsagesArb = fc.array(tokenUsageArb, { minLength: 1, maxLength: 50 });

/** 生成正整数 Token 数量 */
const tokenCountArb = fc.integer({ min: 0, max: 10_000_000 });

/** 生成成本金额 */
const costArb = fc.float({ min: 0, max: 1000, noNaN: true });

/** 生成文本 */
const textArb = fc.string({ minLength: 0, maxLength: 5000 });

// =============================================================================
// Property 5: Token 统计准确性
// Validates: Requirements 1.7
// =============================================================================

describe('TokenTracker Property Tests', () => {
  describe('Property 5: Token 统计准确性', () => {
    let tracker: TokenTracker;

    beforeEach(() => {
      tracker = new TokenTracker();
    });

    it('累计 Token 数应等于所有记录的总和', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          tracker.reset();
          
          let expectedPrompt = 0;
          let expectedCompletion = 0;
          
          for (const usage of usages) {
            tracker.recordUsage(usage);
            expectedPrompt += usage.promptTokens;
            expectedCompletion += usage.completionTokens;
          }
          
          const stats = tracker.getStats();
          
          expect(stats.totalPromptTokens).toBe(expectedPrompt);
          expect(stats.totalCompletionTokens).toBe(expectedCompletion);
          expect(stats.totalTokens).toBe(expectedPrompt + expectedCompletion);
          expect(stats.totalRequests).toBe(usages.length);
        }),
        { numRuns: 100 }
      );
    });

    it('平均 Token 数应等于总数除以请求数', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          tracker.reset();
          
          for (const usage of usages) {
            tracker.recordUsage(usage);
          }
          
          const stats = tracker.getStats();
          const expectedAverage = stats.totalTokens / stats.totalRequests;
          
          expect(stats.averageTokensPerRequest).toBeCloseTo(expectedAverage, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('成本计算应基于正确的定价', () => {
      fc.assert(
        fc.property(tokenUsageArb, (usage) => {
          const cost = tracker.calculateCost({ ...usage, timestamp: Date.now() });
          const pricing = tracker.getPricing(usage.model);
          
          const expectedCost = 
            (usage.promptTokens / 1_000_000) * pricing.inputPrice +
            (usage.completionTokens / 1_000_000) * pricing.outputPrice;
          
          expect(cost).toBeCloseTo(expectedCost, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('历史记录应保持插入顺序', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          tracker.reset();
          
          for (const usage of usages) {
            tracker.recordUsage(usage);
          }
          
          const history = tracker.getHistory();
          
          // 时间戳应该递增
          for (let i = 1; i < history.length; i++) {
            expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i - 1].timestamp);
          }
          
          // 模型应该匹配
          for (let i = 0; i < usages.length; i++) {
            expect(history[i].model).toBe(usages[i].model);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('getRecentUsage 应返回最近的 N 条记录', () => {
      fc.assert(
        fc.property(
          tokenUsagesArb,
          fc.integer({ min: 1, max: 20 }),
          (usages, count) => {
            tracker.reset();
            
            for (const usage of usages) {
              tracker.recordUsage(usage);
            }
            
            const recent = tracker.getRecentUsage(count);
            const expectedCount = Math.min(count, usages.length);
            
            expect(recent.length).toBe(expectedCount);
            
            // 应该是最后 N 条
            const history = tracker.getHistory();
            const expected = history.slice(-count);
            expect(recent).toEqual(expected);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 会话统计属性测试
  // ===========================================================================

  describe('会话统计属性测试', () => {
    let tracker: TokenTracker;

    beforeEach(() => {
      tracker = new TokenTracker();
    });

    it('模型分解的总和应等于总统计', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          tracker.reset();
          
          for (const usage of usages) {
            tracker.recordUsage(usage);
          }
          
          const sessionStats = tracker.getSessionStats();
          
          // 计算模型分解的总和
          let breakdownPrompt = 0;
          let breakdownCompletion = 0;
          let breakdownRequests = 0;
          
          for (const modelStats of Object.values(sessionStats.modelBreakdown)) {
            breakdownPrompt += modelStats.totalPromptTokens;
            breakdownCompletion += modelStats.totalCompletionTokens;
            breakdownRequests += modelStats.totalRequests;
          }
          
          expect(breakdownPrompt).toBe(sessionStats.totalPromptTokens);
          expect(breakdownCompletion).toBe(sessionStats.totalCompletionTokens);
          expect(breakdownRequests).toBe(sessionStats.totalRequests);
        }),
        { numRuns: 50 }
      );
    });

    it('每个模型的统计应该正确', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          tracker.reset();
          
          // 手动计算每个模型的预期统计
          const expected = new Map<string, { prompt: number; completion: number; count: number }>();
          
          for (const usage of usages) {
            const current = expected.get(usage.model) ?? { prompt: 0, completion: 0, count: 0 };
            current.prompt += usage.promptTokens;
            current.completion += usage.completionTokens;
            current.count += 1;
            expected.set(usage.model, current);
            
            tracker.recordUsage(usage);
          }
          
          const sessionStats = tracker.getSessionStats();
          
          for (const [model, exp] of expected) {
            const modelStats = sessionStats.modelBreakdown[model];
            expect(modelStats).toBeDefined();
            expect(modelStats.totalPromptTokens).toBe(exp.prompt);
            expect(modelStats.totalCompletionTokens).toBe(exp.completion);
            expect(modelStats.totalRequests).toBe(exp.count);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 导入导出属性测试
  // ===========================================================================

  describe('导入导出属性测试', () => {
    it('导出后导入应保持数据一致', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          const tracker1 = new TokenTracker();
          
          for (const usage of usages) {
            tracker1.recordUsage(usage);
          }
          
          const exported = tracker1.export();
          
          const tracker2 = new TokenTracker();
          tracker2.import(exported);
          
          // 统计应该相同
          const stats1 = tracker1.getStats();
          const stats2 = tracker2.getStats();
          
          expect(stats2.totalPromptTokens).toBe(stats1.totalPromptTokens);
          expect(stats2.totalCompletionTokens).toBe(stats1.totalCompletionTokens);
          expect(stats2.totalRequests).toBe(stats1.totalRequests);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 重置属性测试
  // ===========================================================================

  describe('重置属性测试', () => {
    it('reset 应清除所有数据', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          const tracker = new TokenTracker();
          
          for (const usage of usages) {
            tracker.recordUsage(usage);
          }
          
          tracker.reset();
          
          const stats = tracker.getStats();
          expect(stats.totalPromptTokens).toBe(0);
          expect(stats.totalCompletionTokens).toBe(0);
          expect(stats.totalRequests).toBe(0);
          expect(tracker.getHistory()).toEqual([]);
        }),
        { numRuns: 50 }
      );
    });

    it('reset 应生成新的会话 ID', () => {
      fc.assert(
        fc.property(tokenUsagesArb, (usages) => {
          const tracker = new TokenTracker();
          const oldSessionId = tracker.getSessionId();
          
          for (const usage of usages) {
            tracker.recordUsage(usage);
          }
          
          tracker.reset();
          const newSessionId = tracker.getSessionId();
          
          expect(newSessionId).not.toBe(oldSessionId);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 工具函数属性测试
  // ===========================================================================

  describe('工具函数属性测试', () => {
    it('formatTokenCount 应返回可读的字符串', () => {
      fc.assert(
        fc.property(tokenCountArb, (tokens) => {
          const formatted = formatTokenCount(tokens);
          
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);
          
          // 大数应该有 K 或 M 后缀
          if (tokens >= 1_000_000) {
            expect(formatted).toContain('M');
          } else if (tokens >= 1_000) {
            expect(formatted).toContain('K');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('formatCost 应返回带 $ 前缀的字符串', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1000, noNaN: true }), (cost) => {
          const formatted = formatCost(cost);
          
          expect(typeof formatted).toBe('string');
          expect(formatted.startsWith('$')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('estimateTokens 应返回非负整数', () => {
      fc.assert(
        fc.property(textArb, (text) => {
          const estimate = estimateTokens(text);
          
          expect(estimate).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(estimate)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('createTokenTracker 应创建有效的追踪器', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
          (sessionId) => {
            const tracker = createTokenTracker({ sessionId });
            
            expect(tracker).toBeInstanceOf(TokenTracker);
            
            if (sessionId) {
              expect(tracker.getSessionId()).toBe(sessionId);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 定价属性测试
  // ===========================================================================

  describe('定价属性测试', () => {
    it('所有预定义模型应有有效定价', () => {
      for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.inputPrice).toBeGreaterThanOrEqual(0);
        expect(pricing.outputPrice).toBeGreaterThanOrEqual(0);
      }
    });

    it('自定义定价应覆盖默认定价', () => {
      fc.assert(
        fc.property(
          modelArb,
          fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
          (model, inputPrice, outputPrice) => {
            const tracker = new TokenTracker();
            
            tracker.setCustomPricing(model, { inputPrice, outputPrice });
            const pricing = tracker.getPricing(model);
            
            expect(pricing.inputPrice).toBe(inputPrice);
            expect(pricing.outputPrice).toBe(outputPrice);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('未知模型应使用默认定价', () => {
      const tracker = new TokenTracker();
      const pricing = tracker.getPricing('unknown-model-xyz');
      
      expect(pricing).toEqual(MODEL_PRICING['default']);
    });
  });
});

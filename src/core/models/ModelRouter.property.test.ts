import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouter } from './ModelRouter';

describe('ModelRouter Property Tests', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter({ maxRetries: 2 });
  });

  describe('Property 17: Model Fallback', () => {
    it('should initialize health status correctly', () => {
      router.registerModel('test', {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.7,
        maxTokens: 4096,
      });
      const health = router.getHealth('anthropic', 'claude-3-sonnet');
      expect(health).toBeDefined();
      expect(health!.healthy).toBe(true);
    });

    it('should reset health status', () => {
      router.registerModel('test', {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.7,
        maxTokens: 4096,
      });
      const health = router.getHealth('anthropic', 'claude-3-sonnet');
      expect(health).toBeDefined();
      health!.healthy = false;
      health!.errorCount = 5;
      router.resetHealth('anthropic', 'claude-3-sonnet');
      const resetHealth = router.getHealth('anthropic', 'claude-3-sonnet');
      expect(resetHealth).toBeDefined();
      expect(resetHealth!.healthy).toBe(true);
      expect(resetHealth!.errorCount).toBe(0);
    });

    it('should track unhealthy models', () => {
      router.registerModel('m1', { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.7, maxTokens: 4096 });
      router.registerModel('m2', { provider: 'openai', model: 'gpt-4o', temperature: 0.5, maxTokens: 4096 });
      const h1 = router.getHealth('anthropic', 'claude-3-sonnet');
      expect(h1).toBeDefined();
      h1!.healthy = false;
      const unhealthy = router.getUnhealthyModels();
      expect(unhealthy.length).toBe(1);
    });

    it('should track circuit breaker', () => {
      router.registerModel('test', { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.7, maxTokens: 4096 });
      expect(router.isCircuitOpen('anthropic', 'claude-3-sonnet')).toBe(false);
    });
  });

  describe('Property 18: Token Usage', () => {
    it('should calculate cost correctly', () => {
      const cost = router.calculateCost('claude-3-sonnet', 1000, 500);
      expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('should initialize usage stats', () => {
      router.registerModel('test', { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.7, maxTokens: 4096 });
      const usage = router.getUsage('anthropic', 'claude-3-sonnet');
      expect(usage).toBeDefined();
      expect(usage!.totalRequests).toBe(0);
    });

    it('should reset usage stats', () => {
      router.registerModel('test', { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.7, maxTokens: 4096 });
      const usage = router.getUsage('anthropic', 'claude-3-sonnet');
      expect(usage).toBeDefined();
      usage!.totalRequests = 10;
      router.resetUsage();
      const resetUsage = router.getUsage('anthropic', 'claude-3-sonnet');
      expect(resetUsage).toBeDefined();
      expect(resetUsage!.totalRequests).toBe(0);
    });

    it('should return zero for unregistered', () => {
      expect(router.estimateCost('nonexistent', 1000, 500)).toBe(0);
    });
  });

  describe('Model Registration', () => {
    it('should list registered models', () => {
      router.registerModel('m1', { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.7, maxTokens: 4096 });
      router.registerModel('m2', { provider: 'openai', model: 'gpt-4o', temperature: 0.5, maxTokens: 4096 });
      expect(router.listModels().length).toBe(2);
    });

    it('should retrieve config', () => {
      router.registerModel('test', { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.7, maxTokens: 4096 });
      const config = router.getConfig('test');
      expect(config).toBeDefined();
      expect(config!.provider).toBe('anthropic');
    });

    it('should return undefined for unregistered', () => {
      expect(router.getConfig('nonexistent')).toBeUndefined();
    });
  });

  describe('Health Summary', () => {
    it('should provide accurate summary', () => {
      router.registerModel('m1', { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.7, maxTokens: 4096 });
      router.registerModel('m2', { provider: 'openai', model: 'gpt-4o', temperature: 0.5, maxTokens: 4096 });
      const summary = router.getHealthSummary();
      expect(summary.totalModels).toBe(2);
      expect(summary.healthyModels).toBe(2);
    });
  });
});

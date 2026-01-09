/**
 * Feature Flags 单元测试
 * 测试标志的启用/禁用逻辑和依赖关系检查
 *
 * _Requirements: 3.1_
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_INFO,
  isFeatureEnabled,
  enableFeature,
  disableFeature,
  resetFeature,
  getAllFeatureFlags,
  getAllFeatureFlagInfo,
  getFeatureFlagsByPhase,
  type FeatureFlag,
} from './featureFlags';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Feature Flags', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('FEATURE_FLAGS 配置', () => {
    it('应该包含所有 Phase 1 标志且默认启用', () => {
      const phase1Flags = Object.entries(FEATURE_FLAG_INFO)
        .filter(([_, info]) => info.phase === 1)
        .map(([key]) => key);

      expect(phase1Flags.length).toBeGreaterThan(0);
      phase1Flags.forEach((flag) => {
        expect(FEATURE_FLAGS[flag]).toBe(true);
      });
    });

    it('应该包含所有 Phase 2 标志且默认禁用', () => {
      const phase2Flags = Object.entries(FEATURE_FLAG_INFO)
        .filter(([_, info]) => info.phase === 2)
        .map(([key]) => key);

      expect(phase2Flags.length).toBeGreaterThan(0);
      phase2Flags.forEach((flag) => {
        expect(FEATURE_FLAGS[flag]).toBe(false);
      });
    });

    it('每个标志应该有完整的元数据', () => {
      Object.entries(FEATURE_FLAG_INFO).forEach(([_key, info]) => {
        expect(info.id).toBeDefined();
        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
        expect(typeof info.enabled).toBe('boolean');
        expect([1, 2, 3, 4]).toContain(info.phase);
      });
    });
  });

  describe('isFeatureEnabled', () => {
    it('应该返回默认值（无 localStorage 覆盖）', () => {
      expect(isFeatureEnabled('LAZY_HISTORY_LOADING')).toBe(true);
      expect(isFeatureEnabled('CONTEXT_WINDOW_PRUNING')).toBe(false);
    });

    it('应该优先使用 localStorage 覆盖值', () => {
      localStorageMock.setItem('feature_CONTEXT_WINDOW_PRUNING', 'true');
      expect(isFeatureEnabled('CONTEXT_WINDOW_PRUNING')).toBe(true);

      localStorageMock.setItem('feature_LAZY_HISTORY_LOADING', 'false');
      expect(isFeatureEnabled('LAZY_HISTORY_LOADING')).toBe(false);
    });

    it('对于未知标志应该返回 false', () => {
      expect(isFeatureEnabled('UNKNOWN_FLAG' as FeatureFlag)).toBe(false);
    });
  });

  describe('enableFeature', () => {
    it('应该成功启用无依赖的标志', () => {
      const result = enableFeature('CONTEXT_WINDOW_PRUNING');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(isFeatureEnabled('CONTEXT_WINDOW_PRUNING')).toBe(true);
    });

    it('应该在依赖未满足时返回错误', () => {
      // NEW_CONTEXT_ARCHITECTURE 依赖 CONTEXT_WINDOW_PRUNING
      const result = enableFeature('NEW_CONTEXT_ARCHITECTURE');
      expect(result.success).toBe(false);
      expect(result.error).toContain('CONTEXT_WINDOW_PRUNING');
    });

    it('应该在依赖满足时成功启用', () => {
      // 先启用依赖
      enableFeature('CONTEXT_WINDOW_PRUNING');
      
      // 再启用依赖它的标志
      const result = enableFeature('NEW_CONTEXT_ARCHITECTURE');
      expect(result.success).toBe(true);
    });

    it('对于未知标志应该返回错误', () => {
      const result = enableFeature('UNKNOWN_FLAG' as FeatureFlag);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown feature flag');
    });
  });

  describe('disableFeature', () => {
    it('应该禁用标志', () => {
      enableFeature('CONTEXT_WINDOW_PRUNING');
      expect(isFeatureEnabled('CONTEXT_WINDOW_PRUNING')).toBe(true);

      disableFeature('CONTEXT_WINDOW_PRUNING');
      expect(isFeatureEnabled('CONTEXT_WINDOW_PRUNING')).toBe(false);
    });

    it('应该级联禁用依赖的标志', () => {
      // 启用依赖链
      enableFeature('CONTEXT_WINDOW_PRUNING');
      enableFeature('NEW_CONTEXT_ARCHITECTURE');
      
      expect(isFeatureEnabled('NEW_CONTEXT_ARCHITECTURE')).toBe(true);

      // 禁用被依赖的标志
      disableFeature('CONTEXT_WINDOW_PRUNING');
      
      // 依赖它的标志也应该被禁用
      expect(isFeatureEnabled('NEW_CONTEXT_ARCHITECTURE')).toBe(false);
    });
  });

  describe('resetFeature', () => {
    it('应该重置标志到默认值', () => {
      // 覆盖默认值
      enableFeature('CONTEXT_WINDOW_PRUNING');
      expect(isFeatureEnabled('CONTEXT_WINDOW_PRUNING')).toBe(true);

      // 重置
      resetFeature('CONTEXT_WINDOW_PRUNING');
      expect(isFeatureEnabled('CONTEXT_WINDOW_PRUNING')).toBe(false);
    });

    it('应该从 localStorage 移除覆盖', () => {
      enableFeature('VIRTUAL_SCROLLING');
      resetFeature('VIRTUAL_SCROLLING');
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('feature_VIRTUAL_SCROLLING');
    });
  });

  describe('getAllFeatureFlags', () => {
    it('应该返回所有标志的当前状态', () => {
      const flags = getAllFeatureFlags();
      
      expect(Object.keys(flags).length).toBe(Object.keys(FEATURE_FLAGS).length);
      expect(flags.LAZY_HISTORY_LOADING).toBe(true);
      expect(flags.CONTEXT_WINDOW_PRUNING).toBe(false);
    });

    it('应该反映 localStorage 覆盖', () => {
      enableFeature('VIRTUAL_SCROLLING');
      
      const flags = getAllFeatureFlags();
      expect(flags.VIRTUAL_SCROLLING).toBe(true);
    });
  });

  describe('getAllFeatureFlagInfo', () => {
    it('应该返回所有标志的详细信息', () => {
      const infos = getAllFeatureFlagInfo();
      
      expect(infos.length).toBe(Object.keys(FEATURE_FLAG_INFO).length);
      infos.forEach((info) => {
        expect(info.id).toBeDefined();
        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
      });
    });

    it('应该包含当前启用状态', () => {
      enableFeature('CONTEXT_WINDOW_PRUNING');
      
      const infos = getAllFeatureFlagInfo();
      const pruningInfo = infos.find((i) => i.id === 'context-window-pruning');
      
      expect(pruningInfo?.enabled).toBe(true);
    });
  });

  describe('getFeatureFlagsByPhase', () => {
    it('应该返回指定阶段的标志', () => {
      const phase1 = getFeatureFlagsByPhase(1);
      const phase2 = getFeatureFlagsByPhase(2);
      
      expect(phase1.length).toBeGreaterThan(0);
      expect(phase2.length).toBeGreaterThan(0);
      
      phase1.forEach((info) => expect(info.phase).toBe(1));
      phase2.forEach((info) => expect(info.phase).toBe(2));
    });

    it('Phase 1 标志应该默认启用', () => {
      const phase1 = getFeatureFlagsByPhase(1);
      
      // 检查原始默认值（不是当前状态）
      phase1.forEach((info) => {
        const originalInfo = FEATURE_FLAG_INFO[
          Object.keys(FEATURE_FLAG_INFO).find(
            (k) => FEATURE_FLAG_INFO[k].id === info.id
          ) as string
        ];
        expect(originalInfo.enabled).toBe(true);
      });
    });
  });

  describe('依赖关系完整性', () => {
    it('所有依赖应该指向存在的标志', () => {
      const allFlags = Object.keys(FEATURE_FLAG_INFO);
      
      Object.values(FEATURE_FLAG_INFO).forEach((info) => {
        if (info.dependencies) {
          info.dependencies.forEach((dep) => {
            expect(allFlags).toContain(dep);
          });
        }
      });
    });

    it('不应该有循环依赖', () => {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (flag: string): boolean => {
        if (recursionStack.has(flag)) return true;
        if (visited.has(flag)) return false;

        visited.add(flag);
        recursionStack.add(flag);

        const info = FEATURE_FLAG_INFO[flag];
        if (info?.dependencies) {
          for (const dep of info.dependencies) {
            if (hasCycle(dep)) return true;
          }
        }

        recursionStack.delete(flag);
        return false;
      };

      Object.keys(FEATURE_FLAG_INFO).forEach((flag) => {
        expect(hasCycle(flag)).toBe(false);
      });
    });
  });
});

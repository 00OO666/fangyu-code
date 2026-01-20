/**
 * DiffManager 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiffManager } from './DiffManager';

describe('DiffManager', () => {
  let diffManager: DiffManager;

  beforeEach(() => {
    diffManager = new DiffManager();
  });

  describe('初始化', () => {
    it('应该能够创建 DiffManager 实例', () => {
      expect(diffManager).toBeDefined();
    });
  });

  describe('解析差异', () => {
    it('parseDiff 方法应该存在', () => {
      expect(diffManager.parseDiff).toBeDefined();
    });

    it('应该能够解析 AI 响应', () => {
      const result = diffManager.parseDiff('test response');
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该能够解析标准diff格式', () => {
      const diffText = `--- file1.ts
+++ file1.ts
-old line
+new line`;
      const result = diffManager.parseDiff(diffText);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].filePath).toBe('file1.ts');
    });

    it('应该正确设置change状态为pending', () => {
      const diffText = `--- file1.ts
+++ file1.ts
-old
+new`;
      const result = diffManager.parseDiff(diffText);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('修改管理', () => {
    it('acceptChange 方法应该存在', () => {
      expect(diffManager.acceptChange).toBeDefined();
    });

    it('rejectChange 方法应该存在', () => {
      expect(diffManager.rejectChange).toBeDefined();
    });

    it('应该能够接受修改', () => {
      const diffText = `--- file1.ts
+++ file1.ts
-old
+new`;
      const changes = diffManager.parseDiff(diffText);
      expect(() => diffManager.acceptChange(changes[0].id)).not.toThrow();
      expect(diffManager.getChange(changes[0].id)?.status).toBe('accepted');
    });

    it('应该能够拒绝修改', () => {
      const diffText = `--- file1.ts
+++ file1.ts
-old
+new`;
      const changes = diffManager.parseDiff(diffText);
      expect(() => diffManager.rejectChange(changes[0].id)).not.toThrow();
      expect(diffManager.getChange(changes[0].id)?.status).toBe('rejected');
    });

    it('应该能够获取所有changes', () => {
      const diffText = `--- file1.ts
+++ file1.ts
-old
+new`;
      diffManager.parseDiff(diffText);
      const changes = diffManager.getChanges();
      expect(Array.isArray(changes)).toBe(true);
      expect(changes.length).toBeGreaterThan(0);
    });

    it('应该能够清除所有changes', () => {
      const diffText = `--- file1.ts
+++ file1.ts
-old
+new`;
      diffManager.parseDiff(diffText);
      diffManager.clearChanges();
      expect(diffManager.getChanges().length).toBe(0);
    });
  });

  describe('应用修改', () => {
    it('applyChanges 方法应该存在', () => {
      expect(diffManager.applyChanges).toBeDefined();
    });

    it('应该能够应用修改', async () => {
      await expect(diffManager.applyChanges()).resolves.not.toThrow();
    });

    it('应该只应用accepted的修改', async () => {
      const diffText = `--- file1.ts
+++ file1.ts
-old
+new`;
      const changes = diffManager.parseDiff(diffText);
      diffManager.acceptChange(changes[0].id);
      await expect(diffManager.applyChanges()).resolves.not.toThrow();
    });
  });
});

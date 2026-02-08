/**
 * LSP Client 单元测试
 *
 * 测试目标：
 * 1. LSP Client 能够正确初始化
 * 2. 缓存机制正常工作
 * 3. 所有 LSP 方法能够正确调用
 * 4. 错误处理正常
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LSPClient } from "./LSPClient";
import { RealLSPClient } from "../tools/LSPAutoLoader";
import type { Position } from "../types/unified-agent";

describe("LSPClient", () => {
  let realClient: RealLSPClient;
  let lspClient: LSPClient;

  beforeEach(() => {
    realClient = new RealLSPClient();
    lspClient = new LSPClient(realClient);
  });

  describe("初始化", () => {
    it("应该能够创建 LSP Client 实例", () => {
      expect(lspClient).toBeDefined();
      expect(lspClient).toBeInstanceOf(LSPClient);
    });

    it("应该有正确的初始缓存状态", () => {
      const stats = lspClient.getCacheStats();
      expect(stats.total).toBe(0);
      expect(stats.hover).toBe(0);
      expect(stats.definition).toBe(0);
      expect(stats.references).toBe(0);
      expect(stats.diagnostics).toBe(0);
      expect(stats.completion).toBe(0);
    });
  });

  describe("缓存功能", () => {
    it("应该能够清除所有缓存", () => {
      lspClient.clearCache();
      const stats = lspClient.getCacheStats();
      expect(stats.total).toBe(0);
    });

    it("应该能够清除特定文件的缓存", () => {
      lspClient.clearFileCache("test.ts");
      const stats = lspClient.getCacheStats();
      expect(stats.total).toBe(0);
    });

    it("应该能够获取缓存统计信息", () => {
      const stats = lspClient.getCacheStats();
      expect(stats).toHaveProperty("hover");
      expect(stats).toHaveProperty("definition");
      expect(stats).toHaveProperty("references");
      expect(stats).toHaveProperty("diagnostics");
      expect(stats).toHaveProperty("completion");
      expect(stats).toHaveProperty("total");
    });
  });

  describe("LSP 方法", () => {
    const testFile = "test.ts";
    const testPosition: Position = { line: 0, character: 0 };

    it("应该有 hover 方法", () => {
      expect(typeof lspClient.hover).toBe("function");
    });

    it("应该有 gotoDefinition 方法", () => {
      expect(typeof lspClient.gotoDefinition).toBe("function");
    });

    it("应该有 findReferences 方法", () => {
      expect(typeof lspClient.findReferences).toBe("function");
    });

    it("应该有 rename 方法", () => {
      expect(typeof lspClient.rename).toBe("function");
    });

    it("应该有 getDiagnostics 方法", () => {
      expect(typeof lspClient.getDiagnostics).toBe("function");
    });

    it("应该有 completion 方法", () => {
      expect(typeof lspClient.completion).toBe("function");
    });

    it("hover 方法应该返回 Promise", () => {
      const result = lspClient.hover(testFile, testPosition);
      expect(result).toBeInstanceOf(Promise);
    });

    it("gotoDefinition 方法应该返回 Promise", () => {
      const result = lspClient.gotoDefinition(testFile, testPosition);
      expect(result).toBeInstanceOf(Promise);
    });

    it("findReferences 方法应该返回 Promise", () => {
      const result = lspClient.findReferences(testFile, testPosition);
      expect(result).toBeInstanceOf(Promise);
    });

    it("rename 方法应该返回 Promise", () => {
      const result = lspClient.rename(testFile, testPosition, "newName");
      expect(result).toBeInstanceOf(Promise);
    });

    it("getDiagnostics 方法应该返回 Promise", () => {
      const result = lspClient.getDiagnostics(testFile);
      expect(result).toBeInstanceOf(Promise);
    });

    it("completion 方法应该返回 Promise", () => {
      const result = lspClient.completion(testFile, testPosition);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("错误处理", () => {
    it("hover 失败时应该返回 null", async () => {
      // Mock realClient to throw error
      vi.spyOn(realClient, "textDocumentHover").mockRejectedValue(new Error("Test error"));

      const result = await lspClient.hover("test.ts", { line: 0, character: 0 });
      expect(result).toBeNull();
    });

    it("gotoDefinition 失败时应该返回 null", async () => {
      vi.spyOn(realClient, "textDocumentDefinition").mockRejectedValue(new Error("Test error"));

      const result = await lspClient.gotoDefinition("test.ts", { line: 0, character: 0 });
      expect(result).toBeNull();
    });

    it("findReferences 失败时应该返回空数组", async () => {
      vi.spyOn(realClient, "textDocumentReferences").mockRejectedValue(new Error("Test error"));

      const result = await lspClient.findReferences("test.ts", { line: 0, character: 0 });
      expect(result).toEqual([]);
    });

    it("getDiagnostics 失败时应该返回空数组", async () => {
      vi.spyOn(realClient, "textDocumentDiagnostics").mockRejectedValue(new Error("Test error"));

      const result = await lspClient.getDiagnostics("test.ts");
      expect(result).toEqual([]);
    });

    it("completion 失败时应该返回空数组", async () => {
      vi.spyOn(realClient, "textDocumentCompletion").mockRejectedValue(new Error("Test error"));

      const result = await lspClient.completion("test.ts", { line: 0, character: 0 });
      expect(result).toEqual([]);
    });
  });
});

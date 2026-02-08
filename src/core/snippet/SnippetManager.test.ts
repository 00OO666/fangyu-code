/**
 * SnippetManager 测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SnippetManager } from "./SnippetManager";

describe("SnippetManager", () => {
  let manager: SnippetManager;

  beforeEach(() => {
    manager = new SnippetManager();
  });

  it("应该能够添加代码片段", () => {
    const snippet = manager.addSnippet({
      name: "Test Snippet",
      description: "A test snippet",
      language: "typescript",
      code: 'console.log("test");',
      tags: ["test"],
    });

    expect(snippet.id).toBeDefined();
    expect(snippet.name).toBe("Test Snippet");
  });

  it("应该能够获取代码片段", () => {
    const snippet = manager.addSnippet({
      name: "Test",
      description: "Test",
      language: "typescript",
      code: "test",
      tags: [],
    });

    const retrieved = manager.getSnippet(snippet.id);
    expect(retrieved).toEqual(snippet);
  });

  it("应该能够搜索代码片段", () => {
    manager.addSnippet({
      name: "React Component",
      description: "A React component",
      language: "typescript",
      code: "export const Component = () => {};",
      tags: ["react"],
    });

    const results = manager.searchSnippets("react");
    expect(results.length).toBeGreaterThan(0);
  });

  it("应该能够按语言过滤", () => {
    manager.addSnippet({
      name: "TS Snippet",
      description: "TypeScript",
      language: "typescript",
      code: "const x = 1;",
      tags: [],
    });

    const results = manager.getSnippetsByLanguage("typescript");
    expect(results.length).toBe(1);
  });
});

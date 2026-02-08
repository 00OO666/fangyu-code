/**
 * IDEToolchain 属性测试
 *
 * Property 9: 语法验证正确性
 * Validates: Requirements 3.5, 3.6
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { IDEToolchain, ToolchainConfig } from "./IDEToolchain";
import { MockLSPClient } from "./LSPTools";
import { MockASTGrepExecutor } from "./ASTGrepTools";
import { MockPowerStorage, MockMCPClient } from "./PowersManager";
import { Diagnostic, DiagnosticSeverity } from "../types/unified-agent";

// 生成文件路径
const filePathArb = fc.stringMatching(/^[a-z][a-z0-9/]*\.(ts|js|py|rs)$/);

// 生成诊断严重性
const severityArb = fc.constantFrom<DiagnosticSeverity>("error", "warning", "info", "hint");

// 生成诊断
const diagnosticArb = (file: string): fc.Arbitrary<Diagnostic> =>
  fc.record({
    file: fc.constant(file),
    range: fc.record({
      start: fc.record({
        line: fc.integer({ min: 0, max: 1000 }),
        character: fc.integer({ min: 0, max: 200 }),
      }),
      end: fc.record({
        line: fc.integer({ min: 0, max: 1000 }),
        character: fc.integer({ min: 0, max: 200 }),
      }),
    }),
    message: fc.string({ minLength: 5, maxLength: 100 }),
    severity: severityArb,
    source: fc.option(fc.string({ minLength: 2, maxLength: 20 }), { nil: undefined }),
    code: fc.option(
      fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.integer({ min: 1, max: 9999 })),
      { nil: undefined }
    ),
  });

describe("IDEToolchain Property Tests", () => {
  let lspClient: MockLSPClient;
  let astExecutor: MockASTGrepExecutor;
  let powerStorage: MockPowerStorage;
  let mcpClient: MockMCPClient;
  let toolchain: IDEToolchain;

  beforeEach(() => {
    lspClient = new MockLSPClient();
    astExecutor = new MockASTGrepExecutor();
    powerStorage = new MockPowerStorage();
    mcpClient = new MockMCPClient();

    const config: ToolchainConfig = {
      workspaceRoot: "/workspace",
      lspClient,
      astExecutor,
      powerStorage,
      mcpClient,
    };

    toolchain = new IDEToolchain(config);
  });

  describe("Syntax Validation Properties (Property 9)", () => {
    it("Property 9.1: 无错误时验证应返回 valid=true", async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          fc.array(
            diagnosticArb("test.ts").filter((d) => d.severity !== "error"),
            { maxLength: 5 }
          ),
          async (file, diagnostics) => {
            const testLspClient = new MockLSPClient();
            const testToolchain = new IDEToolchain({
              workspaceRoot: "/workspace",
              lspClient: testLspClient,
              astExecutor,
              powerStorage,
              mcpClient,
            });

            // 使用完整路径设置诊断
            const fullPath = `/workspace/${file}`;
            const adjustedDiags = diagnostics.map((d) => ({ ...d, file: fullPath }));
            testLspClient.setDiagnostics(fullPath, adjustedDiags);

            const result = await testToolchain.validateSyntax(file);

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it("Property 9.2: 有错误时验证应返回 valid=false", async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          fc
            .array(diagnosticArb("test.ts"), { minLength: 1, maxLength: 5 })
            .filter((diags) => diags.some((d) => d.severity === "error")),
          async (file, diagnostics) => {
            const testLspClient = new MockLSPClient();
            const testToolchain = new IDEToolchain({
              workspaceRoot: "/workspace",
              lspClient: testLspClient,
              astExecutor,
              powerStorage,
              mcpClient,
            });

            // 使用完整路径设置诊断
            const fullPath = `/workspace/${file}`;
            const adjustedDiags = diagnostics.map((d) => ({ ...d, file: fullPath }));
            testLspClient.setDiagnostics(fullPath, adjustedDiags);

            const result = await testToolchain.validateSyntax(file);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it("Property 9.3: 错误、警告、提示应正确分类", async () => {
      const file = "test.ts";
      const fullPath = "/workspace/test.ts";
      const diagnostics: Diagnostic[] = [
        {
          file: fullPath,
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: "Error 1",
          severity: "error",
        },
        {
          file: fullPath,
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } },
          message: "Error 2",
          severity: "error",
        },
        {
          file: fullPath,
          range: { start: { line: 3, character: 0 }, end: { line: 3, character: 10 } },
          message: "Warning 1",
          severity: "warning",
        },
        {
          file: fullPath,
          range: { start: { line: 4, character: 0 }, end: { line: 4, character: 10 } },
          message: "Hint 1",
          severity: "hint",
        },
        {
          file: fullPath,
          range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
          message: "Info 1",
          severity: "info",
        },
      ];

      lspClient.setDiagnostics(fullPath, diagnostics);

      const result = await toolchain.validateSyntax(file);

      expect(result.errors.length).toBe(2);
      expect(result.warnings.length).toBe(1);
      expect(result.hints.length).toBe(2); // hint + info
    });

    it("Property 9.4: 摘要应正确反映问题数量", async () => {
      // 无问题
      lspClient.setDiagnostics("/workspace/clean.ts", []);
      const cleanResult = await toolchain.validateSyntax("clean.ts");
      expect(cleanResult.summary).toBe("No issues found");

      // 只有警告
      lspClient.setDiagnostics("/workspace/warnings.ts", [
        {
          file: "/workspace/warnings.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: "Warning",
          severity: "warning",
        },
      ]);
      const warningResult = await toolchain.validateSyntax("warnings.ts");
      expect(warningResult.summary).toContain("1 warning");

      // 有错误
      lspClient.setDiagnostics("/workspace/errors.ts", [
        {
          file: "/workspace/errors.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: "Error",
          severity: "error",
        },
        {
          file: "/workspace/errors.ts",
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } },
          message: "Warning",
          severity: "warning",
        },
      ]);
      const errorResult = await toolchain.validateSyntax("errors.ts");
      expect(errorResult.summary).toContain("1 error");
      expect(errorResult.summary).toContain("1 warning");
    });
  });

  describe("Code Analysis Properties (Property 9.5)", () => {
    it("Property 9.5.1: 分析应返回请求的信息", async () => {
      const file = "test.ts";
      const fullPath = "/workspace/test.ts";

      lspClient.setHover(fullPath, 5, 10, { contents: "Type: string" });
      lspClient.setDefinition(fullPath, 5, 10, {
        file: "other.ts",
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
      });
      lspClient.setReferences(fullPath, 5, 10, [
        {
          file: "ref1.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
        },
      ]);
      lspClient.setDiagnostics(fullPath, []);

      const result = await toolchain.analyzeCode(file, 5, 10, {
        includeHover: true,
        includeDefinition: true,
        includeReferences: true,
        includeDiagnostics: true,
      });

      expect(result.hover).toBeDefined();
      expect(result.definition).toBeDefined();
      expect(result.references).toBeDefined();
      expect(result.diagnostics).toBeDefined();
    });

    it("Property 9.5.2: 默认应包含 hover 和 diagnostics", async () => {
      const file = "test.ts";
      const fullPath = "/workspace/test.ts";

      lspClient.setHover(fullPath, 5, 10, { contents: "Type: string" });
      lspClient.setDiagnostics(fullPath, []);

      const result = await toolchain.analyzeCode(file, 5, 10, {});

      expect(result.hover).toBeDefined();
      expect(result.diagnostics).toBeDefined();
    });
  });

  describe("Code Search Properties (Property 9.6)", () => {
    it("Property 9.6.1: 搜索应返回正确的结果结构", async () => {
      const matches = [
        {
          file: "/workspace/test.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          text: "match1",
        },
      ];

      astExecutor.setSearchResult("pattern", "typescript", matches);

      const result = await toolchain.searchCode("pattern", "typescript");

      expect(result.pattern).toBe("pattern");
      expect(result.language).toBe("typescript");
      expect(result.matches).toEqual(matches);
      expect(result.totalCount).toBe(1);
    });
  });

  describe("Language Support Properties (Property 9.7)", () => {
    it("Property 9.7.1: 应正确推断文件语言", () => {
      expect(toolchain.inferLanguage("test.ts")).toBe("typescript");
      expect(toolchain.inferLanguage("test.js")).toBe("javascript");
      expect(toolchain.inferLanguage("test.py")).toBe("python");
      expect(toolchain.inferLanguage("test.rs")).toBe("rust");
    });

    it("Property 9.7.2: 应正确检查 AST 支持", () => {
      expect(toolchain.isASTSupported("typescript")).toBe(true);
      expect(toolchain.isASTSupported("javascript")).toBe(true);
      expect(toolchain.isASTSupported("unknown_lang")).toBe(false);
    });

    it("Property 9.7.3: 支持的语言列表应非空", () => {
      const languages = toolchain.getSupportedLanguages();
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain("typescript");
      expect(languages).toContain("javascript");
    });
  });

  describe("Batch Validation Properties (Property 9.8)", () => {
    it("Property 9.8.1: 批量验证应返回所有文件的结果", async () => {
      const files = ["file1.ts", "file2.ts", "file3.ts"];

      for (const file of files) {
        lspClient.setDiagnostics(`/workspace/${file}`, []);
      }

      const results = await toolchain.validateMultiple(files);

      expect(results.size).toBe(files.length);
      for (const file of files) {
        expect(results.has(file)).toBe(true);
      }
    });

    it("Property 9.8.2: 工作区摘要应正确统计", async () => {
      lspClient.setDiagnostics("/workspace/clean.ts", []);
      lspClient.setDiagnostics("/workspace/errors.ts", [
        {
          file: "/workspace/errors.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: "Error 1",
          severity: "error",
        },
        {
          file: "/workspace/errors.ts",
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } },
          message: "Error 2",
          severity: "error",
        },
      ]);
      lspClient.setDiagnostics("/workspace/warnings.ts", [
        {
          file: "/workspace/warnings.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: "Warning",
          severity: "warning",
        },
      ]);

      const summary = await toolchain.getWorkspaceDiagnosticsSummary([
        "clean.ts",
        "errors.ts",
        "warnings.ts",
      ]);

      expect(summary.totalErrors).toBe(2);
      expect(summary.totalWarnings).toBe(1);
      expect(summary.fileCount).toBe(3);
      expect(summary.filesWithErrors).toEqual(["errors.ts"]);
    });
  });

  describe("Tool Access Properties (Property 9.9)", () => {
    it("Property 9.9.1: 应能访问子工具", () => {
      expect(toolchain.getLSPTools()).toBeDefined();
      expect(toolchain.getASTTools()).toBeDefined();
      expect(toolchain.getPowersManager()).toBeDefined();
    });
  });
});

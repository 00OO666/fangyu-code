/**
 * SecurityGuard 属性测试
 *
 * Property 19-22: 安全防护属性测试
 * Validates: Requirements 12.1-12.7
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  SecurityGuard,
  DEFAULT_DANGEROUS_COMMANDS,
  DEFAULT_SENSITIVE_PATTERNS,
} from "./SecurityGuard";
import { Operation, OperationType } from "../types/unified-agent";

// 生成安全的文件名
const safeFilenameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/);

// 生成安全的路径段
const safePathSegmentArb = fc
  .array(safeFilenameArb, { minLength: 1, maxLength: 5 })
  .map((segments) => segments.join("/"));

// 生成操作类型
const operationTypeArb = fc.constantFrom<OperationType>(
  "file.read",
  "file.write",
  "file.delete",
  "command.execute",
  "network.request"
);

// 生成操作
const operationArb: fc.Arbitrary<Operation> = fc.record({
  type: operationTypeArb,
  target: fc.string({ minLength: 1, maxLength: 50 }),
  params: fc.option(
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean())
    ),
    { nil: undefined }
  ),
  timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
  agentId: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
});

describe("SecurityGuard Property Tests", () => {
  let guard: SecurityGuard;

  beforeEach(() => {
    guard = new SecurityGuard({
      workspaceBoundary: "/workspace",
    });
  });

  describe("Path Validation Properties (Property 19)", () => {
    it("Property 19.1: 工作区内的路径应验证通过", () => {
      fc.assert(
        fc.property(safePathSegmentArb, (pathSegment) => {
          const path = `/workspace/${pathSegment}`;
          const result = guard.validatePath(path);
          expect(result.valid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("Property 19.2: 工作区外的路径应验证失败", () => {
      fc.assert(
        fc.property(safePathSegmentArb, (pathSegment) => {
          const path = `/other/${pathSegment}`;
          const result = guard.validatePath(path);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain("outside workspace");
        }),
        { numRuns: 100 }
      );
    });

    it("Property 19.3: 包含路径遍历的路径应验证失败", () => {
      const traversalPaths = [
        "/workspace/../etc/passwd",
        "/workspace/foo/../../bar",
        "/workspace/./../../root",
        "../../../etc/shadow",
      ];

      for (const path of traversalPaths) {
        const result = guard.validatePath(path);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("traversal");
      }
    });

    it("Property 19.4: isWithinWorkspace 应正确判断", () => {
      expect(guard.isWithinWorkspace("/workspace/src/file.ts")).toBe(true);
      expect(guard.isWithinWorkspace("/workspace")).toBe(true);
      expect(guard.isWithinWorkspace("/other/path")).toBe(false);
      expect(guard.isWithinWorkspace("/workspaceother")).toBe(false);
    });
  });

  describe("Dangerous Command Properties (Property 20)", () => {
    it("Property 20.1: 危险命令应被拦截", () => {
      for (const cmd of DEFAULT_DANGEROUS_COMMANDS.slice(0, 10)) {
        const result = guard.validateCommand(cmd);
        expect(result.valid).toBe(false);
      }
    });

    it("Property 20.2: isDangerousCommand 应识别危险命令", () => {
      expect(guard.isDangerousCommand("rm -rf /")).toBe(true);
      expect(guard.isDangerousCommand("rm -rf /*")).toBe(true);
      expect(guard.isDangerousCommand("shutdown")).toBe(true);
      expect(guard.isDangerousCommand("format c:")).toBe(true);
    });

    it("Property 20.3: 安全命令应通过验证", () => {
      const safeCommands = [
        "ls -la",
        "cat file.txt",
        "echo hello",
        "npm install",
        "git status",
        "node app.js",
      ];

      for (const cmd of safeCommands) {
        const result = guard.validateCommand(cmd);
        expect(result.valid).toBe(true);
      }
    });

    it("Property 20.4: 命令注入应被检测", () => {
      const injectionCommands = [
        "echo hello; rm -rf /",
        "cat file | bash",
        "echo $(whoami)",
        "echo `id`",
        'eval "dangerous"',
      ];

      for (const cmd of injectionCommands) {
        const result = guard.validateCommand(cmd);
        expect(result.valid).toBe(false);
      }
    });

    it("Property 20.5: 白名单命令应通过", () => {
      const guardWithWhitelist = new SecurityGuard({
        workspaceBoundary: "/workspace",
        commandWhitelist: ["npm", "git", "node"],
      });

      expect(guardWithWhitelist.validateCommand("npm install").valid).toBe(true);
      expect(guardWithWhitelist.validateCommand("git push").valid).toBe(true);
      expect(guardWithWhitelist.validateCommand("node app.js").valid).toBe(true);
    });
  });

  describe("Sensitive Info Redaction Properties (Property 21)", () => {
    it("Property 21.1: API Key 应被脱敏", () => {
      const text = "api_key=sk_test_FAKE_KEY_FOR_TESTING_1234567890";
      const redacted = guard.redactSensitiveInfo(text);
      expect(redacted).not.toContain("sk_test_");
      expect(redacted).toContain("[REDACTED");
    });

    it("Property 21.2: AWS Key 应被脱敏", () => {
      const text = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
      const redacted = guard.redactSensitiveInfo(text);
      expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });

    it("Property 21.3: 密码应被脱敏", () => {
      const text = "password=mysecretpassword123";
      const redacted = guard.redactSensitiveInfo(text);
      expect(redacted).not.toContain("mysecretpassword123");
      expect(redacted).toContain("[REDACTED");
    });

    it("Property 21.4: 邮箱应被脱敏", () => {
      const text = "Contact: user@example.com for support";
      const redacted = guard.redactSensitiveInfo(text);
      expect(redacted).not.toContain("user@example.com");
      expect(redacted).toContain("[REDACTED");
    });

    it("Property 21.5: 私钥应被脱敏", () => {
      const text = "-----BEGIN RSA PRIVATE KEY-----\nMIIE...";
      const redacted = guard.redactSensitiveInfo(text);
      expect(redacted).toContain("[REDACTED");
    });

    it("Property 21.6: detectSensitiveInfo 应返回匹配位置", () => {
      const text = "api_key=test_key_12345678901234567890";
      const matches = guard.detectSensitiveInfo(text);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].start).toBeGreaterThanOrEqual(0);
      expect(matches[0].end).toBeGreaterThan(matches[0].start);
      expect(matches[0].type).toBeDefined();
    });

    it("Property 21.7: 无敏感信息时应返回原文", () => {
      const text = "This is a normal text without sensitive info";
      const redacted = guard.redactSensitiveInfo(text);
      expect(redacted).toBe(text);
    });
  });

  describe("Audit Log Properties (Property 22)", () => {
    it("Property 22.1: 操作应被记录到审计日志", async () => {
      await fc.assert(
        fc.asyncProperty(operationArb, async (operation) => {
          const testGuard = new SecurityGuard({ workspaceBoundary: "/workspace" });

          const entry = testGuard.logOperation(operation, "success", 100);

          expect(entry.id).toBeDefined();
          expect(entry.operation).toEqual(operation);
          expect(entry.result).toBe("success");
          expect(entry.duration).toBe(100);
        }),
        { numRuns: 50 }
      );
    });

    it("Property 22.2: 审计日志应可查询", () => {
      const operation1: Operation = {
        type: "file.read",
        target: "/workspace/file1.ts",
        timestamp: Date.now(),
      };
      const operation2: Operation = {
        type: "file.write",
        target: "/workspace/file2.ts",
        timestamp: Date.now(),
      };
      const operation3: Operation = {
        type: "command.execute",
        target: "npm install",
        timestamp: Date.now(),
      };

      guard.logOperation(operation1, "success", 50);
      guard.logOperation(operation2, "failure", 100);
      guard.logOperation(operation3, "blocked", 10);

      // 查询所有
      const all = guard.getAuditLog();
      expect(all.length).toBe(3);

      // 按类型查询
      const fileReads = guard.getAuditLog({ type: "file.read" });
      expect(fileReads.length).toBe(1);

      // 按结果查询
      const blocked = guard.getAuditLog({ result: "blocked" });
      expect(blocked.length).toBe(1);
    });

    it("Property 22.3: 审计日志应支持分页", () => {
      for (let i = 0; i < 10; i++) {
        guard.logOperation(
          {
            type: "file.read",
            target: `/workspace/file${i}.ts`,
            timestamp: Date.now(),
          },
          "success",
          10
        );
      }

      const page1 = guard.getAuditLog({ limit: 3, offset: 0 });
      const page2 = guard.getAuditLog({ limit: 3, offset: 3 });

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it("Property 22.4: 审计统计应正确计算", () => {
      guard.logOperation({ type: "file.read", target: "a", timestamp: Date.now() }, "success", 10);
      guard.logOperation({ type: "file.read", target: "b", timestamp: Date.now() }, "success", 10);
      guard.logOperation({ type: "file.write", target: "c", timestamp: Date.now() }, "failure", 10);
      guard.logOperation(
        { type: "command.execute", target: "d", timestamp: Date.now() },
        "blocked",
        10
      );

      const stats = guard.getAuditStats();

      expect(stats.total).toBe(4);
      expect(stats.success).toBe(2);
      expect(stats.failure).toBe(1);
      expect(stats.blocked).toBe(1);
      expect(stats.byType["file.read"]).toBe(2);
      expect(stats.byType["file.write"]).toBe(1);
      expect(stats.byType["command.execute"]).toBe(1);
    });

    it("Property 22.5: 清除审计日志应生效", () => {
      guard.logOperation({ type: "file.read", target: "a", timestamp: Date.now() }, "success", 10);
      guard.logOperation({ type: "file.read", target: "b", timestamp: Date.now() }, "success", 10);

      expect(guard.getAuditLog().length).toBe(2);

      guard.clearAuditLog();

      expect(guard.getAuditLog().length).toBe(0);
    });
  });

  describe("Configuration Properties", () => {
    it("Property: 配置应可更新", () => {
      guard.updateConfig({
        workspaceBoundary: "/new/workspace",
        dangerousCommands: ["custom-danger"],
      });

      const config = guard.getConfig();
      expect(config.workspaceBoundary).toBe("/new/workspace");
      expect(config.dangerousCommands).toContain("custom-danger");
    });
  });
});

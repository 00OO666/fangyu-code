/**
 * PowersManager 属性测试
 *
 * Property 28: Powers 管理正确性
 * Validates: Requirements 9.1-9.7
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { PowersManager, MockPowerStorage, MockMCPClient, PowerInfo } from "./PowersManager";
import { Power, PowerTool, MCPServer } from "../types/unified-agent";

// 生成有效的 Power 名称
const powerNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/);

// 生成关键词
const keywordArb = fc.stringMatching(/^[a-z]{3,10}$/);

// 生成 MCP 服务器
const mcpServerArb: fc.Arbitrary<MCPServer> = fc.record({
  name: fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
  command: fc.option(fc.constant("uvx"), { nil: undefined }),
  args: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }), {
    nil: undefined,
  }),
});

// 生成 Power
const powerArb: fc.Arbitrary<Power> = fc.record({
  name: powerNameArb,
  displayName: fc.string({ minLength: 3, maxLength: 30 }),
  description: fc.string({ minLength: 10, maxLength: 100 }),
  keywords: fc.array(keywordArb, { minLength: 1, maxLength: 5 }),
  mcpServers: fc.array(mcpServerArb, { minLength: 0, maxLength: 3 }),
  steeringFiles: fc.array(fc.stringMatching(/^[a-z-]+\.md$/), { minLength: 0, maxLength: 3 }),
  disabled: fc.boolean(),
});

// 生成 PowerTool
const powerToolArb: fc.Arbitrary<PowerTool> = fc.record({
  name: fc.stringMatching(/^[a-z_][a-z0-9_]{2,20}$/),
  description: fc.string({ minLength: 5, maxLength: 50 }),
  inputSchema: fc.constant({ type: "object", properties: {} }),
});

describe("PowersManager Property Tests", () => {
  let storage: MockPowerStorage;
  let mcpClient: MockMCPClient;
  let manager: PowersManager;

  beforeEach(() => {
    storage = new MockPowerStorage();
    mcpClient = new MockMCPClient();
    manager = new PowersManager(storage, mcpClient);
  });

  describe("List Properties (Property 28.1)", () => {
    it("Property 28.1.1: 列出的 Powers 数量应与存储中的一致", async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(powerArb, { minLength: 0, maxLength: 10 }), async (powers) => {
          const testStorage = new MockPowerStorage();
          const testManager = new PowersManager(testStorage, mcpClient);

          // 确保名称唯一
          const uniquePowers = powers.filter(
            (p, i, arr) => arr.findIndex((x) => x.name === p.name) === i
          );

          for (const power of uniquePowers) {
            testStorage.setPower(power);
          }

          const listed = await testManager.list();
          expect(listed.length).toBe(uniquePowers.length);
        }),
        { numRuns: 50 }
      );
    });

    it("Property 28.1.2: 列出的 Powers 应包含正确的状态", async () => {
      const enabledPower: Power = {
        name: "enabled-power",
        displayName: "Enabled Power",
        description: "An enabled power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      const disabledPower: Power = {
        name: "disabled-power",
        displayName: "Disabled Power",
        description: "A disabled power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: [],
        disabled: true,
      };

      storage.setPower(enabledPower);
      storage.setPower(disabledPower);

      const listed = await manager.list();

      const enabled = listed.find((p) => p.name === "enabled-power");
      const disabled = listed.find((p) => p.name === "disabled-power");

      expect(enabled?.status).toBe("installed");
      expect(disabled?.status).toBe("disabled");
    });
  });

  describe("Activate Properties (Property 28.2)", () => {
    it("Property 28.2.1: 激活后 Power 应标记为活跃", async () => {
      await fc.assert(
        fc.asyncProperty(
          powerArb.filter((p) => !p.disabled),
          async (power) => {
            const testStorage = new MockPowerStorage();
            const testManager = new PowersManager(testStorage, mcpClient);

            testStorage.setPower(power);

            await testManager.activate(power.name);

            expect(testManager.isActive(power.name)).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it("Property 28.2.2: 激活不存在的 Power 应抛出错误", async () => {
      await expect(manager.activate("nonexistent")).rejects.toThrow("Power not found");
    });

    it("Property 28.2.3: 激活禁用的 Power 应抛出错误", async () => {
      const disabledPower: Power = {
        name: "disabled-power",
        displayName: "Disabled",
        description: "A disabled power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: [],
        disabled: true,
      };

      storage.setPower(disabledPower);

      await expect(manager.activate("disabled-power")).rejects.toThrow("Power is disabled");
    });

    it("Property 28.2.4: 激活结果应包含所有服务器的工具", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test Power",
        description: "A test power",
        keywords: ["test"],
        mcpServers: [{ name: "server1" }, { name: "server2" }],
        steeringFiles: [],
        disabled: false,
      };

      const tools1: PowerTool[] = [{ name: "tool1", description: "Tool 1", inputSchema: {} }];
      const tools2: PowerTool[] = [{ name: "tool2", description: "Tool 2", inputSchema: {} }];

      storage.setPower(power);
      mcpClient.setServerTools("server1", tools1);
      mcpClient.setServerTools("server2", tools2);

      const result = await manager.activate("test-power");

      expect(result.toolsByServer["server1"]).toEqual(tools1);
      expect(result.toolsByServer["server2"]).toEqual(tools2);
    });
  });

  describe("Use Properties (Property 28.3)", () => {
    it("Property 28.3.1: 使用未激活的 Power 应返回错误", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["test"],
        mcpServers: [{ name: "server1" }],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);

      const result = await manager.use("test-power", "server1", "tool1", {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("not activated");
    });

    it("Property 28.3.2: 使用激活的 Power 应成功调用工具", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["test"],
        mcpServers: [{ name: "server1" }],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);
      mcpClient.setToolResult("server1", "tool1", { data: "result" });

      await manager.activate("test-power");
      const result = await manager.use("test-power", "server1", "tool1", { arg: "value" });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: "result" });
    });

    it("Property 28.3.3: 使用不存在的服务器应返回错误", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["test"],
        mcpServers: [{ name: "server1" }],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);
      await manager.activate("test-power");

      const result = await manager.use("test-power", "nonexistent", "tool1", {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("ReadSteering Properties (Property 28.4)", () => {
    it("Property 28.4.1: 读取存在的 steering 文件应返回内容", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: ["guide.md"],
        disabled: false,
      };

      storage.setPower(power);
      storage.setSteeringFile("test-power", "guide.md", "# Guide\nContent here");

      const content = await manager.readSteering("test-power", "guide.md");

      expect(content).toBe("# Guide\nContent here");
    });

    it("Property 28.4.2: 读取不存在的 steering 文件应抛出错误", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: ["guide.md"],
        disabled: false,
      };

      storage.setPower(power);

      await expect(manager.readSteering("test-power", "nonexistent.md")).rejects.toThrow(
        "Steering file not found"
      );
    });
  });

  describe("Deactivate Properties (Property 28.5)", () => {
    it("Property 28.5.1: 停用后 Power 应不再活跃", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);
      await manager.activate("test-power");

      expect(manager.isActive("test-power")).toBe(true);

      manager.deactivate("test-power");

      expect(manager.isActive("test-power")).toBe(false);
    });

    it("Property 28.5.2: 停用未激活的 Power 应返回 false", () => {
      const result = manager.deactivate("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("Keyword Search Properties (Property 28.6)", () => {
    it("Property 28.6.1: 关键词搜索应返回匹配的 Powers", async () => {
      const power1: Power = {
        name: "weather-power",
        displayName: "Weather",
        description: "Weather information",
        keywords: ["weather", "forecast"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      const power2: Power = {
        name: "docs-power",
        displayName: "Docs",
        description: "Documentation search",
        keywords: ["docs", "documentation"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power1);
      storage.setPower(power2);

      const weatherResults = await manager.searchByKeyword("weather");
      const docsResults = await manager.searchByKeyword("docs");

      expect(weatherResults.length).toBe(1);
      expect(weatherResults[0].name).toBe("weather-power");

      expect(docsResults.length).toBe(1);
      expect(docsResults[0].name).toBe("docs-power");
    });

    it("Property 28.6.2: 搜索应不区分大小写", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["GitHub", "API"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);

      const results1 = await manager.searchByKeyword("github");
      const results2 = await manager.searchByKeyword("GITHUB");
      const results3 = await manager.searchByKeyword("api");

      expect(results1.length).toBe(1);
      expect(results2.length).toBe(1);
      expect(results3.length).toBe(1);
    });
  });

  describe("Auto-Activate Properties (Property 28.7)", () => {
    it("Property 28.7.1: 自动激活应匹配文本中的关键词", async () => {
      const power: Power = {
        name: "weather-power",
        displayName: "Weather",
        description: "Weather information",
        keywords: ["weather", "forecast"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);

      const activated = await manager.autoActivateByKeywords("What is the weather today?");

      expect(activated).toContain("weather-power");
      expect(manager.isActive("weather-power")).toBe(true);
    });

    it("Property 28.7.2: 已激活的 Power 不应重复激活", async () => {
      const power: Power = {
        name: "weather-power",
        displayName: "Weather",
        description: "Weather information",
        keywords: ["weather"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);
      await manager.activate("weather-power");

      const activated = await manager.autoActivateByKeywords("weather forecast");

      expect(activated).not.toContain("weather-power");
    });

    it("Property 28.7.3: 禁用的 Power 不应自动激活", async () => {
      const power: Power = {
        name: "disabled-power",
        displayName: "Disabled",
        description: "Disabled power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: [],
        disabled: true,
      };

      storage.setPower(power);

      const activated = await manager.autoActivateByKeywords("test keyword");

      expect(activated).not.toContain("disabled-power");
    });
  });

  describe("Configure Properties (Property 28.8)", () => {
    it("Property 28.8.1: 配置应正确保存", async () => {
      const power: Power = {
        name: "test-power",
        displayName: "Test",
        description: "Test power",
        keywords: ["test"],
        mcpServers: [],
        steeringFiles: [],
        disabled: false,
      };

      storage.setPower(power);

      await manager.configure("test-power", {
        disabled: true,
        autoApprove: ["tool1", "tool2"],
      });

      const config = storage.getConfig("test-power");
      expect(config?.disabled).toBe(true);
      expect(config?.autoApprove).toEqual(["tool1", "tool2"]);
    });

    it("Property 28.8.2: 配置不存在的 Power 应抛出错误", async () => {
      await expect(manager.configure("nonexistent", {})).rejects.toThrow("Power not found");
    });
  });
});

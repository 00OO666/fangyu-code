/**
 * PluginManager 测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PluginManager } from "./PluginManager";

describe("PluginManager", () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it("应该能够创建PluginManager实例", () => {
    expect(manager).toBeDefined();
  });

  it("应该能够注册插件", async () => {
    const plugin = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      enabled: false,
    };
    await manager.registerPlugin(plugin);
    expect(manager.getPlugin("test-plugin")).toEqual(plugin);
  });

  it("应该能够启用插件", async () => {
    const plugin = {
      id: "test",
      name: "Test",
      version: "1.0.0",
      description: "Test",
      author: "Test",
      enabled: false,
    };
    await manager.registerPlugin(plugin);
    await manager.enablePlugin("test");
    expect(manager.getPlugin("test")?.enabled).toBe(true);
  });

  it("应该能够禁用插件", async () => {
    const plugin = {
      id: "test",
      name: "Test",
      version: "1.0.0",
      description: "Test",
      author: "Test",
      enabled: true,
    };
    await manager.registerPlugin(plugin);
    await manager.disablePlugin("test");
    expect(manager.getPlugin("test")?.enabled).toBe(false);
  });

  it("应该能够获取所有插件", async () => {
    await manager.registerPlugin({
      id: "plugin1",
      name: "Plugin 1",
      version: "1.0.0",
      description: "Test",
      author: "Test",
      enabled: true,
    });
    const plugins = manager.getAllPlugins();
    expect(plugins.length).toBe(1);
  });

  it("应该能够更新插件配置", () => {
    manager.registerPlugin({
      id: "test",
      name: "Test",
      version: "1.0.0",
      description: "Test",
      author: "Test",
      enabled: false,
    });
    manager.updatePluginConfig("test", { key: "value" });
    expect(manager.getPlugin("test")?.config?.key).toBe("value");
  });
});

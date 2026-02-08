/**
 * GitManager 测试
 */

import { describe, it, expect } from "vitest";
import { GitManager } from "./GitManager";

describe("GitManager", () => {
  it("应该能够创建GitManager实例", () => {
    const manager = new GitManager("/test/repo");
    expect(manager).toBeDefined();
  });

  it("应该能够获取状态", async () => {
    const manager = new GitManager("/test/repo");
    const status = await manager.getStatus();
    expect(status).toBeDefined();
    expect(status.branch).toBeDefined();
  });

  it("应该能够获取分支列表", async () => {
    const manager = new GitManager("/test/repo");
    const branches = await manager.getBranches();
    expect(Array.isArray(branches)).toBe(true);
  });

  it("应该能够获取提交历史", async () => {
    const manager = new GitManager("/test/repo");
    const commits = await manager.getCommits(10);
    expect(Array.isArray(commits)).toBe(true);
  });
});

/**
 * TemplateEngine 测试
 */

import { describe, it, expect } from "vitest";
import { TemplateEngine } from "./TemplateEngine";

describe("TemplateEngine", () => {
  it("应该能够创建TemplateEngine实例", () => {
    const engine = new TemplateEngine();
    expect(engine).toBeDefined();
  });

  it("应该能够添加模板", () => {
    const engine = new TemplateEngine();
    const template = {
      id: "test-template",
      name: "Test Template",
      description: "A test template",
      category: "test",
      tags: ["test"],
      files: [],
      variables: [],
    };
    engine.addTemplate(template);
    expect(engine.getTemplate("test-template")).toEqual(template);
  });

  it("应该能够渲染模板", () => {
    const engine = new TemplateEngine();
    const result = engine.renderTemplate("Hello {{ name }}!", { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("应该能够验证变量", () => {
    const engine = new TemplateEngine();
    const template = {
      id: "test",
      name: "Test",
      description: "Test",
      category: "test",
      tags: [],
      files: [],
      variables: [{ name: "required", description: "Required var", required: true }],
    };
    const errors = engine.validateVariables(template, {});
    expect(errors.length).toBeGreaterThan(0);
  });
});

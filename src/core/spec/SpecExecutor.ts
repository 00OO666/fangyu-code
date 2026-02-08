/**
 * SpecExecutor - Spec 驱动执行器
 *
 * 实现需求→设计→任务的自动化流程
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import {
  SpecWorkflow,
  SpecStatus,
  RequirementsDoc,
  DesignDoc,
  TaskList,
  TaskItem,
  TaskStatus,
  SpecProgress,
  Requirement,
  CorrectnessProperty,
} from "../types/unified-agent";

// EARS 模式类型
export type EARSPattern =
  | "ubiquitous" // THE <system> SHALL <response>
  | "event-driven" // WHEN <trigger>, THE <system> SHALL <response>
  | "state-driven" // WHILE <condition>, THE <system> SHALL <response>
  | "unwanted" // IF <condition>, THEN THE <system> SHALL <response>
  | "optional" // WHERE <option>, THE <system> SHALL <response>
  | "complex"; // Combination of patterns

// EARS 模式正则表达式
const EARS_PATTERNS: Record<EARSPattern, RegExp> = {
  ubiquitous: /^THE\s+\w+\s+SHALL\s+/i,
  "event-driven": /^WHEN\s+.+,?\s+THE\s+\w+\s+SHALL\s+/i,
  "state-driven": /^WHILE\s+.+,?\s+THE\s+\w+\s+SHALL\s+/i,
  unwanted: /^IF\s+.+,?\s+THEN\s+THE\s+\w+\s+SHALL\s+/i,
  optional: /^WHERE\s+.+,?\s+THE\s+\w+\s+SHALL\s+/i,
  complex: /^(WHERE\s+.+\s+)?(WHILE\s+.+\s+)?(WHEN|IF)\s+.+\s+THE\s+\w+\s+SHALL\s+/i,
};

// 文件系统接口
export interface SpecFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

// Mock 文件系统
export class MockSpecFileSystem implements SpecFileSystem {
  private files: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();

  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }
}

// 事件监听器类型
type ProgressListener = (progress: SpecProgress) => void;

/**
 * SpecExecutor 类
 */
export class SpecExecutor {
  private fs: SpecFileSystem;
  private workflows: Map<string, SpecWorkflow> = new Map();
  private progressListeners: ProgressListener[] = [];
  private specBasePath: string;

  constructor(fs?: SpecFileSystem, basePath: string = ".fangyu/specs") {
    this.fs = fs ?? new MockSpecFileSystem();
    this.specBasePath = basePath;
  }

  // ==========================================================================
  // 工作流管理
  // ==========================================================================

  /**
   * 创建新的 Spec 工作流
   * Requirements: 5.1
   */
  async createSpec(featureName: string, idea: string): Promise<SpecWorkflow> {
    const normalizedName = this.normalizeFeatureName(featureName);
    const specPath = `${this.specBasePath}/${normalizedName}`;

    // 创建目录
    await this.fs.mkdir(specPath);

    const workflow: SpecWorkflow = {
      featureName: normalizedName,
      status: "requirements",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 生成初始需求
    workflow.requirements = await this.generateRequirements(idea);

    // 保存需求文档
    await this.saveRequirements(normalizedName, workflow.requirements);

    this.workflows.set(normalizedName, workflow);
    return workflow;
  }

  /**
   * 加载现有的 Spec 工作流
   * Requirements: 5.1
   */
  async loadSpec(featureName: string): Promise<SpecWorkflow> {
    const normalizedName = this.normalizeFeatureName(featureName);

    // 检查缓存
    if (this.workflows.has(normalizedName)) {
      return this.workflows.get(normalizedName)!;
    }

    const specPath = `${this.specBasePath}/${normalizedName}`;

    // 检查目录是否存在
    const requirementsPath = `${specPath}/requirements.md`;
    const designPath = `${specPath}/design.md`;
    const tasksPath = `${specPath}/tasks.md`;

    const workflow: SpecWorkflow = {
      featureName: normalizedName,
      status: "requirements",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 加载需求文档
    if (await this.fs.exists(requirementsPath)) {
      const content = await this.fs.readFile(requirementsPath);
      workflow.requirements = this.parseRequirementsDoc(content);
      workflow.status = "requirements";
    }

    // 加载设计文档
    if (await this.fs.exists(designPath)) {
      const content = await this.fs.readFile(designPath);
      workflow.design = this.parseDesignDoc(content);
      workflow.status = "design";
    }

    // 加载任务列表
    if (await this.fs.exists(tasksPath)) {
      const content = await this.fs.readFile(tasksPath);
      workflow.tasks = this.parseTaskList(content);
      workflow.status = this.determineStatus(workflow.tasks);
    }

    this.workflows.set(normalizedName, workflow);
    return workflow;
  }

  // ==========================================================================
  // 需求生成
  // ==========================================================================

  /**
   * 生成需求文档
   * Requirements: 5.2
   */
  async generateRequirements(idea: string): Promise<RequirementsDoc> {
    // 从 idea 中提取关键概念
    const concepts = this.extractConcepts(idea);

    // 生成术语表
    const glossary: Record<string, string> = {};
    for (const concept of concepts) {
      glossary[concept] = `${concept} component of the system`;
    }

    // 生成需求
    const requirements: Requirement[] = this.generateRequirementsFromIdea(idea, concepts);

    return {
      introduction: idea,
      glossary,
      requirements,
    };
  }

  /**
   * 验证需求是否符合 EARS 模式
   * Requirements: 5.2
   */
  validateEARSCompliance(criterion: string): {
    valid: boolean;
    pattern?: EARSPattern;
    error?: string;
  } {
    for (const [pattern, regex] of Object.entries(EARS_PATTERNS)) {
      if (regex.test(criterion)) {
        return { valid: true, pattern: pattern as EARSPattern };
      }
    }
    return {
      valid: false,
      error: "Criterion does not match any EARS pattern",
    };
  }

  /**
   * 检测 EARS 模式类型
   */
  detectEARSPattern(criterion: string): EARSPattern | null {
    for (const [pattern, regex] of Object.entries(EARS_PATTERNS)) {
      if (regex.test(criterion)) {
        return pattern as EARSPattern;
      }
    }
    return null;
  }

  // ==========================================================================
  // 设计生成
  // ==========================================================================

  /**
   * 生成设计文档
   * Requirements: 5.3
   */
  async generateDesign(requirements: RequirementsDoc): Promise<DesignDoc> {
    // 从需求中提取组件
    const components = this.extractComponents(requirements);

    // 从需求中提取数据模型
    const dataModels = this.extractDataModels(requirements);

    // 生成正确性属性
    const correctnessProperties = this.generateCorrectnessProperties(requirements);

    return {
      overview: `Design for: ${requirements.introduction}`,
      architecture: this.generateArchitecture(components),
      components,
      dataModels,
      correctnessProperties,
      errorHandling: this.generateErrorHandling(requirements),
      testingStrategy: this.generateTestingStrategy(correctnessProperties),
    };
  }

  // ==========================================================================
  // 任务生成
  // ==========================================================================

  /**
   * 生成任务列表
   * Requirements: 5.4
   */
  async generateTasks(design: DesignDoc): Promise<TaskList> {
    const tasks: TaskItem[] = [];
    let taskId = 1;

    // 为每个组件生成任务
    for (const component of design.components) {
      const componentTask: TaskItem = {
        id: `${taskId}`,
        description: `Implement ${component.name}`,
        status: "pending",
        dependencies: [],
        progress: 0,
        isOptional: false,
        subtasks: [],
        requirements: [],
      };

      // 添加实现子任务
      componentTask.subtasks!.push({
        id: `${taskId}.1`,
        description: `Create ${component.name} core implementation`,
        status: "pending",
        dependencies: [],
        progress: 0,
        isOptional: false,
        requirements: [],
      });

      // 添加测试子任务
      componentTask.subtasks!.push({
        id: `${taskId}.2`,
        description: `Write tests for ${component.name}`,
        status: "pending",
        dependencies: [`${taskId}.1`],
        progress: 0,
        isOptional: true,
        requirements: [],
      });

      tasks.push(componentTask);
      taskId++;
    }

    // 为正确性属性生成测试任务
    for (const property of design.correctnessProperties) {
      tasks.push({
        id: `${taskId}`,
        description: `Property test: ${property.title}`,
        status: "pending",
        dependencies: [],
        progress: 0,
        isOptional: true,
        property: property.id,
        requirements: property.validates,
      });
      taskId++;
    }

    // 添加集成任务
    tasks.push({
      id: `${taskId}`,
      description: "Integration and final testing",
      status: "pending",
      dependencies: tasks.slice(0, -1).map((t) => t.id),
      progress: 0,
      isOptional: false,
      requirements: [],
    });

    return {
      overview: `Implementation plan for: ${design.overview}`,
      tasks,
    };
  }

  /**
   * 验证任务依赖顺序
   * Requirements: 5.4
   */
  validateTaskDependencies(tasks: TaskItem[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const taskIds = new Set(tasks.map((t) => t.id));
    const flatTasks = this.flattenTasks(tasks);

    for (const task of flatTasks) {
      for (const dep of task.dependencies) {
        if (!taskIds.has(dep) && !flatTasks.some((t) => t.id === dep)) {
          errors.push(`Task ${task.id} depends on non-existent task ${dep}`);
        }
      }

      // 检查循环依赖
      if (this.hasCircularDependency(task.id, flatTasks)) {
        errors.push(`Task ${task.id} has circular dependency`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 获取可执行的下一个任务（依赖已满足）
   */
  getNextExecutableTask(tasks: TaskItem[]): TaskItem | null {
    const flatTasks = this.flattenTasks(tasks);
    const completedIds = new Set(
      flatTasks.filter((t) => t.status === "completed").map((t) => t.id)
    );

    for (const task of flatTasks) {
      if (task.status === "pending") {
        const depsCompleted = task.dependencies.every((dep) => completedIds.has(dep));
        if (depsCompleted) {
          return task;
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // 任务执行和追踪
  // ==========================================================================

  /**
   * 更新任务状态
   * Requirements: 5.5
   */
  updateTaskStatus(featureName: string, taskId: string, status: TaskStatus): void {
    const workflow = this.workflows.get(featureName);
    if (!workflow?.tasks) return;

    const task = this.findTask(workflow.tasks.tasks, taskId);
    if (task) {
      task.status = status;
      if (status === "completed") {
        task.progress = 100;
      } else if (status === "in_progress") {
        task.progress = Math.max(task.progress, 10);
      }
      workflow.updatedAt = Date.now();
      this.notifyProgressUpdate(featureName);
    }
  }

  /**
   * 获取进度
   * Requirements: 5.5
   */
  getProgress(featureName: string): SpecProgress {
    const workflow = this.workflows.get(featureName);
    if (!workflow?.tasks) {
      return { totalTasks: 0, completedTasks: 0, inProgressTasks: 0, percentage: 0 };
    }

    const flatTasks = this.flattenTasks(workflow.tasks.tasks);
    const totalTasks = flatTasks.length;
    const completedTasks = flatTasks.filter((t) => t.status === "completed").length;
    const inProgressTasks = flatTasks.filter((t) => t.status === "in_progress").length;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }

  /**
   * 注册进度更新监听器
   */
  onProgressUpdate(callback: ProgressListener): () => void {
    this.progressListeners.push(callback);
    return () => {
      const index = this.progressListeners.indexOf(callback);
      if (index > -1) {
        this.progressListeners.splice(index, 1);
      }
    };
  }

  // ==========================================================================
  // Todo Enforcer
  // ==========================================================================

  /**
   * 检查未完成的任务
   * Requirements: 5.6
   */
  checkIncompleteTasks(featureName: string): TaskItem[] {
    const workflow = this.workflows.get(featureName);
    if (!workflow?.tasks) return [];

    const flatTasks = this.flattenTasks(workflow.tasks.tasks);
    return flatTasks.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled" && !t.isOptional
    );
  }

  /**
   * 获取下一个应该执行的任务
   * Requirements: 5.6
   */
  getNextTask(featureName: string): TaskItem | null {
    const workflow = this.workflows.get(featureName);
    if (!workflow?.tasks) return null;

    return this.getNextExecutableTask(workflow.tasks.tasks);
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  private normalizeFeatureName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  private extractConcepts(idea: string): string[] {
    // 简单的概念提取：提取大写开头的词和技术术语
    const words = idea.split(/\s+/);
    const concepts: string[] = [];

    for (const word of words) {
      const cleaned = word.replace(/[^a-zA-Z]/g, "");
      if (cleaned.length > 3 && /^[A-Z]/.test(cleaned)) {
        concepts.push(cleaned);
      }
    }

    return [...new Set(concepts)];
  }

  private generateRequirementsFromIdea(idea: string, concepts: string[]): Requirement[] {
    const requirements: Requirement[] = [];
    let reqId = 1;

    // 生成基本功能需求
    requirements.push({
      id: `${reqId++}`,
      userStory: `As a user, I want ${idea.toLowerCase()}, so that I can achieve my goals.`,
      acceptanceCriteria: [
        `THE System SHALL provide the core functionality described`,
        `WHEN a user interacts with the system, THE System SHALL respond appropriately`,
      ],
    });

    // 为每个概念生成需求
    for (const concept of concepts.slice(0, 3)) {
      requirements.push({
        id: `${reqId++}`,
        userStory: `As a user, I want to use ${concept}, so that I can leverage its capabilities.`,
        acceptanceCriteria: [
          `THE ${concept} SHALL be available for use`,
          `WHEN ${concept} is invoked, THE System SHALL execute it correctly`,
        ],
      });
    }

    return requirements;
  }

  private extractComponents(
    requirements: RequirementsDoc
  ): Array<{ name: string; description: string; interfaces: string }> {
    const components: Array<{ name: string; description: string; interfaces: string }> = [];

    // 从术语表中提取组件
    for (const [name, description] of Object.entries(requirements.glossary)) {
      components.push({
        name,
        description,
        interfaces: `interface ${name} { /* ... */ }`,
      });
    }

    return components;
  }

  private extractDataModels(
    requirements: RequirementsDoc
  ): Array<{ name: string; definition: string }> {
    const models: Array<{ name: string; definition: string }> = [];

    // 从术语表中提取数据模型
    for (const name of Object.keys(requirements.glossary)) {
      models.push({
        name: `${name}Model`,
        definition: `interface ${name}Model { id: string; /* ... */ }`,
      });
    }

    return models;
  }

  private generateCorrectnessProperties(requirements: RequirementsDoc): CorrectnessProperty[] {
    const properties: CorrectnessProperty[] = [];
    let propId = 1;

    for (const req of requirements.requirements) {
      for (const criterion of req.acceptanceCriteria) {
        const pattern = this.detectEARSPattern(criterion);
        if (pattern) {
          properties.push({
            id: propId++,
            title: `Property from Requirement ${req.id}`,
            description: `For any valid input, ${criterion.toLowerCase()}`,
            validates: [req.id],
          });
        }
      }
    }

    return properties;
  }

  private generateArchitecture(components: Array<{ name: string }>): string {
    const componentList = components.map((c) => c.name).join(", ");
    return `Architecture with components: ${componentList}`;
  }

  private generateErrorHandling(_requirements: RequirementsDoc): string {
    return "Standard error handling with retry and fallback mechanisms";
  }

  private generateTestingStrategy(properties: CorrectnessProperty[]): string {
    return `Property-based testing with ${properties.length} properties using fast-check`;
  }

  private async saveRequirements(
    featureName: string,
    requirements: RequirementsDoc
  ): Promise<void> {
    const content = this.serializeRequirements(requirements);
    await this.fs.writeFile(`${this.specBasePath}/${featureName}/requirements.md`, content);
  }

  private serializeRequirements(requirements: RequirementsDoc): string {
    let content = "# Requirements Document\n\n";
    content += `## Introduction\n\n${requirements.introduction}\n\n`;
    content += "## Glossary\n\n";
    for (const [term, def] of Object.entries(requirements.glossary)) {
      content += `- **${term}**: ${def}\n`;
    }
    content += "\n## Requirements\n\n";
    for (const req of requirements.requirements) {
      content += `### Requirement ${req.id}\n\n`;
      content += `**User Story:** ${req.userStory}\n\n`;
      content += "#### Acceptance Criteria\n\n";
      for (let i = 0; i < req.acceptanceCriteria.length; i++) {
        content += `${i + 1}. ${req.acceptanceCriteria[i]}\n`;
      }
      content += "\n";
    }
    return content;
  }

  private parseRequirementsDoc(content: string): RequirementsDoc {
    // 简化的解析实现
    const introduction = content.match(/## Introduction\n\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() || "";

    const glossary: Record<string, string> = {};
    const glossaryMatch = content.match(/## Glossary\n\n([\s\S]*?)(?=\n## )/);
    if (glossaryMatch) {
      const lines = glossaryMatch[1].split("\n");
      for (const line of lines) {
        const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
        if (match) {
          glossary[match[1]] = match[2];
        }
      }
    }

    const requirements: Requirement[] = [];
    const reqMatches = content.matchAll(
      /### Requirement (\d+)\n\n\*\*User Story:\*\* ([\s\S]*?)(?=\n### |$)/g
    );
    for (const match of reqMatches) {
      const id = match[1];
      const userStory = match[2].split("\n")[0];
      const criteriaMatch = match[2].match(/#### Acceptance Criteria\n\n([\s\S]*?)(?=\n### |$)/);
      const acceptanceCriteria: string[] = [];
      if (criteriaMatch) {
        const lines = criteriaMatch[1].split("\n");
        for (const line of lines) {
          const critMatch = line.match(/^\d+\. (.+)/);
          if (critMatch) {
            acceptanceCriteria.push(critMatch[1]);
          }
        }
      }
      requirements.push({ id, userStory, acceptanceCriteria });
    }

    return { introduction, glossary, requirements };
  }

  private parseDesignDoc(content: string): DesignDoc {
    // 简化的解析实现
    return {
      overview: content.match(/## Overview\n\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() || "",
      architecture: content.match(/## Architecture\n\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() || "",
      components: [],
      dataModels: [],
      correctnessProperties: [],
      errorHandling: "",
      testingStrategy: "",
    };
  }

  private parseTaskList(content: string): TaskList {
    const tasks: TaskItem[] = [];
    const taskMatches = content.matchAll(/- \[([ x])\] (\d+(?:\.\d+)?)\. (.+)/g);

    for (const match of taskMatches) {
      const status: TaskStatus = match[1] === "x" ? "completed" : "pending";
      const id = match[2];
      const description = match[3];

      tasks.push({
        id,
        description,
        status,
        dependencies: [],
        progress: status === "completed" ? 100 : 0,
        isOptional: description.includes("*"),
      });
    }

    return {
      overview: content.match(/## Overview\n\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() || "",
      tasks,
    };
  }

  private determineStatus(tasks: TaskList): SpecStatus {
    const flatTasks = this.flattenTasks(tasks.tasks);
    const allCompleted = flatTasks.every((t) => t.status === "completed" || t.isOptional);
    const anyInProgress = flatTasks.some((t) => t.status === "in_progress");

    if (allCompleted) return "completed";
    if (anyInProgress) return "executing";
    return "tasks";
  }

  private flattenTasks(tasks: TaskItem[]): TaskItem[] {
    const result: TaskItem[] = [];
    for (const task of tasks) {
      result.push(task);
      if (task.subtasks) {
        result.push(...this.flattenTasks(task.subtasks));
      }
    }
    return result;
  }

  private findTask(tasks: TaskItem[], taskId: string): TaskItem | null {
    for (const task of tasks) {
      if (task.id === taskId) return task;
      if (task.subtasks) {
        const found = this.findTask(task.subtasks, taskId);
        if (found) return found;
      }
    }
    return null;
  }

  private hasCircularDependency(
    taskId: string,
    tasks: TaskItem[],
    visited: Set<string> = new Set()
  ): boolean {
    if (visited.has(taskId)) return true;
    visited.add(taskId);

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    for (const dep of task.dependencies) {
      if (this.hasCircularDependency(dep, tasks, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  private notifyProgressUpdate(featureName: string): void {
    const progress = this.getProgress(featureName);
    for (const listener of this.progressListeners) {
      listener(progress);
    }
  }
}

export default SpecExecutor;

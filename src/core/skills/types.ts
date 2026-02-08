/**
 * Fangyu Code Skills System - 类型定义
 *
 * 灵感来源：Claude Code Skills 系统
 * 与 Spec 模式深度集成
 */

// ============================================
// Skill 元数据
// ============================================

export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  compatibility?: string;
  categories?: string[];
  keywords?: string[];
  triggers?: string[]; // 触发关键词
}

// ============================================
// Skill 资源
// ============================================

export interface SkillResource {
  type: "script" | "reference" | "asset" | "template";
  path: string;
  description?: string;
  language?: string;
}

// ============================================
// Skill 工作流步骤
// ============================================

export interface SkillWorkflowStep {
  id: string;
  name: string;
  description: string;
  type: "action" | "question" | "validation" | "generation";
  prompt?: string;
  script?: string;
  inputs?: SkillInput[];
  outputs?: SkillOutput[];
  conditions?: SkillCondition[];
  nextSteps?: string[];
}

export interface SkillInput {
  name: string;
  type: "string" | "number" | "boolean" | "file" | "directory" | "choice";
  description?: string;
  required?: boolean;
  default?: any;
  choices?: string[];
  validation?: string;
}

export interface SkillOutput {
  name: string;
  type: "string" | "file" | "directory" | "json";
  description?: string;
}

export interface SkillCondition {
  type: "file_exists" | "env_var" | "input_match" | "custom";
  value: string;
  operator?: "equals" | "contains" | "matches" | "exists";
  target?: string;
}

// ============================================
// Skill 模式
// ============================================

export type SkillMode = "workflow" | "task" | "reference";

// ============================================
// 完整 Skill 定义
// ============================================

export interface Skill {
  metadata: SkillMetadata;
  mode: SkillMode;
  overview: string;
  quickStart?: string;
  workflow?: SkillWorkflowStep[];
  tasks?: SkillTask[];
  references?: SkillReference[];
  resources: SkillResource[];
  notes?: string[];
  bestPractices?: string[];
  isLoaded?: boolean;
  loadedAt?: number;
  sourcePath?: string;
}

export interface SkillTask {
  id: string;
  name: string;
  description: string;
  instructions: string;
  examples?: string[];
  relatedTasks?: string[];
}

export interface SkillReference {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

// ============================================
// Skill 执行上下文
// ============================================

export interface SkillExecutionContext {
  skill: Skill;
  currentStep?: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  history: SkillExecutionHistoryItem[];
  startedAt: number;
  projectPath?: string;
  engine?: "claude" | "codex" | "gemini";
}

export interface SkillExecutionHistoryItem {
  stepId: string;
  action: string;
  timestamp: number;
  input?: any;
  output?: any;
  error?: string;
}

// ============================================
// Skill 搜索和匹配
// ============================================

export interface SkillMatch {
  skill: Skill;
  score: number;
  matchedKeywords: string[];
  matchedTriggers: string[];
}

export interface SkillSearchOptions {
  query?: string;
  categories?: string[];
  keywords?: string[];
  mode?: SkillMode;
  limit?: number;
}

// ============================================
// Skill 存储位置
// ============================================

export interface SkillLocation {
  type: "global" | "project" | "custom";
  path: string;
}

export const DEFAULT_SKILL_LOCATIONS: SkillLocation[] = [
  { type: "global", path: "~/.fangyu-code/skills" },
  { type: "project", path: ".fangyu/skills" },
];

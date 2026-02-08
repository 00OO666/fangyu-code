/**
 * SkillParser - 解析 SKILL.md 文件
 *
 * 支持 Claude Code 风格的 SKILL.md 格式：
 * - YAML Front Matter (name, description, etc.)
 * - Markdown 内容 (概述、工作流、任务等)
 */

import type {
  Skill,
  SkillMetadata,
  SkillMode,
  SkillWorkflowStep,
  SkillTask,
  SkillReference,
  SkillResource,
} from "./types";

// ============================================
// YAML Front Matter 解析
// ============================================

interface ParsedFrontMatter {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  compatibility?: string;
  metadata?: {
    categories?: string[];
    keywords?: string[];
    version?: string;
    author?: string;
  };
}

function parseFrontMatter(content: string): { frontMatter: ParsedFrontMatter; body: string } {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];

  // 简单的 YAML 解析（不依赖外部库）
  const frontMatter: ParsedFrontMatter = {};
  const lines = yamlContent.split("\n");
  let inArray = false;
  let arrayKey = "";
  let arrayValues: string[] = [];
  let currentKey = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // 数组项
    if (trimmed.startsWith("- ")) {
      if (inArray) {
        arrayValues.push(trimmed.slice(2).trim());
      }
      continue;
    }

    // 结束数组
    if (inArray && !trimmed.startsWith("- ")) {
      (frontMatter as any)[arrayKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }

    // 键值对
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value === "" || value === "|") {
        // 可能是数组或多行字符串
        inArray = true;
        arrayKey = key;
        arrayValues = [];
      } else {
        // 移除引号
        const cleanValue = value.replace(/^["']|["']$/g, "");
        (frontMatter as any)[key] = cleanValue;
      }
      currentKey = key;
    }
  }

  // 处理最后的数组
  if (inArray && arrayValues.length > 0) {
    (frontMatter as any)[arrayKey] = arrayValues;
  }

  return { frontMatter, body };
}

// ============================================
// Markdown 内容解析
// ============================================

interface ParsedSection {
  title: string;
  level: number;
  content: string;
  subsections: ParsedSection[];
}

function parseMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split("\n");
  const sections: ParsedSection[] = [];
  const stack: ParsedSection[] = [];

  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      // 保存之前的内容
      if (stack.length > 0) {
        stack[stack.length - 1].content = currentContent.join("\n").trim();
      }
      currentContent = [];

      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      const newSection: ParsedSection = {
        title,
        level,
        content: "",
        subsections: [],
      };

      // 找到正确的父级
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        sections.push(newSection);
      } else {
        stack[stack.length - 1].subsections.push(newSection);
      }

      stack.push(newSection);
    } else {
      currentContent.push(line);
    }
  }

  // 保存最后的内容
  if (stack.length > 0) {
    stack[stack.length - 1].content = currentContent.join("\n").trim();
  }

  return sections;
}

// ============================================
// 工作流步骤解析
// ============================================

function parseWorkflowSteps(sections: ParsedSection[]): SkillWorkflowStep[] {
  const steps: SkillWorkflowStep[] = [];
  let stepIndex = 0;

  for (const section of sections) {
    // 查找 "步骤" 或 "Step" 开头的章节
    const stepMatch = section.title.match(/^(?:步骤|Step)\s*(\d+)?[:\s]*(.+)?$/i);
    if (stepMatch) {
      stepIndex++;
      const step: SkillWorkflowStep = {
        id: `step-${stepIndex}`,
        name: stepMatch[2] || section.title,
        description: section.content,
        type: "action",
        nextSteps: stepIndex < sections.length ? [`step-${stepIndex + 1}`] : [],
      };

      // 从内容中提取更多信息
      if (section.content.includes("```")) {
        step.type = "generation";
      }
      if (
        section.title.toLowerCase().includes("验证") ||
        section.title.toLowerCase().includes("valid")
      ) {
        step.type = "validation";
      }
      if (section.title.includes("?") || section.title.toLowerCase().includes("询问")) {
        step.type = "question";
      }

      steps.push(step);
    }

    // 递归处理子章节
    if (section.subsections.length > 0) {
      steps.push(...parseWorkflowSteps(section.subsections));
    }
  }

  return steps;
}

// ============================================
// 任务解析
// ============================================

function parseTasks(sections: ParsedSection[]): SkillTask[] {
  const tasks: SkillTask[] = [];
  let taskIndex = 0;

  for (const section of sections) {
    // 查找 "任务" 或 "Task" 开头的章节
    const taskMatch = section.title.match(/^(?:任务|Task)\s*(\d+)?[:\s]*(.+)?$/i);
    if (taskMatch) {
      taskIndex++;
      const task: SkillTask = {
        id: `task-${taskIndex}`,
        name: taskMatch[2] || section.title,
        description: section.content.split("\n")[0] || "",
        instructions: section.content,
        examples: extractCodeBlocks(section.content),
      };
      tasks.push(task);
    }

    // 递归处理子章节
    if (section.subsections.length > 0) {
      tasks.push(...parseTasks(section.subsections));
    }
  }

  return tasks;
}

// ============================================
// 参考文档解析
// ============================================

function parseReferences(sections: ParsedSection[]): SkillReference[] {
  const refs: SkillReference[] = [];
  let refIndex = 0;

  for (const section of sections) {
    // 查找 "参考" 或 "Reference" 相关章节
    if (section.title.match(/参考|reference|规范|standard/i)) {
      for (const sub of section.subsections) {
        refIndex++;
        refs.push({
          id: `ref-${refIndex}`,
          title: sub.title,
          content: sub.content,
          category: section.title,
        });
      }

      // 如果没有子章节，整个章节作为一个参考
      if (section.subsections.length === 0 && section.content) {
        refIndex++;
        refs.push({
          id: `ref-${refIndex}`,
          title: section.title,
          content: section.content,
        });
      }
    }
  }

  return refs;
}

// ============================================
// 辅助函数
// ============================================

function extractCodeBlocks(content: string): string[] {
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }

  return blocks;
}

function detectSkillMode(sections: ParsedSection[]): SkillMode {
  const allTitles = getAllTitles(sections).map((t) => t.toLowerCase());

  // 检查是否有工作流相关章节
  if (
    allTitles.some((t) => t.includes("工作流") || t.includes("workflow") || t.match(/步骤|step/))
  ) {
    return "workflow";
  }

  // 检查是否有任务相关章节
  if (allTitles.some((t) => t.includes("任务") || t.includes("task"))) {
    return "task";
  }

  // 检查是否有参考/规范相关章节
  if (allTitles.some((t) => t.includes("参考") || t.includes("reference") || t.includes("规范"))) {
    return "reference";
  }

  return "task"; // 默认
}

function getAllTitles(sections: ParsedSection[]): string[] {
  const titles: string[] = [];
  for (const section of sections) {
    titles.push(section.title);
    titles.push(...getAllTitles(section.subsections));
  }
  return titles;
}

function findSectionByTitle(sections: ParsedSection[], pattern: RegExp): ParsedSection | undefined {
  for (const section of sections) {
    if (pattern.test(section.title)) {
      return section;
    }
    const found = findSectionByTitle(section.subsections, pattern);
    if (found) return found;
  }
  return undefined;
}

// ============================================
// 主解析函数
// ============================================

export function parseSkillFile(content: string, sourcePath?: string): Skill {
  const { frontMatter, body } = parseFrontMatter(content);
  const sections = parseMarkdownSections(body);

  // 构建元数据
  const metadata: SkillMetadata = {
    name: frontMatter.name || "unnamed-skill",
    description: frontMatter.description || "",
    version: frontMatter.metadata?.version || frontMatter.version || "1.0.0",
    author: frontMatter.metadata?.author || frontMatter.author,
    license: frontMatter.license,
    compatibility: frontMatter.compatibility,
    categories: frontMatter.metadata?.categories || [],
    keywords: frontMatter.metadata?.keywords || [],
    triggers: extractTriggers(frontMatter.description || "", sections),
  };

  // 检测模式
  const mode = detectSkillMode(sections);

  // 提取概述
  const overviewSection = findSectionByTitle(sections, /概述|overview|简介|introduction/i);
  const overview = overviewSection?.content || sections[0]?.content || "";

  // 提取快速开始
  const quickStartSection = findSectionByTitle(
    sections,
    /快速开始|quick\s*start|getting\s*started/i
  );
  const quickStart = quickStartSection?.content;

  // 根据模式解析内容
  const workflow = mode === "workflow" ? parseWorkflowSteps(sections) : undefined;
  const tasks = mode === "task" ? parseTasks(sections) : undefined;
  const references = mode === "reference" ? parseReferences(sections) : undefined;

  // 提取资源引用
  const resources = extractResources(body);

  // 提取注意事项
  const notesSection = findSectionByTitle(sections, /注意|notes|警告|warning/i);
  const notes = notesSection ? extractListItems(notesSection.content) : undefined;

  // 提取最佳实践
  const bestPracticesSection = findSectionByTitle(sections, /最佳实践|best\s*practice/i);
  const bestPractices = bestPracticesSection
    ? extractListItems(bestPracticesSection.content)
    : undefined;

  return {
    metadata,
    mode,
    overview,
    quickStart,
    workflow,
    tasks,
    references,
    resources,
    notes,
    bestPractices,
    isLoaded: true,
    loadedAt: Date.now(),
    sourcePath,
  };
}

function extractTriggers(description: string, sections: ParsedSection[]): string[] {
  const triggers: string[] = [];

  // 从描述中提取触发词
  const triggerPatterns = [/当用户说[""「](.+?)[""」]/g, /当用户需要(.+?)时/g, /触发[：:]\s*(.+)/g];

  for (const pattern of triggerPatterns) {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      triggers.push(match[1].trim());
    }
  }

  // 从触发条件章节提取
  const triggerSection = findSectionByTitle(sections, /触发|trigger/i);
  if (triggerSection) {
    const items = extractListItems(triggerSection.content);
    triggers.push(...items);
  }

  return [...new Set(triggers)]; // 去重
}

function extractResources(content: string): SkillResource[] {
  const resources: SkillResource[] = [];

  // 匹配资源引用模式
  const patterns = [
    /`(scripts\/[^`]+)`/g,
    /`(references\/[^`]+)`/g,
    /`(assets\/[^`]+)`/g,
    /`(templates\/[^`]+)`/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const path = match[1];
      const type = path.split("/")[0].replace(/s$/, "") as SkillResource["type"];
      resources.push({ type, path });
    }
  }

  return resources;
}

function extractListItems(content: string): string[] {
  const items: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^[-*]\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
  }

  return items;
}

export default parseSkillFile;

/**
 * SkillManager - Skills 管理器
 * 
 * 功能：
 * 1. 加载和管理 Skills（全局 + 项目级）
 * 2. 关键词匹配和自动触发
 * 3. 与 Spec 模式集成
 */

import type {
  Skill,
  SkillMatch,
  SkillSearchOptions,
  SkillLocation,
  SkillExecutionContext,
} from './types';
import { parseSkillFile } from './SkillParser';

// ============================================
// SkillManager 配置
// ============================================

export interface SkillManagerConfig {
  locations: SkillLocation[];
  autoTrigger: boolean;  // 是否自动触发
  cacheEnabled: boolean;
  maxCacheAge: number;   // 缓存过期时间（毫秒）
}

export const DEFAULT_SKILL_MANAGER_CONFIG: SkillManagerConfig = {
  locations: [
    { type: 'global', path: '~/.fangyu-code/skills' },
    { type: 'project', path: '.fangyu/skills' },
  ],
  autoTrigger: true,
  cacheEnabled: true,
  maxCacheAge: 5 * 60 * 1000, // 5 分钟
};

// ============================================
// SkillManager 类
// ============================================

export class SkillManager {
  private config: SkillManagerConfig;
  private skills: Map<string, Skill> = new Map();
  private lastLoadTime: number = 0;
  private projectPath?: string;

  // 文件系统操作回调（由 Tauri 注入）
  private fsReadFile?: (path: string) => Promise<string>;
  private fsReadDir?: (path: string) => Promise<string[]>;
  private fsExists?: (path: string) => Promise<boolean>;

  constructor(config: Partial<SkillManagerConfig> = {}) {
    this.config = { ...DEFAULT_SKILL_MANAGER_CONFIG, ...config };
  }

  /**
   * 初始化文件系统操作
   */
  initFileSystem(fs: {
    readFile: (path: string) => Promise<string>;
    readDir: (path: string) => Promise<string[]>;
    exists: (path: string) => Promise<boolean>;
  }) {
    this.fsReadFile = fs.readFile;
    this.fsReadDir = fs.readDir;
    this.fsExists = fs.exists;
  }

  /**
   * 设置当前项目路径
   */
  setProjectPath(path: string) {
    this.projectPath = path;
    // 项目切换时清除缓存
    this.skills.clear();
    this.lastLoadTime = 0;
  }

  /**
   * 🔄 加载所有 Skills
   */
  async loadSkills(): Promise<Skill[]> {
    if (!this.fsReadFile || !this.fsReadDir || !this.fsExists) {
      console.warn('[SkillManager] File system not initialized');
      return [];
    }

    // 检查缓存
    if (this.config.cacheEnabled && this.skills.size > 0) {
      const cacheAge = Date.now() - this.lastLoadTime;
      if (cacheAge < this.config.maxCacheAge) {
        return Array.from(this.skills.values());
      }
    }

    this.skills.clear();
    const loadedSkills: Skill[] = [];

    for (const location of this.config.locations) {
      const resolvedPath = this.resolvePath(location.path);

      try {
        const exists = await this.fsExists(resolvedPath);
        if (!exists) continue;

        const entries = await this.fsReadDir(resolvedPath);

        for (const entry of entries) {
          const skillPath = `${resolvedPath}/${entry}`;
          const skillFile = `${skillPath}/SKILL.md`;

          try {
            const skillFileExists = await this.fsExists(skillFile);
            if (!skillFileExists) continue;

            const content = await this.fsReadFile(skillFile);
            const skill = parseSkillFile(content, skillPath);

            // 使用 name 作为 key，项目级覆盖全局
            this.skills.set(skill.metadata.name, skill);
            loadedSkills.push(skill);

            console.log(`[SkillManager] Loaded skill: ${skill.metadata.name} from ${location.type}`);
          } catch (err) {
            console.warn(`[SkillManager] Failed to load skill from ${skillPath}:`, err);
          }
        }
      } catch (err) {
        console.warn(`[SkillManager] Failed to read directory ${resolvedPath}:`, err);
      }
    }

    this.lastLoadTime = Date.now();
    console.log(`[SkillManager] Loaded ${loadedSkills.length} skills`);

    return loadedSkills;
  }

  /**
   * 🔍 根据用户输入匹配 Skills
   */
  async matchSkills(userInput: string): Promise<SkillMatch[]> {
    await this.loadSkills();

    const matches: SkillMatch[] = [];
    const inputLower = userInput.toLowerCase();
    const inputWords = inputLower.split(/\s+/);

    for (const skill of this.skills.values()) {
      let score = 0;
      const matchedKeywords: string[] = [];
      const matchedTriggers: string[] = [];

      // 检查触发词
      for (const trigger of skill.metadata.triggers || []) {
        const triggerLower = trigger.toLowerCase();
        if (inputLower.includes(triggerLower)) {
          score += 10;
          matchedTriggers.push(trigger);
        }
      }

      // 检查关键词
      for (const keyword of skill.metadata.keywords || []) {
        const keywordLower = keyword.toLowerCase();
        if (inputLower.includes(keywordLower)) {
          score += 5;
          matchedKeywords.push(keyword);
        }
      }

      // 检查名称
      if (inputLower.includes(skill.metadata.name.toLowerCase())) {
        score += 8;
      }

      // 检查描述中的词
      const descWords = (skill.metadata.description || '').toLowerCase().split(/\s+/);
      for (const word of inputWords) {
        if (word.length > 2 && descWords.includes(word)) {
          score += 2;
        }
      }

      if (score > 0) {
        matches.push({
          skill,
          score,
          matchedKeywords,
          matchedTriggers
        });
      }
    }

    // 按分数排序
    matches.sort((a, b) => b.score - a.score);

    return matches;
  }

  /**
   * 🎯 获取最佳匹配的 Skill
   */
  async getBestMatch(userInput: string, minScore: number = 5): Promise<Skill | null> {
    const matches = await this.matchSkills(userInput);

    if (matches.length > 0 && matches[0].score >= minScore) {
      return matches[0].skill;
    }

    return null;
  }

  /**
   * 📋 搜索 Skills
   */
  async searchSkills(options: SkillSearchOptions): Promise<Skill[]> {
    await this.loadSkills();

    let results = Array.from(this.skills.values());

    // 按查询过滤
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      results = results.filter(skill =>
        skill.metadata.name.toLowerCase().includes(queryLower) ||
        skill.metadata.description.toLowerCase().includes(queryLower) ||
        skill.overview.toLowerCase().includes(queryLower)
      );
    }

    // 按分类过滤
    if (options.categories?.length) {
      results = results.filter(skill =>
        skill.metadata.categories?.some(c => options.categories!.includes(c))
      );
    }

    // 按关键词过滤
    if (options.keywords?.length) {
      results = results.filter(skill =>
        skill.metadata.keywords?.some(k => options.keywords!.includes(k))
      );
    }

    // 按模式过滤
    if (options.mode) {
      results = results.filter(skill => skill.mode === options.mode);
    }

    // 限制数量
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 📖 获取单个 Skill
   */
  async getSkill(name: string): Promise<Skill | null> {
    await this.loadSkills();
    return this.skills.get(name) || null;
  }

  /**
   * 📋 获取所有 Skills 列表
   */
  async listSkills(): Promise<Skill[]> {
    await this.loadSkills();
    return Array.from(this.skills.values());
  }

  /**
   * 🚀 创建执行上下文
   */
  createExecutionContext(skill: Skill): SkillExecutionContext {
    return {
      skill,
      inputs: {},
      outputs: {},
      history: [],
      startedAt: Date.now(),
      projectPath: this.projectPath
    };
  }

  /**
   * 📝 生成 Skill 的 Prompt 注入
   */
  generatePromptInjection(skill: Skill): string {
    const parts: string[] = [];

    parts.push(`## 当前激活的 Skill: ${skill.metadata.name}`);
    parts.push('');
    parts.push(`**描述**: ${skill.metadata.description}`);
    parts.push('');
    parts.push('### 概述');
    parts.push(skill.overview);

    if (skill.quickStart) {
      parts.push('');
      parts.push('### 快速开始');
      parts.push(skill.quickStart);
    }

    if (skill.workflow?.length) {
      parts.push('');
      parts.push('### 工作流程');
      for (const step of skill.workflow) {
        parts.push(`**${step.name}**: ${step.description}`);
      }
    }

    if (skill.tasks?.length) {
      parts.push('');
      parts.push('### 可用任务');
      for (const task of skill.tasks) {
        parts.push(`- **${task.name}**: ${task.description}`);
      }
    }

    if (skill.notes?.length) {
      parts.push('');
      parts.push('### 注意事项');
      for (const note of skill.notes) {
        parts.push(`- ${note}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 🔧 解析路径（处理 ~ 和相对路径）
   */
  private resolvePath(path: string): string {
    if (path.startsWith('~')) {
      // 在 Tauri 中，这需要通过 Rust 获取 home 目录
      // 这里先返回原始路径，实际使用时由 Tauri 处理
      return path;
    }

    if (path.startsWith('.') && this.projectPath) {
      return `${this.projectPath}/${path}`;
    }

    return path;
  }

  /**
   * 🔄 刷新缓存
   */
  async refresh(): Promise<void> {
    this.skills.clear();
    this.lastLoadTime = 0;
    await this.loadSkills();
  }

  /**
   * 📊 获取统计信息
   */
  getStats(): {
    totalSkills: number;
    byMode: Record<string, number>;
    byCategory: Record<string, number>;
    lastLoadTime: number;
  } {
    const byMode: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const skill of this.skills.values()) {
      byMode[skill.mode] = (byMode[skill.mode] || 0) + 1;

      for (const category of skill.metadata.categories || []) {
        byCategory[category] = (byCategory[category] || 0) + 1;
      }
    }

    return {
      totalSkills: this.skills.size,
      byMode,
      byCategory,
      lastLoadTime: this.lastLoadTime
    };
  }
}

// 导出单例
export const skillManager = new SkillManager();

export default SkillManager;

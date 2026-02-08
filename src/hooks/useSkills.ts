/**
 * useSkills - Skills 系统 React Hook
 *
 * 提供 Skills 的加载、搜索、匹配功能
 */

import { logger } from "@/lib/logger";
import { useState, useEffect, useCallback, useMemo } from "react";
import { readTextFile, readDir, exists } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import { SkillManager, type Skill, type SkillMatch, type SkillSearchOptions } from "../core/skills";

// ============================================
// Hook 状态类型
// ============================================

interface UseSkillsState {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  lastMatch: SkillMatch | null;
}

interface UseSkillsReturn extends UseSkillsState {
  // 操作方法
  loadSkills: () => Promise<void>;
  searchSkills: (options: SkillSearchOptions) => Promise<Skill[]>;
  matchInput: (input: string) => Promise<SkillMatch[]>;
  getBestMatch: (input: string) => Promise<Skill | null>;
  getSkill: (name: string) => Skill | undefined;
  generatePrompt: (skill: Skill) => string;
  refresh: () => Promise<void>;

  // 统计
  stats: {
    total: number;
    byMode: Record<string, number>;
  };
}

// ============================================
// Hook 实现
// ============================================

export function useSkills(projectPath?: string): UseSkillsReturn {
  const [state, setState] = useState<UseSkillsState>({
    skills: [],
    loading: false,
    error: null,
    lastMatch: null,
  });

  // 创建 SkillManager 实例
  const manager = useMemo(() => {
    const m = new SkillManager();
    return m;
  }, []);

  // 初始化文件系统
  useEffect(() => {
    const initFs = async () => {
      try {
        const home = await homeDir();

        manager.initFileSystem({
          readFile: async (path: string) => {
            // 处理 ~ 路径
            const resolvedPath = path.startsWith("~") ? path.replace("~", home) : path;
            return await readTextFile(resolvedPath);
          },
          readDir: async (path: string) => {
            const resolvedPath = path.startsWith("~") ? path.replace("~", home) : path;
            const entries = await readDir(resolvedPath);
            return entries.filter((e) => e.isDirectory).map((e) => e.name);
          },
          exists: async (path: string) => {
            const resolvedPath = path.startsWith("~") ? path.replace("~", home) : path;
            return await exists(resolvedPath);
          },
        });
      } catch (err) {
        logger.error("useSkills", "[useSkills] Failed to init file system:", err);
      }
    };

    initFs();
  }, [manager]);

  // 设置项目路径
  useEffect(() => {
    if (projectPath) {
      manager.setProjectPath(projectPath);
    }
  }, [projectPath, manager]);

  // 加载 Skills
  const loadSkills = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const skills = await manager.loadSkills();
      setState((prev) => ({ ...prev, skills, loading: false }));
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to load skills";
      setState((prev) => ({ ...prev, error, loading: false }));
    }
  }, [manager]);

  // 搜索 Skills
  const searchSkills = useCallback(
    async (options: SkillSearchOptions): Promise<Skill[]> => {
      return await manager.searchSkills(options);
    },
    [manager]
  );

  // 匹配用户输入
  const matchInput = useCallback(
    async (input: string): Promise<SkillMatch[]> => {
      const matches = await manager.matchSkills(input);

      if (matches.length > 0) {
        setState((prev) => ({ ...prev, lastMatch: matches[0] }));
      }

      return matches;
    },
    [manager]
  );

  // 获取最佳匹配
  const getBestMatch = useCallback(
    async (input: string): Promise<Skill | null> => {
      return await manager.getBestMatch(input);
    },
    [manager]
  );

  // 获取单个 Skill
  const getSkill = useCallback(
    (name: string): Skill | undefined => {
      return state.skills.find((s) => s.metadata.name === name);
    },
    [state.skills]
  );

  // 生成 Prompt
  const generatePrompt = useCallback(
    (skill: Skill): string => {
      return manager.generatePromptInjection(skill);
    },
    [manager]
  );

  // 刷新
  const refresh = useCallback(async () => {
    await manager.refresh();
    await loadSkills();
  }, [manager, loadSkills]);

  // 统计信息
  const stats = useMemo(() => {
    const byMode: Record<string, number> = {};

    for (const skill of state.skills) {
      byMode[skill.mode] = (byMode[skill.mode] || 0) + 1;
    }

    return {
      total: state.skills.length,
      byMode,
    };
  }, [state.skills]);

  // 初始加载
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  return {
    ...state,
    loadSkills,
    searchSkills,
    matchInput,
    getBestMatch,
    getSkill,
    generatePrompt,
    refresh,
    stats,
  };
}

export default useSkills;

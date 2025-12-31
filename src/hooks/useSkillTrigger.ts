/**
 * useSkillTrigger - 技能自动触发 Hook
 *
 * 功能:
 * - 监听用户输入，自动检测技能触发词
 * - 支持 /command 格式触发
 * - 支持关键词匹配触发
 * - 提供触发建议和自动补全
 *
 * 来源: Claude Code Slash Commands + Cursor Custom Commands
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

export interface SkillInfo {
  name: string;
  path: string;
  description?: string;
  triggers: string[];
  content?: string;
}

export interface TriggerMatch {
  skill: SkillInfo;
  trigger: string;
  matchType: 'exact' | 'prefix' | 'keyword';
  score: number;
}

export interface TriggerSuggestion {
  trigger: string;
  skill: SkillInfo;
  description?: string;
}

// ============================================================
// Hook
// ============================================================

interface UseSkillTriggerOptions {
  /** 项目路径 */
  projectPath?: string;
  /** 是否启用自动触发 */
  enabled?: boolean;
  /** 是否显示建议 */
  showSuggestions?: boolean;
  /** 最大建议数量 */
  maxSuggestions?: number;
}

export function useSkillTrigger(options: UseSkillTriggerOptions = {}) {
  const {
    projectPath,
    enabled = true,
    showSuggestions = true,
    maxSuggestions = 5,
  } = options;

  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TriggerSuggestion[]>([]);
  const lastInputRef = useRef<string>('');

  // 加载技能列表
  const loadSkills = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const result = await api.listAgentSkills(projectPath);

      const skillInfos: SkillInfo[] = await Promise.all(
        result.map(async (s: any) => {
          let content = '';
          try {
            content = await api.readSkill(s.path);
          } catch {
            // 忽略读取错误
          }

          // 提取触发词
          const triggers = extractTriggers(s.name, content);

          return {
            name: s.name,
            path: s.path,
            description: s.description || extractDescription(content),
            triggers,
            content,
          };
        })
      );

      setSkills(skillInfos);
    } catch (error) {
      console.error('加载技能失败:', error);
    } finally {
      setLoading(false);
    }
  }, [projectPath, enabled]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // 从内容中提取触发词
  const extractTriggers = (name: string, content: string): string[] => {
    const triggers: string[] = [];

    // 默认触发词：/skill-name
    triggers.push(`/${name}`);

    // 从内容中提取 triggers: [...] 格式
    const triggerMatch = content.match(/triggers?:\s*\[([^\]]+)\]/i);
    if (triggerMatch) {
      const extracted = triggerMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/['"]/g, ''))
        .filter((t) => t.length > 0);
      triggers.push(...extracted);
    }

    // 提取内容中的 /command 格式
    const commandMatches = content.match(/\/[a-z][a-z0-9-]*/gi);
    if (commandMatches) {
      triggers.push(...commandMatches);
    }

    return [...new Set(triggers)];
  };

  // 提取描述
  const extractDescription = (content: string): string => {
    const match = content.match(/^#\s+(.+?)(?:\n|$)/m);
    return match ? match[1].trim() : '';
  };

  /**
   * 检测输入中的技能触发
   */
  const detectTrigger = useCallback(
    (input: string): TriggerMatch | null => {
      if (!enabled || !input) return null;

      const trimmed = input.trim();

      // 检查精确匹配 /command
      if (trimmed.startsWith('/')) {
        const command = trimmed.split(/\s+/)[0].toLowerCase();

        for (const skill of skills) {
          for (const trigger of skill.triggers) {
            if (trigger.toLowerCase() === command) {
              return {
                skill,
                trigger,
                matchType: 'exact',
                score: 100,
              };
            }
          }
        }
      }

      // 检查前缀匹配
      for (const skill of skills) {
        for (const trigger of skill.triggers) {
          if (trimmed.toLowerCase().startsWith(trigger.toLowerCase())) {
            return {
              skill,
              trigger,
              matchType: 'prefix',
              score: 80,
            };
          }
        }
      }

      return null;
    },
    [skills, enabled]
  );

  /**
   * 获取触发建议
   */
  const getSuggestions = useCallback(
    (input: string): TriggerSuggestion[] => {
      if (!showSuggestions || !input) return [];

      const trimmed = input.trim().toLowerCase();

      // 只在输入 / 开头时提供建议
      if (!trimmed.startsWith('/')) return [];

      const query = trimmed.slice(1); // 移除 /

      const matches: TriggerSuggestion[] = [];

      for (const skill of skills) {
        for (const trigger of skill.triggers) {
          const triggerLower = trigger.toLowerCase().replace(/^\//, '');

          // 前缀匹配
          if (triggerLower.startsWith(query) || query.length === 0) {
            matches.push({
              trigger,
              skill,
              description: skill.description,
            });
          }
          // 模糊匹配
          else if (triggerLower.includes(query)) {
            matches.push({
              trigger,
              skill,
              description: skill.description,
            });
          }
        }
      }

      // 去重并排序
      const uniqueMatches = Array.from(
        new Map(matches.map((m) => [m.trigger, m])).values()
      );

      // 按匹配程度排序
      uniqueMatches.sort((a, b) => {
        const aStarts = a.trigger.toLowerCase().startsWith('/' + query);
        const bStarts = b.trigger.toLowerCase().startsWith('/' + query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.trigger.length - b.trigger.length;
      });

      return uniqueMatches.slice(0, maxSuggestions);
    },
    [skills, showSuggestions, maxSuggestions]
  );

  /**
   * 处理输入变化
   */
  const handleInputChange = useCallback(
    (input: string) => {
      lastInputRef.current = input;

      if (showSuggestions) {
        const newSuggestions = getSuggestions(input);
        setSuggestions(newSuggestions);
      }
    },
    [getSuggestions, showSuggestions]
  );

  /**
   * 应用触发建议
   */
  const applySuggestion = useCallback(
    (
      suggestion: TriggerSuggestion,
      currentInput: string
    ): { newInput: string; skill: SkillInfo } => {
      // 替换当前的 /xxx 为完整触发词
      const parts = currentInput.split(/\s+/);
      parts[0] = suggestion.trigger;

      return {
        newInput: parts.join(' '),
        skill: suggestion.skill,
      };
    },
    []
  );

  /**
   * 执行技能
   */
  const executeSkill = useCallback(
    async (
      skill: SkillInfo,
      args?: string
    ): Promise<{ success: boolean; content: string }> => {
      try {
        // 读取技能内容
        const content = skill.content || (await api.readSkill(skill.path));

        // 返回技能内容，让调用方决定如何使用
        return {
          success: true,
          content: args ? `${content}\n\n用户参数: ${args}` : content,
        };
      } catch (error) {
        console.error('执行技能失败:', error);
        return {
          success: false,
          content: `执行技能 ${skill.name} 失败: ${error}`,
        };
      }
    },
    []
  );

  /**
   * 解析输入并提取技能和参数
   */
  const parseInput = useCallback(
    (
      input: string
    ): { skill: SkillInfo | null; args: string; remainingInput: string } => {
      const match = detectTrigger(input);

      if (!match) {
        return { skill: null, args: '', remainingInput: input };
      }

      // 提取参数（触发词之后的内容）
      const triggerEnd = input.toLowerCase().indexOf(match.trigger.toLowerCase()) + match.trigger.length;
      const args = input.slice(triggerEnd).trim();

      return {
        skill: match.skill,
        args,
        remainingInput: args,
      };
    },
    [detectTrigger]
  );

  /**
   * 获取所有可用触发词
   */
  const allTriggers = useMemo(() => {
    const triggers: string[] = [];
    for (const skill of skills) {
      triggers.push(...skill.triggers);
    }
    return [...new Set(triggers)].sort();
  }, [skills]);

  /**
   * 按触发词查找技能
   */
  const findSkillByTrigger = useCallback(
    (trigger: string): SkillInfo | null => {
      const normalizedTrigger = trigger.toLowerCase();

      for (const skill of skills) {
        if (skill.triggers.some((t) => t.toLowerCase() === normalizedTrigger)) {
          return skill;
        }
      }

      return null;
    },
    [skills]
  );

  return {
    // 状态
    skills,
    loading,
    suggestions,
    allTriggers,

    // 方法
    loadSkills,
    detectTrigger,
    getSuggestions,
    handleInputChange,
    applySuggestion,
    executeSkill,
    parseInput,
    findSkillByTrigger,
  };
}

export default useSkillTrigger;

/**
 * useMentionParser - @mention 解析器 Hook
 *
 * 功能:
 * - 解析提示词中的 @subagent 语法
 * - 提供自动完成建议
 * - 支持多种mention类型（子代理、技能、文件等）
 *
 * 语法:
 * - @subagent:name - 调用子代理
 * - @skill:name - 调用技能
 * - @file:path - 引用文件
 *
 * 来源: Claude Code @mention + Cursor @ References
 */

import { logger } from "@/lib/logger";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// ============================================================
// 类型定义
// ============================================================

export type MentionType = "subagent" | "skill" | "file" | "command";

export interface Mention {
  type: MentionType;
  name: string;
  fullMatch: string;
  startIndex: number;
  endIndex: number;
}

export interface MentionSuggestion {
  type: MentionType;
  name: string;
  description?: string;
  icon?: string;
}

export interface ParsedPrompt {
  /** 原始提示词 */
  original: string;
  /** 清理后的提示词（移除mention语法） */
  cleaned: string;
  /** 解析出的mentions */
  mentions: Mention[];
  /** 是否有效 */
  isValid: boolean;
  /** 验证错误 */
  errors: string[];
}

// ============================================================
// 正则表达式
// ============================================================

// 匹配 @type:name 格式
const MENTION_REGEX = /@(subagent|skill|file|command):([a-zA-Z0-9_\-./]+)/g;

// 匹配正在输入的mention（用于自动完成）
const PARTIAL_MENTION_REGEX = /@([a-zA-Z]*)(?::([a-zA-Z0-9_\-./]*))?$/;

// ============================================================
// Hook
// ============================================================

interface UseMentionParserOptions {
  /** 是否启用验证 */
  enableValidation?: boolean;
  /** 是否加载建议数据 */
  loadSuggestions?: boolean;
}

export function useMentionParser(options: UseMentionParserOptions = {}) {
  const { enableValidation = true, loadSuggestions = true } = options;

  const [subagents, setSubagents] = useState<MentionSuggestion[]>([]);
  const [skills, setSkills] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载可用的子代理和技能
  useEffect(() => {
    if (!loadSuggestions) return;

    const load = async () => {
      setLoading(true);
      try {
        const [subagentList, skillList] = await Promise.all([
          api.listSubagents().catch(() => []),
          api.listAgentSkills().catch(() => []),
        ]);

        setSubagents(
          subagentList.map((s: any) => ({
            type: "subagent" as MentionType,
            name: s.name,
            description: s.description,
          }))
        );

        setSkills(
          skillList.map((s: any) => ({
            type: "skill" as MentionType,
            name: s.name,
            description: s.description,
          }))
        );
      } catch (error) {
        logger.error("useMentionParser", "加载mention建议失败:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loadSuggestions]);

  /**
   * 解析提示词中的mentions
   */
  const parsePrompt = useCallback(
    (prompt: string): ParsedPrompt => {
      const mentions: Mention[] = [];
      const errors: string[] = [];

      let match;
      while ((match = MENTION_REGEX.exec(prompt)) !== null) {
        const [fullMatch, type, name] = match;
        mentions.push({
          type: type as MentionType,
          name,
          fullMatch,
          startIndex: match.index,
          endIndex: match.index + fullMatch.length,
        });
      }

      // 验证mentions
      if (enableValidation) {
        for (const mention of mentions) {
          if (mention.type === "subagent") {
            const exists = subagents.some((s) => s.name === mention.name);
            if (!exists && subagents.length > 0) {
              errors.push(`子代理 "${mention.name}" 不存在`);
            }
          } else if (mention.type === "skill") {
            const exists = skills.some((s) => s.name === mention.name);
            if (!exists && skills.length > 0) {
              errors.push(`技能 "${mention.name}" 不存在`);
            }
          }
        }
      }

      // 生成清理后的提示词
      let cleaned = prompt;
      // 从后往前替换，避免索引变化
      for (let i = mentions.length - 1; i >= 0; i--) {
        const m = mentions[i];
        cleaned = cleaned.slice(0, m.startIndex) + cleaned.slice(m.endIndex);
      }
      cleaned = cleaned.trim();

      return {
        original: prompt,
        cleaned,
        mentions,
        isValid: errors.length === 0,
        errors,
      };
    },
    [enableValidation, subagents, skills]
  );

  /**
   * 获取自动完成建议
   */
  const getSuggestions = useCallback(
    (prompt: string, cursorPosition: number): MentionSuggestion[] => {
      // 获取光标前的文本
      const textBeforeCursor = prompt.slice(0, cursorPosition);
      const match = textBeforeCursor.match(PARTIAL_MENTION_REGEX);

      if (!match) return [];

      const [, typePrefix, namePrefix] = match;
      let suggestions: MentionSuggestion[] = [];

      // 如果还没输入类型
      if (!typePrefix || typePrefix.length === 0) {
        return [
          { type: "subagent", name: "subagent", description: "调用子代理" },
          { type: "skill", name: "skill", description: "执行技能" },
          { type: "file", name: "file", description: "引用文件" },
          { type: "command", name: "command", description: "执行命令" },
        ];
      }

      // 根据类型前缀过滤
      if ("subagent".startsWith(typePrefix.toLowerCase())) {
        suggestions = suggestions.concat(
          subagents.map((s) => ({
            ...s,
            name: namePrefix ? s.name : `subagent:${s.name}`,
          }))
        );
      }

      if ("skill".startsWith(typePrefix.toLowerCase())) {
        suggestions = suggestions.concat(
          skills.map((s) => ({
            ...s,
            name: namePrefix ? s.name : `skill:${s.name}`,
          }))
        );
      }

      // 如果已经输入了类型，按名称前缀过滤
      if (namePrefix) {
        const lowerPrefix = namePrefix.toLowerCase();
        suggestions = suggestions.filter((s) => s.name.toLowerCase().includes(lowerPrefix));
      }

      return suggestions.slice(0, 10); // 最多10个建议
    },
    [subagents, skills]
  );

  /**
   * 插入mention到提示词
   */
  const insertMention = useCallback(
    (
      prompt: string,
      cursorPosition: number,
      suggestion: MentionSuggestion
    ): { newPrompt: string; newCursorPosition: number } => {
      const textBeforeCursor = prompt.slice(0, cursorPosition);
      const textAfterCursor = prompt.slice(cursorPosition);

      // 找到@符号的位置
      const atIndex = textBeforeCursor.lastIndexOf("@");
      if (atIndex === -1) {
        return { newPrompt: prompt, newCursorPosition: cursorPosition };
      }

      // 构建完整的mention
      const fullMention = `@${suggestion.type}:${suggestion.name}`;

      // 替换
      const newPrompt = textBeforeCursor.slice(0, atIndex) + fullMention + " " + textAfterCursor;
      const newCursorPosition = atIndex + fullMention.length + 1;

      return { newPrompt, newCursorPosition };
    },
    []
  );

  /**
   * 高亮提示词中的mentions
   */
  const highlightMentions = useCallback((prompt: string): string => {
    return prompt.replace(MENTION_REGEX, '<span class="mention">$&</span>');
  }, []);

  /**
   * 提取所有被引用的子代理
   */
  const extractSubagents = useCallback(
    (prompt: string): string[] => {
      const parsed = parsePrompt(prompt);
      return parsed.mentions.filter((m) => m.type === "subagent").map((m) => m.name);
    },
    [parsePrompt]
  );

  /**
   * 提取所有被引用的技能
   */
  const extractSkills = useCallback(
    (prompt: string): string[] => {
      const parsed = parsePrompt(prompt);
      return parsed.mentions.filter((m) => m.type === "skill").map((m) => m.name);
    },
    [parsePrompt]
  );

  return {
    // 状态
    loading,
    subagents,
    skills,

    // 方法
    parsePrompt,
    getSuggestions,
    insertMention,
    highlightMentions,
    extractSubagents,
    extractSkills,
  };
}

export default useMentionParser;

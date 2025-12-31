/**
 * useCustomSlashCommands Hook
 *
 * 从后端获取用户和项目的自定义斜杠命令
 * 支持 Claude 和 Gemini 引擎
 *
 * Claude: ~/.claude/commands/*.md
 * Gemini: ~/.gemini/commands/*.toml
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SlashCommand } from '../slashCommands';

/** 执行引擎类型 */
type ExecutionEngine = 'claude' | 'gemini' | 'codex';

/** 后端返回的自定义命令类型 */
interface CustomSlashCommandResponse {
  /** 命令名称 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 作用域: "project" | "user" */
  scope: string;
  /** 描述 */
  description: string | null;
  /** 参数提示 */
  argHint: string | null;
  /** 文件内容 */
  content: string;
}

interface UseCustomSlashCommandsOptions {
  /** 项目路径 */
  projectPath?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 执行引擎类型 (默认 claude) */
  engine?: ExecutionEngine;
}

interface UseCustomSlashCommandsReturn {
  /** 自定义命令列表（已转换为 SlashCommand 格式） */
  customCommands: SlashCommand[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 重新加载命令 */
  refresh: () => Promise<void>;
}

/**
 * 获取自定义斜杠命令的 Hook
 *
 * 自动从后端加载用户和项目级别的自定义命令
 * 支持 Claude 和 Gemini 引擎
 */
export function useCustomSlashCommands({
  projectPath,
  enabled = true,
  engine = 'claude',
}: UseCustomSlashCommandsOptions): UseCustomSlashCommandsReturn {
  const [rawCommands, setRawCommands] = useState<CustomSlashCommandResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 根据引擎选择后端命令
  const getBackendCommand = useCallback((eng: ExecutionEngine): string => {
    switch (eng) {
      case 'gemini':
        return 'list_gemini_custom_slash_commands';
      case 'claude':
      default:
        return 'list_custom_slash_commands';
    }
  }, []);

  // 加载自定义命令
  const loadCommands = useCallback(async () => {
    if (!enabled) {
      setRawCommands([]);
      return;
    }

    // Codex 暂不支持自定义斜杠命令
    if (engine === 'codex') {
      setRawCommands([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const backendCommand = getBackendCommand(engine);
      const commands = await invoke<CustomSlashCommandResponse[]>(
        backendCommand,
        { projectPath: projectPath || null }
      );
      setRawCommands(commands);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // 如果后端命令不存在（Gemini 还未实现），静默失败
      if (errorMessage.includes('not found') || errorMessage.includes('Unknown command')) {
        console.debug(`Custom slash commands not available for engine: ${engine}`);
        setRawCommands([]);
      } else {
        console.error('Failed to load custom slash commands:', errorMessage);
        setError(errorMessage);
        setRawCommands([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, enabled, engine, getBackendCommand]);

  // 初始加载和项目路径变化时重新加载
  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  // 转换为 SlashCommand 格式
  const customCommands = useMemo((): SlashCommand[] => {
    return rawCommands.map((cmd): SlashCommand => ({
      name: cmd.name,
      description: cmd.description || `Custom command: ${cmd.name}`,
      source: cmd.scope === 'project' ? 'project' : 'user',
      category: 'custom',
      // 自定义命令默认支持非交互式模式（它们只是模板）
      supportsNonInteractive: true,
      argHint: cmd.argHint || undefined,
    }));
  }, [rawCommands]);

  return {
    customCommands,
    isLoading,
    error,
    refresh: loadCommands,
  };
}

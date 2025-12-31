/**
 * useSlashCommandMenu Hook
 *
 * 管理斜杠命令自动补全菜单的状态和逻辑
 * 支持 Claude 和 Gemini 引擎
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  type SlashCommand,
  BUILT_IN_SLASH_COMMANDS,
  filterSlashCommands,
} from '../slashCommands';
import { GEMINI_BUILT_IN_SLASH_COMMANDS } from '../geminiSlashCommands';

/** 执行引擎类型 */
type ExecutionEngine = 'claude' | 'gemini' | 'codex';

interface UseSlashCommandMenuOptions {
  /** 当前输入的文本 */
  prompt: string;
  /** 选择命令后的回调 */
  onCommandSelect?: (command: string) => void;
  /** 自定义命令列表 */
  customCommands?: SlashCommand[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 执行引擎类型 (默认 claude) */
  engine?: ExecutionEngine;
}

interface UseSlashCommandMenuReturn {
  /** 是否显示菜单 */
  isOpen: boolean;
  /** 搜索查询 (/ 后面的内容) */
  query: string;
  /** 当前选中的索引 */
  selectedIndex: number;
  /** 设置选中索引 */
  setSelectedIndex: (index: number) => void;
  /** 过滤后的命令列表 */
  filteredCommands: SlashCommand[];
  /** 选择命令 */
  selectCommand: (command: SlashCommand) => void;
  /** 关闭菜单 */
  closeMenu: () => void;
  /** 处理键盘事件 (在 onKeyDown 中调用) */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

/**
 * 检测是否正在输入斜杠命令
 */
function detectSlashCommand(text: string): { isSlashCommand: boolean; query: string } {
  const trimmed = text.trim();

  // 必须以 / 开头
  if (!trimmed.startsWith('/')) {
    return { isSlashCommand: false, query: '' };
  }

  // 不能包含空格（空格后就是参数了）
  // 但可以在空格前显示菜单
  const firstSpaceIndex = trimmed.indexOf(' ');
  if (firstSpaceIndex > 0) {
    // 有空格，不显示菜单（用户已经输入了命令）
    return { isSlashCommand: false, query: '' };
  }

  // 提取 / 后面的查询
  const query = trimmed.slice(1);

  return { isSlashCommand: true, query };
}

export function useSlashCommandMenu({
  prompt,
  onCommandSelect,
  customCommands = [],
  disabled = false,
  engine = 'claude',
}: UseSlashCommandMenuOptions): UseSlashCommandMenuReturn {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isManuallyClose, setIsManuallyClose] = useState(false);

  // 检测斜杠命令
  const { isSlashCommand, query } = useMemo(() => {
    if (disabled) return { isSlashCommand: false, query: '' };
    return detectSlashCommand(prompt);
  }, [prompt, disabled]);

  // 根据引擎选择内置命令列表
  const builtInCommands = useMemo(() => {
    switch (engine) {
      case 'gemini':
        return GEMINI_BUILT_IN_SLASH_COMMANDS;
      case 'claude':
        return BUILT_IN_SLASH_COMMANDS;
      case 'codex':
        // Codex 暂不支持非交互式斜杠命令
        return [];
      default:
        return BUILT_IN_SLASH_COMMANDS;
    }
  }, [engine]);

  // 合并命令列表
  const allCommands = useMemo(() => {
    return [...builtInCommands, ...customCommands];
  }, [builtInCommands, customCommands]);

  // 过滤命令 (只显示支持非交互式的)
  const filteredCommands = useMemo(() => {
    return filterSlashCommands(allCommands, query, true);
  }, [allCommands, query]);

  // 菜单是否显示
  const isOpen = isSlashCommand && !isManuallyClose && filteredCommands.length > 0;

  // 当查询改变时重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
    setIsManuallyClose(false);
  }, [query]);

  // 当 prompt 清空时重置手动关闭状态
  useEffect(() => {
    if (!prompt.trim()) {
      setIsManuallyClose(false);
    }
  }, [prompt]);

  // 选择命令
  const selectCommand = useCallback((command: SlashCommand) => {
    const fullCommand = `/${command.name}`;
    onCommandSelect?.(fullCommand);
    setIsManuallyClose(true);
  }, [onCommandSelect]);

  // 关闭菜单
  const closeMenu = useCallback(() => {
    setIsManuallyClose(true);
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (!isOpen) return false;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return true;

      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return true;

      case 'Enter':
        // 仅当菜单打开时拦截 Enter
        if (filteredCommands[selectedIndex]) {
          e.preventDefault();
          selectCommand(filteredCommands[selectedIndex]);
          return true;
        }
        return false;

      case 'Tab':
        // Tab 也可以选择
        if (filteredCommands[selectedIndex]) {
          e.preventDefault();
          selectCommand(filteredCommands[selectedIndex]);
          return true;
        }
        return false;

      case 'Escape':
        e.preventDefault();
        closeMenu();
        return true;

      default:
        return false;
    }
  }, [isOpen, filteredCommands, selectedIndex, selectCommand, closeMenu]);

  return {
    isOpen,
    query,
    selectedIndex,
    setSelectedIndex,
    filteredCommands,
    selectCommand,
    closeMenu,
    handleKeyDown,
  };
}

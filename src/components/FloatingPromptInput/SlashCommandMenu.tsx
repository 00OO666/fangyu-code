/**
 * SlashCommandMenu - 斜杠命令自动补全菜单
 *
 * 当用户在输入框中输入 / 时显示命令列表
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Command, Terminal, Settings, GitBranch, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type SlashCommand,
  BUILT_IN_SLASH_COMMANDS,
  CATEGORY_LABELS,
  filterSlashCommands,
  groupCommandsByCategory,
} from './slashCommands';
import { GEMINI_BUILT_IN_SLASH_COMMANDS } from './geminiSlashCommands';

/** 执行引擎类型 */
type ExecutionEngine = 'claude' | 'gemini' | 'codex';

interface SlashCommandMenuProps {
  /** 是否显示菜单 */
  isOpen: boolean;
  /** 搜索查询 (/ 后面的内容) */
  query: string;
  /** 选中命令时的回调 */
  onSelect: (command: SlashCommand) => void;
  /** 关闭菜单 */
  onClose: () => void;
  /** 当前选中的索引 */
  selectedIndex: number;
  /** 设置选中的索引 */
  onSelectedIndexChange: (index: number) => void;
  /** 是否只显示支持非交互式模式的命令 */
  nonInteractiveOnly?: boolean;
  /** 自定义命令列表 (项目 + 用户) */
  customCommands?: SlashCommand[];
  /** 菜单位置 */
  position?: { top: number; left: number };
  /** 执行引擎类型 (默认 claude) */
  engine?: ExecutionEngine;
}

/**
 * 获取分类图标
 */
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'session':
      return <Clock className="h-3.5 w-3.5" />;
    case 'context':
      return <Sparkles className="h-3.5 w-3.5" />;
    case 'system':
      return <Terminal className="h-3.5 w-3.5" />;
    case 'git':
      return <GitBranch className="h-3.5 w-3.5" />;
    case 'config':
      return <Settings className="h-3.5 w-3.5" />;
    case 'custom':
      return <Command className="h-3.5 w-3.5" />;
    default:
      return <Command className="h-3.5 w-3.5" />;
  }
};

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  isOpen,
  query,
  onSelect,
  onClose,
  selectedIndex,
  onSelectedIndexChange,
  nonInteractiveOnly = true,
  customCommands = [],
  position,
  engine = 'claude',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

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

  // 合并内置命令和自定义命令
  const allCommands = useMemo(() => {
    return [...builtInCommands, ...customCommands];
  }, [builtInCommands, customCommands]);

  // 过滤命令
  const filteredCommands = useMemo(() => {
    return filterSlashCommands(allCommands, query, nonInteractiveOnly);
  }, [allCommands, query, nonInteractiveOnly]);

  // 按分类分组
  const groupedCommands = useMemo(() => {
    return groupCommandsByCategory(filteredCommands);
  }, [filteredCommands]);

  // 扁平化命令列表用于键盘导航
  const flatCommands = useMemo(() => {
    const flat: SlashCommand[] = [];
    groupedCommands.forEach(commands => {
      flat.push(...commands);
    });
    return flat;
  }, [groupedCommands]);

  // 滚动到选中项
  useEffect(() => {
    if (selectedItemRef.current && menuRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 处理命令点击
  const handleCommandClick = useCallback((cmd: SlashCommand) => {
    onSelect(cmd);
  }, [onSelect]);

  if (!isOpen || flatCommands.length === 0) {
    return null;
  }

  let currentFlatIndex = 0;

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute z-50 w-80 max-h-64 overflow-y-auto",
        "bg-popover border border-border rounded-lg shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      style={position ? {
        bottom: position.top,
        left: position.left,
      } : {
        bottom: '100%',
        left: 0,
        marginBottom: '8px',
      }}
    >
      {/* 标题 */}
      <div className="sticky top-0 bg-popover border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Command className="h-3.5 w-3.5" />
          <span>斜杠命令</span>
          {query && (
            <span className="text-foreground/60">
              搜索: <code className="bg-muted px-1 rounded">{query}</code>
            </span>
          )}
          {nonInteractiveOnly && (
            <span className="ml-auto text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
              非交互式
            </span>
          )}
        </div>
      </div>

      {/* 命令列表 */}
      <div className="py-1">
        {Array.from(groupedCommands.entries()).map(([category, commands]) => (
          <div key={category}>
            {/* 分类标题 */}
            <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide flex items-center gap-1.5">
              {getCategoryIcon(category)}
              {CATEGORY_LABELS[category] || category}
            </div>

            {/* 命令项 */}
            {commands.map((cmd) => {
              const flatIndex = currentFlatIndex++;
              const isSelected = flatIndex === selectedIndex;

              return (
                <div
                  key={`${cmd.source}-${cmd.name}`}
                  ref={isSelected ? selectedItemRef : null}
                  className={cn(
                    "px-3 py-1.5 cursor-pointer transition-colors",
                    "hover:bg-accent",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => handleCommandClick(cmd)}
                  onMouseEnter={() => onSelectedIndexChange(flatIndex)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-foreground">
                        /{cmd.name}
                      </code>
                      {cmd.argHint && (
                        <span className="text-xs text-muted-foreground/60">
                          {cmd.argHint}
                        </span>
                      )}
                    </div>
                    {cmd.source !== 'built-in' && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        cmd.source === 'project' ? "bg-green-500/10 text-green-500" : "bg-purple-500/10 text-purple-500"
                      )}>
                        {cmd.source === 'project' ? '项目' : '用户'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {cmd.description}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      <div className="sticky bottom-0 bg-popover border-t border-border px-3 py-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">↑↓</kbd> 导航
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-2">Enter</kbd> 选择
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-2">Esc</kbd> 关闭
          </span>
          <span>{flatCommands.length} 个命令</span>
        </div>
      </div>
    </div>
  );
};

export default SlashCommandMenu;

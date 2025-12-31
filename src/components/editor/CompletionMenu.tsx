/**
 * CompletionMenu 组件
 *
 * 代码补全菜单，显示补全项列表
 * 支持键盘导航、鼠标选择、文档预览
 */

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code,
  Variable,
  Braces,
  Hash,
  FileCode,
  Folder,
  Package,
  Zap,
  Type,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompletionItem, CompletionItemKind } from '@/types/completion';

export interface CompletionMenuProps {
  /** 是否可见 */
  visible: boolean;
  /** 补全项列表 */
  items: CompletionItem[];
  /** 当前选中索引 */
  selectedIndex: number;
  /** 是否加载中 */
  loading?: boolean;
  /** 位置 */
  position?: { x: number; y: number };
  /** 选择项回调 */
  onSelect?: (item: CompletionItem, index: number) => void;
  /** 悬停项回调 */
  onHover?: (index: number) => void;
  /** 关闭回调 */
  onDismiss?: () => void;
  /** 最大高度 */
  maxHeight?: number;
  /** 显示文档 */
  showDocumentation?: boolean;
}

// 图标映射
const KIND_ICONS: Record<CompletionItemKind, React.ComponentType<{ className?: string }>> = {
  keyword: Hash,
  variable: Variable,
  function: Braces,
  method: Braces,
  property: Code,
  class: Box,
  interface: Type,
  type: Type,
  enum: Hash,
  constant: Hash,
  snippet: Zap,
  file: FileCode,
  folder: Folder,
  module: Package,
  unit: Hash,
  value: Code,
  event: Zap,
  operator: Code,
  text: Code,
};

// 颜色映射
const KIND_COLORS: Record<CompletionItemKind, string> = {
  keyword: 'text-purple-500',
  variable: 'text-blue-500',
  function: 'text-amber-500',
  method: 'text-amber-500',
  property: 'text-cyan-500',
  class: 'text-orange-500',
  interface: 'text-green-500',
  type: 'text-green-500',
  enum: 'text-violet-500',
  constant: 'text-red-500',
  snippet: 'text-pink-500',
  file: 'text-gray-500',
  folder: 'text-yellow-500',
  module: 'text-indigo-500',
  unit: 'text-gray-500',
  value: 'text-blue-400',
  event: 'text-rose-500',
  operator: 'text-gray-500',
  text: 'text-gray-500',
};

export const CompletionMenu: React.FC<CompletionMenuProps> = ({
  visible,
  items,
  selectedIndex,
  loading = false,
  position = { x: 0, y: 0 },
  onSelect,
  onHover,
  onDismiss,
  maxHeight = 300,
  showDocumentation = true,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // 滚动到选中项
  useEffect(() => {
    if (selectedRef.current && listRef.current) {
      const list = listRef.current;
      const item = selectedRef.current;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      if (itemRect.top < listRect.top) {
        item.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else if (itemRect.bottom > listRect.bottom) {
        item.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // 键盘事件（由父组件处理，这里只处理 Escape）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        e.preventDefault();
        onDismiss?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onDismiss]);

  const selectedItem = items[selectedIndex];

  return (
    <AnimatePresence>
      {visible && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
          style={{
            left: position.x,
            top: position.y,
            minWidth: 280,
            maxWidth: 450,
          }}
        >
          {/* 补全列表 */}
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight }}
          >
            {items.map((item, index) => {
              const IconComponent = KIND_ICONS[item.kind] || Code;
              const iconColor = KIND_COLORS[item.kind] || 'text-gray-500';
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={`${item.label}-${index}`}
                  ref={isSelected ? selectedRef : undefined}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => onSelect?.(item, index)}
                  onMouseEnter={() => onHover?.(index)}
                >
                  {/* 图标 */}
                  <IconComponent className={cn('h-4 w-4 flex-shrink-0', iconColor)} />

                  {/* 标签和详情 */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-mono text-sm truncate">{item.label}</span>
                    {item.detail && (
                      <span className="text-xs text-muted-foreground truncate">
                        {item.detail}
                      </span>
                    )}
                  </div>

                  {/* 来源标记 */}
                  {item.source && item.source !== 'local' && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0',
                      item.source === 'ai' ? 'bg-violet-500/20 text-violet-500' :
                      item.source === 'snippet' ? 'bg-pink-500/20 text-pink-500' :
                      'bg-gray-500/20 text-gray-500'
                    )}>
                      {item.source === 'ai' ? 'AI' : item.source === 'snippet' ? '片段' : item.source}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 文档预览 */}
          {showDocumentation && selectedItem?.documentation && (
            <div className="border-t border-border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {selectedItem.documentation}
              </p>
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* 快捷键提示 */}
          <div className="border-t border-border px-3 py-1.5 bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>↑↓ 选择</span>
            <span>Tab 确认</span>
            <span>Esc 取消</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompletionMenu;

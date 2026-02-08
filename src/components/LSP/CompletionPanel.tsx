/**
 * Completion Panel 组件
 * 显示代码补全建议
 */

import React from "react";
import type { CompletionItem } from "@/core/tools/LSPTools";

interface CompletionPanelProps {
  items: CompletionItem[];
  onSelect: (item: CompletionItem) => void;
}

export const CompletionPanel: React.FC<CompletionPanelProps> = ({ items, onSelect }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-background border rounded shadow-lg max-h-64 overflow-y-auto">
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => onSelect(item)}
          className="block text-left px-3 py-2 hover:bg-accent w-full"
        >
          <span className="font-mono">{item.label}</span>
          {item.detail && <span className="text-xs text-muted-foreground ml-2">{item.detail}</span>}
        </button>
      ))}
    </div>
  );
};

export default CompletionPanel;

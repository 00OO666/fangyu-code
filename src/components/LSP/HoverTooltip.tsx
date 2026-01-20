/**
 * Hover Tooltip 组件
 * 显示 LSP hover 信息
 */

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { HoverInfo } from '@/core/types/unified-agent';

interface HoverTooltipProps {
  hoverInfo: HoverInfo | null;
  position: { x: number; y: number };
  onClose: () => void;
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({
  hoverInfo,
  position,
  onClose,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hoverInfo) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [hoverInfo]);

  if (!visible || !hoverInfo) {
    return null;
  }

  return (
    <div
      className="fixed z-50 bg-background border border-border rounded-md shadow-lg p-3 max-w-md"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-sm">
        <ReactMarkdown>{hoverInfo.content}</ReactMarkdown>
      </div>
      <button
        onClick={onClose}
        className="absolute top-1 right-1 text-muted-foreground hover:text-foreground"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
};

export default HoverTooltip;

/**
 * References Panel 组件
 * 显示所有引用位置
 */

import React from 'react';
import type { Location } from '@/core/types/unified-agent';

interface ReferencesPanelProps {
  references: Location[];
  onNavigate: (location: Location) => void;
}

export const ReferencesPanel: React.FC<ReferencesPanelProps> = ({
  references,
  onNavigate,
}) => {
  if (references.length === 0) {
    return <div className="p-2 text-muted-foreground">No references found</div>;
  }

  return (
    <div className="p-2 space-y-1">
      {references.map((ref, index) => (
        <button
          key={index}
          onClick={() => onNavigate(ref)}
          className="block text-left text-sm hover:bg-accent p-1 rounded w-full"
        >
          {ref.file}:{ref.range.start.line + 1}
        </button>
      ))}
    </div>
  );
};

export default ReferencesPanel;

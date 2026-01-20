/**
 * Diagnostics Panel 组件
 * 显示错误和警告
 */

import React from 'react';
import type { Diagnostic } from '@/core/types/unified-agent';

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  onNavigate: (diagnostic: Diagnostic) => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  diagnostics,
  onNavigate,
}) => {
  if (diagnostics.length === 0) {
    return <div className="p-2 text-muted-foreground">No diagnostics</div>;
  }

  return (
    <div className="p-2 space-y-1">
      {diagnostics.map((diag, index) => (
        <button
          key={index}
          onClick={() => onNavigate(diag)}
          className="block text-left text-sm hover:bg-accent p-2 rounded w-full"
        >
          <span className={`font-semibold ${
            diag.severity === 'error' ? 'text-red-500' : 'text-yellow-500'
          }`}>
            {diag.severity}
          </span>
          : {diag.message}
        </button>
      ))}
    </div>
  );
};

export default DiagnosticsPanel;

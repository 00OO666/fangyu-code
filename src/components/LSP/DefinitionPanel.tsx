/**
 * Definition Panel 组件
 * 显示符号定义位置
 */

import React from "react";
import type { Location } from "@/core/types/unified-agent";

interface DefinitionPanelProps {
  location: Location | null;
  onNavigate: (location: Location) => void;
}

export const DefinitionPanel: React.FC<DefinitionPanelProps> = ({ location, onNavigate }) => {
  if (!location) {
    return null;
  }

  return (
    <div className="p-2 border rounded">
      <button onClick={() => onNavigate(location)} className="text-blue-500 hover:underline">
        {location.file}:{location.range.start.line + 1}
      </button>
    </div>
  );
};

export default DefinitionPanel;

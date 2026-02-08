/**
 * Diff Preview 组件
 * 显示代码差异预览
 */

import React, { useState } from "react";
import type { DiffChange } from "@/core/diff/DiffManager";

interface DiffPreviewProps {
  diff?: string;
  changes?: DiffChange[];
  onAccept?: (changeId?: string) => void;
  onReject?: (changeId?: string) => void;
  onApply?: () => void;
}

export const DiffPreview: React.FC<DiffPreviewProps> = ({
  diff,
  changes,
  onAccept,
  onReject,
  onApply,
}) => {
  const [viewMode, setViewMode] = useState<"side-by-side" | "inline">("side-by-side");

  // 如果传入的是 diff 字符串，显示简单的 diff 视图
  if (diff) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b">
          <h3 className="font-semibold">Code Diff</h3>
          {onApply && (
            <button
              onClick={onApply}
              className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Apply
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="font-mono text-sm bg-muted p-4 rounded">{diff}</pre>
        </div>
      </div>
    );
  }

  // 原有的 changes 数组逻辑
  if (!changes || changes.length === 0) {
    return <div className="p-4 text-muted-foreground">No changes to preview</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="font-semibold">Code Changes ({changes.length})</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("side-by-side")}
            className={`px-3 py-1 rounded ${viewMode === "side-by-side" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode("inline")}
            className={`px-3 py-1 rounded ${viewMode === "inline" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            Inline
          </button>
          <button
            onClick={onApply}
            className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Apply All
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {changes.map((change) => (
          <div key={change.id} className="border rounded p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm">{change.filePath}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onAccept?.(change.id)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                  disabled={change.status === "accepted"}
                >
                  Accept
                </button>
                <button
                  onClick={() => onReject?.(change.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                  disabled={change.status === "rejected"}
                >
                  Reject
                </button>
              </div>
            </div>
            <div className="bg-muted p-2 rounded font-mono text-xs">
              {viewMode === "side-by-side" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-red-50 p-1">
                    <pre>{change.oldContent}</pre>
                  </div>
                  <div className="bg-green-50 p-1">
                    <pre>{change.newContent}</pre>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-red-50 p-1 mb-1">
                    <pre>- {change.oldContent}</pre>
                  </div>
                  <div className="bg-green-50 p-1">
                    <pre>+ {change.newContent}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiffPreview;

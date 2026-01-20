/**
 * Rename Dialog 组件
 * 重命名符号对话框
 */

import React, { useState } from 'react';

interface RenameDialogProps {
  currentName: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
}

export const RenameDialog: React.FC<RenameDialogProps> = ({
  currentName,
  onRename,
  onCancel,
}) => {
  const [newName, setNewName] = useState(currentName);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-4 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-3">Rename Symbol</h3>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-3"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => onRename(newName)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameDialog;

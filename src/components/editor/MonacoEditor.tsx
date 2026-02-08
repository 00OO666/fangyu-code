/**
 * Monaco Editor Component
 * Monaco编辑器封装组件
 */

import React from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  height?: string | number;
  width?: string | number;
  onMount?: OnMount;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language = "typescript",
  theme = "vs-dark",
  readOnly = false,
  height = "100%",
  width = "100%",
  onMount,
}) => {
  return (
    <Editor
      height={height}
      width={width}
      language={language}
      value={value}
      onChange={(val) => onChange?.(val || "")}
      onMount={onMount}
      theme={theme}
      options={{
        readOnly,
        minimap: { enabled: true },
        fontSize: 14,
        lineHeight: 22,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
      }}
    />
  );
};

export default MonacoEditor;

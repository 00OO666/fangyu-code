/**
 * Code Editor with LSP Integration
 * Monaco编辑器 + LSP功能集成
 */

import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { LSPClient } from '@/core/lsp/LSPClient';
import { RealLSPClient } from '@/core/tools/LSPAutoLoader';
import { HoverTooltip } from '../LSP/HoverTooltip';
import { DefinitionPanel } from '../LSP/DefinitionPanel';
import { ReferencesPanel } from '../LSP/ReferencesPanel';
import { RenameDialog } from '../LSP/RenameDialog';
import { DiagnosticsPanel } from '../LSP/DiagnosticsPanel';
import { CompletionPanel } from '../LSP/CompletionPanel';
import type { HoverInfo, Location, Diagnostic } from '@/core/types/unified-agent';
import type { CompletionItem } from '@/core/tools/LSPTools';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  filePath?: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'typescript',
  filePath,
  readOnly = false,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lspClientRef = useRef<LSPClient | null>(null);

  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [definition, setDefinition] = useState<Location | null>(null);
  const [references, setReferences] = useState<Location[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [renameTarget, setRenameTarget] = useState<{ name: string; position: { line: number; character: number } } | null>(null);

  useEffect(() => {
    const realClient = new RealLSPClient();
    lspClientRef.current = new LSPClient(realClient);

    return () => {
      lspClientRef.current = null;
    };
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.onMouseMove(async (e) => {
      if (!lspClientRef.current || !filePath || !e.target.position) return;

      const position = { line: e.target.position.lineNumber - 1, character: e.target.position.column - 1 };
      const hover = await lspClientRef.current.hover(filePath, position);

      if (hover) {
        const coords = editor.getScrolledVisiblePosition(e.target.position);
        if (coords) {
          setHoverInfo(hover);
          setHoverPosition({ x: coords.left, y: coords.top + coords.height });
        }
      } else {
        setHoverInfo(null);
        setHoverPosition(null);
      }
    });

    editor.onDidChangeCursorPosition(async (e) => {
      if (!lspClientRef.current || !filePath) return;

      const diags = await lspClientRef.current.getDiagnostics(filePath);
      setDiagnostics(diags);
    });

    editor.addAction({
      id: 'lsp-goto-definition',
      label: 'Go to Definition',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12],
      run: async (ed) => {
        if (!lspClientRef.current || !filePath) return;

        const position = ed.getPosition();
        if (!position) return;

        const pos = { line: position.lineNumber - 1, character: position.column - 1 };
        const def = await lspClientRef.current.gotoDefinition(filePath, pos);
        setDefinition(def);
      },
    });

    editor.addAction({
      id: 'lsp-find-references',
      label: 'Find All References',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
      run: async (ed) => {
        if (!lspClientRef.current || !filePath) return;

        const position = ed.getPosition();
        if (!position) return;

        const pos = { line: position.lineNumber - 1, character: position.column - 1 };
        const refs = await lspClientRef.current.findReferences(filePath, pos);
        setReferences(refs);
      },
    });

    editor.addAction({
      id: 'lsp-rename',
      label: 'Rename Symbol',
      keybindings: [monaco.KeyCode.F2],
      run: async (ed) => {
        if (!lspClientRef.current || !filePath) return;

        const position = ed.getPosition();
        if (!position) return;

        const model = ed.getModel();
        if (!model) return;

        const word = model.getWordAtPosition(position);
        if (!word) return;

        setRenameTarget({
          name: word.word,
          position: { line: position.lineNumber - 1, character: position.column - 1 },
        });
      },
    });
  };

  const handleNavigate = (location: Location) => {
    if (!editorRef.current) return;

    editorRef.current.setPosition({
      lineNumber: location.range.start.line + 1,
      column: location.range.start.character + 1,
    });
    editorRef.current.revealLineInCenter(location.range.start.line + 1);
  };

  const handleRename = async (newName: string) => {
    if (!lspClientRef.current || !filePath || !renameTarget) return;

    await lspClientRef.current.rename(filePath, renameTarget.position, newName);
    setRenameTarget(null);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(val) => onChange?.(val || '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: true },
            fontSize: 14,
            lineHeight: 22,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />

        {hoverInfo && hoverPosition && (
          <HoverTooltip
            hoverInfo={hoverInfo}
            position={hoverPosition}
            onClose={() => {
              setHoverInfo(null);
              setHoverPosition(null);
            }}
          />
        )}

        {renameTarget && (
          <RenameDialog
            currentName={renameTarget.name}
            onRename={handleRename}
            onCancel={() => setRenameTarget(null)}
          />
        )}
      </div>

      <div className="w-80 border-l flex flex-col">
        {definition && (
          <div className="border-b p-2">
            <h3 className="text-sm font-semibold mb-2">Definition</h3>
            <DefinitionPanel location={definition} onNavigate={handleNavigate} />
          </div>
        )}

        {references.length > 0 && (
          <div className="border-b p-2">
            <h3 className="text-sm font-semibold mb-2">References ({references.length})</h3>
            <ReferencesPanel references={references} onNavigate={handleNavigate} />
          </div>
        )}

        {diagnostics.length > 0 && (
          <div className="border-b p-2">
            <h3 className="text-sm font-semibold mb-2">Problems ({diagnostics.length})</h3>
            <DiagnosticsPanel diagnostics={diagnostics} onNavigate={handleNavigate} />
          </div>
        )}

        {completions.length > 0 && (
          <div className="p-2">
            <h3 className="text-sm font-semibold mb-2">Completions</h3>
            <CompletionPanel items={completions} onSelect={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;

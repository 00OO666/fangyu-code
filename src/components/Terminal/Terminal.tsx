/**
 * Terminal 组件
 * 内置终端 + AI 助手
 */

import React, { useRef, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TerminalProps {
  onCommand?: (command: string) => void;
  aiEnabled?: boolean;
}

interface TerminalOutput {
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

export const Terminal: React.FC<TerminalProps> = ({
  onCommand,
  aiEnabled = true,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);

  useEffect(() => {
    const createSession = async () => {
      try {
        const id = await invoke<number>('terminal_create_session');
        setSessionId(id);
      } catch (error) {
        console.error('Failed to create terminal session:', error);
      }
    };

    createSession();

    return () => {
      if (sessionId) {
        invoke('terminal_close_session', { sessionId }).catch(console.error);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const commandLine = `$ ${input}`;
    setHistory([...history, commandLine]);
    onCommand?.(input);

    try {
      const parts = input.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      const output = await invoke<TerminalOutput>('terminal_execute', {
        command,
        args,
        cwd: null,
      });

      const outputLines = [];
      if (output.stdout) {
        outputLines.push(output.stdout);
      }
      if (output.stderr) {
        outputLines.push(`Error: ${output.stderr}`);
      }
      if (output.exit_code !== 0) {
        outputLines.push(`Exit code: ${output.exit_code}`);
      }

      setHistory([...history, commandLine, ...outputLines]);
    } catch (error) {
      setHistory([...history, commandLine, `Error: ${error}`]);
    }

    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-black text-green-400 font-mono">
      <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-700">
        <span className="text-sm">Terminal</span>
        {aiEnabled && (
          <span className="text-xs bg-blue-600 px-2 py-1 rounded">AI Enabled</span>
        )}
      </div>
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {history.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-2 border-t border-gray-700">
        <div className="flex items-center">
          <span className="mr-2">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            placeholder="Enter command..."
            autoFocus
          />
        </div>
      </form>
    </div>
  );
};

export default Terminal;

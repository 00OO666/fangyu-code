import React, { useState, useEffect, useRef } from "react";
import { Send, X, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";

interface ProcessOutput {
  output_type: string;
  content: string;
  timestamp: number;
}

interface EmbeddedTerminalProps {
  sessionId?: string;
  workingDir: string;
  onClose?: () => void;
  className?: string;
}

export const EmbeddedTerminal: React.FC<EmbeddedTerminalProps> = ({
  sessionId,
  workingDir,
  onClose,
  className = "",
}) => {
  const [output, setOutput] = useState<ProcessOutput[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const isPollingRef = useRef(false);

  useEffect(() => {
    // 自动滚动到底部
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    // 定时获取输出
    if (isRunning) {
      const interval = setInterval(async () => {
        if (isPollingRef.current) return;
        isPollingRef.current = true;
        try {
          const [newOutput, running] = await Promise.all([
            invoke<ProcessOutput[]>("get_process_output"),
            invoke<boolean>("is_process_communication_running"),
          ]);
          if (!isMountedRef.current) return;
          setOutput(newOutput);
          if (!running) {
            setIsRunning(false);
          }
        } catch (error) {
          logger.error("[EmbeddedTerminal] Failed to get output:", error);
        } finally {
          isPollingRef.current = false;
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [isRunning]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      invoke("stop_process_communication").catch((error) => {
        logger.error("[EmbeddedTerminal] Failed to stop process on unmount:", error);
      });
    };
  }, []);

  const startProcess = async () => {
    if (isMountedRef.current) {
      setLoading(true);
    }
    try {
      await invoke("start_process_communication", {
        command: "claude",
        args: [],
        workingDir,
      });
      if (isMountedRef.current) {
        setIsRunning(true);
      }
      logger.info("[EmbeddedTerminal] Started process");
    } catch (error) {
      logger.error("[EmbeddedTerminal] Failed to start process:", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const stopProcess = async () => {
    if (isMountedRef.current) {
      setLoading(true);
    }
    try {
      await invoke("stop_process_communication");
      if (isMountedRef.current) {
        setIsRunning(false);
      }
      logger.info("[EmbeddedTerminal] Stopped process");
    } catch (error) {
      logger.error("[EmbeddedTerminal] Failed to stop process:", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const sendInput = async () => {
    if (!input.trim() || !isRunning) return;

    try {
      await invoke("send_process_input", { input: input.trim() });
      if (isMountedRef.current) {
        setInput("");
      }
      logger.info("[EmbeddedTerminal] Sent input:", input);
    } catch (error) {
      logger.error("[EmbeddedTerminal] Failed to send input:", error);
    }
  };

  const clearOutput = async () => {
    try {
      await invoke("clear_process_output");
      if (isMountedRef.current) {
        setOutput([]);
      }
      logger.info("[EmbeddedTerminal] Cleared output");
    } catch (error) {
      logger.error("[EmbeddedTerminal] Failed to clear output:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendInput();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#0a0e1a] border border-white/10 rounded-xl overflow-hidden ${className}`}
      style={{
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">嵌入式终端</h3>
          {isRunning && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">运行中</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearOutput}
            disabled={loading || output.length === 0}
            className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
            title="清除输出"
          >
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Output Area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm"
        style={{
          backgroundColor: "#000000",
        }}
      >
        {output.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {isRunning ? "等待输出..." : "终端未启动"}
          </div>
        ) : (
          <div className="space-y-1">
            {output.map((line, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-gray-600 text-xs flex-shrink-0">
                  {formatTimestamp(line.timestamp)}
                </span>
                <span
                  className={
                    line.output_type === "stderr"
                      ? "text-red-400"
                      : "text-green-400"
                  }
                >
                  {line.content}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4">
        {!isRunning ? (
          <button
            onClick={startProcess}
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "启动中..." : "启动终端"}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入命令..."
                className="flex-1 px-3 py-2 bg-[#141824] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={sendInput}
                disabled={!input.trim()}
                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={stopProcess}
              disabled={loading}
              className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "停止中..." : "停止终端"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

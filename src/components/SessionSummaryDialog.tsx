import React, { useState } from "react";
import { Copy, Check, AlertTriangle, FileText, X } from "lucide-react";

interface SessionSummaryDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Summary content in markdown format */
  summary: string;
  /** Current token usage percentage (0-1) */
  tokenPercentage: number;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when user wants to start a new session */
  onStartNewSession?: () => void;
  /** Callback when user wants to continue anyway */
  onContinueAnyway?: () => void;
}

export const SessionSummaryDialog: React.FC<SessionSummaryDialogProps> = ({
  isOpen,
  summary,
  tokenPercentage,
  onClose,
  onStartNewSession,
  onContinueAnyway,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy summary:", error);
    }
  };

  const percentage = Math.round(tokenPercentage * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">会话即将达到上下文限制</h2>
              <p className="text-sm text-gray-400">
                当前使用: {percentage}% ({percentage >= 90 ? "已达到临界值" : "接近警告阈值"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pt-4">
          <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                percentage >= 90
                  ? "bg-red-500"
                  : percentage >= 80
                    ? "bg-orange-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Summary Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <FileText className="w-4 h-4" />
              <span>会话摘要（Markdown 格式）</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] rounded-lg transition-colors text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-green-500">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">复制摘要</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-[#0d0d0d] border border-[#333] rounded-lg p-4 font-mono text-sm text-gray-300 whitespace-pre-wrap">
            {summary || "正在生成摘要..."}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#333] bg-[#1a1a1a]">
          <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-sm text-orange-200">
              <strong>建议：</strong>
              {percentage >= 90
                ? "会话已达到临界值，继续可能导致上下文丢失或错误。建议开启新会话并粘贴上述摘要。"
                : "会话接近上下文限制，建议尽快开启新会话以避免潜在问题。"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onContinueAnyway && percentage < 95 && (
              <button
                onClick={onContinueAnyway}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 rounded-lg transition-colors"
              >
                继续当前会话
              </button>
            )}
            {onStartNewSession && (
              <button
                onClick={onStartNewSession}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                开启新会话
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionSummaryDialog;

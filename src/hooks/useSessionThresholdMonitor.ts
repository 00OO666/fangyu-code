import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ClaudeStreamMessage } from "@/types/claude";

interface ThresholdConfig {
  /** Warning threshold (0-1), default 0.8 (80%) */
  warningThreshold: number;
  /** Critical threshold (0-1), default 0.9 (90%) */
  criticalThreshold: number;
  /** Max context tokens */
  maxContextTokens: number;
}

interface ThresholdStatus {
  /** Current token count */
  currentTokens: number;
  /** Percentage of max tokens (0-1) */
  percentage: number;
  /** Whether warning threshold is reached */
  isWarning: boolean;
  /** Whether critical threshold is reached */
  isCritical: boolean;
  /** Whether summary generation is in progress */
  isGeneratingSummary: boolean;
}

interface UseSessionThresholdMonitorOptions {
  /** Session ID to monitor */
  sessionId?: string;
  /** Current messages in the session */
  messages: ClaudeStreamMessage[];
  /** Threshold configuration */
  config?: Partial<ThresholdConfig>;
  /** Callback when warning threshold is reached */
  onWarning?: (status: ThresholdStatus) => void;
  /** Callback when critical threshold is reached */
  onCritical?: (status: ThresholdStatus) => void;
  /** Callback when summary is generated */
  onSummaryGenerated?: (summary: string) => void;
}

const DEFAULT_CONFIG: ThresholdConfig = {
  warningThreshold: 0.8,
  criticalThreshold: 0.9,
  maxContextTokens: 120000,
};

/** 警告限流间隔（毫秒）- 每分钟最多警告一次 */
const WARNING_INTERVAL = 60000;

/**
 * Hook for monitoring session token usage and triggering summary generation
 */
export const useSessionThresholdMonitor = (
  options: UseSessionThresholdMonitorOptions,
) => {
  const {
    sessionId,
    messages,
    config: userConfig,
    onWarning,
    onCritical,
    onSummaryGenerated,
  } = options;

  const config = { ...DEFAULT_CONFIG, ...userConfig };

  const [status, setStatus] = useState<ThresholdStatus>({
    currentTokens: 0,
    percentage: 0,
    isWarning: false,
    isCritical: false,
    isGeneratingSummary: false,
  });

  const warningTriggeredRef = useRef(false);
  const criticalTriggeredRef = useRef(false);
  /** 🔧 FIX: 上次超限警告时间，用于限流 */
  const lastExceedWarningTimeRef = useRef<number>(0);

  // Estimate token count from messages
  const estimateTokenCount = useCallback((msgs: ClaudeStreamMessage[]): number => {
    // Rough estimation: 1 token ≈ 4 characters
    let totalChars = 0;

    for (const msg of msgs) {
      if (msg.type === "user") {
        totalChars += JSON.stringify(msg.message).length;
      } else if (msg.type === "assistant") {
        totalChars += JSON.stringify(msg.message).length;
      }
    }

    return Math.ceil(totalChars / 4);
  }, []);

  // Generate session summary using Claude API
  const generateSummary = useCallback(
    async (msgs: ClaudeStreamMessage[]): Promise<string> => {
      setStatus((prev) => ({ ...prev, isGeneratingSummary: true }));

      try {
        // Extract text content from messages
        const conversationText = msgs
          .map((msg, idx) => {
            if (msg.type === "user") {
              const content =
                typeof msg.message === "string"
                  ? msg.message
                  : msg.message?.content
                    ?.map((c) => (c.type === "text" ? c.text : ""))
                    .join("\n");
              return `## User Message ${idx + 1}\n${content}`;
            } else if (msg.type === "assistant") {
              const content =
                typeof msg.message === "string"
                  ? msg.message
                  : msg.message?.content
                    ?.map((c) => (c.type === "text" ? c.text : ""))
                    .join("\n");
              return `## Assistant Response ${idx + 1}\n${content}`;
            }
            return "";
          })
          .filter(Boolean)
          .join("\n\n");

        // Call Claude API to generate summary
        const summaryPrompt = `请为以下对话生成一个详细的摘要，使用 Markdown 格式。摘要应该包括：

1. **对话主题**：简要说明对话的主要主题
2. **关键讨论点**：列出讨论的主要问题和解决方案
3. **重要决策**：记录做出的重要决策或结论
4. **待办事项**：列出未完成的任务或需要继续的工作
5. **技术细节**：记录重要的技术实现细节、代码片段或配置

请确保摘要详细且易于理解，以便在新会话中快速恢复上下文。

---

${conversationText}`;

        // Use Haiku model for cost efficiency
        const summary = await api.generateTextWithLLM(summaryPrompt, "haiku");

        setStatus((prev) => ({ ...prev, isGeneratingSummary: false }));
        onSummaryGenerated?.(summary);

        return summary;
      } catch (error) {
        // 🔧 FIX: 记录完整错误对象，包含 type、message、stack、context
        const errorInfo = {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          context: {
            messagesCount: msgs.length,
            timestamp: new Date().toISOString(),
          },
        };
        console.error("[useSessionThresholdMonitor] Failed to generate summary:", errorInfo);
        setStatus((prev) => ({ ...prev, isGeneratingSummary: false }));

        // 🔧 FIX: 返回用户友好的回退摘要而不是抛出错误
        const fallbackSummary = `## 摘要生成失败

抱歉，无法自动生成会话摘要。

**错误信息**: ${errorInfo.errorMessage}

**建议操作**:
1. 检查网络连接
2. 稍后重试
3. 手动记录重要内容

---
*生成时间: ${new Date().toLocaleString()}*`;

        onSummaryGenerated?.(fallbackSummary);
        return fallbackSummary;
      }
    },
    [onSummaryGenerated],
  );

  // Monitor token usage
  useEffect(() => {
    const currentTokens = estimateTokenCount(messages);
    const percentage = currentTokens / config.maxContextTokens;

    // 🔧 FIX: 添加警告限流，每分钟最多警告一次
    // 避免控制台被刷屏
    const now = Date.now();
    if (percentage > 1.0 && now - lastExceedWarningTimeRef.current > WARNING_INTERVAL) {
      lastExceedWarningTimeRef.current = now;
      console.warn(
        `[useSessionThresholdMonitor] ⚠️ Token usage exceeds 100%:`,
        `\n  Current tokens: ${currentTokens.toLocaleString()}`,
        `\n  Max tokens: ${config.maxContextTokens.toLocaleString()}`,
        `\n  Percentage: ${(percentage * 100).toFixed(1)}%`,
        `\n  Messages count: ${messages.length}`
      );
    }

    const newStatus: ThresholdStatus = {
      currentTokens,
      percentage,
      isWarning: percentage >= config.warningThreshold,
      isCritical: percentage >= config.criticalThreshold,
      isGeneratingSummary: status.isGeneratingSummary,
    };

    setStatus(newStatus);

    // Trigger warning callback (only once)
    if (newStatus.isWarning && !warningTriggeredRef.current) {
      warningTriggeredRef.current = true;
      onWarning?.(newStatus);
    }

    // Trigger critical callback (only once)
    if (newStatus.isCritical && !criticalTriggeredRef.current) {
      criticalTriggeredRef.current = true;
      onCritical?.(newStatus);
    }
  }, [messages, config, estimateTokenCount, onWarning, onCritical, status.isGeneratingSummary]);

  // Reset triggers when session changes
  useEffect(() => {
    warningTriggeredRef.current = false;
    criticalTriggeredRef.current = false;
  }, [sessionId]);

  return {
    status,
    generateSummary: () => generateSummary(messages),
  };
};

export default useSessionThresholdMonitor;

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { tokenExtractor } from "@/lib/tokenExtractor";
import { notify } from "@/components/notifications";
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
  maxContextTokens: 200000, // 🔧 FIX: Claude 4.5 Sonnet 实际上下文窗口是 200K
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

  // 🔧 FIX v2.5.3: 正确计算上下文大小
  // 每条消息的 input_tokens 已经包含了之前所有消息的上下文
  // 所以只需要取最后一条 assistant 消息的 input_tokens 即可
  const calculateActualTokenCount = useCallback((msgs: ClaudeStreamMessage[]): number => {
    // 从后往前找最后一条有 usage 数据的 assistant 消息
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      if (msg.type === "assistant") {
        const tokens = tokenExtractor.extract(msg);
        // input_tokens 代表当前上下文大小（包含所有历史消息）
        // output_tokens 是本次回复的 token 数
        if (tokens.input_tokens > 0) {
          return tokens.input_tokens + tokens.output_tokens;
        }
      }
    }
    return 0;
  }, []);

  // 🔧 备用：字符估算（当没有 usage 数据时使用）
  const estimateTokenCount = useCallback((msgs: ClaudeStreamMessage[]): number => {
    // 先尝试使用实际 usage 数据
    const actualTokens = calculateActualTokenCount(msgs);
    if (actualTokens > 0) {
      return actualTokens;
    }

    // 回退到字符估算（改进版：中文 1 字符 ≈ 2 tokens，英文 1 token ≈ 4 字符）
    let totalTokens = 0;

    for (const msg of msgs) {
      if (msg.type === "user" || msg.type === "assistant") {
        const content = extractTextContent(msg);
        // 统计中文字符和非中文字符
        const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = content.length - chineseChars;
        // 中文：1 字符 ≈ 2 tokens，其他：4 字符 ≈ 1 token
        totalTokens += chineseChars * 2 + Math.ceil(otherChars / 4);
      }
    }

    return totalTokens;
  }, [calculateActualTokenCount]);

  // 提取消息文本内容
  const extractTextContent = (msg: ClaudeStreamMessage): string => {
    const message = msg.message;
    if (!message) return "";

    if (typeof message === "string") return message;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .map((c: any) => (c.type === "text" ? c.text : ""))
        .filter(Boolean)
        .join("\n");
    }
    return "";
  };

  // Generate session summary using Claude API
  const generateSummary = useCallback(
    async (msgs: ClaudeStreamMessage[]): Promise<string> => {
      isGeneratingSummaryRef.current = true;
      setStatus((prev) => ({ ...prev, isGeneratingSummary: true }));

      try {
        // Extract text content from messages
        // 🔧 FIX: 添加类型检查，防止 content 不是数组时调用 map 报错
        const extractContent = (message: any): string => {
          if (!message) return "";

          // 如果 message 本身是字符串
          if (typeof message === "string") return message;

          // 如果 message.content 是字符串
          if (typeof message.content === "string") return message.content;

          // 如果 message.content 是数组
          if (Array.isArray(message.content)) {
            return message.content
              .map((c: any) => (c.type === "text" ? c.text : ""))
              .filter(Boolean)
              .join("\n");
          }

          // 其他情况返回空字符串
          return "";
        };

        const conversationText = msgs
          .map((msg, idx) => {
            if (msg.type === "user") {
              const content = extractContent(msg.message);
              return content ? `## User Message ${idx + 1}\n${content}` : "";
            } else if (msg.type === "assistant") {
              const content = extractContent(msg.message);
              return content ? `## Assistant Response ${idx + 1}\n${content}` : "";
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
        // 获取当前 Provider 配置，确保使用正确的 API Key 和 Base URL
        let apiKey: string | undefined;
        let apiBase: string | undefined;
        try {
          const providerConfig = await api.getCurrentProviderConfig();
          apiKey = providerConfig.anthropic_api_key || providerConfig.anthropic_auth_token;
          apiBase = providerConfig.anthropic_base_url;
        } catch (e) {
          console.warn("[useSessionThresholdMonitor] Failed to get provider config, using defaults:", e);
        }

        const summary = await api.generateTextWithLLM(summaryPrompt, "haiku", apiKey, apiBase);

        isGeneratingSummaryRef.current = false;
        setStatus((prev) => ({ ...prev, isGeneratingSummary: false }));
        onSummaryGenerated?.(summary);

        return summary;
      } catch (error) {
        // 🔧 FIX: 记录完整错误对象，包含 type、message、stack、context
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorInfo = {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
          context: {
            messagesCount: msgs.length,
            timestamp: new Date().toISOString(),
          },
        };
        console.error("[useSessionThresholdMonitor] Failed to generate summary:", errorInfo);
        isGeneratingSummaryRef.current = false;
        setStatus((prev) => ({ ...prev, isGeneratingSummary: false }));

        // 🆕 显示友好的错误通知，带"去修改"按钮
        const isAuthError = errorMessage.includes("401") ||
          errorMessage.includes("authentication") ||
          errorMessage.includes("API key") ||
          errorMessage.includes("Unauthorized");

        if (isAuthError) {
          notify.error("摘要生成失败：API 认证错误", {
            description: "请检查 API Key 和 Base URL 配置是否正确",
            position: "top-center",
            duration: 0, // 不自动关闭
            action: {
              label: "去修改",
              onClick: () => {
                // 打开设置页面的 API 配置
                window.dispatchEvent(new CustomEvent("open-settings", { detail: { tab: "provider" } }));
              },
            },
          });
        } else {
          notify.error("摘要生成失败", {
            description: errorMessage.slice(0, 100),
            position: "top-center",
            duration: 5000,
          });
        }

        // 🔧 FIX: 返回用户友好的回退摘要而不是抛出错误
        const fallbackSummary = `## 摘要生成失败

抱歉，无法自动生成会话摘要。

**错误信息**: ${errorInfo.errorMessage}

**建议操作**:
1. 检查 API Key 和 Base URL 配置
2. 确认网络连接正常
3. 稍后重试

---
*生成时间: ${new Date().toLocaleString()}*`;

        onSummaryGenerated?.(fallbackSummary);
        return fallbackSummary;
      }
    },
    [onSummaryGenerated],
  );

  // 🔧 FIX: 使用 ref 追踪 isGeneratingSummary，避免在依赖数组中包含 status
  const isGeneratingSummaryRef = useRef(false);

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
      isGeneratingSummary: isGeneratingSummaryRef.current,
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
  }, [messages, config, estimateTokenCount, onWarning, onCritical]);

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

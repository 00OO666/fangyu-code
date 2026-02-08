import { calculateMessageCost } from "@/lib/pricing";
import { aggregateSessionCost } from "@/lib/sessionCost";
import { tokenExtractor } from "@/lib/tokenExtractor";
import type { ClaudeStreamMessage } from "@/types/claude";
import type {
  PromptCostDetailItem,
  PromptCostItem,
  PromptCostSummary,
} from "@/lib/promptCostTypes";

function extractUserText(message: ClaudeStreamMessage): string {
  if (!message.message?.content) return "";

  const content = message.message.content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text || "")
      .join("\n");
  }

  if (text.includes("\\")) {
    text = text
      .replace(/\\\\n/g, "\n")
      .replace(/\\\\r/g, "\r")
      .replace(/\\\\t/g, "\t")
      .replace(/\\\\"/g, '"')
      .replace(/\\\\'/g, "'")
      .replace(/\\\\\\\\/g, "\\");
  }

  return text;
}

export function calculatePromptCostSummary(messages: ClaudeStreamMessage[]): PromptCostSummary {
  let promptIndex = 0;
  const items: PromptCostItem[] = [];

  let sessionDefaultModel: string | undefined;
  for (const msg of messages) {
    if ((msg as any).type === "system" && (msg as any).subtype === "init") {
      sessionDefaultModel = (msg as any).model;
      if (sessionDefaultModel) {
        break;
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const messageType = (message as any).type || (message.message as any)?.role;

    if (messageType !== "user") continue;

    const text = extractUserText(message);
    if (!text) continue;

    let tokens: PromptCostItem["tokens"] = undefined;
    let cost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;

    const toolCallsMap: Record<string, number> = {};
    let totalToolCalls = 0;

    let thinkingCount = 0;
    let thinkingTokens = 0;

    let displayEngine: string | undefined;
    let displayModel: string | undefined;

    const messageMap = new Map<
      string,
      { tokens: any; engine: string; model: string | undefined; actualCost: number | undefined }
    >();
    const costDetails: PromptCostDetailItem[] = [];

    for (let j = i + 1; j < messages.length; j++) {
      const nextMessage = messages[j];
      const nextType = (nextMessage as any).type || (nextMessage.message as any)?.role;

      if (nextType === "user") {
        break;
      }

      if (nextType === "assistant" || nextType === "system") {
        const messageId =
          (nextMessage as any)?.message?.id || (nextMessage as any).id || (nextMessage as any).uuid;
        const key = messageId || `index:${j}`;

        const extractedTokens = tokenExtractor.extract(nextMessage);
        const msgEngine = (nextMessage as any).engine || "claude";
        const msgModel =
          (nextMessage as any).model || (nextMessage as any)?.message?.model || sessionDefaultModel;
        const msgCostUsd =
          (nextMessage as any).costUSD ??
          (nextMessage as any).totalCostUSD ??
          (nextMessage as any).cost_usd ??
          (nextMessage as any).total_cost_usd;

        const existing = messageMap.get(key);
        const totalTokenCount =
          extractedTokens.input_tokens +
          extractedTokens.output_tokens +
          extractedTokens.cache_read_tokens +
          extractedTokens.cache_creation_tokens;
        const existingTokenCount = existing
          ? existing.tokens.input_tokens +
            existing.tokens.output_tokens +
            existing.tokens.cache_read_tokens +
            existing.tokens.cache_creation_tokens
          : 0;

        if (!existing || totalTokenCount > existingTokenCount) {
          messageMap.set(key, {
            tokens: extractedTokens,
            engine: msgEngine,
            model: msgModel,
            actualCost: msgCostUsd,
          });

          if (totalTokenCount > 0) {
            let detailType: PromptCostDetailItem["type"] = "other";
            let description = "";

            if (nextType === "system") {
              detailType = "system";
              const subtype = (nextMessage as any).subtype;
              description = subtype ? `系统消息 (${subtype})` : "系统消息";
            } else if (nextMessage.message?.content) {
              const content = Array.isArray(nextMessage.message.content)
                ? nextMessage.message.content
                : [nextMessage.message.content];

              const hasThinking = content.some((block: any) => block.type === "thinking");
              const hasToolUse = content.some((block: any) => block.type === "tool_use");

              if (hasThinking) {
                detailType = "thinking";
                description = "Claude Code 思考";
              } else if (hasToolUse) {
                detailType = "tool_call";
                const toolNames = content
                  .filter((block: any) => block.type === "tool_use")
                  .map((block: any) => block.name)
                  .join(", ");
                description = `工具调用: ${toolNames}`;
              } else {
                detailType = "assistant";
                description = "AI 回复";
              }
            }

            const messageCost =
              typeof msgCostUsd === "number" && msgCostUsd > 0
                ? msgCostUsd
                : calculateMessageCost(extractedTokens, msgModel, msgEngine);

            costDetails.push({
              type: detailType,
              description,
              cost: messageCost,
              tokens: {
                input: extractedTokens.input_tokens,
                output: extractedTokens.output_tokens,
                cacheRead: extractedTokens.cache_read_tokens,
                cacheWrite: extractedTokens.cache_creation_tokens,
              },
              model: msgModel,
              engine: msgEngine,
              messageIndex: j,
            });
          }
        }

        if (!displayEngine) displayEngine = msgEngine;
        if (!displayModel) displayModel = msgModel;

        if (nextMessage.message?.content) {
          const content = Array.isArray(nextMessage.message.content)
            ? nextMessage.message.content
            : [nextMessage.message.content];

          content.forEach((block: any) => {
            if (block.type === "tool_use") {
              totalToolCalls++;
              const toolName = block.name || "unknown";
              toolCallsMap[toolName] = (toolCallsMap[toolName] || 0) + 1;
            }

            if (block.type === "thinking") {
              thinkingCount++;
              thinkingTokens += block.thinking_tokens || 0;
            }
          });
        }
      }
    }

    for (const entry of messageMap.values()) {
      totalInput += entry.tokens.input_tokens;
      totalOutput += entry.tokens.output_tokens;
      totalCacheRead += entry.tokens.cache_read_tokens;
      totalCacheWrite += entry.tokens.cache_creation_tokens;
      const actualCostUsd = entry.actualCost;
      if (typeof actualCostUsd === "number" && actualCostUsd > 0) {
        cost += actualCostUsd;
      } else {
        cost += calculateMessageCost(entry.tokens, entry.model, entry.engine);
      }
    }

    const totalTokens = totalInput + totalOutput + totalCacheRead + totalCacheWrite;
    if (totalTokens > 0) {
      tokens = {
        input: totalInput,
        output: totalOutput,
        cacheRead: totalCacheRead,
        cacheWrite: totalCacheWrite,
        total: totalTokens,
      };
    }

    const cacheHitRate =
      totalInput > 0 ? Math.round((totalCacheRead / totalInput) * 100) : undefined;

    items.push({
      promptIndex,
      content: text,
      timestamp: (message as any).sentAt || (message as any).timestamp,
      tokens,
      cost: totalTokens > 0 ? cost : undefined,
      toolCalls: totalToolCalls > 0 ? { total: totalToolCalls, byType: toolCallsMap } : undefined,
      thinking: thinkingCount > 0 ? { count: thinkingCount, tokens: thinkingTokens } : undefined,
      cacheHitRate,
      engine: displayEngine,
      model: displayModel,
      costDetails: costDetails.length > 0 ? costDetails : undefined,
    });

    promptIndex++;
  }

  const orderedItems = items.reverse();
  const promptsTotalCost = orderedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const sessionAggregation = messages.length > 0 ? aggregateSessionCost(messages) : null;

  return {
    items: orderedItems,
    promptsTotalCost,
    sessionTotalCost: sessionAggregation?.totals.totalCost || 0,
    sessionTotals: sessionAggregation?.totals || {
      totalCost: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  };
}

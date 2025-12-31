import React from "react";
import { useMessagesContext, type ToolResultEntry } from "@/contexts/MessagesContext";
import type { ClaudeStreamMessage } from "@/types/claude";

type ToolStatus = "pending" | "success" | "error";

export interface UseToolResultsReturn {
  toolResults: Map<string, ToolResultEntry>;
  getResultById: (toolUseId?: string | null) => ToolResultEntry | undefined;
  getResultsForMessage: (message: ClaudeStreamMessage | undefined) => ToolResultEntry[];
  getStatusById: (toolUseId?: string | null) => ToolStatus;
}

export const useToolResults = (): UseToolResultsReturn => {
  const { toolResults } = useMessagesContext();

  const getResultById = React.useCallback(
    (toolUseId?: string | null) => {
      if (!toolUseId) {
        return undefined;
      }
      return toolResults.get(toolUseId);
    },
    [toolResults]
  );

  const getResultsForMessage = React.useCallback(
    (message: ClaudeStreamMessage | undefined) => {
      if (!message || !Array.isArray(message.message?.content)) {
        return [];
      }

      const results: ToolResultEntry[] = [];

      message.message!.content.forEach((item: any) => {
        if (item?.type === "tool_use" && item.id) {
          const result = toolResults.get(item.id);
          if (result) {
            results.push(result);
          }
        }
      });

      return results;
    },
    [toolResults]
  );

  const getStatusById = React.useCallback(
    (toolUseId?: string | null): ToolStatus => {
      if (!toolUseId) {
        return "pending";
      }

      const result = toolResults.get(toolUseId);
      if (!result) {
        return "pending";
      }

      return result.isError ? "error" : "success";
    },
    [toolResults]
  );

  return {
    toolResults,
    getResultById,
    getResultsForMessage,
    getStatusById,
  };
};



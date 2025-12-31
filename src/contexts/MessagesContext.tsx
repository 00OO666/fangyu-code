import React from "react";
import type { ClaudeStreamMessage } from "@/types/claude";

export interface ToolResultEntry {
  toolUseId: string;
  content?: any;
  isError?: boolean;
  sourceMessage?: ClaudeStreamMessage;
}

export interface MessageFilterConfig {
  hideWarmupMessages: boolean;
}

// ✅ 性能优化: 拆分为数据和操作两个 Context
// 这样只使用操作函数的组件不会因数据更新而重渲染

interface MessagesDataContextValue {
  messages: ClaudeStreamMessage[];
  isStreaming: boolean;
  filterConfig: MessageFilterConfig;
  toolResults: Map<string, ToolResultEntry>;
}

interface MessagesActionsContextValue {
  setMessages: React.Dispatch<React.SetStateAction<ClaudeStreamMessage[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setFilterConfig: React.Dispatch<React.SetStateAction<MessageFilterConfig>>;
}

const MessagesDataContext = React.createContext<MessagesDataContextValue | undefined>(undefined);
const MessagesActionsContext = React.createContext<MessagesActionsContextValue | undefined>(undefined);

const buildToolResultMap = (messages: ClaudeStreamMessage[]): Map<string, ToolResultEntry> => {
  const results = new Map<string, ToolResultEntry>();

  messages.forEach((msg) => {
    const content = msg.message?.content;

    if (Array.isArray(content)) {
      content.forEach((item: any) => {
        if (item && item.type === "tool_result" && item.tool_use_id) {
          results.set(item.tool_use_id, {
            toolUseId: item.tool_use_id,
            content: item.content ?? item.result ?? item,
            isError: Boolean(item.is_error),
            sourceMessage: msg,
          });
        }
      });
    }
  });

  return results;
};

interface MessagesProviderProps {
  initialMessages?: ClaudeStreamMessage[];
  initialIsStreaming?: boolean;
  initialFilterConfig?: Partial<MessageFilterConfig>;
  children: React.ReactNode;
}

const defaultFilterConfig: MessageFilterConfig = {
  hideWarmupMessages: true,
};

export const MessagesProvider: React.FC<MessagesProviderProps> = ({
  initialMessages = [],
  initialIsStreaming = false,
  initialFilterConfig,
  children,
}) => {
  const [messages, setMessages] = React.useState<ClaudeStreamMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = React.useState<boolean>(initialIsStreaming);
  const [filterConfig, setFilterConfig] = React.useState<MessageFilterConfig>({
    hideWarmupMessages:
      initialFilterConfig?.hideWarmupMessages !== undefined
        ? initialFilterConfig.hideWarmupMessages
        : defaultFilterConfig.hideWarmupMessages,
  });

  const toolResults = React.useMemo(() => buildToolResultMap(messages), [messages]);

  // ✅ 性能优化: 操作函数独立缓存，确保引用稳定
  const actionsValue = React.useMemo<MessagesActionsContextValue>(
    () => ({
      setMessages,
      setIsStreaming,
      setFilterConfig,
    }),
    [setMessages, setIsStreaming, setFilterConfig]
  );

  // ✅ 性能优化: 数据独立缓存
  const dataValue = React.useMemo<MessagesDataContextValue>(
    () => ({
      messages,
      isStreaming,
      filterConfig,
      toolResults,
    }),
    [messages, isStreaming, filterConfig, toolResults]
  );

  return (
    <MessagesActionsContext.Provider value={actionsValue}>
      <MessagesDataContext.Provider value={dataValue}>
        {children}
      </MessagesDataContext.Provider>
    </MessagesActionsContext.Provider>
  );
};

// ✅ 性能优化: 只获取数据的 Hook（数据更新时会重渲染）
export const useMessagesData = (): MessagesDataContextValue => {
  const context = React.useContext(MessagesDataContext);
  if (!context) {
    throw new Error("useMessagesData must be used within a MessagesProvider");
  }
  return context;
};

// ✅ 性能优化: 只获取操作函数的 Hook（数据更新时不会重渲染）
export const useMessagesActions = (): MessagesActionsContextValue => {
  const context = React.useContext(MessagesActionsContext);
  if (!context) {
    throw new Error("useMessagesActions must be used within a MessagesProvider");
  }
  return context;
};

// ✅ 兼容性: 保留原有 API，同时获取数据和操作
// 建议新代码使用 useMessagesData 或 useMessagesActions
export const useMessagesContext = () => {
  const data = useMessagesData();
  const actions = useMessagesActions();
  return { ...data, ...actions };
};

MessagesProvider.displayName = "MessagesProvider";



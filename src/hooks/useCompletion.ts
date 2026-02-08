/**
 * useCompletion Hook
 *
 * 代码补全管理 Hook，提供：
 * - 自动触发补全
 * - 手动触发补全
 * - 补全项选择和应用
 * - 键盘导航
 */

import { logger } from "@/lib/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CompletionConfig,
  CompletionContext,
  CompletionItem,
  CompletionProvider,
  CompletionResult,
  CompletionState,
} from "@/types/completion";
import { getKeywordCompletions, getSnippetCompletions } from "@/types/completion";

// 默认配置
const DEFAULT_CONFIG: Required<CompletionConfig> = {
  enabled: true,
  autoTrigger: true,
  triggerDelay: 150,
  maxItems: 20,
  enableAI: false,
  aiModel: "claude-3-haiku",
  showDocumentation: true,
  shortcuts: {
    trigger: "Ctrl+Space",
    accept: "Tab",
    next: "ArrowDown",
    previous: "ArrowUp",
    dismiss: "Escape",
  },
};

// 默认触发字符
const DEFAULT_TRIGGER_CHARS = [".", ":", "<", "/", "@", "#"];

/**
 * 代码补全 Hook
 */
export function useCompletion(config: CompletionConfig = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // 状态
  const [state, setState] = useState<CompletionState>({
    visible: false,
    loading: false,
    selectedIndex: 0,
    result: null,
    context: null,
  });

  // Refs
  const triggerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const providersRef = useRef<CompletionProvider[]>([]);
  const configRef = useRef(mergedConfig);

  // 更新配置引用
  useEffect(() => {
    configRef.current = mergedConfig;
  }, [mergedConfig]);

  /**
   * 注册补全提供者
   */
  const registerProvider = useCallback((provider: CompletionProvider) => {
    providersRef.current.push(provider);
    return () => {
      providersRef.current = providersRef.current.filter((p) => p.id !== provider.id);
    };
  }, []);

  /**
   * 获取补全项
   */
  const getCompletions = useCallback(
    async (context: CompletionContext): Promise<CompletionResult> => {
      const items: CompletionItem[] = [];
      const language = context.language || "javascript";

      // 1. 获取关键字补全
      const keywords = getKeywordCompletions(language);
      items.push(...keywords);

      // 2. 获取代码片段补全
      const snippets = getSnippetCompletions(language);
      items.push(...snippets);

      // 3. 调用注册的提供者
      for (const provider of providersRef.current) {
        // 检查语言支持
        if (provider.languages && !provider.languages.includes(language)) {
          continue;
        }

        try {
          const result = await provider.provideCompletions(context);
          items.push(...result.items);
        } catch (error) {
          logger.error("useCompletion", `[Completion] Provider ${provider.id} error:`, error);
        }
      }

      // 4. 过滤和排序
      const currentWord = context.currentWord.toLowerCase();
      const filtered = items
        .filter((item) => {
          const filterText = (item.filterText || item.label).toLowerCase();
          return filterText.includes(currentWord) || currentWord.includes(filterText);
        })
        .sort((a, b) => {
          // 按优先级排序
          const priorityA = a.sortPriority ?? 100;
          const priorityB = b.sortPriority ?? 100;
          if (priorityA !== priorityB) return priorityA - priorityB;

          // 按匹配度排序（前缀匹配优先）
          const aStartsWith = a.label.toLowerCase().startsWith(currentWord);
          const bStartsWith = b.label.toLowerCase().startsWith(currentWord);
          if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;

          // 按字母排序
          return a.label.localeCompare(b.label);
        })
        .slice(0, configRef.current.maxItems);

      return {
        items: filtered,
        isComplete: true,
      };
    },
    []
  );

  /**
   * 触发补全
   */
  const trigger = useCallback(
    async (context: CompletionContext) => {
      if (!configRef.current.enabled) return;

      setState((prev) => ({ ...prev, loading: true, context }));

      try {
        const result = await getCompletions(context);

        setState((prev) => ({
          ...prev,
          visible: result.items.length > 0,
          loading: false,
          selectedIndex: 0,
          result,
        }));
      } catch (error) {
        logger.error("useCompletion", "[Completion] Error:", error);
        setState((prev) => ({
          ...prev,
          visible: false,
          loading: false,
          error: String(error),
        }));
      }
    },
    [getCompletions]
  );

  /**
   * 延迟触发（用于自动触发）
   */
  const triggerDelayed = useCallback(
    (context: CompletionContext) => {
      if (triggerTimerRef.current) {
        clearTimeout(triggerTimerRef.current);
      }

      triggerTimerRef.current = setTimeout(() => {
        trigger(context);
      }, configRef.current.triggerDelay);
    },
    [trigger]
  );

  /**
   * 处理输入变化
   */
  const handleInput = useCallback(
    (context: CompletionContext) => {
      if (!configRef.current.autoTrigger) return;

      // 检查是否是触发字符
      const lastChar = context.textBeforeCursor.slice(-1);
      const isTriggerChar = DEFAULT_TRIGGER_CHARS.includes(lastChar);

      // 检查当前词长度
      const hasWord = context.currentWord.length >= 2;

      if (isTriggerChar || hasWord) {
        triggerDelayed(context);
      } else {
        dismiss();
      }
    },
    [triggerDelayed]
  );

  /**
   * 关闭补全
   */
  const dismiss = useCallback(() => {
    if (triggerTimerRef.current) {
      clearTimeout(triggerTimerRef.current);
    }
    setState((prev) => ({
      ...prev,
      visible: false,
      result: null,
      context: null,
      selectedIndex: 0,
    }));
  }, []);

  /**
   * 选择下一项
   */
  const selectNext = useCallback(() => {
    setState((prev) => {
      if (!prev.result || prev.result.items.length === 0) return prev;
      const nextIndex = (prev.selectedIndex + 1) % prev.result.items.length;
      return { ...prev, selectedIndex: nextIndex };
    });
  }, []);

  /**
   * 选择上一项
   */
  const selectPrevious = useCallback(() => {
    setState((prev) => {
      if (!prev.result || prev.result.items.length === 0) return prev;
      const prevIndex =
        prev.selectedIndex === 0 ? prev.result.items.length - 1 : prev.selectedIndex - 1;
      return { ...prev, selectedIndex: prevIndex };
    });
  }, []);

  /**
   * 选择指定索引
   */
  const selectIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, selectedIndex: index }));
  }, []);

  /**
   * 获取当前选中项
   */
  const getSelectedItem = useCallback((): CompletionItem | null => {
    if (!state.result || state.result.items.length === 0) return null;
    return state.result.items[state.selectedIndex] || null;
  }, [state.result, state.selectedIndex]);

  /**
   * 应用补全
   */
  const apply = useCallback(
    (item?: CompletionItem): string | null => {
      const targetItem = item || getSelectedItem();
      if (!targetItem) return null;

      dismiss();
      return targetItem.insertText || targetItem.label;
    },
    [getSelectedItem, dismiss]
  );

  // 清理
  useEffect(() => {
    return () => {
      if (triggerTimerRef.current) {
        clearTimeout(triggerTimerRef.current);
      }
    };
  }, []);

  return {
    // 状态
    ...state,
    items: state.result?.items || [],

    // 方法
    trigger,
    triggerDelayed,
    handleInput,
    dismiss,
    selectNext,
    selectPrevious,
    selectIndex,
    getSelectedItem,
    apply,
    registerProvider,

    // 配置
    config: mergedConfig,
  };
}

export default useCompletion;

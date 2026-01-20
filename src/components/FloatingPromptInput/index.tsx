import { logger } from '@/lib/logger';
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useReducer, useCallback, useContext, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingPromptInputProps, FloatingPromptInputRef, ThinkingMode, ModelType, ModelConfig } from "./types";
import { THINKING_MODES, MODELS } from "./constants";
import { useImageHandling } from "./hooks/useImageHandling";
import { useFileSelection } from "./hooks/useFileSelection";
import { usePromptEnhancement } from "./hooks/usePromptEnhancement";
import { usePromptSuggestion } from "./hooks/usePromptSuggestion";
import { useDraftPersistence } from "./hooks/useDraftPersistence";
import { useSlashCommandMenu } from "./hooks/useSlashCommandMenu";
import { useCustomSlashCommands } from "./hooks/useCustomSlashCommands";
import { api } from "@/lib/api";
import { getEnabledProviders } from "@/lib/promptEnhancementService";
import { inputReducer, initialState } from "./reducer";
import { getDefaultModel } from "./defaultModelStorage";

// 🔧 FIX: 移除 Zustand Store 导入，直接使用父组件传入的 props
// import { useExecutionEngineConfig, useSetExecutionEngineConfig } from "@/stores/sessionStore";

// Memory Import功能
import { useMemoryDetection } from "@/hooks/useMemoryDetection";
import { MemoryImportSuggestion } from "@/components/MemoryImportSuggestion";

// 🆕 Prompt Queue 功能
import { PromptQueueContext, type PromptSendMode, type PromptQueueContextValue } from "@/hooks/usePromptQueue";
import { PromptQueuePanel } from "./PromptQueuePanel";

// 🆕 预填充消息支持（用于摘要续接等场景）
import { useConsumePrefillMessage } from "@/stores/sessionStore";

// Import sub-components
import { InputArea } from "./InputArea";
import { AttachmentPreview } from "./AttachmentPreview";
import { ControlBar } from "./ControlBar";
import { ExpandedModal } from "./ExpandedModal";
import { FileDropZone, type FileAttachment } from "@/components/FileDropZone";
import { useFileAttachments } from "@/hooks/useFileAttachments";

// Re-export types for external use
export type { FloatingPromptInputRef, FloatingPromptInputProps, ThinkingMode, ModelType } from "./types";

/**
 * FloatingPromptInput - Refactored modular component
 */
const FloatingPromptInputInner = (
  {
    onSend,
    isLoading = false,
    disabled = false,
    defaultModel = "sonnet",
    sessionModel,
    projectPath,
    sessionId,
    projectId,
    className,
    onCancel,
    getConversationContext,
    messages,
    isPlanMode = false,
    onTogglePlanMode,
    sessionCost,
    sessionStats,
    hasMessages = false,
    session,
    codexRateLimits,
    executionEngineConfig: externalEngineConfig,
    onExecutionEngineConfigChange,
    onOpenCanvas,
    hasPreviewableCode,
    codeSource,
    onToggleUsageDashboard,
    showUsageDashboard,
    onToggleMCPConfig,
    // 🔧 以下属性已弃用，保留接口兼容性但不使用
    compactStatus: _compactStatus,
    isCompacting: _isCompacting,
    compactProgress: _compactProgress,
    deltaMessagesCount: _deltaMessagesCount,
  }: FloatingPromptInputProps,
  ref: React.Ref<FloatingPromptInputRef>,
) => {
  // 🆕 使用父组件传入的配置，而不是 Zustand Store
  // 🔧 FIX: 移除 Zustand store 的使用，避免双重状态管理导致无限循环
  // 父组件 ClaudeCodeSession 已经管理了 executionEngineConfig 状态
  const executionEngineConfig = externalEngineConfig || {
    engine: 'claude' as const,
    codexMode: 'read-only' as const,
    codexModel: 'gpt-5.2',
    geminiModel: 'gemini-3-flash',
  };
  const setExecutionEngineConfig = onExecutionEngineConfigChange || (() => { });

  // 🔧 FIX: 使用 useReducer 的第三个参数（lazy initialization）避免每次渲染都调用 getInitialModel
  // 原问题：传递对象表达式作为初始状态时，表达式会在每次渲染时被求值，导致 console.log 输出 1000+ 次
  const [state, dispatch] = useReducer(inputReducer, null, () => {
    // Determine initial model:
    // 1. Historical session: use sessionModel
    // 2. New session: use user's default model or fallback to "sonnet"
    const parseModel = (modelStr?: string): ModelType | null => {
      if (!modelStr) return null;
      const lowerModel = modelStr.toLowerCase();
      if (lowerModel.includes("opus")) return "opus";
      if (lowerModel.includes("sonnet") && lowerModel.includes("1m")) return "sonnet1m";
      if (lowerModel.includes("sonnet")) return "sonnet";
      return null;
    };

    const parsedSessionModel = parseModel(sessionModel);
    let selectedModel: ModelType;

    if (parsedSessionModel) {
      logger.debug('index', '[FloatingPromptInput] 历史会话，使用保存的模型:', parsedSessionModel);
      selectedModel = parsedSessionModel;
    } else {
      const userDefaultModel = getDefaultModel();
      if (userDefaultModel) {
        logger.debug('index', '[FloatingPromptInput] 新会话，使用用户默认模型:', userDefaultModel);
        selectedModel = userDefaultModel;
      } else {
        logger.debug('index', '[FloatingPromptInput] 未设置默认模型，回退到:', defaultModel);
        selectedModel = defaultModel;
      }
    }

    return {
      ...initialState,
      selectedModel,
    };
  });

  // 🔧 FIX: 提取稳定的回调函数，避免每次渲染都创建新函数
  const handlePromptChange = useCallback((p: string) => {
    dispatch({ type: "SET_PROMPT", payload: p });
  }, []);

  const handleCursorPositionChange = useCallback((p: number) => {
    dispatch({ type: "SET_CURSOR_POSITION", payload: p });
  }, []);

  const handleSetModel = useCallback((model: ModelType) => {
    dispatch({ type: "SET_MODEL", payload: model });
  }, []);

  const handleSetEnableProjectContext = useCallback((enable: boolean) => {
    dispatch({ type: "SET_ENABLE_PROJECT_CONTEXT", payload: enable });
  }, []);

  const handleSetShowCostPopover = useCallback((show: boolean) => {
    dispatch({ type: "SET_SHOW_COST_POPOVER", payload: show });
  }, []);

  const handleSetExpanded = useCallback((expanded: boolean) => {
    dispatch({ type: "SET_EXPANDED", payload: expanded });
  }, []);

  const handleCloseExpanded = useCallback(() => {
    dispatch({ type: "SET_EXPANDED", payload: false });
  }, []);

  const handleOpenExpanded = useCallback(() => {
    dispatch({ type: "SET_EXPANDED", payload: true });
  }, []);

  // 🔧 Mac 输入法兼容：composition 事件回调
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    compositionEndTimeRef.current = Date.now();
  }, []);

  // 🔧 FIX: 稳定的回调函数，避免每次渲染创建新函数
  const handleNoopCancel = useCallback(() => { }, []);

  const handleToggleQueuePanel = useCallback(() => {
    setShowQueuePanel(prev => !prev);
  }, []);

  const handleMemoryImportComplete = useCallback(() => {
    logger.debug('index', '[FloatingPromptInput] Memory imported successfully');
  }, []);

  const handleCloseMemoryPanel = useCallback(() => {
    setShowMemoryPanel(false);
  }, []);

  const handleCloseQueuePanel = useCallback(() => {
    setShowQueuePanel(false);
  }, []);

  // 🆕 文件附件管理（支持图片、PDF、Word、Excel、PPT）
  const fileAttachments = useFileAttachments({
    maxFiles: 10,
    maxFileSize: 20 * 1024 * 1024, // 20MB
  });

  // 🆕 智能记忆检测（必须在 state 初始化之后）
  // ⚠️ 临时禁用：调试崩溃问题
  const { matches: memoryMatches, hasMatches } = useMemoryDetection(state.prompt, {
    enabled: false, // TODO: 修复后恢复为 true
    debounceMs: 500,
    minLength: 3,
  });
  const [showMemoryPanel, setShowMemoryPanel] = useState(true);

  // 🆕 提示词队列管理
  // 🔧 FIX: 使用可选的 Context 访问，避免在 PromptQueueProvider 外部使用时崩溃
  const promptQueueContext = useContext(PromptQueueContext);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  
  // 🔧 FIX: 创建一个空的队列对象作为 fallback
  const emptyQueue: PromptQueueContextValue = useMemo(() => ({
    items: [],
    isProcessing: false,
    currentItemId: null,
    autoMerge: false,
    enqueue: () => ({ id: '', prompt: '', model: 'sonnet' as const, createdAt: 0, mode: 'sequential' as const, status: 'pending' as const }),
    dequeue: () => null,
    revokeToInput: () => null,
    markSending: () => {},
    markSent: () => {},
    markFailed: () => {},
    clearQueue: () => {},
    getNextSequential: () => null,
    getMergeItems: () => [],
    getMergedPrompt: () => null,
    reorderItem: () => {},
    updateItemMode: () => {},
    updateItemPrompt: () => {},
    setAutoMerge: () => {},
    getStats: () => ({ total: 0, pending: 0, sending: 0, sent: 0 }),
  }), []);
  
  const promptQueue = promptQueueContext || emptyQueue;
  
  // 🔧 FIX: 使用 useMemo 避免每次渲染都创建新数组
  const pendingCount = React.useMemo(
    () => promptQueue.items.filter(i => i.status === 'pending').length,
    [promptQueue.items]
  );

  // 🆕 自动队列处理：使用 ref 存储最新值，避免 useEffect 依赖导致的频繁执行
  const latestRefs = useRef({ promptQueue, onSend });

  // 🔧 FIX: 使用 useEffect 更新 ref，避免在渲染期间直接赋值
  useEffect(() => {
    latestRefs.current = { promptQueue, onSend };
  });

  // 🆕 追踪 isLoading 变化，AI 完成后自动处理队列（只依赖 isLoading）
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    // AI 刚完成任务，自动处理下一个队列项
    if (wasLoading && !isLoading) {
      const timer = setTimeout(() => {
        const { promptQueue: queue, onSend: send } = latestRefs.current;
        const nextItem = queue.getNextSequential();
        if (nextItem) {
          logger.debug('index', '[FloatingPromptInput] Auto-processing next queue item:', nextItem.id);
          queue.dequeue(nextItem.id);
          send(nextItem.prompt, nextItem.model, undefined, false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]); // 只依赖 isLoading，避免无限循环


  // 草稿持久化 Hook - 确保输入内容在页面切换后不丢失
  const { saveDraft, clearDraft } = useDraftPersistence({
    sessionId,
    onRestore: useCallback((draft: string) => {
      // 恢复草稿时更新 prompt 状态
      dispatch({ type: "SET_PROMPT", payload: draft });
    }, []),
  });

  // 🆕 预填充消息支持（用于摘要续接等场景）
  const consumePrefillMessage = useConsumePrefillMessage();
  useEffect(() => {
    // 组件挂载时检查是否有预填充消息
    const prefillMessage = consumePrefillMessage();
    if (prefillMessage) {
      logger.debug('index', '[FloatingPromptInput] 检测到预填充消息，自动填充到输入框');
      dispatch({ type: "SET_PROMPT", payload: prefillMessage });
    }
  }, []); // 只在组件挂载时执行一次

  // Initialize enableProjectContext from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('enable_project_context');
      if (stored === 'true') {
        dispatch({ type: "SET_ENABLE_PROJECT_CONTEXT", payload: true });
      }
    } catch {
      // Ignore error
    }
  }, []);

  // Initialize thinking mode from settings.json (source of truth)
  // 🔥 修复：从 settings.json 读取 MAX_THINKING_TOKENS 的真实状态，而不是仅依赖 localStorage
  useEffect(() => {
    const initThinkingMode = async () => {
      try {
        // 从 settings.json 读取真实状态
        const settings = await api.getClaudeSettings();
        const hasMaxThinkingTokens = settings?.env?.MAX_THINKING_TOKENS !== undefined;
        const actualMode = hasMaxThinkingTokens ? 'on' : 'off';

        dispatch({ type: "SET_THINKING_MODE", payload: actualMode });

        // 同步更新 localStorage 以保持一致
        localStorage.setItem('thinking_mode', actualMode);
      } catch (error) {
        logger.error('index', '[ThinkingMode] Failed to read settings, falling back to localStorage:', error);
        // 降级：从 localStorage 读取
        try {
          const stored = localStorage.getItem('thinking_mode');
          if (stored === 'off' || stored === 'on') {
            dispatch({ type: "SET_THINKING_MODE", payload: stored });
          }
        } catch {
          // Ignore error
        }
      }
    };

    initThinkingMode();
  }, []);

  // 🔧 FIX: 移除了双向同步的 useEffect，因为现在直接使用父组件传入的 props
  // 不再需要 Zustand store 同步逻辑

  // Dynamic model list
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(MODELS);

  // 🔧 Mac 输入法兼容：追踪 IME 组合输入状态
  const [isComposing, setIsComposing] = useState(false);
  // 记录 compositionend 时间戳，用于冷却期检测
  const compositionEndTimeRef = useRef(0);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Custom hooks
  const {
    imageAttachments,
    embeddedImages,
    dragActive,
    handlePaste,
    handleRemoveImageAttachment,
    handleRemoveEmbeddedImage,
    handleDrag,
    handleDrop,
    addImage,
    setImageAttachments,
    setEmbeddedImages,
  } = useImageHandling({
    prompt: state.prompt,
    projectPath,
    isExpanded: state.isExpanded,
    onPromptChange: handlePromptChange,
    textareaRef,
    expandedTextareaRef,
  });

  const {
    showFilePicker,
    filePickerQuery,
    detectAtSymbol,
    updateFilePickerQuery,
    handleFileSelect,
    handleFilePickerClose,
    setShowFilePicker,
    setFilePickerQuery,
  } = useFileSelection({
    prompt: state.prompt,
    projectPath,
    cursorPosition: state.cursorPosition,
    isExpanded: state.isExpanded,
    onPromptChange: handlePromptChange,
    onCursorPositionChange: handleCursorPositionChange,
    textareaRef,
    expandedTextareaRef,
  });


  const {
    isEnhancing,
    handleEnhancePromptWithAPI,
    enableDualAPI,
    setEnableDualAPI,
  } = usePromptEnhancement({
    prompt: state.prompt,
    isExpanded: state.isExpanded,
    onPromptChange: handlePromptChange,
    getConversationContext,
    messages,
    textareaRef,
    expandedTextareaRef,
    projectPath,
    sessionId,
    projectId,
    enableProjectContext: state.enableProjectContext,
    enableMultiRound: true,
  });

  // 🆕 Prompt Suggestions Hook
  const [enablePromptSuggestion, setEnablePromptSuggestion] = useState(() => {
    try {
      const stored = localStorage.getItem('enable_prompt_suggestion');
      return stored !== null ? stored === 'true' : true; // 默认启用
    } catch {
      return true;
    }
  });

  // Listen for setting changes from GeneralSettings
  useEffect(() => {
    const handleToggle = (e: CustomEvent<{ enabled: boolean }>) => {
      setEnablePromptSuggestion(e.detail.enabled);
    };
    window.addEventListener('prompt-suggestion-toggle', handleToggle as EventListener);
    return () => {
      window.removeEventListener('prompt-suggestion-toggle', handleToggle as EventListener);
    };
  }, []);

  const {
    suggestion,
    isLoading: isSuggestionLoading,
    acceptSuggestion,
    dismissSuggestion,
  } = usePromptSuggestion({
    messages: messages || [],
    currentPrompt: state.prompt,
    enabled: enablePromptSuggestion && !state.isExpanded && !isLoading && !disabled,
    debounceMs: 600,
  });

  // 🆕 斜杠命令支持 Claude 和 Gemini 引擎（Codex 暂不支持非交互式斜杠命令）
  const currentEngine = executionEngineConfig.engine;
  const isSlashCommandSupported = currentEngine === 'claude' || currentEngine === 'gemini';

  // 🆕 自定义斜杠命令 Hook - 从后端获取用户和项目命令
  // Claude: ~/.claude/commands/*.md
  // Gemini: ~/.gemini/commands/*.toml
  const { customCommands } = useCustomSlashCommands({
    projectPath,
    enabled: isSlashCommandSupported && !state.isExpanded && !disabled,
    engine: currentEngine,
  });

  // 🆕 斜杠命令菜单 Hook
  const {
    isOpen: showSlashCommandMenu,
    query: slashCommandQuery,
    selectedIndex: slashCommandSelectedIndex,
    setSelectedIndex: setSlashCommandSelectedIndex,
    selectCommand: handleSlashCommandSelect,
    closeMenu: closeSlashCommandMenu,
    handleKeyDown: handleSlashCommandKeyDown,
  } = useSlashCommandMenu({
    prompt: state.prompt,
    onCommandSelect: handlePromptChange,
    customCommands,
    // Claude 和 Gemini 都支持斜杠命令菜单
    disabled: !isSlashCommandSupported || state.isExpanded || disabled,
    engine: currentEngine,
  });

  // Persist project context switch
  useEffect(() => {
    try {
      localStorage.setItem('enable_project_context', state.enableProjectContext.toString());
    } catch (error) {
      logger.warn('index', 'Failed to save enable_project_context to localStorage:', error);
    }
  }, [state.enableProjectContext]);

  // Restore session model
  useEffect(() => {
    // 🔧 FIX: 内联解析函数，避免依赖外部函数
    const parseModel = (modelStr?: string): ModelType | null => {
      if (!modelStr) return null;
      const lowerModel = modelStr.toLowerCase();
      if (lowerModel.includes("opus")) return "opus";
      if (lowerModel.includes("sonnet") && lowerModel.includes("1m")) return "sonnet1m";
      if (lowerModel.includes("sonnet")) return "sonnet";
      return null;
    };

    const parsedSessionModel = parseModel(sessionModel);
    if (parsedSessionModel) {
      dispatch({ type: "SET_MODEL", payload: parsedSessionModel });
    }
  }, [sessionModel]);

  // Load custom models
  useEffect(() => {
    const loadCustomModel = async () => {
      try {
        const settings = await api.getClaudeSettings();
        const envVars = settings?.data?.env || settings?.env;

        if (envVars && typeof envVars === 'object') {
          const customModel = envVars.ANTHROPIC_MODEL ||
            envVars.ANTHROPIC_DEFAULT_SONNET_MODEL ||
            envVars.ANTHROPIC_DEFAULT_OPUS_MODEL;

          if (customModel && typeof customModel === 'string') {
            // Check if it's a built-in model ID (sonnet, opus, sonnet1m)
            const isBuiltInModel = ['sonnet', 'opus', 'sonnet1m'].includes(customModel.toLowerCase());

            if (!isBuiltInModel) {
              // This is a custom model - add it to the list
              const customModelConfig: ModelConfig = {
                id: "custom" as ModelType,
                name: customModel,
                description: "Custom model from environment variables",
                icon: <Sparkles className="h-4 w-4" />
              };

              setAvailableModels(prev => {
                const hasCustom = prev.some(m => m.id === "custom");
                if (!hasCustom) return [...prev, customModelConfig];
                // Update existing custom model if name changed
                return prev.map(m => m.id === "custom" ? customModelConfig : m);
              });
            }
          }
        }
      } catch (error) {
        logger.error('index', '[FloatingPromptInput] Failed to load custom model:', error);
      }
    };

    loadCustomModel();
  }, []);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    addImage,
    setPrompt: (text: string) => dispatch({ type: "SET_PROMPT", payload: text }),
  }));

  // Toggle thinking mode
  const handleToggleThinkingMode = useCallback(async () => {
    const currentMode = state.selectedThinkingMode;
    const newMode: ThinkingMode = currentMode === "off" ? "on" : "off";
    dispatch({ type: "SET_THINKING_MODE", payload: newMode });

    // Persist to localStorage
    try {
      localStorage.setItem('thinking_mode', newMode);
    } catch {
      // Ignore localStorage errors
    }

    try {
      const thinkingMode = THINKING_MODES.find(m => m.id === newMode);
      const enabled = newMode === "on";
      const tokens = thinkingMode?.tokens;
      await api.updateThinkingMode(enabled, tokens);
    } catch (error) {
      logger.error('index', "Failed to update thinking mode:", error);
      // Revert state and localStorage on API error
      const revertedMode = currentMode;
      dispatch({ type: "SET_THINKING_MODE", payload: revertedMode });
      try {
        localStorage.setItem('thinking_mode', revertedMode);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [state.selectedThinkingMode]);

  // Focus management
  useEffect(() => {
    if (state.isExpanded && expandedTextareaRef.current) {
      expandedTextareaRef.current.focus();
    } else if (!state.isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [state.isExpanded]);

  // Auto-resize textarea
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = state.isExpanded ? 600 : 300;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    if (textarea.scrollHeight > maxHeight) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  useEffect(() => {
    const textarea = state.isExpanded ? expandedTextareaRef.current : textareaRef.current;
    adjustTextareaHeight(textarea);
  }, [state.prompt, state.isExpanded]);

  // Tab key listener - 🆕 只在没有建议时切换 thinking mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeElement = document.activeElement;
        const isInTextarea = activeElement?.tagName === 'TEXTAREA';
        // 🆕 在 textarea 中且有建议时，不处理（由组件内部 handleKeyDown 处理）
        if (isInTextarea && suggestion) {
          return;
        }
        if (!isInTextarea && !disabled) {
          e.preventDefault();
          handleToggleThinkingMode();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [disabled, handleToggleThinkingMode, suggestion]);

  // Event handlers
  // 🆕 默认改为 interrupt 模式（插队指导/纠正）
  const handleSend = (sendMode: PromptSendMode = 'interrupt') => {
    // Allow sending if there's text content OR image attachments
    if ((state.prompt.trim() || imageAttachments.length > 0) && !disabled) {
      let finalPrompt = state.prompt.trim();
      // 保存原始输入，发送失败时可恢复
      const savedPrompt = finalPrompt;
      const savedAttachments = [...imageAttachments];
      const savedEmbedded = [...embeddedImages];

      if (imageAttachments.length > 0) {
        // Codex CLI doesn't recognize @ prefix syntax, use direct paths instead
        // Claude Code CLI uses @ prefix to reference files
        const isCodex = executionEngineConfig.engine === 'codex';
        const imagePathMentions = imageAttachments.map(attachment => {
          if (isCodex) {
            // For Codex: use direct path without @ prefix
            return attachment.filePath.includes(' ') ? `"${attachment.filePath}"` : attachment.filePath;
          } else {
            // For Claude Code: use @ prefix for file reference
            return attachment.filePath.includes(' ') ? `@"${attachment.filePath}"` : `@${attachment.filePath}`;
          }
        }).join(' ');

        finalPrompt = finalPrompt + (finalPrompt.endsWith(' ') || finalPrompt === '' ? '' : ' ') + imagePathMentions;
      }

      // 🆕 强规则：按 Enter 发送的提示词自动复制到剪贴板，方便找回
      try {
        navigator.clipboard.writeText(finalPrompt).then(() => {
          logger.debug('index', '[FloatingPromptInput] 提示词已复制到剪贴板:', finalPrompt.substring(0, 50) + '...');
        }).catch(err => {
          logger.warn('index', '[FloatingPromptInput] 复制到剪贴板失败:', err);
        });
      } catch (err) {
        logger.warn('index', '[FloatingPromptInput] 剪贴板 API 不可用:', err);
      }

      // When custom model is selected, pass the actual model name instead of "custom"
      let modelToSend = state.selectedModel;
      if (state.selectedModel === 'custom') {
        const customModelConfig = availableModels.find(m => m.id === 'custom');
        if (customModelConfig) {
          modelToSend = customModelConfig.name as ModelType;
        }
      }

      // 🆕 队列逻辑：如果 AI 正在工作且不是插队模式，加入队列
      if (isLoading && sendMode !== 'interrupt') {
        promptQueue.enqueue(finalPrompt, modelToSend, sendMode);
        logger.debug('index', '[FloatingPromptInput] AI 正在工作，已加入队列:', { mode: sendMode, promptPreview: finalPrompt.substring(0, 50) });

        // 清空输入框
        dispatch({ type: "RESET_INPUT" });
        setImageAttachments([]);
        setEmbeddedImages([]);
        clearDraft();
        setTimeout(() => {
          const textarea = state.isExpanded ? expandedTextareaRef.current : textareaRef.current;
          if (textarea) textarea.style.height = 'auto';
        }, 0);
        return;
      }

      // 🔧 FIX: 先立即清空输入框（用户即时反馈），然后异步执行 onSend，失败时恢复
      dispatch({ type: "RESET_INPUT" });
      setImageAttachments([]);
      setEmbeddedImages([]);
      clearDraft();
      setTimeout(() => {
        const textarea = state.isExpanded ? expandedTextareaRef.current : textareaRef.current;
        if (textarea) textarea.style.height = 'auto';
      }, 0);

      // 插队模式：直接发送，不添加前缀
      const promptToSend = finalPrompt;

      // 🆕 插队模式需要 forceImmediate=true 绕过 usePromptExecution 的队列检查
      const forceImmediate = sendMode === 'interrupt';

      // 异步执行 onSend，失败时恢复输入框
      Promise.resolve(onSend(promptToSend, modelToSend, undefined, forceImmediate)).catch((error) => {
        logger.error('index', '[FloatingPromptInput] 发送失败，恢复输入框:', error);
        dispatch({ type: "SET_PROMPT", payload: savedPrompt });
        setImageAttachments(savedAttachments);
        setEmbeddedImages(savedEmbedded);
        saveDraft(savedPrompt);
      });
    }
  };

  // 🆕 队列操作回调
  const handleRevokeToInput = useCallback((itemId: string) => {
    const revokedPrompt = promptQueue.revokeToInput(itemId);
    if (revokedPrompt) {
      dispatch({ type: "SET_PROMPT", payload: revokedPrompt });
      saveDraft(revokedPrompt);
      // 聚焦输入框
      setTimeout(() => {
        const textarea = state.isExpanded ? expandedTextareaRef.current : textareaRef.current;
        if (textarea) textarea.focus();
      }, 0);
    }
  }, [promptQueue, state.isExpanded, saveDraft]);

  const handleSendImmediate = useCallback((itemId: string) => {
    const item = promptQueue.items.find(i => i.id === itemId);
    if (item) {
      promptQueue.dequeue(itemId);
      if (isLoading) {
        // 插队模式：直接发送
        onSend(item.prompt, item.model, undefined, true);
      } else {
        // 直接发送：不添加前缀
        onSend(item.prompt, item.model, undefined, false);
      }
    }
  }, [promptQueue, onSend, isLoading]);

  const handleSendMerged = useCallback(() => {
    const mergedPrompt = promptQueue.getMergedPrompt();
    if (mergedPrompt) {
      const mergeItems = promptQueue.getMergeItems();
      // 标记所有 merge 项为已发送
      mergeItems.forEach(item => {
        promptQueue.markSent(item.id);
      });
      // 发送打包的提示词（forceImmediate=false，正常排队）
      onSend(mergedPrompt, state.selectedModel, undefined, false);
    }
  }, [promptQueue, onSend, state.selectedModel]);

  const handleDeleteQueueItem = useCallback((itemId: string) => {
    promptQueue.dequeue(itemId);
  }, [promptQueue]);

  const handleReorderQueueItem = useCallback((itemId: string, newIndex: number) => {
    promptQueue.reorderItem(itemId, newIndex);
  }, [promptQueue]);

  const handleUpdateQueueItemMode = useCallback((itemId: string, mode: PromptSendMode) => {
    promptQueue.updateItemMode(itemId, mode);
  }, [promptQueue]);

  // 🆕 更新队列项提示词
  const handleUpdateQueueItemPrompt = useCallback((itemId: string, prompt: string) => {
    promptQueue.updateItemPrompt(itemId, prompt);
  }, [promptQueue]);

  // 🆕 处理 AI 生成的图片（Nano Banana）
  const handleImageGenerated = useCallback(async (imageBase64: string, mimeType: string) => {
    try {
      // 将 base64 图片保存到临时文件，然后添加到附件
      const result = await api.saveClipboardImage(`data:${mimeType};base64,${imageBase64}`);

      if (result.success && result.file_path) {
        // 创建预览 URL
        const byteCharacters = atob(imageBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        // 添加到图片附件列表
        const newAttachment = {
          id: Date.now().toString(),
          filePath: result.file_path,
          previewUrl: blobUrl,
          width: 0,
          height: 0,
        };

        setImageAttachments(prev => [...prev, newAttachment]);
        logger.debug('index', '[FloatingPromptInput] AI 生成图片已添加到附件:', result.file_path);
      } else {
        logger.error('index', '[FloatingPromptInput] 保存 AI 生成图片失败:', result.error);
      }
    } catch (error) {
      logger.error('index', '[FloatingPromptInput] 处理 AI 生成图片失败:', error);
    }
  }, [setImageAttachments]);

  // 🆕 队列输入框提交（sequential 模式，等待执行）
  const handleQueueSubmit = useCallback((prompt: string, mode: PromptSendMode) => {
    if (prompt.trim()) {
      promptQueue.enqueue(prompt.trim(), state.selectedModel, mode);
      logger.debug('index', '[FloatingPromptInput] 加入队列:', { mode, promptPreview: prompt.substring(0, 50) });
    }
  }, [promptQueue, state.selectedModel]);

  // 🆕 优化提示词（调用 prompt enhancement API）
  const handleOptimizePrompt = useCallback(async (_itemId: string, originalPrompt: string): Promise<string | null> => {
    try {
      logger.debug('index', '[FloatingPromptInput] 优化提示词:', originalPrompt.substring(0, 50));
      // 调用 handleEnhancePromptWithAPI（需要临时设置 prompt）
      const savedPrompt = state.prompt;
      dispatch({ type: "SET_PROMPT", payload: originalPrompt });

      // 获取第一个可用的 provider
      const providers = getEnabledProviders();
      if (providers.length === 0) {
        logger.warn('index', '[FloatingPromptInput] 没有可用的优化 provider');
        dispatch({ type: "SET_PROMPT", payload: savedPrompt });
        return null;
      }

      // 等待优化完成
      await handleEnhancePromptWithAPI(providers[0].id);

      // 获取优化后的文本
      const optimizedPrompt = state.prompt;

      // 恢复原来的 prompt
      dispatch({ type: "SET_PROMPT", payload: savedPrompt });

      return optimizedPrompt !== originalPrompt ? optimizedPrompt : null;
    } catch (error) {
      logger.error('index', '[FloatingPromptInput] 优化失败:', error);
      return null;
    }
  }, [state.prompt, handleEnhancePromptWithAPI, getEnabledProviders]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;
    detectAtSymbol(newValue, newCursorPosition);
    updateFilePickerQuery(newValue, newCursorPosition);
    dispatch({ type: "SET_PROMPT", payload: newValue });
    dispatch({ type: "SET_CURSOR_POSITION", payload: newCursorPosition });
    // 保存草稿
    saveDraft(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 🆕 优先处理斜杠命令菜单的键盘事件
    if (handleSlashCommandKeyDown(e)) {
      return;
    }

    if (showFilePicker && e.key === 'Escape') {
      e.preventDefault();
      setShowFilePicker(false);
      setFilePickerQuery("");
      return;
    }

    // 🆕 Tab 键接受建议 (斜杠命令菜单未打开时)
    if (e.key === 'Tab' && !e.shiftKey && suggestion && !showFilePicker && !showSlashCommandMenu) {
      e.preventDefault();
      const accepted = acceptSuggestion();
      if (accepted) {
        dispatch({ type: "SET_PROMPT", payload: accepted });
      }
      return;
    }

    // 🆕 Escape 键取消建议
    if (e.key === 'Escape' && suggestion && !showFilePicker) {
      e.preventDefault();
      dismissSuggestion();
      return;
    }

    // 🔧 Enter 键发送消息（优化：简化 IME 检测，确保单次 Enter 即可发送）
    if (e.key === "Enter" && !e.shiftKey && !state.isExpanded && !showFilePicker) {
      // 简化输入法检测：只检查最核心的标志
      // 原生事件的 isComposing 属性足以判断是否在 IME 组合中
      if (!e.nativeEvent.isComposing && !isComposing) {
        e.preventDefault();
        dismissSuggestion(); // 发送时清除建议
        handleSend();
      }
    }
  };

  return (
    <>
      {/* Expanded Modal */}
      <AnimatePresence>
        {state.isExpanded && (
          <ExpandedModal
            ref={expandedTextareaRef}
            prompt={state.prompt}
            disabled={disabled}
            imageAttachments={imageAttachments}
            embeddedImages={embeddedImages}
            executionEngineConfig={executionEngineConfig}
            setExecutionEngineConfig={setExecutionEngineConfig}
            selectedModel={state.selectedModel}
            setSelectedModel={handleSetModel}
            availableModels={availableModels}
            selectedThinkingMode={state.selectedThinkingMode}
            handleToggleThinkingMode={handleToggleThinkingMode}
            isPlanMode={isPlanMode}
            onTogglePlanMode={onTogglePlanMode}
            isEnhancing={isEnhancing}
            projectPath={projectPath}
            enableProjectContext={state.enableProjectContext}
            setEnableProjectContext={handleSetEnableProjectContext}
            enableDualAPI={enableDualAPI}
            setEnableDualAPI={setEnableDualAPI}
            getEnabledProviders={getEnabledProviders}
            handleEnhancePromptWithAPI={handleEnhancePromptWithAPI}
            onClose={handleCloseExpanded}
            onRemoveAttachment={handleRemoveImageAttachment}
            onRemoveEmbedded={handleRemoveEmbeddedImage}
            onTextChange={handleTextChange}
            onPaste={handlePaste}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onSend={handleSend}
          />
        )}
      </AnimatePresence>

      {/* ✅ 重构布局: 输入区域不再使用 fixed 定位，作为 Flex 容器的一部分 */}
      <div className={cn(
        "flex-shrink-0 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] shadow-[var(--glass-shadow)]",
        className
      )}>
        <AttachmentPreview
          imageAttachments={imageAttachments}
          embeddedImages={embeddedImages}
          onRemoveAttachment={handleRemoveImageAttachment}
          onRemoveEmbedded={handleRemoveEmbeddedImage}
          className="border-b border-border/50 p-4"
        />

        {/* 🆕 文件附件区域（支持拖拽上传图片/PDF/Word/Excel/PPT） */}
        {fileAttachments.hasAttachments && (
          <FileDropZone
            attachments={fileAttachments.attachments}
            onAttachmentsChange={(update) => {
              // FileDropZone 使用函数式更新，但我们用 hook 管理状态
              // 这里只处理删除操作（通过 removeFile）
              if (typeof update === 'function') {
                const newList = update(fileAttachments.attachments);
                // 找出被删除的项
                const removedIds = fileAttachments.attachments
                  .filter(a => !newList.find(n => n.id === a.id))
                  .map(a => a.id);
                removedIds.forEach(id => fileAttachments.removeFile(id));
              }
            }}
            disabled={disabled}
            compact={false}
            className="px-4 pt-2 border-b border-border/50"
          />
        )}

        <div className="p-4 space-y-2 flex-shrink-0">
          <InputArea
            ref={textareaRef}
            prompt={state.prompt}
            disabled={disabled}
            dragActive={dragActive}
            showFilePicker={showFilePicker}
            projectPath={projectPath}
            filePickerQuery={filePickerQuery}
            onTextChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onExpand={handleOpenExpanded}
            onFileSelect={handleFileSelect}
            onFilePickerClose={handleFilePickerClose}
            // 🔧 Mac 输入法兼容
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            // 🆕 Prompt Suggestions
            suggestion={suggestion}
            isSuggestionLoading={isSuggestionLoading}
            enableSuggestion={enablePromptSuggestion}
            // 🆕 斜杠命令菜单
            showSlashCommandMenu={showSlashCommandMenu}
            slashCommandQuery={slashCommandQuery}
            slashCommandSelectedIndex={slashCommandSelectedIndex}
            onSlashCommandSelect={handleSlashCommandSelect}
            onSlashCommandMenuClose={closeSlashCommandMenu}
            onSlashCommandSelectedIndexChange={setSlashCommandSelectedIndex}
            customSlashCommands={customCommands}
            engine={currentEngine}
          />

          <ControlBar
            disabled={disabled}
            isLoading={isLoading}
            prompt={state.prompt}
            hasAttachments={imageAttachments.length > 0}
            executionEngineConfig={executionEngineConfig}
            setExecutionEngineConfig={setExecutionEngineConfig}
            selectedModel={state.selectedModel}
            setSelectedModel={handleSetModel}
            availableModels={availableModels}
            selectedThinkingMode={state.selectedThinkingMode}
            handleToggleThinkingMode={handleToggleThinkingMode}
            isPlanMode={isPlanMode}
            onTogglePlanMode={onTogglePlanMode}
            hasMessages={hasMessages}
            sessionCost={sessionCost}
            sessionStats={sessionStats}
            showCostPopover={state.showCostPopover}
            setShowCostPopover={handleSetShowCostPopover}
            messages={messages}
            session={session}
            codexRateLimits={codexRateLimits}
            isEnhancing={isEnhancing}
            projectPath={projectPath}
            enableProjectContext={state.enableProjectContext}
            setEnableProjectContext={handleSetEnableProjectContext}
            enableDualAPI={enableDualAPI}
            setEnableDualAPI={setEnableDualAPI}
            getEnabledProviders={getEnabledProviders}
            handleEnhancePromptWithAPI={handleEnhancePromptWithAPI}
            onCancel={onCancel || handleNoopCancel}
            onSend={handleSend}
            onOpenCanvas={onOpenCanvas}
            hasPreviewableCode={hasPreviewableCode}
            codeSource={codeSource}
            onToggleUsageDashboard={onToggleUsageDashboard}
            showUsageDashboard={showUsageDashboard}
            onToggleMCPConfig={onToggleMCPConfig}
            // 🆕 队列相关
            pendingQueueCount={pendingCount}
            queueItems={promptQueue.items}
            showQueuePanel={showQueuePanel}
            onToggleQueuePanel={handleToggleQueuePanel}
            // 🆕 图像生成回调
            onImageGenerated={handleImageGenerated}
          />
        </div>
      </div>
      {/* 🆕 智能记忆导入建议 */}
      {hasMatches && showMemoryPanel && projectPath && (
        <MemoryImportSuggestion
          matches={memoryMatches}
          projectPath={projectPath}
          onImportComplete={handleMemoryImportComplete}
          onClose={handleCloseMemoryPanel}
        />
      )}

      {/* 🆕 提示词队列面板 */}
      <AnimatePresence>
        {showQueuePanel && (
          <PromptQueuePanel
            items={promptQueue.items}
            isProcessing={promptQueue.isProcessing}
            currentItemId={promptQueue.currentItemId}
            autoMerge={promptQueue.autoMerge}
            onRevokeToInput={handleRevokeToInput}
            onSendImmediate={handleSendImmediate}
            onDelete={handleDeleteQueueItem}
            onReorder={handleReorderQueueItem}
            onUpdateMode={handleUpdateQueueItemMode}
            onUpdatePrompt={handleUpdateQueueItemPrompt}
            onSendMerged={handleSendMerged}
            onClearQueue={promptQueue.clearQueue}
            onSetAutoMerge={promptQueue.setAutoMerge}
            onClose={handleCloseQueuePanel}
            isLoading={isLoading}
            onQueueSubmit={handleQueueSubmit}
            onOptimizePrompt={handleOptimizePrompt}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export const FloatingPromptInput = forwardRef(FloatingPromptInputInner);

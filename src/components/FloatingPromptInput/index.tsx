import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useReducer, useCallback } from "react";
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

// Import sub-components
import { InputArea } from "./InputArea";
import { AttachmentPreview } from "./AttachmentPreview";
import { ControlBar } from "./ControlBar";
import { ExpandedModal } from "./ExpandedModal";

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
  }: FloatingPromptInputProps,
  ref: React.Ref<FloatingPromptInputRef>,
) => {
  // Helper function to convert backend model string to frontend ModelType
  const parseSessionModel = (modelStr?: string): ModelType | null => {
    if (!modelStr) return null;

    const lowerModel = modelStr.toLowerCase();
    if (lowerModel.includes("opus")) return "opus";
    if (lowerModel.includes("sonnet") && lowerModel.includes("1m")) return "sonnet1m";
    if (lowerModel.includes("sonnet")) return "sonnet";

    return null;
  };

  // Determine initial model:
  // 1. Historical session: use sessionModel
  // 2. New session: use user's default model or fallback to "sonnet"
  const getInitialModel = (): ModelType => {
    // If this is a historical session with saved model, use it
    const parsedSessionModel = parseSessionModel(sessionModel);
    if (parsedSessionModel) {
      return parsedSessionModel;
    }
    // For new sessions, use user's default model setting
    const userDefaultModel = getDefaultModel();
    if (userDefaultModel) {
      return userDefaultModel;
    }
    // Fall back to prop default or "sonnet"
    return defaultModel;
  };

  // Use Reducer for state management
  const [state, dispatch] = useReducer(inputReducer, {
    ...initialState,
    selectedModel: getInitialModel(),
    executionEngineConfig: externalEngineConfig || initialState.executionEngineConfig,
  });

  // 草稿持久化 Hook - 确保输入内容在页面切换后不丢失
  const { saveDraft, clearDraft } = useDraftPersistence({
    sessionId,
    onRestore: useCallback((draft: string) => {
      // 恢复草稿时更新 prompt 状态
      dispatch({ type: "SET_PROMPT", payload: draft });
    }, []),
  });

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
        console.error('[ThinkingMode] Failed to read settings, falling back to localStorage:', error);
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

  // Sync external config changes
  useEffect(() => {
    if (externalEngineConfig && externalEngineConfig.engine !== state.executionEngineConfig.engine) {
      dispatch({ type: "SET_EXECUTION_ENGINE_CONFIG", payload: externalEngineConfig });
    }
  }, [externalEngineConfig]);

  // Persist execution engine config
  useEffect(() => {
    try {
      localStorage.setItem('execution_engine_config', JSON.stringify(state.executionEngineConfig));
      onExecutionEngineConfigChange?.(state.executionEngineConfig);
    } catch (error) {
      console.error('[ExecutionEngine] Failed to save config to localStorage:', error);
    }
  }, [state.executionEngineConfig, onExecutionEngineConfigChange]);

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
    onPromptChange: (p) => dispatch({ type: "SET_PROMPT", payload: p }),
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
    onPromptChange: (p) => dispatch({ type: "SET_PROMPT", payload: p }),
    onCursorPositionChange: (p) => dispatch({ type: "SET_CURSOR_POSITION", payload: p }),
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
    onPromptChange: (p) => dispatch({ type: "SET_PROMPT", payload: p }),
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
  const currentEngine = state.executionEngineConfig.engine;
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
    onCommandSelect: (command) => {
      // 替换当前输入为选中的命令
      dispatch({ type: "SET_PROMPT", payload: command });
    },
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
      console.warn('Failed to save enable_project_context to localStorage:', error);
    }
  }, [state.enableProjectContext]);

  // Restore session model
  useEffect(() => {
    const parsedSessionModel = parseSessionModel(sessionModel);
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
        console.error('[FloatingPromptInput] Failed to load custom model:', error);
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
      console.error("Failed to update thinking mode:", error);
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
  const handleSend = () => {
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
        const isCodex = state.executionEngineConfig.engine === 'codex';
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
          console.log('[FloatingPromptInput] 提示词已复制到剪贴板:', finalPrompt.substring(0, 50) + '...');
        }).catch(err => {
          console.warn('[FloatingPromptInput] 复制到剪贴板失败:', err);
        });
      } catch (err) {
        console.warn('[FloatingPromptInput] 剪贴板 API 不可用:', err);
      }

      // When custom model is selected, pass the actual model name instead of "custom"
      let modelToSend = state.selectedModel;
      if (state.selectedModel === 'custom') {
        const customModelConfig = availableModels.find(m => m.id === 'custom');
        if (customModelConfig) {
          modelToSend = customModelConfig.name as ModelType;
        }
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

      // 异步执行 onSend，失败时恢复输入框
      Promise.resolve(onSend(finalPrompt, modelToSend, undefined)).catch((error) => {
        console.error('[FloatingPromptInput] 发送失败，恢复输入框:', error);
        dispatch({ type: "SET_PROMPT", payload: savedPrompt });
        setImageAttachments(savedAttachments);
        setEmbeddedImages(savedEmbedded);
        saveDraft(savedPrompt);
      });
    }
  };

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
            executionEngineConfig={state.executionEngineConfig}
            setExecutionEngineConfig={(config) => dispatch({ type: "SET_EXECUTION_ENGINE_CONFIG", payload: config })}
            selectedModel={state.selectedModel}
            setSelectedModel={(model) => dispatch({ type: "SET_MODEL", payload: model })}
            availableModels={availableModels}
            selectedThinkingMode={state.selectedThinkingMode}
            handleToggleThinkingMode={handleToggleThinkingMode}
            isPlanMode={isPlanMode}
            onTogglePlanMode={onTogglePlanMode}
            isEnhancing={isEnhancing}
            projectPath={projectPath}
            enableProjectContext={state.enableProjectContext}
            setEnableProjectContext={(enable) => dispatch({ type: "SET_ENABLE_PROJECT_CONTEXT", payload: enable })}
            enableDualAPI={enableDualAPI}
            setEnableDualAPI={setEnableDualAPI}
            getEnabledProviders={getEnabledProviders}
            handleEnhancePromptWithAPI={handleEnhancePromptWithAPI}
            onClose={() => dispatch({ type: "SET_EXPANDED", payload: false })}
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

        <div className="p-4 space-y-2">
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
            onExpand={() => dispatch({ type: "SET_EXPANDED", payload: true })}
            onFileSelect={handleFileSelect}
            onFilePickerClose={handleFilePickerClose}
            // 🔧 Mac 输入法兼容
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => {
              setIsComposing(false);
              compositionEndTimeRef.current = Date.now(); // 记录时间戳用于冷却期
            }}
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
            executionEngineConfig={state.executionEngineConfig}
            setExecutionEngineConfig={(config) => dispatch({ type: "SET_EXECUTION_ENGINE_CONFIG", payload: config })}
            selectedModel={state.selectedModel}
            setSelectedModel={(model) => dispatch({ type: "SET_MODEL", payload: model })}
            availableModels={availableModels}
            selectedThinkingMode={state.selectedThinkingMode}
            handleToggleThinkingMode={handleToggleThinkingMode}
            isPlanMode={isPlanMode}
            onTogglePlanMode={onTogglePlanMode}
            hasMessages={hasMessages}
            sessionCost={sessionCost}
            sessionStats={sessionStats}
            showCostPopover={state.showCostPopover}
            setShowCostPopover={(show) => dispatch({ type: "SET_SHOW_COST_POPOVER", payload: show })}
            messages={messages}
            session={session}
            codexRateLimits={codexRateLimits}
            isEnhancing={isEnhancing}
            projectPath={projectPath}
            enableProjectContext={state.enableProjectContext}
            setEnableProjectContext={(enable) => dispatch({ type: "SET_ENABLE_PROJECT_CONTEXT", payload: enable })}
            enableDualAPI={enableDualAPI}
            setEnableDualAPI={setEnableDualAPI}
            getEnabledProviders={getEnabledProviders}
            handleEnhancePromptWithAPI={handleEnhancePromptWithAPI}
            onCancel={onCancel || (() => {})}
            onSend={handleSend}
            onOpenCanvas={onOpenCanvas}
            hasPreviewableCode={hasPreviewableCode}
            codeSource={codeSource}
            onToggleUsageDashboard={onToggleUsageDashboard}
            showUsageDashboard={showUsageDashboard}
            onToggleMCPConfig={onToggleMCPConfig}
          />
        </div>
      </div>
    </>
  );
};

export const FloatingPromptInput = forwardRef(FloatingPromptInputInner);

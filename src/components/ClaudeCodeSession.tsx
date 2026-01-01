import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  X,
  List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Session, type Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { FloatingPromptInput, type FloatingPromptInputRef, type ModelType } from "./FloatingPromptInput";
import { ErrorBoundary } from "./ErrorBoundary";
import { RevertPromptPicker } from "./RevertPromptPicker";
import { PromptNavigator } from "./PromptNavigator";
import { SplitPane } from "@/components/ui/split-pane";
import { WebviewPreview } from "./WebviewPreview";
import { type TranslationResult } from '@/lib/translationMiddleware';
import { useSessionCostCalculation } from '@/hooks/useSessionCostCalculation';
import { useDisplayableMessages } from '@/hooks/useDisplayableMessages';
import { useGroupedMessages } from '@/hooks/useGroupedMessages';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSmartAutoScroll } from '@/hooks/useSmartAutoScroll';
import { useMessageTranslation } from '@/hooks/useMessageTranslation';
import { useSessionStream } from '@/hooks/useSessionStream';
import { usePromptExecution } from '@/hooks/usePromptExecution';
import { useHourlyUsageTracker } from '@/hooks/useHourlyUsageTracker';
import { useSmartTabTitle } from '@/hooks/useSmartTabTitle';
import { useBackgroundCompact } from '@/hooks/useBackgroundCompact';
import { useSmartSessionContinue } from '@/hooks/useSmartSessionContinue';
import { useContextWindowUsage } from '@/hooks/useContextWindowUsage';
import { MessagesProvider, useMessagesContext } from '@/contexts/MessagesContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { PlanModeProvider, usePlanMode } from '@/contexts/PlanModeContext';
import { PlanApprovalDialog } from '@/components/dialogs/PlanApprovalDialog';
import { PlanModeStatusBar } from '@/components/widgets/system/PlanModeStatusBar';
import { UserQuestionProvider, useUserQuestion } from '@/contexts/UserQuestionContext';
import { AskUserQuestionDialog } from '@/components/dialogs/AskUserQuestionDialog';
import { codexConverter } from '@/lib/codexConverter';
import { convertGeminiSessionDetailToClaudeMessages } from '@/lib/geminiConverter';
import { SessionHeader } from "./session/SessionHeader";
import { SessionMessages, type SessionMessagesRef } from "./session/SessionMessages";
import { CanvasFloatingWindow } from "@/components/canvas/CanvasFloatingWindow";
import { CompactStatusIndicator } from './CompactStatusIndicator';
import { UsageDashboard } from "@/components/UsageDashboard";
import { ProjectMCPQuickConfig } from "@/components/ProjectMCPQuickConfig";
import { useCanvasExtractor } from "@/hooks/useCanvasExtractor";
import { useAutoMCPCallTracker } from "@/hooks/useAutoMCPCallTracker";
import { useAutoResume } from "@/hooks/useAutoResume";
import { AutoResumeIndicator } from "./AutoResumeIndicator";

import * as SessionHelpers from '@/lib/sessionHelpers';

import type { ClaudeStreamMessage } from '@/types/claude';
import type { CodexRateLimits } from '@/types/codex';

interface ClaudeCodeSessionProps {
  /**
   * Optional session to resume (when clicking from SessionList)
   */
  session?: Session;
  /**
   * Initial project path (for new sessions)
   */
  initialProjectPath?: string;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when streaming state changes
   */
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
  /**
   * Callback when project path changes (for updating tab title)
   */
  onProjectPathChange?: (newPath: string) => void;
  /**
   * 🆕 Callback when execution engine changes (for updating tab icon)
   */
  onEngineChange?: (engine: 'claude' | 'codex' | 'gemini') => void;
  /**
   * 🔧 FIX: Callback when session info is extracted (for persisting new session to tab)
   * Called when a new session receives its sessionId and projectId from backend
   */
  onSessionInfoChange?: (info: { sessionId: string; projectId: string; projectPath: string; engine?: 'claude' | 'codex' | 'gemini' }) => void;
  /**
   * Whether this session is currently active (for event listener management)
   */
  isActive?: boolean;
  /**
   * 🆕 Callback when smart title is generated (for updating tab title)
   * Called after first message or after 3 rounds of conversation
   */
  onTitleUpdate?: (title: string) => void;
  /**
   * 🆕 智能会话升级回调 - 当用户发送第一条消息时，自动创建项目文件夹
   * 返回生成的项目路径，或 null 表示失败
   */
  onSmartSessionUpgrade?: (firstMessage: string) => Promise<{ projectPath: string; title: string } | null>;
}

/**
 * ClaudeCodeSession component for interactive Claude Code sessions
 * 
 * @example
 * <ClaudeCodeSession onBack={() => setView('projects')} />
 */
const ClaudeCodeSessionInner: React.FC<ClaudeCodeSessionProps> = ({
  session,
  initialProjectPath = "",
  className,
  onStreamingChange,
  onProjectPathChange,
  onEngineChange,
  onSessionInfoChange,
  onTitleUpdate,
  onSmartSessionUpgrade,
  isActive = true, // 默认为活跃状态，保持向后兼容
}) => {
  const { t } = useTranslation();
  const [projectPath, setProjectPath] = useState(initialProjectPath || session?.project_path || "");
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const {
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    filterConfig,
    setFilterConfig
  } = useMessagesContext();
  const isLoading = isStreaming;
  const setIsLoading = setIsStreaming;
  const [error, setError] = useState<string | null>(null);
  const [_rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]); // Kept for hooks, not directly used
  const [isFirstPrompt, setIsFirstPrompt] = useState(!session); // Key state for session continuation
  const [extractedSessionInfo, setExtractedSessionInfo] = useState<{ sessionId: string; projectId: string; engine?: 'claude' | 'codex' | 'gemini' } | null>(null);
  // 🔧 FIX: 标记会话是否不存在（历史记录文件未找到）
  // 当为 true 时，effectiveSession 应返回 null，显示路径选择界面
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [codexRateLimits, setCodexRateLimits] = useState<CodexRateLimits | null>(null);

  // Canvas 实时预览状态
  const [showCanvas, setShowCanvas] = useState(false);
  const extractedCode = useCanvasExtractor(messages);

  // 🆕 Usage Dashboard 状态
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);

  // 🆕 项目级 MCP 配置对话框状态
  const [showMCPConfig, setShowMCPConfig] = useState(false);

  // Plan Mode state - 使用 Context（方案 B-1）
  const {
    isPlanMode,
    setIsPlanMode,
    showApprovalDialog,
    pendingApproval,
    approvePlan,
    rejectPlan,
    closeApprovalDialog,
    setSendPromptCallback,
  } = usePlanMode();

  // 🆕 UserQuestion Context - 用户问答交互
  const {
    pendingQuestion,
    showQuestionDialog,
    submitAnswers,
    closeQuestionDialog,
    setSendMessageCallback,
  } = useUserQuestion();

  // 🆕 Execution Engine Config (Codex integration)
  // Load from localStorage to remember user's settings
  const [executionEngineConfig, setExecutionEngineConfig] = useState<import('@/components/FloatingPromptInput/types').ExecutionEngineConfig>(() => {
    try {
      const stored = localStorage.getItem('execution_engine_config');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ClaudeCodeSession] Failed to load engine config from localStorage:', error);
    }
    // Default config
    return {
      engine: 'claude',
      codexMode: 'read-only',
      codexModel: 'gpt-5.2',
      geminiModel: 'gemini-3-flash',
    };
  });

  // 自动追踪 MCP 调用时间
  useAutoMCPCallTracker(messages, executionEngineConfig.engine);

  // Queued prompts state
  const [queuedPrompts, setQueuedPrompts] = useState<Array<{ id: string; prompt: string; model: ModelType }>>([]);

  // State for revert prompt picker (defined early for useKeyboardShortcuts)
  const [showRevertPicker, setShowRevertPicker] = useState(false);

  // 🔧 FIX: 用于存储智能会话升级后待发送的首条消息
  // 解决问题：setProjectPath 是异步的，首条消息会在 projectPath 更新前被检查并拒绝
  const pendingFirstMessageRef = useRef<{ prompt: string; model: ModelType; maxThinkingTokens?: number } | null>(null);

  // 🆕 智能标签页标题 - 根据对话内容自动命名
  // 条件：只在活跃标签页且有消息时启用，避免性能问题
  useSmartTabTitle({
    messages,
    initialTitle: projectPath.split(/[/\\]/).pop() || session?.project_path?.split(/[/\\]/).pop() || '新会话',
    onTitleUpdate: useCallback((title: string) => {
      if (onTitleUpdate && isActive) {
        console.log('[ClaudeCodeSession] Smart title update:', title);
        onTitleUpdate(title);
      }
    }, [onTitleUpdate, isActive]),
    enabled: isActive && messages.length > 0, // 只在活跃且有消息时启用
  });

  // State for prompt navigator
  const [showPromptNavigator, setShowPromptNavigator] = useState(false);

  // Settings state to avoid repeated loading in StreamMessage components
  // 🔧 FIX: 初始化默认值，避免异步加载导致 filterConfig 闪烁
  const [claudeSettings, setClaudeSettings] = useState<{
    showSystemInitialization?: boolean;
    hideWarmupMessages?: boolean;
  }>({
    showSystemInitialization: true,
    hideWarmupMessages: true, // 默认隐藏 warmup 消息，与 MessagesContext 默认值一致
  });

  // ✅ Refactored: Use custom Hook for session cost calculation
  const { stats: costStats, formatCost } = useSessionCostCalculation(messages, executionEngineConfig.engine);

  // 🆕 记录每小时使用数据（用于统计图表）
  useHourlyUsageTracker(costStats);

  // ✅ Refactored: Use custom Hook for message filtering
  useEffect(() => {
    setFilterConfig(prev => {
      const hideWarmup = claudeSettings?.hideWarmupMessages !== false;
      if (prev.hideWarmupMessages === hideWarmup) {
        return prev;
      }
      return {
        ...prev,
        hideWarmupMessages: hideWarmup
      };
    });
  }, [claudeSettings?.hideWarmupMessages, setFilterConfig]);

  // 🆕 Notify parent when execution engine changes (for tab icon update)
  useEffect(() => {
    if (onEngineChange) {
      onEngineChange(executionEngineConfig.engine);
    }
  }, [executionEngineConfig.engine, onEngineChange]);

  // 🔧 FIX: Notify parent when session info is extracted (for new session persistence)
  // This fixes the issue where new session messages are lost after route switch
  useEffect(() => {
    if (extractedSessionInfo && onSessionInfoChange && projectPath) {
      console.debug('[ClaudeCodeSession] Session info extracted, notifying parent:', extractedSessionInfo);
      onSessionInfoChange({
        sessionId: extractedSessionInfo.sessionId,
        projectId: extractedSessionInfo.projectId,
        projectPath: projectPath,
        engine: extractedSessionInfo.engine,
      });
    }
  }, [extractedSessionInfo, projectPath, onSessionInfoChange]);

  const displayableMessages = useDisplayableMessages(messages, {
    hideWarmupMessages: filterConfig.hideWarmupMessages
  });

  // 🆕 将消息分组（处理子代理消息）
  const messageGroups = useGroupedMessages(displayableMessages, {
    enableSubagentGrouping: true
  });

  // Stable callback for toggling plan mode (prevents unnecessary event listener re-registration)
  const handleTogglePlanMode = useCallback(() => {
    setIsPlanMode(!isPlanMode);
  }, [isPlanMode, setIsPlanMode]);

  // Stable callback for showing revert dialog
  const handleShowRevertDialog = useCallback(() => {
    setShowRevertPicker(true);
  }, []);

  // ✅ Refactored: Use custom Hook for keyboard shortcuts

  // 🆕 提示词导航状态（用于 PgUp/PgDn 快捷键）
  // 🆕 计算总提示词数量（用于键盘导航）
  const totalPrompts = useMemo(() => {
    return messages.filter(m => {
      const msgType = (m as any).type || (m.message as any)?.role;
      return msgType === 'user';
    }).length;
  }, [messages]);

  const [currentPromptIndex, setCurrentPromptIndex] = React.useState<number>(-1);
  
  // 🆕 导航到上一条提示词
  const handleNavigateToPreviousPrompt = useCallback(() => {
    if (totalPrompts === 0) return;
    
    const newIndex = currentPromptIndex <= 0 ? 0 : currentPromptIndex - 1;
    setCurrentPromptIndex(newIndex);
    sessionMessagesRef.current?.scrollToPrompt(newIndex);
  }, [currentPromptIndex, totalPrompts]);
  
  // 🆕 导航到下一条提示词
  const handleNavigateToNextPrompt = useCallback(() => {
    if (totalPrompts === 0) return;
    
    const maxIndex = totalPrompts - 1;
    const newIndex = currentPromptIndex >= maxIndex ? maxIndex : currentPromptIndex + 1;
    setCurrentPromptIndex(newIndex);
    sessionMessagesRef.current?.scrollToPrompt(newIndex);
  }, [currentPromptIndex, totalPrompts]);

  useKeyboardShortcuts({
    isActive,
    onTogglePlanMode: handleTogglePlanMode,
    onShowRevertDialog: handleShowRevertDialog,
    hasDialogOpen: showRevertPicker,
    onNavigateToPreviousPrompt: handleNavigateToPreviousPrompt,
    onNavigateToNextPrompt: handleNavigateToNextPrompt,
    onToggleUsageDashboard: () => setShowUsageDashboard(prev => !prev)
  });

  // ✅ Refactored: Use custom Hook for smart auto-scroll
  const { parentRef, userScrolled, setUserScrolled, setShouldAutoScroll } =
    useSmartAutoScroll({
      displayableMessages,
      isLoading
    });

  // 🆕 Fix: Scroll to bottom when session history is loaded
  const hasScrolledToBottomRef = useRef<string | null>(null);

  useEffect(() => {
    // Check if we have messages and parentRef is attached
    if (displayableMessages.length > 0 && parentRef.current) {
      const currentSessionId = session?.id || 'new_session';
      
      // If we haven't scrolled for this session yet
      if (hasScrolledToBottomRef.current !== currentSessionId) {
        // Use a small delay to ensure virtualizer has calculated sizes
        const timer = setTimeout(() => {
          if (parentRef.current) {
            // Force scroll to bottom
            parentRef.current.scrollTop = parentRef.current.scrollHeight;
            
            // Sync with smart auto-scroll state
            setUserScrolled(false);
            setShouldAutoScroll(true);
            
            // Mark as done for this session
            hasScrolledToBottomRef.current = currentSessionId;
          }
        }, 150); // 150ms delay for stability
        
        return () => clearTimeout(timer);
      }
    }
  }, [displayableMessages.length, session?.id, setUserScrolled, setShouldAutoScroll]);

  // ============================================================================
  // MESSAGE-LEVEL OPERATIONS (Fine-grained Undo/Redo)
  // ============================================================================
  // Operations extracted to useMessageOperations Hook

  // New state for preview feature
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  
  // Translation state
  const [lastTranslationResult, setLastTranslationResult] = useState<TranslationResult | null>(null);
  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);

  // Add collapsed state for queued prompts
  const [queuedPromptsCollapsed, setQueuedPromptsCollapsed] = useState(false);


  // ✅ All refs declared BEFORE custom Hooks that depend on them
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const hasActiveSessionRef = useRef(false);
  const floatingPromptRef = useRef<FloatingPromptInputRef>(null);
  const sessionMessagesRef = useRef<SessionMessagesRef>(null);
  const queuedPromptsRef = useRef<Array<{ id: string; prompt: string; model: ModelType }>>([]);
  const isMountedRef = useRef(true);
  const isListeningRef = useRef(false);

  // ✅ Refactored: Use custom Hook for message translation (AFTER refs are declared)
  const {
    processMessageWithTranslation,
    initializeProgressiveTranslation,
  } = useMessageTranslation({
    isMountedRef,
    lastTranslationResult: lastTranslationResult || undefined,
    onMessagesUpdate: setMessages
  });

  // 🔧 FIX: 处理会话历史不存在的情况，重置到初始状态
  const handleSessionNotFound = useCallback(() => {
    console.debug('[ClaudeCodeSession] Session not found, resetting to initial state');
    setSessionNotFound(true);
    // 重置为新会话状态
    setIsFirstPrompt(true);
  }, []);

  // ✅ 新架构: 使用 useSessionStream（基于 AsyncQueue + ConverterRegistry）
  const {
    loadSessionHistory,
    checkForActiveSession,
    // reconnectToSession removed - listeners now persist across tab switches
    // messageQueue - 新增：消息队列，支持 for await...of 消费
  } = useSessionStream({
    session,
    isMountedRef,
    isListeningRef,
    hasActiveSessionRef,
    unlistenRefs,
    setIsLoading,
    setError,
    setMessages,
    setRawJsonlOutput,
    setClaudeSessionId,
    setCodexRateLimits,
    initializeProgressiveTranslation,
    processMessageWithTranslation,
    onSessionNotFound: handleSessionNotFound
  });

  // Keep ref in sync with state
  useEffect(() => {
    queuedPromptsRef.current = queuedPrompts;
  }, [queuedPrompts]);

  // 🔧 NEW: Notify parent when project path changes (for tab title update)
  useEffect(() => {
    // Only notify if projectPath is valid and not the initial placeholder
    if (projectPath && projectPath !== initialProjectPath && onProjectPathChange) {
      onProjectPathChange(projectPath);
    }
  }, [projectPath, initialProjectPath, onProjectPathChange]);



  // ⚡ PERFORMANCE FIX: Git 初始化延迟到真正需要时
  // 原问题：每次加载会话都立即执行 git init + git add + git commit
  // 在大项目中，git add . 可能需要数秒，导致会话加载卡顿
  // 解决方案：只在发送提示词时才初始化 Git（在 recordPromptSent 中已有）
  // useEffect(() => {
  //   if (!projectPath) return;
  //   api.checkAndInitGit(projectPath).then(...);
  // }, [projectPath]);

  // Get effective session info (from prop or extracted) - use useMemo to ensure it updates
  const effectiveSession = useMemo(() => {
    // 🔧 FIX: 当会话历史不存在时，返回 null 以显示路径选择界面
    // 这处理了从 localStorage 恢复的无效会话（历史文件已删除或不存在）
    if (sessionNotFound) {
      return null;
    }
    if (session) return session;
    if (extractedSessionInfo) {
      return {
        id: extractedSessionInfo.sessionId,
        project_id: extractedSessionInfo.projectId,
        project_path: projectPath,
        created_at: Date.now(),
        engine: extractedSessionInfo.engine, // 🔧 FIX: Include engine field
      } as Session;
    }
    return null;
  }, [session, extractedSessionInfo, projectPath, sessionNotFound]);

  // 🆕 上下文窗口使用率（用于触发后台压缩）
  const contextUsage = useContextWindowUsage(
    messages,
    executionEngineConfig.codexModel || 'sonnet',
    executionEngineConfig.engine
  );

  // 🆕 智能会话续接（替代压缩功能 - 新窗口注入摘要）
  const {
    status: sessionContinueStatus,
    shouldContinue,
    summary: sessionSummary,
    newSessionId: continuedSessionId,
    continueTo, // TODO: 用于手动触发会话续接
    cancel: cancelSessionContinue, // TODO: 用于取消会话续接
    generateSummary, // TODO: 用于手动生成摘要
    isProcessing: isGeneratingSummary,
    error: sessionContinueError, // TODO: 用于显示错误提示
  } = useSmartSessionContinue({
    sessionId: effectiveSession?.id,
    projectPath,
    threshold: 0.75,
    autoSwitch: true,
    recentMessagesCount: 10,
    keepOldSession: true,
    summaryVerbosity: 'detailed',
    contextUsage: contextUsage.hasData ? contextUsage.percentage / 100 : 0,
  });

  // 暂时抑制未使用变量警告（这些将在未来功能中使用）
  void continueTo;
  void cancelSessionContinue;
  void generateSummary;
  void sessionContinueError;

  // 🆕 后台无缝压缩（Invisible UX - 75% 阈值自动触发）
  // ⚠️ 已被智能会话续接替代，保留以供降级使用
  const {
    status: compactStatus,
    isCompacting,
    progress: compactProgress,
    deltaMessagesCount,
    shouldSwitchSession,
    newSessionId,
    confirmSwitch,
  } = useBackgroundCompact({
    sessionId: effectiveSession?.id,
    projectPath,
    compactThreshold: 0.75,
    autoCompact: false, // 禁用自动压缩，优先使用会话续接
    contextUsage: contextUsage.hasData ? contextUsage.percentage / 100 : 0,
    maxTokens: contextUsage.contextWindowSize,
    currentTokens: contextUsage.currentTokens,
  });

  // 🆕 自动继续任务（Cost-Effective UX - 自动发送"继续"，节省 token 费用）
  const {
    shouldResume,
    countdown: autoResumeCountdown,
    cancel: cancelAutoResume,
    resume: manualResume,
    isCancelled: isAutoResumeCancelled,
    remainingAttempts,
  } = useAutoResume({
    sessionId: effectiveSession?.id,
    messages,
    isLoading,
    isStreaming,
    delay: 5000,        // 5 秒延迟
    maxAttempts: 5,     // 最多自动继续 5 次
    minInterval: 30000, // 每次间隔至少 30 秒
    inactiveTimeout: 60 * 60 * 1000, // 1 小时超时
  });

  // 🆕 智能会话续接：当达到阈值时，自动创建新会话并切换
  useEffect(() => {
    if (shouldContinue && continuedSessionId) {
      console.log('[ClaudeCodeSession] 🎉 Smart session continue - switching to:', continuedSessionId);
      console.log('[ClaudeCodeSession] 📝 Summary:', sessionSummary?.summaryText.slice(0, 200) + '...');

      // TODO: 打开新窗口并加载新会话
      // 目前先更新当前会话ID
      setClaudeSessionId(continuedSessionId);
      loadSessionHistory();

      // 通知父组件会话已切换
      if (onSessionInfoChange && projectPath) {
        onSessionInfoChange({
          sessionId: continuedSessionId,
          projectId: effectiveSession?.project_id || '',
          projectPath,
          engine: executionEngineConfig.engine as 'claude' | 'codex' | 'gemini',
        });
      }
    }
  }, [shouldContinue, continuedSessionId, sessionSummary, loadSessionHistory, onSessionInfoChange, projectPath, effectiveSession?.project_id, executionEngineConfig.engine]);

  // 🆕 当后台压缩完成时，自动切换到新会话（降级方案）
  useEffect(() => {
    if (shouldSwitchSession && newSessionId) {
      console.log('[ClaudeCodeSession] 🔄 Seamless session switch to:', newSessionId);
      setClaudeSessionId(newSessionId);
      loadSessionHistory();
      confirmSwitch();
    }
  }, [shouldSwitchSession, newSessionId, confirmSwitch, loadSessionHistory]);

  useEffect(() => {
    if (executionEngineConfig.engine !== 'codex') {
      setCodexRateLimits(null);
      return;
    }

    setCodexRateLimits(null);
  }, [executionEngineConfig.engine, effectiveSession?.id]);

  // ✅ Refactored: Use custom Hook for prompt execution (AFTER all other Hooks)
  const { handleSendPrompt } = usePromptExecution({
    projectPath,
    isLoading,
    claudeSessionId,
    effectiveSession,
    isPlanMode,
    lastTranslationResult,
    isActive,
    isFirstPrompt,
    extractedSessionInfo,
    executionEngine: executionEngineConfig.engine, // 🆕 Codex integration
    codexMode: executionEngineConfig.codexMode,    // 🆕 Codex integration
    codexModel: executionEngineConfig.codexModel,  // 🆕 Codex integration
    geminiModel: executionEngineConfig.geminiModel,           // 🆕 Gemini integration
    geminiApprovalMode: executionEngineConfig.geminiApprovalMode, // 🆕 Gemini integration
    hasActiveSessionRef,
    unlistenRefs,
    isMountedRef,
    isListeningRef,
    queuedPromptsRef,
    setIsLoading,
    setError,
    setMessages,
    setClaudeSessionId,
    setLastTranslationResult,
    setQueuedPrompts,
    setRawJsonlOutput,
    setExtractedSessionInfo,
    setIsFirstPrompt,
    setCodexRateLimits,
    processMessageWithTranslation
  });

  // 🔧 FIX: 当 projectPath 从 undefined 变为有值时，发送待发送的首条消息
  // 这解决了 setProjectPath 异步更新导致首条消息被丢弃的问题
  useEffect(() => {
    if (projectPath && pendingFirstMessageRef.current) {
      const { prompt, model, maxThinkingTokens } = pendingFirstMessageRef.current;
      pendingFirstMessageRef.current = null; // 清除，防止重复发送

      // 重置滚动状态
      setUserScrolled(false);
      setShouldAutoScroll(true);

      // 延迟发送，确保 React 状态完全更新
      setTimeout(() => {
        sessionMessagesRef.current?.scrollToBottom();
        handleSendPrompt(prompt, model, maxThinkingTokens, undefined);
      }, 100);
    }
  }, [projectPath, handleSendPrompt, setUserScrolled, setShouldAutoScroll]);

  // 🆕 包装 handleSendPrompt，发送消息时自动滚动到底部
  // 解决问题：当用户滚动查看历史消息后发送新消息，页面不会自动滚动到底部
  // 🔧 修复：消息数量过多时使用虚拟列表的 scrollToIndex 确保滚动到真正的底部
  // 🆕 智能会话：在发送第一条消息时自动创建项目文件夹
  // 🆕 插队模式：支持 forceImmediate 参数，绕过 usePromptExecution 的队列检查
  const handleSendPromptWithScroll = useCallback(async (prompt: string, model: ModelType, maxThinkingTokens?: number, forceImmediate?: boolean) => {
    console.log('[ClaudeCodeSession] handleSendPromptWithScroll called', {
      hasProjectPath: !!projectPath,
      hasUpgradeCallback: !!onSmartSessionUpgrade,
      isFirstPrompt,
      promptLength: prompt?.length
    });

    // 🆕 智能会话升级：如果没有项目路径且有升级回调，先创建项目文件夹
    if (!projectPath && onSmartSessionUpgrade && isFirstPrompt) {
      console.log('[ClaudeCodeSession] Starting smart session upgrade...');
      try {
        const result = await onSmartSessionUpgrade(prompt);
        console.log('[ClaudeCodeSession] Smart session upgrade result:', result);

        if (result) {
          console.log('[ClaudeCodeSession] Setting project path:', result.projectPath);
          setProjectPath(result.projectPath);
          onProjectPathChange?.(result.projectPath);
          // 🔧 FIX: 保存首条消息到 ref，等 projectPath 更新后由 useEffect 发送
          pendingFirstMessageRef.current = { prompt, model, maxThinkingTokens };
          console.log('[ClaudeCodeSession] Pending first message saved, waiting for projectPath update');
          return; // 不在这里发送，让 useEffect 处理
        } else {
          console.error('[ClaudeCodeSession] Smart session upgrade returned null');
          setError("智能会话升级失败：无法创建项目文件夹");
          // 🔧 FIX: 抛出错误，让 FloatingPromptInput 捕获并恢复输入框
          throw new Error("智能会话升级失败：无法创建项目文件夹");
        }
      } catch (err) {
        console.error('[ClaudeCodeSession] Smart session upgrade failed with error:', err);
        console.error('[ClaudeCodeSession] Error stack:', err instanceof Error ? err.stack : 'No stack');
        console.error('[ClaudeCodeSession] Error details:', {
          name: err instanceof Error ? err.name : 'Unknown',
          message: err instanceof Error ? err.message : String(err)
        });
        const errorMsg = `智能会话升级失败: ${err instanceof Error ? err.message : String(err)}`;
        setError(errorMsg);
        // 🔧 FIX: 抛出错误，让 FloatingPromptInput 捕获并恢复输入框
        throw new Error(errorMsg);
      }
    }

    // 重置滚动状态，确保发送消息后自动滚动到底部
    setUserScrolled(false);
    setShouldAutoScroll(true);

    // 使用虚拟列表的 scrollToBottom 方法，解决消息过多时 scrollHeight 估算不准的问题
    // 延迟执行，等待消息添加到列表后再滚动
    setTimeout(() => {
      sessionMessagesRef.current?.scrollToBottom();
    }, 50);

    await handleSendPrompt(prompt, model, maxThinkingTokens, forceImmediate);
  }, [projectPath, onSmartSessionUpgrade, isFirstPrompt, handleSendPrompt, setUserScrolled, setShouldAutoScroll, onProjectPathChange]);

  // 🆕 方案 B-1: 设置发送提示词回调，用于计划批准后自动执行
  useEffect(() => {
    // 创建一个简化的发送函数，只需要 prompt 参数
    const simpleSendPrompt = (prompt: string) => {
      handleSendPromptWithScroll(prompt, 'sonnet'); // 使用默认模型
    };
    setSendPromptCallback(simpleSendPrompt);

    // 清理时移除回调
    return () => {
      setSendPromptCallback(null);
    };
  }, [handleSendPromptWithScroll, setSendPromptCallback]);

  // 🆕 自动继续任务：当 shouldResume 为 true 时，自动发送"继续"
  useEffect(() => {
    if (shouldResume && !isLoading && !isStreaming) {
      console.log('[ClaudeCodeSession] 🚀 Auto-resume triggered - sending "继续"');
      handleSendPromptWithScroll('继续', 'sonnet');
    }
  }, [shouldResume, isLoading, isStreaming, handleSendPromptWithScroll]);

  // 🆕 设置 UserQuestion 的发送消息回调，用于答案提交后自动发送
  useEffect(() => {
    const simpleSendMessage = (message: string) => {
      handleSendPromptWithScroll(message, 'sonnet'); // 使用默认模型
    };
    setSendMessageCallback(simpleSendMessage);

    // 清理时移除回调
    return () => {
      setSendMessageCallback(null);
    };
  }, [handleSendPromptWithScroll, setSendMessageCallback]);

  // Load recent projects when component mounts (only for new sessions)
  useEffect(() => {
    if (!session && !initialProjectPath) {
      const loadRecentProjects = async () => {
        try {
          const projects = await api.listProjects();
          // Sort by created_at (latest first) and take top 5
          const sortedProjects = projects
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, 5);
          setRecentProjects(sortedProjects);
        } catch (error) {
          console.error("Failed to load recent projects:", error);
        }
      };
      loadRecentProjects();
    }
  }, [session, initialProjectPath]);

  // Load session history if resuming
  useEffect(() => {
    if (session) {
      // Set the claudeSessionId immediately when we have a session
      setClaudeSessionId(session.id);

      // 🆕 Auto-switch execution engine based on session type
      const sessionEngine = (session as any).engine;

      if (sessionEngine === 'codex') {
        setExecutionEngineConfig(prev => ({
          ...prev,
          engine: 'codex' as const,
        }));
      } else if (sessionEngine === 'gemini') {
        setExecutionEngineConfig(prev => ({
          ...prev,
          engine: 'gemini' as const,
        }));
      } else {
        setExecutionEngineConfig(prev => ({
          ...prev,
          engine: 'claude',
        }));
      }

      // Load session history first, then check for active session
      const initializeSession = async () => {
        await loadSessionHistory();
        // After loading history, check if the session is still active
        if (isMountedRef.current) {
          await checkForActiveSession();
        }
      };

      initializeSession();
    }
  }, [session]); // Remove hasLoadedSession dependency to ensure it runs on mount

  // 🔧 FIX: Reload session history when tab becomes active
  // This fixes the issue where switching between tabs doesn't show messages
  // because TabManager keeps all tabs in DOM (absolute + hidden) and components don't remount
  // 🆕 OPTIMIZATION: Only reload if messages are empty (避免覆盖正在流式传输的消息)
  const prevIsActiveRef = useRef(isActive);
  useEffect(() => {
    const wasInactive = prevIsActiveRef.current === false;
    const nowActive = isActive === true;

    // When tab becomes active and we have a session, reload history
    // (unless this is the initial mount - handled by the previous useEffect)
    // 🔧 CRITICAL FIX: Only reload if messages are empty to avoid overwriting streaming messages
    if (wasInactive && nowActive && session && messages.length === 0) {
      console.debug('[ClaudeCodeSession] Tab became active with empty messages, reloading history for session:', session.id);
      loadSessionHistory();
    } else if (wasInactive && nowActive && session && messages.length > 0) {
      console.debug('[ClaudeCodeSession] Tab became active with existing messages, skipping reload to preserve state');
    }

    prevIsActiveRef.current = isActive;
  }, [isActive, session, messages.length, loadSessionHistory]);

  // Load Claude settings once for all StreamMessage components
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getClaudeSettings();
        setClaudeSettings(settings);
      } catch (error) {
        console.error("Failed to load Claude settings:", error);
        setClaudeSettings({ 
          showSystemInitialization: true,
          hideWarmupMessages: true // Default: hide warmup messages for better UX
        }); // Default fallback
      }
    };

    loadSettings();
  }, []);

  // Report streaming state changes
  useEffect(() => {
    onStreamingChange?.(isLoading, claudeSessionId);
  }, [isLoading, claudeSessionId, onStreamingChange]);

  // 🔧 FIX: DO NOT clean up listeners on tab switch
  // Listeners should persist until session completes or component unmounts
  // This fixes the issue where:
  // 1. User sends prompt in tab A
  // 2. User switches to tab B before receiving session_id
  // 3. Listeners in tab A were cleaned up, causing output loss
  //
  // The listeners will be automatically cleaned up when:
  // - Session completes (in processComplete/processCodexComplete)
  // - Component unmounts (in the cleanup effect below)
  //
  // Multi-tab conflict is prevented by:
  // - Message deduplication (processedClaudeMessages/processedCodexMessages Set)
  // - isMountedRef check in message handlers
  // - Session-specific event channels (claude-output:{session_id})
  useEffect(() => {
    // Tab state changes are handled silently
  }, [isActive]);

  // ✅ Keyboard shortcuts (ESC, Shift+Tab) extracted to useKeyboardShortcuts Hook

  // ✅ Smart scroll management (3 useEffect blocks) extracted to useSmartAutoScroll Hook

  // ✅ Session lifecycle functions (loadSessionHistory, checkForActiveSession, reconnectToSession)
  // are now provided by useSessionStream Hook (新架构)

  const handleSelectPath = async () => {
    try {
      const selected = await SessionHelpers.selectProjectPath();

      if (selected) {
        setProjectPath(selected);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    }
  };

  // ✅ handleSendPrompt function is now provided by usePromptExecution Hook (line 207-234)

  // Get conversation context for prompt enhancement
  // 🔧 FIX: Use useCallback to ensure getConversationContext always uses the latest messages
  // This fixes the issue where prompt enhancement doesn't work in historical sessions
  const getConversationContext = useCallback((): string[] => {
    return SessionHelpers.getConversationContext(messages);
  }, [messages]);

  // 🔥 修复：添加参数控制取消行为
  // - keepQueue: 保留队列（插队时使用）
  // - processNextInQueue: 自动处理队列下一项
  const handleCancelExecution = async (options?: { keepQueue?: boolean; processNextInQueue?: boolean }) => {
    const { keepQueue = false, processNextInQueue = false } = options || {};
    if (!isLoading) return;

    try {
      // 🆕 根据执行引擎调用相应的取消方法
      if (executionEngineConfig.engine === 'codex') {
        await api.cancelCodex(claudeSessionId || undefined);
      } else {
        await api.cancelClaudeExecution(claudeSessionId || undefined);
      }

      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
      unlistenRefs.current = [];

      // Reset states
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);

      // Reset session state on cancel
      setClaudeSessionId(null);

      // 🔥 修复：根据参数决定是否清空队列
      if (!keepQueue) {
        // 用户主动取消：清空队列并显示取消消息
        setQueuedPrompts([]);

        // Add a message indicating the session was cancelled
        const cancelMessage: ClaudeStreamMessage = {
          type: "system",
          subtype: "info",
          result: "__USER_CANCELLED__", // Will be translated in render
          timestamp: new Date().toISOString(),
          receivedAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, cancelMessage]);
      } else if (processNextInQueue) {
        // 保留队列并自动处理下一项
        setTimeout(() => {
          if (queuedPromptsRef.current.length > 0) {
            const [nextPrompt, ...remainingPrompts] = queuedPromptsRef.current;
            setQueuedPrompts(remainingPrompts);
            handleSendPromptWithScroll(nextPrompt.prompt, nextPrompt.model);
          }
        }, 100);
      }
      // keepQueue=true, processNextInQueue=false: 只保留队列，不自动处理
    } catch (err) {
      console.error("Failed to cancel execution:", err);
      
      // Even if backend fails, we should update UI to reflect stopped state
      // Add error message but still stop the UI loading state
      const errorMessage: ClaudeStreamMessage = {
        type: "system",
        subtype: "error",
        result: `Failed to cancel execution: ${err instanceof Error ? err.message : 'Unknown error'}. The process may still be running in the background.`,
        timestamp: new Date().toISOString(),
        receivedAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Clean up listeners anyway
      unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
      unlistenRefs.current = [];
      
      // Reset states to allow user to continue
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);
    }
  };

  // Handle URL detection from terminal output
  const handleLinkDetected = (url: string) => {
    const currentState: SessionHelpers.PreviewState = {
      showPreview,
      showPreviewPrompt,
      previewUrl,
      isPreviewMaximized,
      splitPosition
    };
    const newState = SessionHelpers.handleLinkDetected(url, currentState);
    if (newState.previewUrl !== currentState.previewUrl) {
      setPreviewUrl(newState.previewUrl);
    }
    if (newState.showPreviewPrompt !== currentState.showPreviewPrompt) {
      setShowPreviewPrompt(newState.showPreviewPrompt);
    }
  };

  const handleClosePreview = () => {
    const currentState: SessionHelpers.PreviewState = {
      showPreview,
      showPreviewPrompt,
      previewUrl,
      isPreviewMaximized,
      splitPosition
    };
    const newState = SessionHelpers.handleClosePreview(currentState);
    setShowPreview(newState.showPreview);
    setIsPreviewMaximized(newState.isPreviewMaximized);
  };

  const handlePreviewUrlChange = (url: string) => {
    const currentState: SessionHelpers.PreviewState = {
      showPreview,
      showPreviewPrompt,
      previewUrl,
      isPreviewMaximized,
      splitPosition
    };
    const newState = SessionHelpers.handlePreviewUrlChange(url, currentState);
    setPreviewUrl(newState.previewUrl);
  };

  const handleTogglePreviewMaximize = () => {
    const currentState: SessionHelpers.PreviewState = {
      showPreview,
      showPreviewPrompt,
      previewUrl,
      isPreviewMaximized,
      splitPosition
    };
    const newState = SessionHelpers.handleTogglePreviewMaximize(currentState);
    setIsPreviewMaximized(newState.isPreviewMaximized);
    setSplitPosition(newState.splitPosition);
  };

  // 🆕 辅助函数：计算用户消息对应的 promptIndex
  // 只计算真实用户输入，排除系统消息和工具结果
  const getPromptIndexForMessage = useCallback((displayableIndex: number): number => {
    // 找到 displayableMessages[displayableIndex] 在 messages 中的实际位置
    const displayableMessage = displayableMessages[displayableIndex];
    const actualIndex = messages.findIndex(m => m === displayableMessage);
    
    if (actualIndex === -1) return -1;
    
    // 计算这是第几条真实用户消息（排除 Warmup/System 和纯工具结果消息）
    // 这个逻辑必须和后端 prompt_tracker.rs 完全一致！
    return messages.slice(0, actualIndex + 1)
      .filter(m => {
        // 只处理 user 类型消息
        if (m.type !== 'user') return false;
        
        // 检查是否是侧链消息（agent 消息）- 与后端一致
        const isSidechain = (m as any).isSidechain === true;
        if (isSidechain) {
          return false;
        }
        
        // 检查是否有 parent_tool_use_id（子代理的消息）- 与后端一致
        const hasParentToolUseId = (m as any).parent_tool_use_id !== null && (m as any).parent_tool_use_id !== undefined;
        if (hasParentToolUseId) {
          return false;
        }
        
        // 提取消息文本（处理字符串和数组两种格式）
        const content = m.message?.content;
        let text = '';
        let hasTextContent = false;
        let hasToolResult = false;
        
        if (typeof content === 'string') {
          text = content;
          hasTextContent = text.trim().length > 0;
        } else if (Array.isArray(content)) {
          // 提取所有 text 类型的内容
          const textItems = content.filter((item: any) => item.type === 'text');
          text = textItems.map((item: any) => item.text || '').join('');
          hasTextContent = textItems.length > 0 && text.trim().length > 0;
          
          // 检查是否有 tool_result
          hasToolResult = content.some((item: any) => item.type === 'tool_result');
        }
        
        // 如果只有 tool_result 没有 text，不计入（这些是工具执行的结果）
        if (hasToolResult && !hasTextContent) {
          return false;
        }
        
        // 必须有文本内容
        if (!hasTextContent) {
          return false;
        }
        
        // 排除自动发送的 Warmup 和 Skills 消息
        // 这个逻辑要和后端 prompt_tracker.rs 保持一致
        const isWarmupMessage = text.includes('Warmup');
        const isSkillMessage = text.includes('<command-name>') 
          || text.includes('Launching skill:')
          || text.includes('skill is running');
        return !isWarmupMessage && !isSkillMessage;
      })
      .length - 1;
  }, [messages, displayableMessages]);


  // 🆕 撤回处理函数 - 支持三种撤回模式
  // Handle prompt navigation - scroll to specific prompt
  const handlePromptNavigation = useCallback((promptIndex: number) => {
    if (sessionMessagesRef.current) {
      sessionMessagesRef.current.scrollToPrompt(promptIndex);
    }
    // Close navigator after navigation
    setShowPromptNavigator(false);
  }, []);

  const handleRevert = useCallback(async (promptIndex: number, mode: import('@/lib/api').RewindMode = 'both') => {
    if (!effectiveSession) return;

    try {

      const sessionEngine = effectiveSession.engine || executionEngineConfig.engine || 'claude';
      const isCodex = sessionEngine === 'codex';
      const isGemini = sessionEngine === 'gemini';

      // 调用后端撤回（返回提示词文本）
      const promptText = isCodex
        ? await api.revertCodexToPrompt(
            effectiveSession.id,
            projectPath,
            promptIndex,
            mode
          )
        : isGemini
        ? await api.revertGeminiToPrompt(
            effectiveSession.id,
            projectPath,
            promptIndex,
            mode
          )
        : await api.revertToPrompt(
            effectiveSession.id,
            effectiveSession.project_id,
            projectPath,
            promptIndex,
            mode
          );

      // 重新加载消息历史（根据引擎类型使用不同的 API）
      if (isGemini) {
        // Gemini 使用专门的 API 加载历史
        const geminiDetail = await api.getGeminiSessionDetail(projectPath, effectiveSession.id);
        setMessages(convertGeminiSessionDetailToClaudeMessages(geminiDetail) as any);
      } else {
        // Claude/Codex 使用原有 API
        const history = await api.loadSessionHistory(
          effectiveSession.id,
          effectiveSession.project_id,
          sessionEngine as any
        );

        if (sessionEngine === 'codex' && Array.isArray(history)) {
          // 将 Codex 事件转换为消息格式（与 useSessionStream 保持一致）
          codexConverter.reset();
          const convertedMessages: any[] = [];
          for (const event of history) {
            const msg = codexConverter.convertEventObject(event as any);
            if (msg) convertedMessages.push(msg);
          }
          setMessages(convertedMessages);
        } else if (Array.isArray(history)) {
          setMessages(history);
        } else if (history && typeof history === 'object' && 'messages' in history) {
          setMessages((history as any).messages);
        }
      }

      // 恢复提示词到输入框（仅在对话撤回模式下）
      if ((mode === 'conversation_only' || mode === 'both') && floatingPromptRef.current && promptText) {
        floatingPromptRef.current.setPrompt(promptText);
      }

      // 清除错误
      setError('');

    } catch (error) {
      console.error('[Prompt Revert] Failed to revert:', error);
      setError('__REVERT_FAILED__:' + error);
    }
  }, [effectiveSession, projectPath, claudeSettings?.hideWarmupMessages, executionEngineConfig.engine]);

  // Cleanup event listeners and track mount state
  // ⚠️ IMPORTANT: No dependencies! Only cleanup on real unmount
  // Adding dependencies like effectiveSession would cause cleanup to run
  // when session ID is extracted, clearing active listeners
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      isListeningRef.current = false;

      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
      unlistenRefs.current = [];

      // Reset session state on unmount
      setClaudeSessionId(null);
    };
  }, []); // Empty deps - only run on mount/unmount

  // ✅ 架构优化: 使用 SessionProvider 提供会话上下文，避免 Props Drilling
  const messagesList = (
    <SessionProvider
      session={effectiveSession}
      projectPath={projectPath}
      sessionId={effectiveSession?.id || null}
      projectId={effectiveSession?.project_id || null}
      settings={claudeSettings}
      onLinkDetected={handleLinkDetected}
      onRevert={handleRevert}
      getPromptIndexForMessage={getPromptIndexForMessage}
    >
      <SessionMessages
        ref={sessionMessagesRef}
        messageGroups={messageGroups}
        isLoading={isLoading}
        error={error}
        parentRef={parentRef}
        onCancel={handleCancelExecution}
      />
    </SessionProvider>
  );

  // Show project path input only when:
  // 1. No initial session prop AND
  // 2. No extracted session info (from successful first response) AND
  // 3. Not a smart session (smart sessions auto-create project on first message)
  const projectPathInput = !effectiveSession && !onSmartSessionUpgrade && (
    <SessionHeader
      projectPath={projectPath}
      setProjectPath={(path) => {
        setProjectPath(path);
        setError(null);
      }}
      handleSelectPath={handleSelectPath}
      recentProjects={recentProjects}
      isLoading={isLoading}
    />
  );

  // If preview is maximized, render only the WebviewPreview in full screen
  if (showPreview && isPreviewMaximized) {
    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 z-50 bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <WebviewPreview
            initialUrl={previewUrl}
            onClose={handleClosePreview}
            isMaximized={isPreviewMaximized}
            onToggleMaximize={handleTogglePreviewMaximize}
            onUrlChange={handlePreviewUrlChange}
            className="h-full"
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className={cn("flex h-full bg-background", className)}>
      {/* Main Content Area - 重构布局：使用 Flexbox 实现消息区域与输入区域的完全分离 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 消息展示区域容器 - flex-1 占据剩余空间，min-h-0 防止 flex 子元素溢出 */}
        <div className={cn(
          "flex-1 min-h-0 overflow-hidden transition-all duration-300 relative"
        )}>
          {showPreview ? (
            // Split pane layout when preview is active
            <SplitPane
              left={
                <div className="h-full flex flex-col">
                  {projectPathInput}
                  <PlanModeStatusBar isPlanMode={isPlanMode} />
                  {/* 🆕 Token Usage Dashboard - 预览模式下也可用 */}
                  <AnimatePresence>
                    {showUsageDashboard && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-shrink-0 w-full border-b border-border bg-background"
                      >
                        <div className="max-h-[50vh] overflow-y-auto">
                          <UsageDashboard
                            onBack={() => setShowUsageDashboard(false)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {messagesList}
                </div>
              }
              right={
                <WebviewPreview
                  initialUrl={previewUrl}
                  onClose={handleClosePreview}
                  isMaximized={isPreviewMaximized}
                  onToggleMaximize={handleTogglePreviewMaximize}
                  onUrlChange={handlePreviewUrlChange}
                />
              }
              initialSplit={splitPosition}
              onSplitChange={setSplitPosition}
              minLeftWidth={400}
              minRightWidth={400}
              className="h-full"
            />
          ) : (
            // ✅ 重构布局: 使用 Flexbox 实现消息区域与输入区域的完全分离
            // 消息区域独立滚动，输入区域固定在底部
            <div className="h-full flex flex-col relative">
              {projectPathInput}
              <PlanModeStatusBar isPlanMode={isPlanMode} />

              {/* 🆕 Token Usage Dashboard - 可折叠面板 */}
              <AnimatePresence>
                {showUsageDashboard && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0 w-full border-b border-border bg-background"
                  >
                    <div className="max-h-[60vh] overflow-y-auto">
                      <UsageDashboard
                        onBack={() => setShowUsageDashboard(false)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {messagesList}

              {isLoading && messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <div className="rotating-symbol text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {session ? t('claudeSession.loadingHistory') : t('claudeSession.initializingClaude')}
                    </span>
                  </div>
                </div>
              )}

              {/* ✅ 滚动控件 - 放在消息区域内，使用 absolute 定位 */}
              {displayableMessages.length > 5 && (
                <div className="absolute right-4 bottom-4 pointer-events-auto z-40">
                  <div className="flex flex-col gap-1.5">
                    {/* Prompt Navigator Button */}
                    {!showPromptNavigator && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-1 bg-background/60 backdrop-blur-md border border-border/50 rounded-xl px-1.5 py-2 cursor-pointer hover:bg-accent/80 shadow-sm"
                        onClick={() => setShowPromptNavigator(true)}
                        title={t('claudeSession.promptNav')}
                      >
                        <List className="h-4 w-4" />
                        <div className="flex flex-col items-center text-[10px] leading-tight tracking-wider">
                          <span>{t('session.promptChar1')}</span>
                          <span>{t('session.promptChar2')}</span>
                          <span>{t('session.promptChar3')}</span>
                        </div>
                      </motion.div>
                    )}

                    {/* New message indicator - only show when user scrolled away */}
                    <AnimatePresence>
                      {userScrolled && (
                        <motion.div
                          initial={{ opacity: 0, y: 20, scale: 0.8 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 20, scale: 0.8 }}
                          className="flex flex-col items-center gap-1 bg-background/60 backdrop-blur-md border border-border/50 rounded-xl px-1.5 py-2 cursor-pointer hover:bg-accent/80 shadow-sm"
                          onClick={() => {
                            setUserScrolled(false);
                            setShouldAutoScroll(true);
                            // 使用虚拟列表的 scrollToBottom，解决消息过多时滚动不到底的问题
                            sessionMessagesRef.current?.scrollToBottom();
                          }}
                          title={t('claudeSession.newMessage')}
                        >
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          <div className="flex flex-col items-center text-[10px] leading-tight tracking-wider">
                            <span>{t('session.newChar1')}</span>
                            <span>{t('session.newChar2')}</span>
                            <span>{t('session.newChar3')}</span>
                          </div>
                          <ChevronDown className="h-3 w-3" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Traditional scroll controls */}
                    <div className="flex flex-col bg-background/60 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUserScrolled(true);
                          setShouldAutoScroll(false);
                          if (parentRef.current) {
                            parentRef.current.scrollTo({
                              top: 0,
                              behavior: 'smooth'
                            });
                          }
                        }}
                        className="px-1.5 py-1.5 hover:bg-accent/80 rounded-none h-auto min-h-0"
                        title={t('claudeSession.scrollToTop')}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <div className="h-px w-full bg-border/50" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUserScrolled(false);
                          setShouldAutoScroll(true);
                          // 使用虚拟列表的 scrollToBottom，解决消息过多时滚动不到底的问题
                          sessionMessagesRef.current?.scrollToBottom();
                        }}
                        className="px-1.5 py-1.5 hover:bg-accent/80 rounded-none h-auto min-h-0"
                        title={t('claudeSession.scrollToBottom')}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* ✅ 重构：队列提示词作为 Flex 的一部分，显示在输入框上方 */}
        <AnimatePresence>
          {queuedPrompts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-shrink-0 w-full max-w-3xl mx-auto px-4 pb-2"
            >
              <div className="floating-element backdrop-enhanced rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {t('session.queuedPrompts', { count: queuedPrompts.length })}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setQueuedPromptsCollapsed(prev => !prev)}>
                    {queuedPromptsCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
                {!queuedPromptsCollapsed && queuedPrompts.map((queuedPrompt, index) => (
                  <motion.div
                    key={queuedPrompt.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2 bg-muted/50 rounded-md p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                          {queuedPrompt.model === "opus" ? "Opus" : queuedPrompt.model === "sonnet1m" ? "Sonnet 1M" : "Sonnet"}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2 break-words">{queuedPrompt.prompt}</p>
                    </div>
                    {/* 🆕 上移/下移按钮（支持队列插队） */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        disabled={index === 0}
                        onClick={() => {
                          setQueuedPrompts(prev => {
                            const newQueue = [...prev];
                            [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
                            return newQueue;
                          });
                        }}
                        title="上移（插队）"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        disabled={index === queuedPrompts.length - 1}
                        onClick={() => {
                          setQueuedPrompts(prev => {
                            const newQueue = [...prev];
                            [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
                            return newQueue;
                          });
                        }}
                        title="下移"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* 🆕 立即执行按钮（插队执行） */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-primary hover:text-primary hover:bg-primary/20"
                      onClick={async () => {
                        // 移除当前提示词
                        const promptToExecute = queuedPrompt;
                        setQueuedPrompts(prev => prev.filter(p => p.id !== promptToExecute.id));

                        // 🔥 修复：如果正在执行，先取消当前任务（保留队列）
                        if (isLoading) {
                          await handleCancelExecution({ keepQueue: true, processNextInQueue: false });
                          // 等待取消完成
                          await new Promise(resolve => setTimeout(resolve, 200));
                        }

                        // 立即发送插队项
                        handleSendPromptWithScroll(promptToExecute.prompt, promptToExecute.model);
                      }}
                      title="立即执行（插队）"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => setQueuedPrompts(prev => prev.filter(p => p.id !== queuedPrompt.id))}
                      title="移除"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Prompt Input - 输入区域 */}
        <ErrorBoundary>
          {/* ✅ 重构：输入区域作为 Flex 容器的一部分，不再使用 fixed 定位 */}
          <FloatingPromptInput
            className="flex-shrink-0 transition-[left] duration-300"
            ref={floatingPromptRef}
            onSend={handleSendPromptWithScroll}
            onCancel={handleCancelExecution}
            isLoading={isLoading}
            disabled={!projectPath && !effectiveSession && !onSmartSessionUpgrade}
            projectPath={projectPath}
            sessionId={effectiveSession?.id}         // 🆕 传递会话 ID
            projectId={effectiveSession?.project_id} // 🆕 传递项目 ID
            sessionModel={session?.model}
            getConversationContext={getConversationContext}
            messages={messages}                      // 🆕 传递完整消息列表
            isPlanMode={isPlanMode}
            onTogglePlanMode={handleTogglePlanMode}
            sessionCost={formatCost(costStats.totalCost)}
            sessionStats={costStats}
            hasMessages={messages.length > 0}
            session={effectiveSession || undefined}  // 🆕 传递完整会话信息用于导出
            codexRateLimits={codexRateLimits}
            executionEngineConfig={executionEngineConfig}              // 🆕 Codex 集成
            onExecutionEngineConfigChange={setExecutionEngineConfig}   // 🆕 Codex 集成
            onOpenCanvas={() => setShowCanvas(true)}                   // 🆕 Canvas 实时预览
            hasPreviewableCode={!!extractedCode?.code}                 // 🆕 检测到可预览代码
            codeSource={extractedCode?.source}                         // 🆕 代码来源
            onToggleUsageDashboard={() => setShowUsageDashboard(prev => !prev)} // 🆕 Token 消耗图表
            showUsageDashboard={showUsageDashboard}                    // 🆕 图表显示状态
            onToggleMCPConfig={() => setShowMCPConfig(prev => !prev)}  // 🆕 项目级 MCP 配置
            compactStatus={compactStatus}                              // 🆕 后台压缩状态
            isCompacting={isCompacting}                                // 🆕 是否正在压缩
            compactProgress={compactProgress}                          // 🆕 压缩进度
            deltaMessagesCount={deltaMessagesCount}                    // 🆕 增量消息数量
          />

          {/* 🆕 状态指示器 - 后台压缩/会话续接（Invisible UX） */}
          <CompactStatusIndicator
            status={compactStatus}
            progress={compactProgress}
            deltaMessagesCount={deltaMessagesCount}
            isCompacting={isCompacting}
            sessionContinueStatus={sessionContinueStatus}
            isGeneratingSummary={isGeneratingSummary}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50"
          />

          {/* 🆕 自动继续指示器 - 智能检测未完成任务（Cost-Effective UX） */}
          <AutoResumeIndicator
            show={!isAutoResumeCancelled && autoResumeCountdown > 0}
            countdown={autoResumeCountdown}
            remainingAttempts={remainingAttempts}
            onCancel={cancelAutoResume}
            onResume={manualResume}
          />

        </ErrorBoundary>

        {/* Revert Prompt Picker - Shows when double ESC is pressed */}
        {showRevertPicker && effectiveSession && (
          <RevertPromptPicker
            sessionId={effectiveSession.id}
            projectId={effectiveSession.project_id}
            projectPath={projectPath}
            engine={effectiveSession.engine || executionEngineConfig.engine || 'claude'}
            onSelect={handleRevert}
            onClose={() => setShowRevertPicker(false)}
          />
        )}

        {/* Plan Approval Dialog - 方案 B-1: ExitPlanMode 触发审批 */}
        <PlanApprovalDialog
          open={showApprovalDialog}
          plan={pendingApproval?.plan || ''}
          onClose={closeApprovalDialog}
          onApprove={approvePlan}
          onReject={rejectPlan}
        />

        {/* 🆕 User Question Dialog - AskUserQuestion 自动触发 */}
        <AskUserQuestionDialog
          open={showQuestionDialog}
          questions={pendingQuestion?.questions || []}
          onClose={closeQuestionDialog}
          onSubmit={submitAnswers}
        />
      </div>

      {/* Prompt Navigator - Quick navigation to any user prompt */}
      <PromptNavigator
        messages={messages}
        isOpen={showPromptNavigator}
        onClose={() => setShowPromptNavigator(false)}
        onPromptClick={handlePromptNavigation}
      />

      {/* Canvas 实时预览悬浮窗 - Gemini 风格 */}
      <CanvasFloatingWindow
        isOpen={showCanvas}
        onClose={() => setShowCanvas(false)}
        extractedCode={extractedCode?.code || ''}
        language={extractedCode?.language || 'tsx'}
      />

      {/* 🆕 项目级 MCP 快捷配置对话框 */}
      {projectPath && (
        <ProjectMCPQuickConfig
          open={showMCPConfig}
          onClose={() => setShowMCPConfig(false)}
          projectPath={projectPath}
          engine={executionEngineConfig.engine}
        />
      )}

    </div>
  );
};

export const ClaudeCodeSession: React.FC<ClaudeCodeSessionProps> = (props) => {
  return (
    <MessagesProvider initialFilterConfig={{ hideWarmupMessages: true }}>
      <PlanModeProvider>
        <UserQuestionProvider>
          <ClaudeCodeSessionInner {...props} />
        </UserQuestionProvider>
      </PlanModeProvider>
    </MessagesProvider>
  );
};


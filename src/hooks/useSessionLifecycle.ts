import { useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { api, type Session } from '@/lib/api';
import { normalizeUsageData } from '@/lib/utils';
import type { ClaudeStreamMessage } from '@/types/claude';
import type { CodexRateLimits } from '@/types/codex';
import { codexConverter } from '@/lib/codexConverter';
import { convertGeminiSessionDetailToClaudeMessages } from '@/lib/geminiConverter';

/**
 * useSessionLifecycle Hook
 *
 * 管理会话生命周期，包括：
 * - 加载会话历史
 * - 检查活跃会话
 * - 重连到活跃会话
 * - 事件监听器管理
 *
 * 从 ClaudeCodeSession.tsx 提取（Phase 3）
 *
 * 🔧 修复：添加竞态条件保护，防止快速切换会话时加载状态卡住
 */

interface UseSessionLifecycleConfig {
  session: Session | undefined;
  isMountedRef: React.MutableRefObject<boolean>;
  isListeningRef: React.MutableRefObject<boolean>;
  hasActiveSessionRef: React.MutableRefObject<boolean>;
  unlistenRefs: React.MutableRefObject<UnlistenFn[]>;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ClaudeStreamMessage[]>>;
  setRawJsonlOutput: React.Dispatch<React.SetStateAction<string[]>>;
  setClaudeSessionId: (sessionId: string) => void;
  setCodexRateLimits?: React.Dispatch<React.SetStateAction<CodexRateLimits | null>>;
  initializeProgressiveTranslation: (messages: ClaudeStreamMessage[]) => Promise<void>;
  processMessageWithTranslation: (message: ClaudeStreamMessage, payload: string) => Promise<void>;
}

interface UseSessionLifecycleReturn {
  loadSessionHistory: () => Promise<void>;
  checkForActiveSession: () => Promise<void>;
  reconnectToSession: (sessionId: string) => Promise<void>;
}

export function useSessionLifecycle(config: UseSessionLifecycleConfig): UseSessionLifecycleReturn {
  const {
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
    processMessageWithTranslation
  } = config;

  // 🔧 修复竞态条件：追踪当前正在加载的会话 ID
  // 当快速切换会话时，确保只有最新的加载请求能更新状态
  const loadingSessionIdRef = useRef<string | null>(null);

  /**
   * 加载会话历史记录
   */
  const loadSessionHistory = useCallback(async () => {
    if (!session) return;

    // 🔧 记录当前加载的会话 ID，用于竞态条件检查
    const currentSessionId = session.id;
    loadingSessionIdRef.current = currentSessionId;

    try {
      setIsLoading(true);
      setError(null);

      
      const engine = (session as any).engine;

      let history: ClaudeStreamMessage[] = [];

      // Handle Gemini sessions differently
      if (engine === 'gemini') {
        try {
          const geminiDetail = await api.getGeminiSessionDetail(session.project_path, session.id);
          history = convertGeminiSessionDetailToClaudeMessages(geminiDetail);
        } catch (geminiErr) {
          console.error('[useSessionLifecycle] Failed to load Gemini session:', geminiErr);
          throw geminiErr;
        }
      } else {
        // Load Claude/Codex sessions
        history = await api.loadSessionHistory(
          session.id,
          session.project_id,
          engine
        );

        // If Codex, convert events to messages
        if (engine === 'codex') {
          codexConverter.reset();
          const convertedMessages: ClaudeStreamMessage[] = [];

          for (const event of history) {
              const msg = codexConverter.convertEventObject(event);
              if (msg) {
                  convertedMessages.push(msg);
              }
          }
          history = convertedMessages;
          if (setCodexRateLimits) {
            setCodexRateLimits(codexConverter.getRateLimits());
          }
        }
      }

      // Convert history to messages format
      // Track warned types to avoid console spam
      const warnedTypes = new Set<string>();
      const loadedMessages: ClaudeStreamMessage[] = history
        .filter(entry => {
          // Filter out invalid message types like 'queue-operation', 'file-history-snapshot'
          const type = entry.type;
          const validTypes = ['user', 'assistant', 'system', 'result', 'summary', 'thinking', 'tool_use'];
          if (type && !validTypes.includes(type)) {
            // Only warn once per type to avoid console spam
            if (!warnedTypes.has(type)) {
              warnedTypes.add(type);
              console.debug('[useSessionLifecycle] Filtering out message type:', type);
            }
            return false;
          }
          return true;
        })
        .map(entry => ({
          ...entry,
          type: entry.type || "assistant"
        }));

      // ✨ NEW: Normalize usage data for historical messages
      // 修复：同时处理所有可能的 usage 位置，确保历史会话费用和上下文窗口正确显示
      const processedMessages = loadedMessages.map(msg => {
        // 处理 message.usage (Claude 主要格式)
        if (msg.message?.usage) {
          msg.message.usage = normalizeUsageData(msg.message.usage);
        }
        // 处理顶层 usage (某些消息类型和 Codex)
        if (msg.usage) {
          msg.usage = normalizeUsageData(msg.usage);
        }
        // 处理 codexMetadata.usage (Codex 特有格式)
        if ((msg as any).codexMetadata?.usage) {
          (msg as any).codexMetadata.usage = normalizeUsageData((msg as any).codexMetadata.usage);
        }

        // 🆕 FIX: Retype slash command related messages from 'user' to 'system'
        // Claude CLI returns slash command output in various formats that should be system messages
        if (msg.type === 'user') {
          const content = msg.message?.content;
          let textContent = '';

          // Extract text content
          if (typeof content === 'string') {
            textContent = content;
          } else if (Array.isArray(content)) {
            textContent = content
              .filter((item: any) => item?.type === 'text')
              .map((item: any) => item?.text || '')
              .join('\n');
          }

          // Check for various slash command output patterns
          const isCommandOutput = textContent.includes('<local-command-stdout>');
          const isCommandMeta = textContent.includes('<command-name>') || textContent.includes('<command-message>');
          const isCommandError = textContent.includes('Unknown slash command:');

          if (isCommandOutput || isCommandMeta || isCommandError) {
            return {
              ...msg,
              type: 'system' as const,
              subtype: isCommandOutput ? 'command-output' : isCommandError ? 'command-error' : 'command-meta'
            };
          }
        }

        return msg;
      });

      // 🔧 竞态条件检查：确保会话没有在加载过程中切换
      // 如果用户在加载过程中切换到了另一个会话，丢弃当前结果
      if (loadingSessionIdRef.current !== currentSessionId) {
        console.debug('[useSessionLifecycle] Session changed during loading, discarding results for:', currentSessionId);
        return;
      }

      // 检查组件是否仍然挂载
      if (!isMountedRef.current) {
        console.debug('[useSessionLifecycle] Component unmounted during loading');
        return;
      }

      // ✨ NEW: Immediate display - no more blocking on translation
      setMessages(processedMessages);
      setRawJsonlOutput(history.map(h => JSON.stringify(h)));

      // ⚡ CRITICAL: Set loading to false IMMEDIATELY after messages are set
      // This prevents the "Loading..." screen from showing unnecessarily
      setIsLoading(false);

      // ⚡ PERFORMANCE: 完全禁用后台翻译初始化，避免性能问题
      // 翻译功能已有独立的懒加载机制，不需要在会话加载时初始化
      // 这可以显著提升生产构建的加载速度
      // setTimeout(async () => {
      //   try {
      //     const isTranslationEnabled = await translationMiddleware.isEnabled();
      //     if (isTranslationEnabled) {
      //       await initializeProgressiveTranslation(processedMessages);
      //     }
      //   } catch (err) {
      //     console.error('[useSessionLifecycle] Background translation failed:', err);
      //   }
      // }, 0);

      // After loading history, we're continuing a conversation
    } catch (err) {
      console.error("Failed to load session history:", err);

      // 🔧 竞态条件检查：只有当前会话的错误才应该显示
      if (loadingSessionIdRef.current !== currentSessionId) {
        console.debug('[useSessionLifecycle] Session changed during error, ignoring error for:', currentSessionId);
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setError("加载会话历史记录失败");
      setIsLoading(false);
    }
  }, [session, isMountedRef, setIsLoading, setError, setMessages, setRawJsonlOutput, setCodexRateLimits, initializeProgressiveTranslation]);

  /**
   * 检查会话是否仍在活跃状态
   */
  const checkForActiveSession = useCallback(async () => {
    // If we have a session prop, check if it's still active
    if (session) {
      // 🔧 竞态条件检查：确保会话没有在检查过程中切换
      const currentSessionId = session.id;

      // Skip active session check for Codex sessions
      // Codex sessions are non-interactive and don't maintain active state
      const isCodexSession = (session as any).engine === 'codex';
      if (isCodexSession) {
        return;
      }

      // Skip active session check for Gemini sessions
      const isGeminiSession = (session as any).engine === 'gemini';
      if (isGeminiSession) {
        return;
      }

      try {
        const activeSessions = await api.listRunningClaudeSessions();

        // 🔧 竞态条件检查：API 调用期间会话可能已切换
        if (loadingSessionIdRef.current !== currentSessionId) {
          console.debug('[useSessionLifecycle] Session changed during active check, aborting for:', currentSessionId);
          return;
        }

        const activeSession = activeSessions.find((s: any) => {
          if ('process_type' in s && s.process_type && 'ClaudeSession' in s.process_type) {
            return (s.process_type as any).ClaudeSession.session_id === session.id;
          }
          return false;
        });

        if (activeSession) {
          // Session is still active, reconnect to its stream
          // IMPORTANT: Set claudeSessionId before reconnecting
          setClaudeSessionId(session.id);

          // Don't add buffered messages here - they've already been loaded by loadSessionHistory
          // Just set up listeners for new messages

          // Set up listeners for the active session
          reconnectToSession(session.id);
        }
      } catch (err) {
        console.error('Failed to check for active sessions:', err);
        // 🔧 不要在这里设置错误状态，因为这只是一个可选的检查
        // 加载历史记录已经成功，检查活跃状态失败不应该影响用户体验
      }
    }
  }, [session, setClaudeSessionId]);

  /**
   * 重新连接到活跃会话
   */
  const reconnectToSession = useCallback(async (sessionId: string) => {
    // Prevent duplicate listeners
    if (isListeningRef.current) {
      return;
    }

    // Clean up previous listeners
    unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
    unlistenRefs.current = [];

    // IMPORTANT: Set the session ID before setting up listeners
    setClaudeSessionId(sessionId);

    // Mark as listening
    isListeningRef.current = true;

    // Set up session-specific listeners
    const outputUnlisten = await listen<string>(`claude-output:${sessionId}`, async (event) => {
      try {
        if (!isMountedRef.current) return;

        // Store raw JSONL
        setRawJsonlOutput(prev => [...prev, event.payload]);

        // 🔧 CRITICAL FIX: Apply translation to reconnect messages too
        // Parse message
        const message = JSON.parse(event.payload) as ClaudeStreamMessage;

        // Apply translation using the same logic as handleStreamMessage
        await processMessageWithTranslation(message, event.payload);

      } catch (err) {
        console.error("Failed to parse message:", err, event.payload);
      }
    });

    const errorUnlisten = await listen<string>(`claude-error:${sessionId}`, (event) => {
      console.error("Claude error:", event.payload);
      if (isMountedRef.current) {
        setError(event.payload);
      }
    });

    const completeUnlisten = await listen<boolean>(`claude-complete:${sessionId}`, async () => {
      if (isMountedRef.current) {
        setIsLoading(false);
        // 🔧 FIX: Reset all session state when session completes
        // This allows usePromptExecution to set up new listeners for the next prompt
        hasActiveSessionRef.current = false;
        isListeningRef.current = false;

        // 🔧 FIX: Clean up listeners to allow new ones to be set up
        // The old session-specific listeners won't work if a new session ID is assigned
        unlistenRefs.current.forEach(u => u && typeof u === 'function' && u());
        unlistenRefs.current = [];
      }
    });

    unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten];

    // Mark as loading to show the session is active
    if (isMountedRef.current) {
      setIsLoading(true);
      hasActiveSessionRef.current = true;
    }
  }, [
    isMountedRef,
    isListeningRef,
    hasActiveSessionRef,
    unlistenRefs,
    setClaudeSessionId,
    setRawJsonlOutput,
    setError,
    setIsLoading,
    processMessageWithTranslation
  ]);

  return {
    loadSessionHistory,
    checkForActiveSession,
    reconnectToSession
  };
}

/**
 * Claude Engine Handler
 *
 * 处理 Claude 引擎的事件监听和消息处理逻辑
 * 从 usePromptExecution.ts 提取（行 1400-1800）
 */

import { logger } from '@/lib/logger';
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import { globalTaskActions } from "@/hooks/useGlobalTaskState";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { TranslationResult } from "@/lib/translationMiddleware";
import type { UsePromptExecutionConfig, ClaudeGlobalEventPayload } from "../types";
import { normalizeClaudeGlobalPayload } from "../utils";

export interface ClaudeEngineContext {
  config: UsePromptExecutionConfig;
  tabIdRef: React.MutableRefObject<string>;
  prompt: string;
  recordedPromptIndex: number;
  currentSessionId: string | null;
  hasAttachedSessionListeners: boolean;
  pendingClaudePromptRecordingPromise: Promise<void> | null;
  processedClaudeMessages: Set<string>;
  handleSendPrompt: (prompt: string, model: any, maxThinkingTokens?: number) => Promise<void>;
}

/**
 * 生成 Claude 消息 ID
 */
function getClaudeMessageId(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash }
  return `claude-${hash}` }

/**
 * 设置 Claude 引擎的事件监听器
 */
export async function setupClaudeEventListeners(
  context: ClaudeEngineContext
): Promise<UnlistenFn[]> {
  const {
    config,
    tabIdRef,
    prompt,
    recordedPromptIndex,
    currentSessionId,
    hasAttachedSessionListeners,
    pendingClaudePromptRecordingPromise,
    processedClaudeMessages,
    handleSendPrompt,
  } = context;

  const {
    projectPath,
    claudeSessionId,
    effectiveSession,
    extractedSessionInfo,
    isMountedRef,
    setRawJsonlOutput,
    setIsLoading,
    hasActiveSessionRef,
    isListeningRef,
    queuedPromptsRef,
    setQueuedPrompts,
    setError,
    processMessageWithTranslation,
  } = config;

  const unlisteners: UnlistenFn[] = [];
  const currentRequestTabId = tabIdRef.current;

  // Helper: Handle stream message
  async function handleStreamMessage(
    payload: string,
    currentTranslationResult?: TranslationResult,
  ) {
    try {
      if (!isMountedRef.current) return;

      // 检查 tabId 是否变化
      if (tabIdRef.current !== currentRequestTabId) {
        logger.debug('claude', "[Claude Engine] ⚠️ tabId 已变化，忽略旧请求的消息");
        return }

      // Deduplicate messages
      const messageId = getClaudeMessageId(payload);
      if (processedClaudeMessages.has(messageId)) {
        return }
      processedClaudeMessages.add(messageId);

      // Store raw JSONL
      setRawJsonlOutput((prev) => [...prev, payload]);

      const message = JSON.parse(payload) as ClaudeStreamMessage;

      // Use shared translation function
      await processMessageWithTranslation(message, payload, currentTranslationResult) } catch (err) {
      logger.error('claude', "[Claude Engine] Failed to parse message:", err, payload) }
  }

  // Helper: Process completion
  const processComplete = async () => {
    // Wait for pending prompt recording
    if (pendingClaudePromptRecordingPromise) {
      await pendingClaudePromptRecordingPromise }

    // Mark prompt as completed
    if (recordedPromptIndex >= 0) {
      const sessionId = effectiveSession?.id || currentSessionId;
      const projectId =
        effectiveSession?.project_id ||
        extractedSessionInfo?.projectId ||
        projectPath.replace(/[^a-zA-Z0-9]/g, "-");

      if (sessionId && projectId) {
        api
          .markPromptCompleted(
            sessionId,
            projectId,
            projectPath,
            recordedPromptIndex,
            prompt,
          )
          .then(() => {})
          .catch((err) => {
            logger.error('claude', "[Claude Engine] Failed to mark completed:", err) }) }
    }

    setIsLoading(false);
    hasActiveSessionRef.current = false;
    isListeningRef.current = false;

    globalTaskActions.updateTaskStatus(tabIdRef.current, "completed");

    // Clean up listeners
    unlisteners.forEach((u) => u && typeof u === "function" && u());
    unlisteners.length = 0;

    // Process queued prompts
    if (queuedPromptsRef.current.length > 0) {
      const [nextPrompt, ...remainingPrompts] = queuedPromptsRef.current;
      setQueuedPrompts(remainingPrompts);

      setTimeout(() => {
        handleSendPrompt(nextPrompt.prompt, nextPrompt.model) }, 100) }
  };

  // Setup session-specific listeners if we have a session ID
  if (claudeSessionId) {
    const sid = claudeSessionId;

    const specificOutputUnlisten = await listen<string>(
      `claude-output:${sid}`,
      async (evt) => {
        await handleStreamMessage(evt.payload) },
    );

    const specificErrorUnlisten = await listen<string>(`claude-error:${sid}`, (evt) => {
      logger.error('claude', "[Claude Engine] Error (scoped);:", evt.payload);
      setError(evt.payload);
      setIsLoading(false);
      hasActiveSessionRef.current = false });

    const specificCompleteUnlisten = await listen<boolean>(
      `claude-complete:${sid}`,
      () => {
        processComplete() },
    );

    unlisteners.push(specificOutputUnlisten, specificErrorUnlisten, specificCompleteUnlisten) }

  // Generic listeners (catch-all)
  const genericOutputUnlisten = await listen<ClaudeGlobalEventPayload<string>>(
    "claude-output",
    async (event) => {
      if (!hasActiveSessionRef.current) return;

      // Use tab_id to filter messages
      const { tabId: eventTabId, payload: messagePayload } = normalizeClaudeGlobalPayload(
        event.payload,
      );

      if (eventTabId && eventTabId !== tabIdRef.current) {
        return }

      // Session isolation
      if (hasAttachedSessionListeners) {
        try {
          const msg = JSON.parse(messagePayload) as ClaudeStreamMessage;
          // Only process init messages for new sessions
          if (
            msg.type === "system" &&
            msg.subtype === "init" &&
            msg.session_id &&
            msg.session_id !== currentSessionId
          ) {
            // Fall through
          } else {
            return }
        } catch {
          return }
      }

      // Extract session_id
      try {
        const msg = JSON.parse(messagePayload) as ClaudeStreamMessage;

        // Validate session_id
        if (msg.session_id && claudeSessionId && msg.session_id !== claudeSessionId) {
          return }

        // Validate cwd
        if (msg.cwd && !claudeSessionId) {
          const normalizePath = (p: string) =>
            p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
          const msgCwd = normalizePath(msg.cwd);
          const currentPath = normalizePath(projectPath);

          if (msgCwd !== currentPath) {
            return }
        }

        await handleStreamMessage(messagePayload) } catch (err) {
        logger.error('claude', "[Claude Engine] Failed to process generic output:", err) }
    },
  );
  unlisteners.push(genericOutputUnlisten);

  const genericErrorUnlisten = await listen<ClaudeGlobalEventPayload<string>>(
    "claude-error",
    (event) => {
      const { tabId: eventTabId, payload: errorPayload } = normalizeClaudeGlobalPayload(
        event.payload,
      );

      if (eventTabId && eventTabId !== tabIdRef.current) {
        return }

      logger.error('claude', "[Claude Engine] Error (generic);:", errorPayload);
      setError(errorPayload);
      setIsLoading(false);
      hasActiveSessionRef.current = false },
  );
  unlisteners.push(genericErrorUnlisten);

  const genericCompleteUnlisten = await listen<ClaudeGlobalEventPayload<boolean>>(
    "claude-complete",
    (event) => {
      const { tabId: eventTabId } = normalizeClaudeGlobalPayload(event.payload);

      if (eventTabId && eventTabId !== tabIdRef.current) {
        return }

      processComplete() },
  );
  unlisteners.push(genericCompleteUnlisten);

  return unlisteners }

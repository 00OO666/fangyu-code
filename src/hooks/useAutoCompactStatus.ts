import { useState, useEffect, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { api } from '@/lib/api';

/**
 * Compaction event types from backend
 */
export type CompactionEventType = 'started' | 'in_progress' | 'completed' | 'failed';

/**
 * Compaction event payload from Tauri
 */
export interface CompactionEvent {
  session_id: string;
  event_type: CompactionEventType;
  progress: number | null;
  message: string | null;
  tokens_before: number | null;
  tokens_after: number | null;
}

/**
 * Auto-compact status for a session
 */
export interface AutoCompactStatus {
  /** Whether compaction is currently in progress */
  isCompacting: boolean;
  /** Current progress (0-100) */
  progress: number;
  /** Status message */
  message: string | null;
  /** Event type for current/last operation */
  eventType: CompactionEventType | null;
  /** Token count before compaction */
  tokensBefore: number | null;
  /** Token count after compaction */
  tokensAfter: number | null;
  /** Last compaction timestamp */
  lastCompaction: Date | null;
  /** Total compaction count for this session */
  compactionCount: number;
  /** Whether auto-compact is enabled globally */
  isEnabled: boolean;
  /** Max context tokens threshold */
  maxContextTokens: number;
  /** Compaction threshold percentage */
  compactionThreshold: number;
}

interface UseAutoCompactStatusOptions {
  /** Session ID to monitor */
  sessionId?: string;
  /** Whether to enable real-time event tracking */
  enableEventTracking?: boolean;
  /** Callback when compaction starts */
  onCompactionStart?: (event: CompactionEvent) => void;
  /** Callback when compaction completes */
  onCompactionComplete?: (event: CompactionEvent) => void;
  /** Callback when compaction fails */
  onCompactionFailed?: (event: CompactionEvent) => void;
}

/**
 * Hook for monitoring auto-compact status and events
 *
 * Listens to Tauri events for real-time compaction status updates
 * and provides API methods for manual status queries.
 */
export const useAutoCompactStatus = (options: UseAutoCompactStatusOptions = {}): AutoCompactStatus & {
  refresh: () => Promise<void>;
} => {
  const {
    sessionId,
    enableEventTracking = true,
    onCompactionStart,
    onCompactionComplete,
    onCompactionFailed,
  } = options;

  const [status, setStatus] = useState<AutoCompactStatus>({
    isCompacting: false,
    progress: 0,
    message: null,
    eventType: null,
    tokensBefore: null,
    tokensAfter: null,
    lastCompaction: null,
    compactionCount: 0,
    isEnabled: true,
    maxContextTokens: 120000,
    compactionThreshold: 0.85,
  });

  // Fetch global auto-compact status
  const fetchStatus = useCallback(async () => {
    try {
      const globalStatus = await api.getAutoCompactStatus();

      setStatus(prev => ({
        ...prev,
        isEnabled: globalStatus.enabled,
        maxContextTokens: globalStatus.max_context_tokens,
        compactionThreshold: globalStatus.compaction_threshold,
      }));

      // If we have a session ID, also get session-specific stats
      if (sessionId) {
        try {
          const sessionStats = await api.getSessionContextStats(sessionId);
          if (sessionStats) {
            setStatus(prev => ({
              ...prev,
              compactionCount: sessionStats.compaction_count || 0,
              lastCompaction: sessionStats.last_compaction
                ? new Date(sessionStats.last_compaction)
                : null,
              isCompacting: sessionStats.status === 'Compacting',
            }));
          }
        } catch (e) {
          // Session might not be registered yet
          console.debug('Session not found in auto-compact monitoring:', sessionId);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch auto-compact status:', error);
    }
  }, [sessionId]);

  // Listen for Tauri events
  useEffect(() => {
    if (!enableEventTracking) return;

    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<CompactionEvent>('auto-compact-event', (event) => {
          const payload = event.payload;

          // Only process events for our session (or all if no session specified)
          if (sessionId && payload.session_id !== sessionId) {
            return;
          }

          const eventType = payload.event_type;

          setStatus(prev => ({
            ...prev,
            eventType,
            progress: payload.progress ?? prev.progress,
            message: payload.message ?? prev.message,
            tokensBefore: payload.tokens_before ?? prev.tokensBefore,
            tokensAfter: payload.tokens_after ?? prev.tokensAfter,
            isCompacting: eventType === 'started' || eventType === 'in_progress',
          }));

          // Trigger callbacks
          switch (eventType) {
            case 'started':
              onCompactionStart?.(payload);
              break;
            case 'completed':
              onCompactionComplete?.(payload);
              // Update compaction count
              setStatus(prev => ({
                ...prev,
                compactionCount: prev.compactionCount + 1,
                lastCompaction: new Date(),
              }));
              break;
            case 'failed':
              onCompactionFailed?.(payload);
              break;
          }
        });
      } catch (error) {
        console.warn('Failed to setup auto-compact event listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [sessionId, enableEventTracking, onCompactionStart, onCompactionComplete, onCompactionFailed]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    ...status,
    refresh: fetchStatus,
  };
};

export default useAutoCompactStatus;

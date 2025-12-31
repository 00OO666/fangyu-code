import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface SessionActivityInfo {
  sessionId: string;
  isActive: boolean;
  timeRemainingHours: number;
  startTime: string;
  lastActivity: string;
}

interface UseSessionActivityStatusOptions {
  /**
   * Session ID to monitor
   */
  sessionId?: string;
  /**
   * Whether to enable real-time monitoring
   */
  enableRealTimeTracking?: boolean;
  /**
   * Polling interval in milliseconds for activity check
   */
  pollInterval?: number;
  /**
   * Activity timeout threshold in minutes
   */
  activityTimeoutMinutes?: number;
}

interface SessionActivityStatus {
  isActive: boolean;
  timeRemainingHours: number;
  isCurrentSession: boolean;
  shouldTrackCost: boolean;
  lastActivity?: string;
  activityState: 'active' | 'inactive' | 'expired' | 'unknown';
}

/**
 * Hook for managing session activity status and determining when to track costs
 *
 * Based on Claude Code's 5-hour session window policy and activity detection
 */
export const useSessionActivityStatus = (options: UseSessionActivityStatusOptions = {}): SessionActivityStatus => {
  const {
    sessionId,
    enableRealTimeTracking = true,
    pollInterval = 30000, // 30 seconds
    activityTimeoutMinutes = 30 // Consider inactive after 30 minutes of no activity
  } = options;

  const [activityInfo, setActivityInfo] = useState<SessionActivityInfo | null>(null);
  const [isCurrentSession, setIsCurrentSession] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<Date>();

  // Check if this is the current active session
  useEffect(() => {
    if (!sessionId) {
      setIsCurrentSession(false);
      return;
    }

    // Check if this session ID matches current active session
    // This could be determined by checking if we're actively receiving messages
    // or if this is the session being displayed in the main view
    const checkCurrentSession = () => {
      // For now, we'll consider a session current if it has recent activity
      // In a real implementation, this would be managed by the session manager
      const urlParams = new URLSearchParams(window.location.search);
      const currentSessionFromUrl = urlParams.get('session');
      setIsCurrentSession(sessionId === currentSessionFromUrl || !currentSessionFromUrl);
    };

    checkCurrentSession();

    // Listen for session changes
    const handleSessionChange = () => checkCurrentSession();
    window.addEventListener('session-changed', handleSessionChange);

    return () => {
      window.removeEventListener('session-changed', handleSessionChange);
    };
  }, [sessionId]);

  // Fetch session activity status
  const fetchActivityStatus = async () => {
    if (!sessionId) return;

    try {
      // Get all active sessions to find our session
      const activeSessions = await api.getActiveSessions();
      const sessionInfo = activeSessions.find((s: any) => s.session_id === sessionId);

      if (sessionInfo) {
        setActivityInfo({
          sessionId,
          isActive: sessionInfo.is_active,
          timeRemainingHours: sessionInfo.time_remaining_hours,
          startTime: sessionInfo.start_time,
          lastActivity: sessionInfo.last_activity
        });

        // Update last activity reference
        if (sessionInfo.last_activity) {
          lastActivityRef.current = new Date(sessionInfo.last_activity);
        }
      } else {
        // Session not found in active sessions - consider it inactive
        setActivityInfo({
          sessionId,
          isActive: false,
          timeRemainingHours: 0,
          startTime: '',
          lastActivity: ''
        });
      }
    } catch (error) {
      console.warn('Failed to fetch session activity status:', error);
      // On error, default to inactive to prevent unwanted cost tracking
      setActivityInfo({
        sessionId,
        isActive: false,
        timeRemainingHours: 0,
        startTime: '',
        lastActivity: ''
      });
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    if (!sessionId || !enableRealTimeTracking) return;

    // Initial fetch
    fetchActivityStatus();

    // Set up polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(fetchActivityStatus, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [sessionId, enableRealTimeTracking, pollInterval]);

  // Determine activity state based on session status and recent activity
  const getActivityState = (): 'active' | 'inactive' | 'expired' | 'unknown' => {
    if (!activityInfo) return 'unknown';

    // If session window has expired
    if (!activityInfo.isActive) {
      return 'expired';
    }

    // If this is the current session, consider it active
    if (isCurrentSession) {
      return 'active';
    }

    // Check last activity time
    if (lastActivityRef.current) {
      const minutesSinceActivity = (Date.now() - lastActivityRef.current.getTime()) / (1000 * 60);
      if (minutesSinceActivity > activityTimeoutMinutes) {
        return 'inactive';
      }
    }

    return 'active';
  };

  // Method to manually update activity (called when new messages arrive)
  const updateActivity = () => {
    lastActivityRef.current = new Date();

    // If we have session info and it's within the window, mark as active
    if (activityInfo && activityInfo.timeRemainingHours > 0) {
      setActivityInfo(prev => prev ? {
        ...prev,
        lastActivity: new Date().toISOString()
      } : null);
    }
  };

  // Expose update method globally for use by message handlers
  useEffect(() => {
    if (isCurrentSession && sessionId) {
      (window as any).__updateSessionActivity = updateActivity;
    }

    return () => {
      if ((window as any).__updateSessionActivity === updateActivity) {
        delete (window as any).__updateSessionActivity;
      }
    };
  }, [isCurrentSession, sessionId]);

  const activityState = getActivityState();

  return {
    isActive: activityInfo?.isActive ?? false,
    timeRemainingHours: activityInfo?.timeRemainingHours ?? 0,
    isCurrentSession,
    shouldTrackCost: activityState === 'active',
    lastActivity: activityInfo?.lastActivity,
    activityState
  };
};

export default useSessionActivityStatus;
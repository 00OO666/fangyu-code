/**
 * useEventCleanup - Unified Tauri Event Listener Management Hook
 *
 * This hook provides a centralized way to manage Tauri window event listeners,
 * ensuring proper cleanup when components unmount to prevent memory leaks.
 *
 * @example
 * ```tsx
 * const { registerListener, getListenerCount } = useEventCleanup();
 *
 * useEffect(() => {
 *   registerListener('focus', handleFocus);
 *   registerListener('blur', handleBlur);
 *   // Cleanup is automatic on unmount
 * }, []);
 * ```
 */

import { logger } from "@/lib/logger";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn, type Event } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";

export interface EventCleanupResult {
  /**
   * Register a Tauri window event listener
   * @param event - Event name to listen for
   * @param handler - Event handler function
   * @returns Promise that resolves when listener is registered
   */
  registerWindowListener: <T>(event: string, handler: (event: Event<T>) => void) => Promise<void>;

  /**
   * Register a global Tauri event listener
   * @param event - Event name to listen for
   * @param handler - Event handler function
   * @returns Promise that resolves when listener is registered
   */
  registerGlobalListener: <T>(event: string, handler: (event: Event<T>) => void) => Promise<void>;

  /**
   * Manually cleanup all registered listeners
   * (Usually not needed as cleanup happens automatically on unmount)
   */
  cleanup: () => void;

  /**
   * Get the current number of registered listeners
   */
  getListenerCount: () => number;

  /**
   * Check if a specific event has a registered listener
   */
  hasListener: (event: string) => boolean;
}

/**
 * Hook for managing Tauri event listeners with automatic cleanup
 *
 * Features:
 * - Automatic cleanup on component unmount
 * - Support for both window-specific and global events
 * - Prevents duplicate listener registration
 * - Provides listener count for debugging
 */
export function useEventCleanup(): EventCleanupResult {
  // Store unlisten functions with their event names for tracking
  const unlistenFunctionsRef = useRef<Map<string, UnlistenFn>>(new Map());
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  /**
   * Register a window-specific event listener
   */
  const registerWindowListener = useCallback(
    async <T>(event: string, handler: (event: Event<T>) => void): Promise<void> => {
      // Skip if already registered or component unmounted
      if (unlistenFunctionsRef.current.has(`window:${event}`) || !isMountedRef.current) {
        return;
      }

      try {
        const window = getCurrentWindow();
        const unlisten = await window.listen<T>(event, handler);

        // Double-check mount status after async operation
        if (isMountedRef.current) {
          unlistenFunctionsRef.current.set(`window:${event}`, unlisten);
        } else {
          // Component unmounted during registration, cleanup immediately
          unlisten();
        }
      } catch (error) {
        logger.error(
          "useEventCleanup",
          `[useEventCleanup] Failed to register window listener for "${event}":`,
          error
        );
      }
    },
    []
  );

  /**
   * Register a global event listener
   */
  const registerGlobalListener = useCallback(
    async <T>(event: string, handler: (event: Event<T>) => void): Promise<void> => {
      // Skip if already registered or component unmounted
      if (unlistenFunctionsRef.current.has(`global:${event}`) || !isMountedRef.current) {
        return;
      }

      try {
        const unlisten = await listen<T>(event, handler);

        // Double-check mount status after async operation
        if (isMountedRef.current) {
          unlistenFunctionsRef.current.set(`global:${event}`, unlisten);
        } else {
          // Component unmounted during registration, cleanup immediately
          unlisten();
        }
      } catch (error) {
        logger.error(
          "useEventCleanup",
          `[useEventCleanup] Failed to register global listener for "${event}":`,
          error
        );
      }
    },
    []
  );

  /**
   * Cleanup all registered listeners
   */
  const cleanup = useCallback(() => {
    const listenerCount = unlistenFunctionsRef.current.size;
    if (listenerCount > 0) {
      logger.debug(
        "useEventCleanup",
        `[useEventCleanup] Cleaning up ${listenerCount} listener(s);`
      );
    }

    for (const [eventKey, unlisten] of unlistenFunctionsRef.current) {
      try {
        unlisten();
      } catch (error) {
        logger.error(
          "useEventCleanup",
          `[useEventCleanup] Failed to cleanup listener "${eventKey}":`,
          error
        );
      }
    }

    unlistenFunctionsRef.current.clear();
  }, []);

  /**
   * Get current listener count
   */
  const getListenerCount = useCallback(() => {
    return unlistenFunctionsRef.current.size;
  }, []);

  /**
   * Check if a specific event has a registered listener
   */
  const hasListener = useCallback((event: string) => {
    return (
      unlistenFunctionsRef.current.has(`window:${event}`) ||
      unlistenFunctionsRef.current.has(`global:${event}`)
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    registerWindowListener,
    registerGlobalListener,
    cleanup,
    getListenerCount,
    hasListener,
  };
}

export default useEventCleanup;

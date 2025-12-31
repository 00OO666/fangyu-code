import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

interface CachedSessionOutput {
  output: string;
  messages: ClaudeStreamMessage[];
  lastUpdated: number;
  status: string;
}

interface OutputCacheContextType {
  getCachedOutput: (sessionId: number) => CachedSessionOutput | null;
  setCachedOutput: (sessionId: number, data: CachedSessionOutput) => void;
  updateSessionStatus: (sessionId: number, status: string) => void;
  clearCache: (sessionId?: number) => void;
  isPolling: boolean;
  startBackgroundPolling: () => void;
  stopBackgroundPolling: () => void;
}

const OutputCacheContext = createContext<OutputCacheContextType | null>(null);

export function useOutputCache() {
  const context = useContext(OutputCacheContext);
  if (!context) {
    throw new Error('useOutputCache must be used within an OutputCacheProvider');
  }
  return context;
}

interface OutputCacheProviderProps {
  children: React.ReactNode;
}

export function OutputCacheProvider({ children }: OutputCacheProviderProps) {
  const [cache, setCache] = useState<Map<number, CachedSessionOutput>>(new Map());
  const isPolling = false; // Polling disabled

  const getCachedOutput = useCallback((sessionId: number): CachedSessionOutput | null => {
    return cache.get(sessionId) || null;
  }, [cache]);

  const setCachedOutput = useCallback((sessionId: number, data: CachedSessionOutput) => {
    setCache(prev => new Map(prev.set(sessionId, data)));
  }, []);

  const updateSessionStatus = useCallback((sessionId: number, status: string) => {
    setCache(prev => {
      const existing = prev.get(sessionId);
      if (existing) {
        const updated = new Map(prev);
        updated.set(sessionId, { ...existing, status });
        return updated;
      }
      return prev;
    });
  }, []);

  const clearCache = useCallback((sessionId?: number) => {
    if (sessionId) {
      setCache(prev => {
        const updated = new Map(prev);
        updated.delete(sessionId);
        return updated;
      });
    } else {
      setCache(new Map());
    }
  }, []);

  

  // Removed agent session polling - no longer supported
  const startBackgroundPolling = useCallback(() => {
    // No-op: polling disabled
  }, []);

  const stopBackgroundPolling = useCallback(() => {
    // No-op: polling disabled
  }, []);

  const value: OutputCacheContextType = {
    getCachedOutput,
    setCachedOutput,
    updateSessionStatus,
    clearCache,
    isPolling,
    startBackgroundPolling,
    stopBackgroundPolling,
  };

  return (
    <OutputCacheContext.Provider value={value}>
      {children}
    </OutputCacheContext.Provider>
  );
}
/**
 * Profiler
 * 性能分析器
 */

export interface ProfileResult {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  memory?: {
    used: number;
    total: number;
  };
}

export interface ProfileSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  results: ProfileResult[];
}

export class Profiler {
  private sessions: Map<string, ProfileSession> = new Map();
  private activeSession: string | null = null;
  private timers: Map<string, number> = new Map();

  startSession(name: string): string {
    const id = `session-${Date.now()}-${Math.random()}`;
    const session: ProfileSession = {
      id,
      name,
      startTime: Date.now(),
      results: [],
    };
    this.sessions.set(id, session);
    this.activeSession = id;
    return id;
  }

  endSession(sessionId?: string): ProfileSession | null {
    const id = sessionId || this.activeSession;
    if (!id) return null;

    const session = this.sessions.get(id);
    if (!session) return null;

    session.endTime = Date.now();
    if (this.activeSession === id) {
      this.activeSession = null;
    }
    return session;
  }

  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  endTimer(name: string): ProfileResult | null {
    const startTime = this.timers.get(name);
    if (!startTime) return null;

    const endTime = Date.now();
    const result: ProfileResult = {
      name,
      duration: endTime - startTime,
      startTime,
      endTime,
    };

    this.timers.delete(name);

    if (this.activeSession) {
      const session = this.sessions.get(this.activeSession);
      if (session) {
        session.results.push(result);
      }
    }

    return result;
  }

  getSession(sessionId: string): ProfileSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ProfileSession[] {
    return Array.from(this.sessions.values());
  }

  clearSessions(): void {
    this.sessions.clear();
    this.activeSession = null;
    this.timers.clear();
  }

  getMemoryUsage(): { used: number; total: number } {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
      };
    }
    return { used: 0, total: 0 };
  }

  async profileFunction<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    this.startTimer(name);
    try {
      const result = await fn();
      return result;
    } finally {
      this.endTimer(name);
    }
  }
}

export default Profiler;

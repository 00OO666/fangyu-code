/**
 * useGlobalTaskState - 全局任务状态管理 Hook
 *
 * 解决问题：
 * - 多会话之间的任务状态同步
 * - 切换标签页后仍能看到其他会话的任务进度
 * - 后台任务完成时通知所有会话
 *
 * 使用方式：
 * 1. 在 App.tsx 中添加 <GlobalTaskStateProvider>
 * 2. 在需要的组件中使用 useGlobalTaskState()
 *
 * @module useGlobalTaskState
 */

import { createContext, useContext, useCallback, useRef, useSyncExternalStore, ReactNode } from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

export type TaskStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskInfo {
  /** 任务唯一标识（通常是 sessionId） */
  taskId: string;
  /** 标签页 ID */
  tabId: string;
  /** 会话 ID */
  sessionId: string;
  /** 项目路径 */
  projectPath: string;
  /** 执行引擎 */
  engine: 'claude' | 'codex' | 'gemini';
  /** 任务状态 */
  status: TaskStatus;
  /** 进度百分比 (0-100) */
  progress?: number;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 最后更新时间 */
  updatedAt: number;
}

export interface GlobalTaskState {
  /** 所有任务（按 taskId 索引） */
  tasks: Map<string, TaskInfo>;
  /** 活跃任务数量 */
  activeCount: number;
}

export interface GlobalTaskActions {
  /** 注册新任务 */
  registerTask: (info: Omit<TaskInfo, 'updatedAt'>) => void;
  /** 更新任务状态 */
  updateTaskStatus: (taskId: string, status: TaskStatus, error?: string) => void;
  /** 更新任务进度 */
  updateTaskProgress: (taskId: string, progress: number) => void;
  /** 移除任务 */
  removeTask: (taskId: string) => void;
  /** 获取任务信息 */
  getTask: (taskId: string) => TaskInfo | undefined;
  /** 获取标签页的任务 */
  getTaskByTabId: (tabId: string) => TaskInfo | undefined;
  /** 获取会话的任务 */
  getTaskBySessionId: (sessionId: string) => TaskInfo | undefined;
  /** 获取所有活跃任务 */
  getActiveTasks: () => TaskInfo[];
  /** 订阅任务状态变化 */
  subscribeToTask: (taskId: string, callback: (task: TaskInfo | undefined) => void) => () => void;
  /** 清空所有任务 */
  clearAllTasks: () => void;
}

// ============================================================================
// Store Implementation (Zustand-like pattern without Zustand)
// ============================================================================

type Listener = () => void;

class GlobalTaskStore {
  private state: GlobalTaskState = {
    tasks: new Map(),
    activeCount: 0,
  };

  private listeners: Set<Listener> = new Set();
  private taskListeners: Map<string, Set<(task: TaskInfo | undefined) => void>> = new Map();

  getSnapshot = (): GlobalTaskState => {
    return this.state;
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify = () => {
    this.listeners.forEach(listener => listener());
  };

  private notifyTaskListeners = (taskId: string, task: TaskInfo | undefined) => {
    const listeners = this.taskListeners.get(taskId);
    if (listeners) {
      listeners.forEach(callback => callback(task));
    }
  };

  private updateActiveCount = () => {
    let count = 0;
    this.state.tasks.forEach(task => {
      if (task.status === 'running' || task.status === 'pending') {
        count++;
      }
    });
    this.state.activeCount = count;
  };

  registerTask = (info: Omit<TaskInfo, 'updatedAt'>) => {
    const task: TaskInfo = {
      ...info,
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      tasks: new Map(this.state.tasks).set(info.taskId, task),
    };

    this.updateActiveCount();
    this.notify();
    this.notifyTaskListeners(info.taskId, task);

    console.debug('[GlobalTaskState] Task registered:', info.taskId, info.status);
  };

  updateTaskStatus = (taskId: string, status: TaskStatus, error?: string) => {
    const existing = this.state.tasks.get(taskId);
    if (!existing) {
      console.warn('[GlobalTaskState] Task not found:', taskId);
      return;
    }

    const now = Date.now();
    const updated: TaskInfo = {
      ...existing,
      status,
      error,
      updatedAt: now,
      completedAt: (status === 'completed' || status === 'failed' || status === 'cancelled')
        ? now
        : existing.completedAt,
    };

    this.state = {
      ...this.state,
      tasks: new Map(this.state.tasks).set(taskId, updated),
    };

    this.updateActiveCount();
    this.notify();
    this.notifyTaskListeners(taskId, updated);

    console.debug('[GlobalTaskState] Task status updated:', taskId, status);
  };

  updateTaskProgress = (taskId: string, progress: number) => {
    const existing = this.state.tasks.get(taskId);
    if (!existing) return;

    const updated: TaskInfo = {
      ...existing,
      progress: Math.min(100, Math.max(0, progress)),
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      tasks: new Map(this.state.tasks).set(taskId, updated),
    };

    this.notify();
    this.notifyTaskListeners(taskId, updated);
  };

  removeTask = (taskId: string) => {
    const tasks = new Map(this.state.tasks);
    const removed = tasks.delete(taskId);

    if (removed) {
      this.state = { ...this.state, tasks };
      this.updateActiveCount();
      this.notify();
      this.notifyTaskListeners(taskId, undefined);

      console.debug('[GlobalTaskState] Task removed:', taskId);
    }
  };

  getTask = (taskId: string): TaskInfo | undefined => {
    return this.state.tasks.get(taskId);
  };

  getTaskByTabId = (tabId: string): TaskInfo | undefined => {
    for (const task of this.state.tasks.values()) {
      if (task.tabId === tabId) {
        return task;
      }
    }
    return undefined;
  };

  getTaskBySessionId = (sessionId: string): TaskInfo | undefined => {
    for (const task of this.state.tasks.values()) {
      if (task.sessionId === sessionId) {
        return task;
      }
    }
    return undefined;
  };

  getActiveTasks = (): TaskInfo[] => {
    const active: TaskInfo[] = [];
    this.state.tasks.forEach(task => {
      if (task.status === 'running' || task.status === 'pending') {
        active.push(task);
      }
    });
    return active;
  };

  subscribeToTask = (taskId: string, callback: (task: TaskInfo | undefined) => void): (() => void) => {
    if (!this.taskListeners.has(taskId)) {
      this.taskListeners.set(taskId, new Set());
    }
    this.taskListeners.get(taskId)!.add(callback);

    return () => {
      const listeners = this.taskListeners.get(taskId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.taskListeners.delete(taskId);
        }
      }
    };
  };

  clearAllTasks = () => {
    const taskIds = Array.from(this.state.tasks.keys());

    this.state = {
      tasks: new Map(),
      activeCount: 0,
    };

    this.notify();
    taskIds.forEach(id => this.notifyTaskListeners(id, undefined));

    console.debug('[GlobalTaskState] All tasks cleared');
  };
}

// Global singleton store
const globalTaskStore = new GlobalTaskStore();

// ============================================================================
// Context and Provider
// ============================================================================

interface GlobalTaskContextValue {
  state: GlobalTaskState;
  actions: GlobalTaskActions;
}

const GlobalTaskContext = createContext<GlobalTaskContextValue | null>(null);

export interface GlobalTaskStateProviderProps {
  children: ReactNode;
}

/**
 * GlobalTaskStateProvider - 全局任务状态提供者
 *
 * 在 App.tsx 中包裹整个应用：
 * ```tsx
 * <GlobalTaskStateProvider>
 *   <App />
 * </GlobalTaskStateProvider>
 * ```
 */
export const GlobalTaskStateProvider: React.FC<GlobalTaskStateProviderProps> = ({ children }) => {
  // Use useSyncExternalStore for efficient re-rendering
  const state = useSyncExternalStore(
    globalTaskStore.subscribe,
    globalTaskStore.getSnapshot,
    globalTaskStore.getSnapshot // SSR fallback (same as client)
  );

  const actions: GlobalTaskActions = {
    registerTask: globalTaskStore.registerTask,
    updateTaskStatus: globalTaskStore.updateTaskStatus,
    updateTaskProgress: globalTaskStore.updateTaskProgress,
    removeTask: globalTaskStore.removeTask,
    getTask: globalTaskStore.getTask,
    getTaskByTabId: globalTaskStore.getTaskByTabId,
    getTaskBySessionId: globalTaskStore.getTaskBySessionId,
    getActiveTasks: globalTaskStore.getActiveTasks,
    subscribeToTask: globalTaskStore.subscribeToTask,
    clearAllTasks: globalTaskStore.clearAllTasks,
  };

  return (
    <GlobalTaskContext.Provider value={{ state, actions }}>
      {children}
    </GlobalTaskContext.Provider>
  );
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * useGlobalTaskState - 获取全局任务状态和操作方法
 *
 * @example
 * ```tsx
 * const { state, actions } = useGlobalTaskState();
 *
 * // 注册任务
 * actions.registerTask({
 *   taskId: 'session-123',
 *   tabId: 'tab-1',
 *   sessionId: 'session-123',
 *   projectPath: '/path/to/project',
 *   engine: 'claude',
 *   status: 'running',
 * });
 *
 * // 更新状态
 * actions.updateTaskStatus('session-123', 'completed');
 *
 * // 读取活跃任务
 * const activeTasks = actions.getActiveTasks();
 * console.log('Active tasks:', state.activeCount);
 * ```
 */
export const useGlobalTaskState = (): GlobalTaskContextValue => {
  const context = useContext(GlobalTaskContext);
  if (!context) {
    throw new Error('useGlobalTaskState must be used within a GlobalTaskStateProvider');
  }
  return context;
};

/**
 * useTaskStatus - 获取特定任务的状态
 *
 * @param taskId 任务 ID
 * @returns 任务信息或 undefined
 *
 * @example
 * ```tsx
 * const task = useTaskStatus('session-123');
 * if (task?.status === 'running') {
 *   console.log('Task is running, progress:', task.progress);
 * }
 * ```
 */
export const useTaskStatus = (taskId: string): TaskInfo | undefined => {
  const { state } = useGlobalTaskState();
  return state.tasks.get(taskId);
};

/**
 * useActiveTaskCount - 获取当前活跃任务数量
 *
 * @returns 活跃任务数量
 */
export const useActiveTaskCount = (): number => {
  const { state } = useGlobalTaskState();
  return state.activeCount;
};

/**
 * useTasksByEngine - 获取特定引擎的所有任务
 *
 * @param engine 执行引擎类型
 * @returns 该引擎的所有任务
 */
export const useTasksByEngine = (engine: 'claude' | 'codex' | 'gemini'): TaskInfo[] => {
  const { state } = useGlobalTaskState();
  const tasks: TaskInfo[] = [];
  state.tasks.forEach(task => {
    if (task.engine === engine) {
      tasks.push(task);
    }
  });
  return tasks;
};

// ============================================================================
// Direct Store Access (for non-React code)
// ============================================================================

/**
 * 直接访问 store（用于非 React 代码）
 *
 * @example
 * ```ts
 * import { globalTaskActions } from './useGlobalTaskState';
 *
 * // 在事件处理器中更新状态
 * globalTaskActions.updateTaskStatus('session-123', 'completed');
 * ```
 */
export const globalTaskActions: GlobalTaskActions = {
  registerTask: globalTaskStore.registerTask,
  updateTaskStatus: globalTaskStore.updateTaskStatus,
  updateTaskProgress: globalTaskStore.updateTaskProgress,
  removeTask: globalTaskStore.removeTask,
  getTask: globalTaskStore.getTask,
  getTaskByTabId: globalTaskStore.getTaskByTabId,
  getTaskBySessionId: globalTaskStore.getTaskBySessionId,
  getActiveTasks: globalTaskStore.getActiveTasks,
  subscribeToTask: globalTaskStore.subscribeToTask,
  clearAllTasks: globalTaskStore.clearAllTasks,
};

export default useGlobalTaskState;

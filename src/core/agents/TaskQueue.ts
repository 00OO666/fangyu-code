/**
 * Task Queue
 *
 * Priority-based task queue with dependency resolution and scheduling.
 */

import type { Task, TaskStatus } from "../types/unified-agent";

// ============================================================================
// Types
// ============================================================================

export interface QueuedTask {
  task: Task;
  enqueuedAt: number;
  attempts: number;
}

export interface TaskQueueConfig {
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
}

export type TaskComparator = (a: QueuedTask, b: QueuedTask) => number;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: TaskQueueConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  maxQueueSize: 1000,
};

// ============================================================================
// Priority Comparators
// ============================================================================

/**
 * Compare by priority (higher priority first)
 */
export const priorityComparator: TaskComparator = (a, b) => {
  return b.task.priority - a.task.priority;
};

/**
 * Compare by enqueue time (FIFO within same priority)
 */
export const fifoComparator: TaskComparator = (a, b) => {
  if (a.task.priority !== b.task.priority) {
    return b.task.priority - a.task.priority;
  }
  return a.enqueuedAt - b.enqueuedAt;
};

/**
 * Compare by deadline (if available)
 */
export const deadlineComparator: TaskComparator = (a, b) => {
  const deadlineA = (a.task.metadata?.deadline as number) || Infinity;
  const deadlineB = (b.task.metadata?.deadline as number) || Infinity;

  if (deadlineA !== deadlineB) {
    return deadlineA - deadlineB;
  }
  return b.task.priority - a.task.priority;
};

// ============================================================================
// Task Queue
// ============================================================================

export class TaskQueue {
  private queue: QueuedTask[] = [];
  private inProgress: Map<string, QueuedTask> = new Map(); // Track dequeued tasks
  private completedTasks: Map<string, Task> = new Map();
  private failedTasks: Map<string, { task: Task; error: string }> = new Map();
  private config: TaskQueueConfig;
  private comparator: TaskComparator;
  private listeners: Set<(event: QueueEvent) => void> = new Set();

  constructor(config?: Partial<TaskQueueConfig>, comparator: TaskComparator = fifoComparator) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.comparator = comparator;
  }

  // ==========================================================================
  // Queue Operations
  // ==========================================================================

  /**
   * Enqueue a task
   */
  enqueue(task: Task): boolean {
    if (this.queue.length >= this.config.maxQueueSize) {
      this.emit({ type: "queue_full", task });
      return false;
    }

    // Check if task already exists
    if (this.queue.some((q) => q.task.id === task.id)) {
      return false;
    }

    const queuedTask: QueuedTask = {
      task: { ...task, status: "queued" },
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    this.queue.push(queuedTask);
    this.sort();

    this.emit({ type: "enqueued", task: queuedTask.task });
    return true;
  }

  /**
   * Dequeue the highest priority task
   */
  dequeue(): Task | undefined {
    // Find first task with satisfied dependencies
    for (let i = 0; i < this.queue.length; i++) {
      const queuedTask = this.queue[i];
      if (this.areDependenciesSatisfied(queuedTask.task)) {
        this.queue.splice(i, 1);
        queuedTask.task.status = "in_progress";
        queuedTask.attempts++;

        // Track in progress
        this.inProgress.set(queuedTask.task.id, queuedTask);

        this.emit({ type: "dequeued", task: queuedTask.task });
        return queuedTask.task;
      }
    }

    return undefined;
  }

  /**
   * Peek at the next task without removing it
   */
  peek(): Task | undefined {
    for (const queuedTask of this.queue) {
      if (this.areDependenciesSatisfied(queuedTask.task)) {
        return queuedTask.task;
      }
    }
    return undefined;
  }

  /**
   * Check if dependencies are satisfied
   */
  private areDependenciesSatisfied(task: Task): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every((depId: string) => {
      const completed = this.completedTasks.get(depId);
      return completed && completed.status === "completed";
    });
  }

  /**
   * Sort the queue by priority
   */
  private sort(): void {
    this.queue.sort(this.comparator);
  }

  // ==========================================================================
  // Task Completion
  // ==========================================================================

  /**
   * Mark a task as completed
   */
  markCompleted(taskId: string, result?: unknown): void {
    // Check in progress first
    const inProgressTask = this.inProgress.get(taskId);
    if (inProgressTask) {
      inProgressTask.task.status = "completed";
      inProgressTask.task.completedAt = Date.now();
      if (result !== undefined) {
        inProgressTask.task.result = result as Task["result"];
      }
      this.completedTasks.set(taskId, inProgressTask.task);
      this.inProgress.delete(taskId);
      this.emit({ type: "completed", task: inProgressTask.task });
      return;
    }

    // Fallback to queue search
    const task = this.findTask(taskId);
    if (task) {
      task.status = "completed";
      task.completedAt = Date.now();
      if (result !== undefined) {
        task.result = result as Task["result"];
      }
      this.completedTasks.set(taskId, task);
      this.emit({ type: "completed", task });
    }
  }

  /**
   * Mark a task as failed
   */
  markFailed(taskId: string, error: string): void {
    // Check in progress first
    const inProgressTask = this.inProgress.get(taskId);

    if (inProgressTask) {
      if (inProgressTask.attempts < this.config.maxRetries) {
        // Retry - put back in queue
        inProgressTask.task.status = "queued";
        this.queue.push(inProgressTask);
        this.inProgress.delete(taskId);
        this.sort();
        this.emit({ type: "retry", task: inProgressTask.task, attempt: inProgressTask.attempts });
      } else {
        // Max retries exceeded
        inProgressTask.task.status = "failed";
        this.failedTasks.set(taskId, { task: inProgressTask.task, error });
        this.inProgress.delete(taskId);
        this.emit({ type: "failed", task: inProgressTask.task, error });
      }
      return;
    }

    // Fallback to queue search (for tasks not yet dequeued)
    const queuedTask = this.queue.find((q) => q.task.id === taskId);

    if (queuedTask) {
      if (queuedTask.attempts < this.config.maxRetries) {
        // Retry
        queuedTask.task.status = "queued";
        this.sort();
        this.emit({ type: "retry", task: queuedTask.task, attempt: queuedTask.attempts });
      } else {
        // Max retries exceeded
        this.queue = this.queue.filter((q) => q.task.id !== taskId);
        queuedTask.task.status = "failed";
        this.failedTasks.set(taskId, { task: queuedTask.task, error });
        this.emit({ type: "failed", task: queuedTask.task, error });
      }
    }
  }

  /**
   * Find a task by ID
   */
  private findTask(taskId: string): Task | undefined {
    const queued = this.queue.find((q) => q.task.id === taskId);
    if (queued) return queued.task;

    return this.completedTasks.get(taskId);
  }

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  /**
   * Remove a task from the queue
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex((q) => q.task.id === taskId);
    if (index >= 0) {
      const removed = this.queue.splice(index, 1)[0];
      this.emit({ type: "removed", task: removed.task });
      return true;
    }
    return false;
  }

  /**
   * Update task priority
   */
  updatePriority(taskId: string, priority: number): boolean {
    const queuedTask = this.queue.find((q) => q.task.id === taskId);
    if (queuedTask) {
      queuedTask.task.priority = priority;
      this.sort();
      this.emit({ type: "priority_changed", task: queuedTask.task });
      return true;
    }
    return false;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.emit({ type: "cleared" });
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    this.completedTasks.clear();
  }

  /**
   * Clear failed tasks
   */
  clearFailed(): void {
    this.failedTasks.clear();
  }

  // ==========================================================================
  // Queue Status
  // ==========================================================================

  /**
   * Get queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   */
  get isFull(): boolean {
    return this.queue.length >= this.config.maxQueueSize;
  }

  /**
   * Get all queued tasks
   */
  getAll(): Task[] {
    return this.queue.map((q) => q.task);
  }

  /**
   * Get tasks by status
   */
  getByStatus(status: TaskStatus): Task[] {
    return this.queue.filter((q) => q.task.status === status).map((q) => q.task);
  }

  /**
   * Get tasks by priority range
   */
  getByPriorityRange(min: number, max: number): Task[] {
    return this.queue
      .filter((q) => q.task.priority >= min && q.task.priority <= max)
      .map((q) => q.task);
  }

  /**
   * Get completed tasks
   */
  getCompleted(): Task[] {
    return Array.from(this.completedTasks.values());
  }

  /**
   * Get failed tasks
   */
  getFailed(): Array<{ task: Task; error: string }> {
    return Array.from(this.failedTasks.values());
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const priorities = this.queue.map((q) => q.task.priority);
    return {
      total: this.queue.length,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      averagePriority:
        priorities.length > 0 ? priorities.reduce((a, b) => a + b, 0) / priorities.length : 0,
      highestPriority: priorities.length > 0 ? Math.max(...priorities) : 0,
      lowestPriority: priorities.length > 0 ? Math.min(...priorities) : 0,
      blockedByDependencies: this.queue.filter((q) => !this.areDependenciesSatisfied(q.task))
        .length,
    };
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Subscribe to queue events
   */
  on(callback: (event: QueueEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit an event
   */
  private emit(event: QueueEvent): void {
    this.listeners.forEach((callback) => callback(event));
  }
}

// ============================================================================
// Types
// ============================================================================

export interface QueueStats {
  total: number;
  completed: number;
  failed: number;
  averagePriority: number;
  highestPriority: number;
  lowestPriority: number;
  blockedByDependencies: number;
}

export type QueueEvent =
  | { type: "enqueued"; task: Task }
  | { type: "dequeued"; task: Task }
  | { type: "completed"; task: Task }
  | { type: "failed"; task: Task; error: string }
  | { type: "retry"; task: Task; attempt: number }
  | { type: "removed"; task: Task }
  | { type: "priority_changed"; task: Task }
  | { type: "queue_full"; task: Task }
  | { type: "cleared" };

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a priority queue
 */
export function createPriorityQueue(config?: Partial<TaskQueueConfig>): TaskQueue {
  return new TaskQueue(config, priorityComparator);
}

/**
 * Create a FIFO queue with priority
 */
export function createFifoQueue(config?: Partial<TaskQueueConfig>): TaskQueue {
  return new TaskQueue(config, fifoComparator);
}

/**
 * Create a deadline-based queue
 */
export function createDeadlineQueue(config?: Partial<TaskQueueConfig>): TaskQueue {
  return new TaskQueue(config, deadlineComparator);
}

/**
 * Background Agent Manager
 * 
 * Manages background agent execution with concurrency control,
 * task queuing, and status tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentRoleType,
  BackgroundTaskStatus,
  TaskStatus,
  ConcurrencyConfig,
  ModelProvider,
} from '../types/unified-agent';
import { getAgentRole } from './AgentRoles';

// ============================================================================
// Types
// ============================================================================

export interface BackgroundTask {
  id: string;
  roleType: AgentRoleType;
  prompt: string;
  status: TaskStatus;
  progress: number;
  startedAt: number;
  completedAt?: number;
  output: string[];
  error?: string;
  provider: ModelProvider;
  model: string;
}

export interface BackgroundExecutor {
  (roleType: AgentRoleType, prompt: string): Promise<string>;
}

interface QueuedTask {
  task: BackgroundTask;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONCURRENCY: ConcurrencyConfig = {
  defaultConcurrency: 5,
  providerConcurrency: {
    anthropic: 3,
    openai: 5,
    google: 10,
    xai: 5,
  },
  modelConcurrency: {
    'claude-opus-4-5-20250514': 2,
    'o3': 2,
  },
};

// ============================================================================
// Background Agent Manager
// ============================================================================

export class BackgroundAgentManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private queue: QueuedTask[] = [];
  private runningByProvider: Map<ModelProvider, number> = new Map();
  private runningByModel: Map<string, number> = new Map();
  private concurrencyConfig: ConcurrencyConfig;
  private executor?: BackgroundExecutor;
  private listeners: Map<string, Set<(status: BackgroundTaskStatus) => void>> = new Map();

  constructor(config?: Partial<ConcurrencyConfig>) {
    this.concurrencyConfig = {
      ...DEFAULT_CONCURRENCY,
      ...config,
    };

    // Initialize counters
    for (const provider of ['anthropic', 'openai', 'google', 'xai'] as ModelProvider[]) {
      this.runningByProvider.set(provider, 0);
    }
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Set the background task executor
   */
  setExecutor(executor: BackgroundExecutor): void {
    this.executor = executor;
  }

  /**
   * Update concurrency configuration
   */
  setConcurrencyConfig(config: Partial<ConcurrencyConfig>): void {
    this.concurrencyConfig = {
      ...this.concurrencyConfig,
      ...config,
    };
  }

  /**
   * Get current concurrency configuration
   */
  getConcurrencyConfig(): ConcurrencyConfig {
    return { ...this.concurrencyConfig };
  }

  // ==========================================================================
  // Task Spawning
  // ==========================================================================

  /**
   * Spawn a background task
   */
  async spawnBackground(roleType: AgentRoleType, prompt: string): Promise<string> {
    const role = getAgentRole(roleType);
    const provider = role.model.provider;
    const model = role.model.model;

    const task: BackgroundTask = {
      id: uuidv4(),
      roleType,
      prompt,
      status: 'pending',
      progress: 0,
      startedAt: Date.now(),
      output: [],
      provider,
      model,
    };

    this.tasks.set(task.id, task);

    // Check if we can run immediately
    if (this.canRunTask(provider, model)) {
      // Reserve capacity SYNCHRONOUSLY before starting async execution
      this.runningByProvider.set(
        provider,
        (this.runningByProvider.get(provider) || 0) + 1
      );
      this.runningByModel.set(
        model,
        (this.runningByModel.get(model) || 0) + 1
      );
      
      // Start task asynchronously
      this.executeTask(task);
      return task.id;
    } else {
      // Queue the task - return a promise that resolves when task starts
      task.status = 'queued';
      this.notifyListeners(task.id);
      
      return new Promise((resolve, reject) => {
        this.queue.push({ task, resolve, reject });
      });
    }
  }

  /**
   * Check if a task can run based on concurrency limits
   */
  private canRunTask(provider: ModelProvider, model: string): boolean {
    // Check total limit first
    const totalRunning = Array.from(this.runningByProvider.values()).reduce((a, b) => a + b, 0);
    if (totalRunning >= this.concurrencyConfig.defaultConcurrency) {
      return false;
    }

    // Check provider limit
    const providerCount = this.runningByProvider.get(provider) || 0;
    const providerLimit = this.concurrencyConfig.providerConcurrency[provider];
    if (providerCount >= providerLimit) {
      return false;
    }

    // Check model limit
    const modelLimit = this.concurrencyConfig.modelConcurrency[model];
    if (modelLimit) {
      const modelCount = this.runningByModel.get(model) || 0;
      if (modelCount >= modelLimit) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a task (capacity already reserved)
   */
  private async executeTask(task: BackgroundTask): Promise<void> {
    // Update status
    task.status = 'in_progress';
    task.progress = 10;
    this.notifyListeners(task.id);

    try {
      if (!this.executor) {
        throw new Error('No executor configured');
      }

      // Execute the task
      const result = await this.executor(task.roleType, task.prompt);

      // Update task
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = Date.now();
      task.output.push(result);
    } catch (error) {
      task.status = 'failed';
      task.progress = 100;
      task.completedAt = Date.now();
      task.error = error instanceof Error ? error.message : String(error);
    } finally {
      // Release capacity
      this.runningByProvider.set(
        task.provider,
        Math.max(0, (this.runningByProvider.get(task.provider) || 1) - 1)
      );
      this.runningByModel.set(
        task.model,
        Math.max(0, (this.runningByModel.get(task.model) || 1) - 1)
      );

      this.notifyListeners(task.id);

      // Process queue
      this.processQueue();
    }
  }

  /**
   * Start executing a task (reserves capacity and executes)
   */
  private async startTask(task: BackgroundTask): Promise<void> {
    // Reserve capacity
    this.runningByProvider.set(
      task.provider,
      (this.runningByProvider.get(task.provider) || 0) + 1
    );
    this.runningByModel.set(
      task.model,
      (this.runningByModel.get(task.model) || 0) + 1
    );

    await this.executeTask(task);
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    // Process one task at a time to avoid race conditions
    while (this.queue.length > 0) {
      // Find first task that can run
      let foundIndex = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];
        if (this.canRunTask(item.task.provider, item.task.model)) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex === -1) {
        break; // No tasks can run
      }

      const item = this.queue[foundIndex];
      this.queue.splice(foundIndex, 1);

      // Reserve capacity SYNCHRONOUSLY
      this.runningByProvider.set(
        item.task.provider,
        (this.runningByProvider.get(item.task.provider) || 0) + 1
      );
      this.runningByModel.set(
        item.task.model,
        (this.runningByModel.get(item.task.model) || 0) + 1
      );

      // Execute task asynchronously
      this.executeTask(item.task)
        .then(() => item.resolve(item.task.id))
        .catch(item.reject);
    }
  }

  // ==========================================================================
  // Task Status
  // ==========================================================================

  /**
   * Get background task status
   */
  getBackgroundStatus(taskId: string): BackgroundTaskStatus | undefined {
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    return {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      startedAt: task.startedAt,
      estimatedCompletion: this.estimateCompletion(task),
      output: task.output.length > 0 ? task.output : undefined,
    };
  }

  /**
   * Estimate task completion time
   */
  private estimateCompletion(task: BackgroundTask): number | undefined {
    if (task.status === 'completed' || task.status === 'failed') {
      return task.completedAt;
    }

    if (task.status === 'in_progress' && task.progress > 0) {
      const elapsed = Date.now() - task.startedAt;
      const estimatedTotal = (elapsed / task.progress) * 100;
      return task.startedAt + estimatedTotal;
    }

    return undefined;
  }

  /**
   * Get all background tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.status === 'in_progress');
  }

  /**
   * Get queued tasks
   */
  getQueuedTasks(): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.status === 'queued');
  }

  // ==========================================================================
  // Task Control
  // ==========================================================================

  /**
   * Cancel a background task
   */
  async cancelBackground(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw new Error(`Cannot cancel completed task: ${taskId}`);
    }

    // Remove from queue if queued
    const queueIndex = this.queue.findIndex((q) => q.task.id === taskId);
    if (queueIndex >= 0) {
      const item = this.queue[queueIndex];
      this.queue.splice(queueIndex, 1);
      item.reject(new Error('Task cancelled'));
    }

    // Update counters if was running (check before changing status)
    const wasInProgress = task.status === 'in_progress';

    // Update status
    task.status = 'cancelled';
    task.completedAt = Date.now();

    // Update counters if was running
    if (wasInProgress) {
      this.runningByProvider.set(
        task.provider,
        Math.max(0, (this.runningByProvider.get(task.provider) || 1) - 1)
      );
      this.runningByModel.set(
        task.model,
        Math.max(0, (this.runningByModel.get(task.model) || 1) - 1)
      );
    }

    this.notifyListeners(taskId);
    this.processQueue();
  }

  /**
   * Update task progress
   */
  updateProgress(taskId: string, progress: number, output?: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'in_progress') {
      task.progress = Math.min(99, Math.max(0, progress));
      if (output) {
        task.output.push(output);
      }
      this.notifyListeners(taskId);
    }
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================

  /**
   * Subscribe to task status updates
   */
  onStatusChange(
    taskId: string,
    callback: (status: BackgroundTaskStatus) => void
  ): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, new Set());
    }
    this.listeners.get(taskId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(taskId)?.delete(callback);
    };
  }

  /**
   * Notify listeners of status change
   */
  private notifyListeners(taskId: string): void {
    const status = this.getBackgroundStatus(taskId);
    if (status) {
      this.listeners.get(taskId)?.forEach((callback) => callback(status));
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get concurrency statistics
   */
  getConcurrencyStats(): {
    totalRunning: number;
    byProvider: Record<ModelProvider, number>;
    byModel: Record<string, number>;
    queueLength: number;
  } {
    return {
      totalRunning: Array.from(this.runningByProvider.values()).reduce((a, b) => a + b, 0),
      byProvider: Object.fromEntries(this.runningByProvider) as Record<ModelProvider, number>,
      byModel: Object.fromEntries(this.runningByModel),
      queueLength: this.queue.length,
    };
  }

  /**
   * Check if at capacity
   */
  isAtCapacity(): boolean {
    const totalRunning = Array.from(this.runningByProvider.values()).reduce((a, b) => a + b, 0);
    return totalRunning >= this.concurrencyConfig.defaultConcurrency;
  }

  /**
   * Get available capacity
   */
  getAvailableCapacity(): number {
    const totalRunning = Array.from(this.runningByProvider.values()).reduce((a, b) => a + b, 0);
    return Math.max(0, this.concurrencyConfig.defaultConcurrency - totalRunning);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.tasks.delete(id);
        this.listeners.delete(id);
      }
    }
  }

  /**
   * Clear all tasks (for testing)
   */
  clearAll(): void {
    this.tasks.clear();
    this.queue.length = 0;
    this.listeners.clear();
    for (const provider of this.runningByProvider.keys()) {
      this.runningByProvider.set(provider, 0);
    }
    this.runningByModel.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: BackgroundAgentManager | null = null;

export function getBackgroundManager(): BackgroundAgentManager {
  if (!managerInstance) {
    managerInstance = new BackgroundAgentManager();
  }
  return managerInstance;
}

export function resetBackgroundManager(): void {
  managerInstance = null;
}

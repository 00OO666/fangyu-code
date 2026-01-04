/**
 * Task Delegation Service
 *
 * 功能:
 * - 后台窗口将任务委托给活跃窗口
 * - 活跃窗口接收并执行委托任务
 * - 任务完成后通知原窗口
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface DelegatedTask {
  taskId: string;
  sourceWindowId: string;
  targetWindowId?: string;
  taskType: string;
  taskData: any;
  priority: 'low' | 'normal' | 'high';
}

class TaskDelegationService {
  /**
   * 委托任务给活跃窗口
   */
  async delegateTask(task: Omit<DelegatedTask, 'targetWindowId'>): Promise<void> {
    try {
      await invoke('delegate_task_to_active_window', { task });
      console.log('[TaskDelegation] Task delegated:', task.taskId);
    } catch (error) {
      console.error('[TaskDelegation] Failed to delegate task:', error);
      throw error;
    }
  }

  /**
   * 监听委托任务
   */
  async listenForDelegatedTasks(
    callback: (task: DelegatedTask) => void
  ): Promise<() => void> {
    const unlisten = await listen<DelegatedTask>('task-delegated', (event) => {
      console.log('[TaskDelegation] Received delegated task:', event.payload);
      callback(event.payload);
    });

    return unlisten;
  }

  /**
   * 报告任务完成
   */
  async reportTaskCompletion(
    taskId: string,
    result: { success: boolean; data?: any; error?: string }
  ): Promise<void> {
    try {
      await invoke('report_delegated_task_completion', { taskId, result });
      console.log('[TaskDelegation] Task completion reported:', taskId);
    } catch (error) {
      console.error('[TaskDelegation] Failed to report completion:', error);
    }
  }
}

export const taskDelegationService = new TaskDelegationService();

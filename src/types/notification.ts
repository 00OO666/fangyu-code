/**
 * 操作通知系统类型定义
 */

export type NotificationType = 'success' | 'error' | 'info' | 'warning';
export type NotificationPosition = 'chat' | 'global';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  position: NotificationPosition;
  duration?: number; // 持续时间（毫秒），0 表示不自动关闭
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface NotificationOptions {
  type?: NotificationType;
  description?: string;
  position?: NotificationPosition;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * 常见操作的通知消息模板
 */
export const NotificationTemplates = {
  // 记忆系统
  memoryCreated: (projectName: string) => ({
    type: 'success' as const,
    message: `已创建项目记忆：${projectName}`,
    description: '记忆文件已保存到 ~/.claude/memory/',
    duration: 5000,
  }),
  memoryLoaded: (projectName: string) => ({
    type: 'info' as const,
    message: `已加载项目记忆：${projectName}`,
    duration: 3000,
  }),
  memoryUpdated: (projectName: string) => ({
    type: 'success' as const,
    message: `已更新项目记忆：${projectName}`,
    duration: 3000,
  }),

  // Hook 管理
  hookEnabled: (hookName: string) => ({
    type: 'success' as const,
    message: `已启用 Hook：${hookName}`,
    duration: 3000,
  }),
  hookDisabled: (hookName: string) => ({
    type: 'info' as const,
    message: `已禁用 Hook：${hookName}`,
    duration: 3000,
  }),

  // MCP 工具
  mcpEnabled: (toolName: string) => ({
    type: 'success' as const,
    message: `已启用 MCP 工具：${toolName}`,
    duration: 3000,
  }),
  mcpDisabled: (toolName: string) => ({
    type: 'info' as const,
    message: `已禁用 MCP 工具：${toolName}`,
    duration: 3000,
  }),

  // Skill 管理
  skillEnabled: (skillName: string) => ({
    type: 'success' as const,
    message: `已启用 Skill：${skillName}`,
    duration: 3000,
  }),
  skillDisabled: (skillName: string) => ({
    type: 'info' as const,
    message: `已禁用 Skill：${skillName}`,
    duration: 3000,
  }),

  // 设置更改
  settingsSaved: () => ({
    type: 'success' as const,
    message: '设置已保存',
    duration: 2000,
  }),
  settingsFailed: (error: string) => ({
    type: 'error' as const,
    message: '设置保存失败',
    description: error,
    duration: 5000,
  }),

  // 执行引擎
  engineSwitched: (engineName: string) => ({
    type: 'info' as const,
    message: `已切换执行引擎：${engineName}`,
    duration: 3000,
  }),

  // 模型切换
  modelChanged: (modelName: string) => ({
    type: 'info' as const,
    message: `已切换模型：${modelName}`,
    duration: 3000,
  }),

  // 会话操作
  sessionCreated: (sessionName: string) => ({
    type: 'success' as const,
    message: `已创建会话：${sessionName}`,
    duration: 3000,
  }),
  sessionDeleted: (sessionName: string) => ({
    type: 'info' as const,
    message: `已删除会话：${sessionName}`,
    duration: 3000,
  }),
  sessionRenamed: (oldName: string, newName: string) => ({
    type: 'success' as const,
    message: `会话已重命名：${oldName} → ${newName}`,
    duration: 3000,
  }),

  // 项目操作
  projectCreated: (projectName: string) => ({
    type: 'success' as const,
    message: `已创建项目：${projectName}`,
    duration: 3000,
  }),
  projectSwitched: (projectName: string) => ({
    type: 'info' as const,
    message: `已切换项目：${projectName}`,
    duration: 3000,
  }),

  // 通用操作
  operationSuccess: (operation: string) => ({
    type: 'success' as const,
    message: `${operation}成功`,
    duration: 3000,
  }),
  operationFailed: (operation: string, error?: string) => ({
    type: 'error' as const,
    message: `${operation}失败`,
    description: error,
    duration: 5000,
  }),
};

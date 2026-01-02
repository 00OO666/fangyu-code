/**
 * 操作通知系统类型定义
 */

export type NotificationType = "success" | "error" | "info" | "warning";
export type NotificationPosition = "chat" | "global" | "top-center";

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
    type: "success" as const,
    message: `已创建项目记忆：${projectName}`,
    description: "记忆文件已保存到 ~/.claude/memory/",
    duration: 5000,
  }),
  memoryLoaded: (projectName: string) => ({
    type: "info" as const,
    message: `已加载项目记忆：${projectName}`,
    duration: 3000,
  }),
  memoryUpdated: (projectName: string) => ({
    type: "success" as const,
    message: `已更新项目记忆：${projectName}`,
    duration: 3000,
  }),

  // Hook 管理
  hookEnabled: (hookName: string) => ({
    type: "success" as const,
    message: `已启用 Hook：${hookName}`,
    duration: 3000,
  }),
  hookDisabled: (hookName: string) => ({
    type: "info" as const,
    message: `已禁用 Hook：${hookName}`,
    duration: 3000,
  }),

  // MCP 工具
  mcpEnabled: (toolName: string) => ({
    type: "success" as const,
    message: `已启用 MCP 工具：${toolName}`,
    duration: 3000,
  }),
  mcpDisabled: (toolName: string) => ({
    type: "info" as const,
    message: `已禁用 MCP 工具：${toolName}`,
    duration: 3000,
  }),

  // Skill 管理
  skillEnabled: (skillName: string) => ({
    type: "success" as const,
    message: `已启用 Skill：${skillName}`,
    duration: 3000,
  }),
  skillDisabled: (skillName: string) => ({
    type: "info" as const,
    message: `已禁用 Skill：${skillName}`,
    duration: 3000,
  }),

  // 设置更改
  settingsSaved: () => ({
    type: "success" as const,
    message: "设置已保存",
    duration: 2000,
  }),
  settingsFailed: (error: string) => ({
    type: "error" as const,
    message: "设置保存失败",
    description: error,
    duration: 5000,
  }),

  // 执行引擎
  engineSwitched: (engineName: string) => ({
    type: "info" as const,
    message: `已切换执行引擎：${engineName}`,
    duration: 3000,
  }),

  // 模型切换
  modelChanged: (modelName: string) => ({
    type: "info" as const,
    message: `已切换模型：${modelName}`,
    duration: 3000,
  }),

  // 会话操作
  sessionCreated: (sessionName: string) => ({
    type: "success" as const,
    message: `已创建会话：${sessionName}`,
    duration: 3000,
  }),
  sessionDeleted: (sessionName: string) => ({
    type: "info" as const,
    message: `已删除会话：${sessionName}`,
    duration: 3000,
  }),
  sessionRenamed: (oldName: string, newName: string) => ({
    type: "success" as const,
    message: `会话已重命名：${oldName} → ${newName}`,
    duration: 3000,
  }),

  // 项目操作
  projectCreated: (projectName: string) => ({
    type: "success" as const,
    message: `已创建项目：${projectName}`,
    duration: 3000,
  }),
  projectSwitched: (projectName: string) => ({
    type: "info" as const,
    message: `已切换项目：${projectName}`,
    duration: 3000,
  }),

  // 通用操作
  operationSuccess: (operation: string) => ({
    type: "success" as const,
    message: `${operation}成功`,
    duration: 3000,
  }),
  operationFailed: (operation: string, error?: string) => ({
    type: "error" as const,
    message: `${operation}失败`,
    description: error,
    duration: 5000,
  }),

  // 🆕 Git 操作（后台自动触发）
  gitFormatting: () => ({
    type: "info" as const,
    message: "正在格式化代码...",
    description: "Biome 自动格式化",
    duration: 2000,
    position: "global" as const,
  }),
  gitFormatComplete: (filesCount: number, details?: string) => ({
    type: "success" as const,
    message: "代码格式化完成",
    description: `已格式化 ${filesCount} 个文件`,
    duration: 5000,
    position: "global" as const,
    action: details
      ? {
          label: "查看详情",
          onClick: () => {
            // 显示详情对话框
            const dialog = document.createElement("div");
            dialog.innerHTML = `
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100000;">
            <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px; max-height: 80vh; overflow: auto;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">格式化详情</h3>
              <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow: auto; font-size: 12px;">${details}</pre>
              <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
          </div>
        `;
            document.body.appendChild(dialog);
          },
        }
      : undefined,
  }),
  gitCommitStart: () => ({
    type: "info" as const,
    message: "正在提交代码...",
    duration: 2000,
    position: "global" as const,
  }),
  gitCommitComplete: (commitHash: string, message?: string) => ({
    type: "success" as const,
    message: "代码提交成功",
    description: `Commit: ${commitHash.slice(0, 7)}`,
    duration: 5000,
    position: "global" as const,
    action: {
      label: "查看详情",
      onClick: () => {
        const dialog = document.createElement("div");
        dialog.innerHTML = `
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100000;">
            <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">提交详情</h3>
              <p style="margin: 8px 0;"><strong>Commit Hash:</strong> ${commitHash}</p>
              ${message ? `<p style="margin: 8px 0;"><strong>提交信息:</strong> ${message}</p>` : ""}
              <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
          </div>
        `;
        document.body.appendChild(dialog);
      },
    },
  }),
  gitPushStart: () => ({
    type: "info" as const,
    message: "正在推送到远程仓库...",
    duration: 2000,
    position: "global" as const,
  }),
  gitPushComplete: (branch?: string, remote?: string) => ({
    type: "success" as const,
    message: "推送成功",
    duration: 5000,
    position: "global" as const,
    action:
      branch || remote
        ? {
            label: "查看详情",
            onClick: () => {
              const dialog = document.createElement("div");
              dialog.innerHTML = `
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100000;">
            <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">推送详情</h3>
              ${branch ? `<p style="margin: 8px 0;"><strong>分支:</strong> ${branch}</p>` : ""}
              ${remote ? `<p style="margin: 8px 0;"><strong>远程仓库:</strong> ${remote}</p>` : ""}
              <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
          </div>
        `;
              document.body.appendChild(dialog);
            },
          }
        : undefined,
  }),

  // 🆕 后台压缩操作
  compactStart: () => ({
    type: "info" as const,
    message: "后台压缩中...",
    description: "正在压缩上下文",
    duration: 0, // 不自动关闭
    position: "global" as const,
  }),
  compactComplete: (stats?: {
    originalSize: number;
    compressedSize: number;
    timeTaken: number;
  }) => ({
    type: "success" as const,
    message: "压缩完成",
    duration: 5000,
    position: "global" as const,
    action: stats
      ? {
          label: "查看详情",
          onClick: () => {
            const dialog = document.createElement("div");
            dialog.innerHTML = `
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100000;">
            <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">压缩详情</h3>
              <p style="margin: 8px 0;"><strong>原始大小:</strong> ${(stats.originalSize / 1024).toFixed(2)} KB</p>
              <p style="margin: 8px 0;"><strong>压缩后:</strong> ${(stats.compressedSize / 1024).toFixed(2)} KB</p>
              <p style="margin: 8px 0;"><strong>压缩率:</strong> ${((1 - stats.compressedSize / stats.originalSize) * 100).toFixed(1)}%</p>
              <p style="margin: 8px 0;"><strong>耗时:</strong> ${(stats.timeTaken / 1000).toFixed(2)} 秒</p>
              <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
          </div>
        `;
            document.body.appendChild(dialog);
          },
        }
      : undefined,
  }),
  compactError: (error: string, details?: string) => ({
    type: "error" as const,
    message: "压缩失败",
    description: error,
    duration: 0, // 错误不自动关闭，让用户主动查看
    position: "global" as const,
    action: {
      label: "查看详情",
      onClick: () => {
        const dialog = document.createElement("div");
        dialog.innerHTML = `
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100000;">
            <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px; max-height: 80vh; overflow: auto;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #dc2626;">压缩失败</h3>
              <p style="margin: 8px 0;"><strong>错误信息:</strong> ${error}</p>
              ${details ? `<pre style="background: #fef2f2; padding: 12px; border-radius: 4px; overflow: auto; font-size: 12px; color: #dc2626; margin-top: 12px;">${details}</pre>` : ""}
              <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top: 16px; padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
          </div>
        `;
        document.body.appendChild(dialog);
      },
    },
  }),
};

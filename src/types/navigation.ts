export type View =
  | "projects"
  | "editor"
  | "codex-editor"
  | "gemini-editor"
  | "claude-file-editor"
  | "claude-code-session"
  | "claude-tab-manager"
  | "settings"
  | "mcp"
  | "usage-dashboard"
  | "diagnostics" // v1.2.9 配置诊断
  | "project-settings"
  | "enhanced-hooks-manager"
  | "hook-manager"
  | "claude-extensions"
  | "plugins"
  | "new-features" // v1.2.0 新功能演示
  | "super-agent" // v2.4.0 Super Agent 控制中心
  | "developer-tools" // v2.5.0 开发工具
  | "spec-generation" // v2.5.0 规范生成引擎
  | "workflow-manager" // v2.5.0 工作流管理器
  | "v3-features"; // v3.0 功能中心

export interface NavigationState {
  currentView: View;
  history: View[];
  previousView: View | null;
}

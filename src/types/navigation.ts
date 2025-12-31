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
  | "new-features"; // v1.2.0 新功能演示

export interface NavigationState {
  currentView: View;
  history: View[];
  previousView: View | null;
}

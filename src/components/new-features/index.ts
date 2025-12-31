/**
 * 新功能组件统一导出
 *
 * 此文件汇总所有新开发的功能模块，方便一次性导入
 */

// ========================================
// Canvas 实时渲染
// ========================================
export { CanvasRenderer } from '../canvas';
export type { CanvasMode, CanvasLanguage, CanvasRendererProps } from '../canvas';

// ========================================
// AI Copilot 侧边栏
// ========================================
export { CopilotSidebar } from '../copilot';
export type {
  CopilotMessage,
  QuickAction,
  CopilotContext,
  CopilotSidebarProps
} from '../copilot';

// ========================================
// Monaco Diff 编辑器
// ========================================
export { MonacoDiffEditor } from '../editor';
export type { DiffChange, MonacoDiffEditorProps } from '../editor';

// ========================================
// 文件树浏览器
// ========================================
export { FileTreeExplorer } from '../explorer';
export type { FileNode, FileTreeExplorerProps, ContextAction } from '../explorer';

// ========================================
// 多模态输入
// ========================================
export { MultiModalInput } from '../input';
export type { MediaType, MediaFile, MultiModalInputProps } from '../input';

// ========================================
// 智能输出解析器
// ========================================
export { SmartOutputParser } from '../output';
export type { OutputType, SmartOutputParserProps } from '../output';

// ========================================
// 多代理工作流系统
// ========================================
export {
  DAGVisualizer,
  WorkflowControlPanel
} from '../workflow';
export type {
  DAGVisualizerProps,
  WorkflowControlPanelProps
} from '../workflow';

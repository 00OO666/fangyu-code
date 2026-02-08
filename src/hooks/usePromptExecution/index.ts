/**
 * usePromptExecution Hook 模块入口
 *
 * 🔧 v2.2.6: 重构为模块化结构，降低代码复杂度
 *
 * 目录结构：
 * - index.ts: 主入口，重新导出所有功能
 * - types.ts: 类型定义
 * - utils.ts: 工具函数
 *
 * 原始文件 usePromptExecution.ts 保持不变，此模块提供：
 * 1. 类型定义的独立导入
 * 2. 工具函数的复用
 * 3. 未来进一步拆分的基础
 */

// 导出类型
export type {
  QueuedPrompt,
  UsePromptExecutionConfig,
  UsePromptExecutionReturn,
  ClaudeGlobalEventPayload,
} from "./types";

// 导出工具函数
export {
  normalizeClaudeGlobalPayload,
  isThinkingBlocksError,
  generateUniqueId,
  safeJsonParse,
  delay,
  isEmptyMessage,
} from "./utils";

// 重新导出主 hook（保持向后兼容）
export { usePromptExecution } from "../usePromptExecution";

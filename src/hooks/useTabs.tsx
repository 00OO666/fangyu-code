/**
 * useTabs - 标签页状态管理
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 此文件现在是 ./tabs/ 模块的重新导出入口
 * - 实际实现已拆分到 ./tabs/ 目录下的多个文件
 * - 保持向后兼容，所有导入此文件的代码无需修改
 *
 * 模块结构:
 * - ./tabs/types.ts - 类型定义
 * - ./tabs/useTabState.ts - 基础状态管理
 * - ./tabs/useTabPersistence.ts - 持久化逻辑
 * - ./tabs/useMultiWindow.ts - 多窗口支持
 * - ./tabs/index.tsx - 组合入口
 *
 * _Requirements: 1.1_
 */

// Re-export everything from the tabs module
export {
  TabProvider,
  TabContext, // 🔧 FIX (v2.7.6): 导出 TabContext 供需要可选访问的 hooks 使用
  useTabs,
  useActiveTab,
  useTabSession,
} from "./tabs";

export type { Tab, TabSession, TabSessionData, TabContextValue } from "./tabs";

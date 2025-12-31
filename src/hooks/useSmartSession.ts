/**
 * useSmartSession Hook
 *
 * 智能会话管理 Hook
 * 支持在首次对话时自动创建项目文件夹并命名会话
 */

import { useCallback, useRef } from 'react';
import { useTabs } from './useTabs';

interface UseSmartSessionReturn {
  /**
   * 是否是智能会话模式
   */
  isSmartMode: boolean;

  /**
   * 确保有 projectPath
   * 在智能模式下，会根据首条消息自动创建项目文件夹
   * 在普通模式下，直接返回现有的 projectPath
   *
   * @param firstMessage - 首条用户消息（用于生成会话标题）
   * @returns Promise<string | null> - 项目路径，如果失败返回 null
   */
  ensureProjectPath: (firstMessage: string) => Promise<string | null>;

  /**
   * 当前的 projectPath
   */
  projectPath: string | undefined;
}

/**
 * 智能会话管理 Hook
 *
 * @param tabId - 标签页 ID
 * @returns 智能会话管理接口
 */
export function useSmartSession(tabId: string): UseSmartSessionReturn {
  const { getTabById, upgradeSmartSession } = useTabs();

  // 使用 ref 来防止重复升级
  const upgradeInProgressRef = useRef(false);
  const upgradedPathRef = useRef<string | null>(null);

  const tab = getTabById(tabId);
  const isSmartMode = tab?.smartMode === true;
  const projectPath = tab?.projectPath;

  const ensureProjectPath = useCallback(async (firstMessage: string): Promise<string | null> => {
    // 如果已经有 projectPath，直接返回
    if (projectPath) {
      return projectPath;
    }

    // 如果已经升级过，返回缓存的路径
    if (upgradedPathRef.current) {
      return upgradedPathRef.current;
    }

    // 如果不是智能模式，返回 null（需要用户手动选择）
    if (!isSmartMode) {
      console.warn('[useSmartSession] No projectPath and not in smart mode');
      return null;
    }

    // 防止重复升级
    if (upgradeInProgressRef.current) {
      console.log('[useSmartSession] Upgrade already in progress, waiting...');
      // 等待升级完成
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!upgradeInProgressRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      return upgradedPathRef.current;
    }

    try {
      upgradeInProgressRef.current = true;
      console.log('[useSmartSession] Upgrading smart session with message:', firstMessage.substring(0, 50));

      const result = await upgradeSmartSession(tabId, firstMessage);

      if (result) {
        console.log('[useSmartSession] Smart session upgraded:', result);
        upgradedPathRef.current = result.projectPath;
        return result.projectPath;
      } else {
        console.error('[useSmartSession] Failed to upgrade smart session');
        return null;
      }
    } catch (error) {
      console.error('[useSmartSession] Error upgrading smart session:', error);
      return null;
    } finally {
      upgradeInProgressRef.current = false;
    }
  }, [tabId, projectPath, isSmartMode, upgradeSmartSession]);

  return {
    isSmartMode,
    ensureProjectPath,
    projectPath,
  };
}

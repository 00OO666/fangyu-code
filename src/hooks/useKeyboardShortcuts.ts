/**
 * 键盘快捷键 Hook
 *
 * 从 ClaudeCodeSession 提取（原 405-462 行）
 * 处理双击 ESC 和 Shift+Tab 的快捷键检测
 */

import { useEffect, useState } from 'react';

interface KeyboardShortcutsConfig {
  /** 是否激活（用于多标签管理） */
  isActive: boolean;
  /** 切换 Plan Mode */
  onTogglePlanMode: () => void;
  /** 显示撤回提示词选择器（双击 ESC） */
  onShowRevertDialog?: () => void;
  /** 🆕 快速恢复最新检查点（双击 ESC，Shift 修饰） */
  onRestoreLastCheckpoint?: () => void;
  /** 是否有对话框打开（如果有，则不处理 ESC） */
  hasDialogOpen?: boolean;
  /** 🆕 导航到上一条用户指令（PgUp） */
  onNavigateToPreviousPrompt?: () => void;
  /** 🆕 导航到下一条用户指令（PgDn） */
  onNavigateToNextPrompt?: () => void;
  /** 🆕 切换 Usage Dashboard（Ctrl+Shift+T） */
  onToggleUsageDashboard?: () => void;
}

/**
 * 键盘快捷键 Hook
 *
 * @param config - 配置对象
 *
 * @example
 * useKeyboardShortcuts({
 *   isActive: true,
 *   onTogglePlanMode: () => setIsPlanMode(prev => !prev),
 *   onShowRevertDialog: () => setShowRevertPicker(true)
 * });
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig): void {
  const {
    isActive,
    onTogglePlanMode,
    onShowRevertDialog,
    onRestoreLastCheckpoint,
    hasDialogOpen = false,
    onNavigateToPreviousPrompt,
    onNavigateToNextPrompt,
    onToggleUsageDashboard
  } = config;

  const [lastEscapeTime, setLastEscapeTime] = useState(0);
  const [lastEscapeWasShift, setLastEscapeWasShift] = useState(false);

  // Double ESC key detection for revert dialog or checkpoint restore
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      // Don't handle ESC if a dialog is open (let the dialog handle it)
      if (event.key === 'Escape' && isActive && !hasDialogOpen) {
        const now = Date.now();
        const isDoubleEscape = now - lastEscapeTime < 300;

        // Check if this is a double ESC within 300ms
        if (isDoubleEscape) {
          event.preventDefault();
          event.stopPropagation();

          // Shift + Esc + Esc: 快速恢复最新检查点
          if (event.shiftKey || lastEscapeWasShift) {
            if (onRestoreLastCheckpoint) {
              console.log('🔄 快速恢复最新检查点 (Shift+Esc+Esc)');
              onRestoreLastCheckpoint();
            }
          }
          // Esc + Esc: 显示撤回提示词选择器
          else {
            if (onShowRevertDialog) {
              onShowRevertDialog();
            }
          }
        }

        setLastEscapeTime(now);
        setLastEscapeWasShift(event.shiftKey);
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleEscapeKey, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey, { capture: true });
    };
  }, [lastEscapeTime, lastEscapeWasShift, isActive, onShowRevertDialog, onRestoreLastCheckpoint, hasDialogOpen]);

  // Shift+Tab for Plan Mode toggle (single press, consistent with Claude Code official)
  useEffect(() => {
    const handlePlanModeToggle = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && event.shiftKey && isActive) {
          event.preventDefault();
          event.stopPropagation();

        // Toggle Plan Mode (single press, as per official Claude Code)
          onTogglePlanMode();
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handlePlanModeToggle, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handlePlanModeToggle, { capture: true });
    };
  }, [isActive, onTogglePlanMode]);

  // 🆕 PgUp/PgDn for prompt navigation
  useEffect(() => {
    const handlePromptNavigation = (event: KeyboardEvent) => {
      if (!isActive) return;
      
      // PgUp - 上一条用户指令
      if (event.key === 'PageUp') {
        event.preventDefault();
        event.stopPropagation();
        if (onNavigateToPreviousPrompt) {
          onNavigateToPreviousPrompt();
        }
      }
      
      // PgDn - 下一条用户指令
      if (event.key === 'PageDown') {
        event.preventDefault();
        event.stopPropagation();
        if (onNavigateToNextPrompt) {
          onNavigateToNextPrompt();
        }
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handlePromptNavigation, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handlePromptNavigation, { capture: true });
    };
  }, [isActive, onNavigateToPreviousPrompt, onNavigateToNextPrompt]);

  // 🆕 Ctrl+Shift+T for Usage Dashboard toggle
  useEffect(() => {
    const handleUsageDashboardToggle = (event: KeyboardEvent) => {
      if (!isActive) return;

      // Ctrl+Shift+T - 切换 Usage Dashboard
      if (event.key === 'T' && event.ctrlKey && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (onToggleUsageDashboard) {
          onToggleUsageDashboard();
        }
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleUsageDashboardToggle, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handleUsageDashboardToggle, { capture: true });
    };
  }, [isActive, onToggleUsageDashboard]);

}
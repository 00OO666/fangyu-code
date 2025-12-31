import { useEffect } from 'react';
import { useTabs } from './useTabs';

export interface GlobalKeyboardShortcutsConfig {
  onOpenSettings?: () => void;
  onOpenSearch?: () => void;
  /** 🆕 打开提示历史搜索 (Ctrl+R) */
  onOpenPromptHistory?: () => void;
  enabled?: boolean;
}

export function useGlobalKeyboardShortcuts(config: GlobalKeyboardShortcutsConfig = {}) {
  const {
    onOpenSettings,
    onOpenSearch,
    onOpenPromptHistory,
    enabled = true,
  } = config;

  const { switchToTab, tabs } = useTabs();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[role="textbox"]') !== null;

      // ESC key handling: only blur input fields
      // Note: "Double ESC to revert" functionality is handled by useKeyboardShortcuts hook
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isInInput) {
          target.blur();
          return;
        }

        // Let dialog handle ESC if one is open
        const hasDialog = document.querySelector('[role="dialog"]') !== null;
        if (hasDialog) return;

        // Removed: ESC navigation back functionality
        // This allows the double-ESC revert dialog to work properly
        return;
      }

      if (isInInput) return;

      if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const tabIndex = parseInt(event.key) - 1;

        if (tabs && tabs[tabIndex]) {
          switchToTab(tabs[tabIndex].id);
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (onOpenSearch) {
          onOpenSearch();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        if (onOpenSettings) {
          onOpenSettings();
        }
        return;
      }

      // Ctrl+R: 打开提示历史搜索
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        // 阻止浏览器刷新
        event.preventDefault();
        if (onOpenPromptHistory) {
          onOpenPromptHistory();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled, onOpenSettings, onOpenSearch, onOpenPromptHistory, switchToTab, tabs]);
}

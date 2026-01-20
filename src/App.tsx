import { logger } from '@/lib/logger';
import { useEffect, useState, lazy, Suspense } from "react";
import { AppProviders } from "@/components/providers";
import { AppLayout } from "@/components/layout/AppLayout";
import { ViewRouter } from "@/components/layout/ViewRouter";
import { useFirstLaunchChangelog } from "@/hooks/useFirstLaunchChangelog";
import { TopCenterNotification } from "@/components/notifications";
import { useDataMigration } from "@/hooks/useDataMigration";
import { api } from "@/lib/api";
import { useConsoleMonitor } from "@/hooks/useConsoleMonitor";
import { WindowAttentionIndicator } from "@/components/WindowAttentionIndicator";

// 🔧 FIX: 懒加载大型组件，减少首屏加载时间
const FirstLaunchChangelogDialog = lazy(() => import("@/components/FirstLaunchChangelogDialog"));
const TauriAutoUpdateDialog = lazy(() => import("@/components/TauriAutoUpdateDialog"));
// 🔧 FIX: 命名导出需要特殊处理
const ErrorMonitorPanel = lazy(() => import("@/components/ErrorMonitorPanel").then(module => ({ default: module.ErrorMonitorPanel })));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then(module => ({ default: module.CommandPalette })));

/**
 * 主应用组件 - 管理 Claude 目录浏览器界面
 * Main App component - Manages the Claude directory browser UI
 */
function App() {
  // 数据迁移 - 清理旧版本的损坏数据
  useDataMigration();

  // 首次启动版本更新提醒
  const { showChangelog, changelog, hideChangelog } = useFirstLaunchChangelog();

  // 🆕 错误监控面板显示状态（支持生产环境通过快捷键开启）
  const [showErrorMonitor, setShowErrorMonitor] = useState(() => {
    // 开发模式默认显示，生产模式检查 localStorage
    if (import.meta.env.DEV) return true;
    return localStorage.getItem('fangyu-show-error-monitor') === 'true';
  });

  // 🔧 FIX: 开发模式下确保面板显示（解决 HMR 热更新后状态丢失问题）
  useEffect(() => {
    if (import.meta.env.DEV && !showErrorMonitor) {
      setShowErrorMonitor(true);
    }
    
    // 🔧 FIX: 清除可能导致面板不可见的旧位置数据
    const savedPos = localStorage.getItem('fangyu-error-panel-position');
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        // 如果位置超出屏幕范围，重置
        if (pos.x < 0 || pos.y < 0 || pos.x > window.innerWidth - 100 || pos.y > window.innerHeight - 100) {
          logger.debug('App', '[App] 错误监控面板位置超出屏幕，重置位置');
          localStorage.removeItem('fangyu-error-panel-position');
        }
      } catch {
        localStorage.removeItem('fangyu-error-panel-position');
      }
    }
  }, []);

  // Console 监控（开发模式或手动开启时启用）
  const { errors, clearErrors, clearError } = useConsoleMonitor({
    enabled: import.meta.env.DEV || showErrorMonitor,
    maxErrors: 50,
    showOriginal: true
  });

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 调试：打印所有按键
      if (event.ctrlKey && event.shiftKey) {
        logger.debug('App', '[App] Ctrl+Shift+' + event.key + ' pressed');
      }
      
      // F12 - 打开/关闭开发者工具
      if (event.key === 'F12') {
        event.preventDefault();
        api.openDevtools().catch(console.error);
      }
      
      // Ctrl+Shift+E - 切换错误监控面板（生产环境也可用）
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        logger.debug('App', '[App] Ctrl+Shift+E detected!');
        event.preventDefault();
        event.stopPropagation();
        setShowErrorMonitor(prev => {
          const newValue = !prev;
          // 持久化到 localStorage
          if (newValue) {
            localStorage.setItem('fangyu-show-error-monitor', 'true');
          } else {
            localStorage.removeItem('fangyu-show-error-monitor');
          }
          logger.debug('App', `[App] 错误监控面板: ${newValue ? '已开启' : '已关闭'}`);
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  return (
    <AppProviders>
      <AppLayout>
        <ViewRouter />
      </AppLayout>

      {/* 🎨 全局命令面板 Ctrl+K */}
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>

      {/* 版本更新提醒对话框 */}
      <Suspense fallback={null}>
        <FirstLaunchChangelogDialog
          open={showChangelog}
          onClose={hideChangelog}
          changelog={changelog}
        />
      </Suspense>

      {/* Tauri 自动更新对话框 */}
      <Suspense fallback={null}>
        <TauriAutoUpdateDialog />
      </Suspense>

      {/* 顶部居中通知 */}
      <TopCenterNotification />

      {/* 错误监控面板（开发模式自动显示，生产模式 Ctrl+Shift+E 开启） */}
      {showErrorMonitor && (
        <Suspense fallback={null}>
          <ErrorMonitorPanel
            errors={errors}
            onClearAll={clearErrors}
            onClearError={clearError}
          />
        </Suspense>
      )}

      {/* 窗口注意力状态指示器 */}
      <WindowAttentionIndicator />
    </AppProviders>
  );
}

export default App;

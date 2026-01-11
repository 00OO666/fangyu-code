import { useEffect, lazy, Suspense } from "react";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { TabProvider } from "@/hooks/useTabs";
import { UpdateProvider } from "@/contexts/UpdateContext";
import { OutputCacheProvider } from "@/lib/outputCache";
import { GlobalTaskStateProvider } from "@/hooks/useGlobalTaskState";
import { PromptQueueProvider } from "@/hooks/usePromptQueue";
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

  // Console 监控（仅开发模式）
  const { errors, clearErrors, clearError } = useConsoleMonitor({
    enabled: import.meta.env.DEV,
    maxErrors: 50,
    showOriginal: true
  });

  // 全局快捷键监听 - F12 打开开发者工具
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // F12 - 打开/关闭开发者工具
      if (event.key === 'F12') {
        event.preventDefault();
        api.openDevtools().catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <UpdateProvider>
      <GlobalTaskStateProvider>
        <OutputCacheProvider>
          <NavigationProvider>
            <ProjectProvider>
              <TabProvider>
                <PromptQueueProvider>
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

                  {/* 错误监控面板（仅开发模式） */}
                  {import.meta.env.DEV && (
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
                </PromptQueueProvider>
              </TabProvider>
            </ProjectProvider>
          </NavigationProvider>
        </OutputCacheProvider>
      </GlobalTaskStateProvider>
    </UpdateProvider>
  );
}

export default App;

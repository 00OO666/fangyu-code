import { useEffect } from "react";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { TabProvider } from "@/hooks/useTabs";
import { UpdateProvider } from "@/contexts/UpdateContext";
import { OutputCacheProvider } from "@/lib/outputCache";
import { GlobalTaskStateProvider } from "@/hooks/useGlobalTaskState";
// 🔧 FIX: 移除 GlobalExecutionProvider，改用全局对象避免 hooks 规则问题
import { PromptQueueProvider } from "@/hooks/usePromptQueue";
import { AppLayout } from "@/components/layout/AppLayout";
import { ViewRouter } from "@/components/layout/ViewRouter";
import { useFirstLaunchChangelog } from "@/hooks/useFirstLaunchChangelog";
import { FirstLaunchChangelogDialog } from "@/components/FirstLaunchChangelogDialog";
import { TauriAutoUpdateDialog } from "@/components/TauriAutoUpdateDialog";
import { TopCenterNotification } from "@/components/notifications";
import { useDataMigration } from "@/hooks/useDataMigration";
import { api } from "@/lib/api";
import { useConsoleMonitor } from "@/hooks/useConsoleMonitor";
import { ErrorMonitorPanel } from "@/components/ErrorMonitorPanel";

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
                {/* 版本更新提醒对话框 */}
                <FirstLaunchChangelogDialog
                  open={showChangelog}
                  onClose={hideChangelog}
                  changelog={changelog}
                />
                {/* Tauri 自动更新对话框 */}
                <TauriAutoUpdateDialog />
                {/* 顶部居中通知 */}
                <TopCenterNotification />
                {/* 错误监控面板（仅开发模式） */}
                {import.meta.env.DEV && (
                  <ErrorMonitorPanel
                    errors={errors}
                    onClearAll={clearErrors}
                    onClearError={clearError}
                  />
                )}
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

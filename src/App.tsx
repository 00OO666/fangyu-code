import { useEffect } from "react";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { TabProvider } from "@/hooks/useTabs";
import { UpdateProvider } from "@/contexts/UpdateContext";
import { OutputCacheProvider } from "@/lib/outputCache";
import { GlobalTaskStateProvider } from "@/hooks/useGlobalTaskState";
import { AppLayout } from "@/components/layout/AppLayout";
import { ViewRouter } from "@/components/layout/ViewRouter";
import { useFirstLaunchChangelog } from "@/hooks/useFirstLaunchChangelog";
import { FirstLaunchChangelogDialog } from "@/components/FirstLaunchChangelogDialog";
import { useDataMigration } from "@/hooks/useDataMigration";
import { api } from "@/lib/api";

/**
 * 主应用组件 - 管理 Claude 目录浏览器界面
 * Main App component - Manages the Claude directory browser UI
 */
function App() {
  // 数据迁移 - 清理旧版本的损坏数据
  useDataMigration();

  // 首次启动版本更新提醒
  const { showChangelog, changelog, hideChangelog } = useFirstLaunchChangelog();

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
              <AppLayout>
                <ViewRouter />
              </AppLayout>
              {/* 版本更新提醒对话框 */}
              <FirstLaunchChangelogDialog
                open={showChangelog}
                onClose={hideChangelog}
                changelog={changelog}
              />
            </TabProvider>
          </ProjectProvider>
        </NavigationProvider>
        </OutputCacheProvider>
      </GlobalTaskStateProvider>
    </UpdateProvider>
  );
}

export default App;

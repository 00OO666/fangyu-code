import React, { ReactNode, useState } from 'react';
import { Sidebar } from "@/components/layout/Sidebar";
import { useNavigation } from '@/contexts/NavigationContext';
import { useUpdate } from '@/contexts/UpdateContext';
import { useTheme } from '@/contexts/ThemeContext';
import { message } from '@tauri-apps/plugin-dialog';
import { UpdateDialog } from '@/components/dialogs/UpdateDialog';
import { AboutDialog } from '@/components/dialogs/AboutDialog';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentView, navigateTo } = useNavigation();
  const { checkUpdate } = useUpdate();
  const { themeName } = useTheme();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);

  const isSciFi = themeName === 'deep-glass-scifi';

  const handleCheckUpdate = async () => {
    setShowAboutDialog(false);

    // 强制检查更新
    const hasUpdate = await checkUpdate(true);

    if (hasUpdate) {
      setShowUpdateDialog(true);
    } else {
      // 如果没有更新，显示提示
      await message('当前已是最新版本', { title: '检查更新', kind: 'info' });
    }
  };
  // 🔧 handleCheckUpdate 保留用于未来功能
  void handleCheckUpdate;

  return (
    <div className="h-screen w-screen overflow-hidden flex text-foreground selection:bg-primary/20 selection:text-primary relative" style={{ background: 'var(--bg-main)' }}>
      {/* 背景层 - 根据主题显示不同背景 */}
      <div className="fixed inset-0 z-0">
        {isSciFi ? (
          // Sci-Fi 主题：纯色背景
          <div className="w-full h-full bg-[#0a0c10]"></div>
        ) : (
          // Pro 主题：山景背景图片
          <>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAn-1TBhuyjDS8e5LTj-Q2NbycbMUTLHCD4xC1NFVCRQV1UC_FY5DDCY1RApKEKfkDEnErwj3z_JOwepYSo4WqfFAvXQrxtEqMgcyW8vVOJuh5xY7k_cGLTOus7J-jzmnd53En18E84pSWYUDurg3AeKzCJNEiLQSHsyoTZNnHXTHs0I5DWPq2VoqDlElxpbOqPKI3DRRNcTGrYMgTJVkwu5WhU4y9_TTL5ZXCijhHxRvLxLuwYZLmSYSH_xE5CbW7kVHp28oboS5lL"
              alt="Dark Nature Background"
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-black/40"></div>
          </>
        )}
      </div>

      {/* Sidebar */}
      <div id="app-sidebar" className="z-50 flex-shrink-0">
        <Sidebar
          currentView={currentView}
          onNavigate={navigateTo}
          onAboutClick={() => setShowAboutDialog(true)}
          onUpdateClick={() => setShowUpdateDialog(true)}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden z-10">
        {/* 顶部标题栏 - 根据主题显示不同标题 */}
        <header className="h-10 flex items-center justify-between px-4 select-none relative z-20">
          {/* Spacer for centering */}
          <div className="w-20"></div>
          {/* App Title */}
          <div className={`text-xs font-medium uppercase tracking-widest opacity-70 ${
            isSciFi ? 'font-display text-amber-500 neon-text-amber' : 'text-gray-400'
          }`}>
            {isSciFi ? 'DEEP GLASS SCI-FI STATION' : 'Deep Glass Pro AI Station V1'}
          </div>
          {/* Window Controls */}
          <div className="flex items-center gap-4 w-20 justify-end text-gray-400">
            {/* 窗口控制按钮可以在未来添加 */}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
          {children}
        </div>
      </main>

      {/* Global Dialogs */}
      <UpdateDialog open={showUpdateDialog} onClose={() => setShowUpdateDialog(false)} />

      <AboutDialog
        open={showAboutDialog}
        onClose={() => setShowAboutDialog(false)}
        onViewNewFeatures={() => navigateTo('new-features')}
      />
    </div>
  );
};

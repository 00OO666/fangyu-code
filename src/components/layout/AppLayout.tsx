import React, { ReactNode, useState } from 'react';
import { Sidebar } from "@/components/layout/Sidebar";
import { useNavigation } from '@/contexts/NavigationContext';
import { useUpdate } from '@/contexts/UpdateContext';
import { message } from '@tauri-apps/plugin-dialog';
import { UpdateDialog } from '@/components/dialogs/UpdateDialog';
import { AboutDialog } from '@/components/dialogs/AboutDialog';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentView, navigateTo } = useNavigation();
  const { checkUpdate } = useUpdate();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);

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
      {/* 🌟 Deep Glass Pro Background - 深色玻璃拟态 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* 极轻的背景渐变 - 低对比度 */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
        {/* 噪点纹理 - 增加深度感 */}
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
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

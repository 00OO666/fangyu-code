import React, { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from "@/components/layout/Sidebar";
import { useNavigation } from '@/contexts/NavigationContext';
import { useUpdate } from '@/contexts/UpdateContext';
import { useTheme } from '@/contexts/ThemeContext';
import { message } from '@tauri-apps/plugin-dialog';
import { UpdateDialog } from '@/components/dialogs/UpdateDialog';
import { AboutDialog } from '@/components/dialogs/AboutDialog';
import { exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';

interface BackgroundEntry {
  id: string;
  fileName: string;
  addedAt: number;
}

const BACKGROUND_LIST_KEY = 'custom-backgrounds';
const BACKGROUND_ACTIVE_KEY = 'custom-background-active';
const BACKGROUND_STORAGE_KEY = 'custom-background-path';
const BACKGROUND_FILE_KEY = 'custom-background-file';
const BACKGROUND_BLUR_KEY = 'custom-background-blur';
const DEFAULT_BLUR = 12;
const MAX_BLUR = 30;

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentView, navigateTo } = useNavigation();
  const { checkUpdate } = useUpdate();
  const { themeName } = useTheme();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(null);
  const [backgroundBlur, setBackgroundBlur] = useState(DEFAULT_BLUR);

  const isSciFi = themeName === 'deep-glass-scifi';

  // 加载自定义背景图片
  useEffect(() => {
    const loadCustomBackground = async () => {
      try {
        const savedBlur = localStorage.getItem(BACKGROUND_BLUR_KEY);
        const parsedBlur = savedBlur ? Number(savedBlur) : NaN;
        const nextBlur = Number.isFinite(parsedBlur)
          ? Math.min(Math.max(parsedBlur, 0), MAX_BLUR)
          : DEFAULT_BLUR;
        setBackgroundBlur(nextBlur);

        let parsedList: BackgroundEntry[] = [];
        const storedList = localStorage.getItem(BACKGROUND_LIST_KEY);
        if (storedList) {
          try {
            const decoded = JSON.parse(storedList);
            if (Array.isArray(decoded)) {
              parsedList = decoded
                .filter((item) => item && typeof item === 'object')
                .map((item) => ({
                  id: String(item.id || ''),
                  fileName: String(item.fileName || ''),
                  addedAt: Number(item.addedAt || Date.now()),
                }))
                .filter((item) => item.id && item.fileName);
            }
          } catch (error) {
            console.warn('背景列表解析失败，将跳过', error);
          }
        }

        const storedActiveId = localStorage.getItem(BACKGROUND_ACTIVE_KEY);
        const activeDisabled = storedActiveId === 'none';
        let activeId = activeDisabled ? null : storedActiveId;

        if (parsedList.length === 0) {
          let legacyFileName = localStorage.getItem(BACKGROUND_FILE_KEY);
          if (!legacyFileName) {
            const legacyPath = localStorage.getItem(BACKGROUND_STORAGE_KEY);
            if (legacyPath) {
              legacyFileName = legacyPath.split(/[\\/]/).pop() || null;
            }
          }

          if (legacyFileName) {
            const legacyExists = await exists(legacyFileName, { baseDir: BaseDirectory.AppData });
            if (legacyExists) {
              const legacyId = `legacy-${Date.now()}`;
              parsedList = [{ id: legacyId, fileName: legacyFileName, addedAt: Date.now() }];
              activeId = legacyId;
              localStorage.setItem(BACKGROUND_LIST_KEY, JSON.stringify(parsedList));
              localStorage.setItem(BACKGROUND_ACTIVE_KEY, legacyId);
            }
          }

          localStorage.removeItem(BACKGROUND_STORAGE_KEY);
          localStorage.removeItem(BACKGROUND_FILE_KEY);
        }

        if (parsedList.length === 0) {
          setCustomBackgroundUrl(null);
          return;
        }

        if (activeDisabled) {
          setCustomBackgroundUrl(null);
          return;
        }

        if (!activeId || !parsedList.some((bg) => bg.id === activeId)) {
          activeId = parsedList[0].id;
          localStorage.setItem(BACKGROUND_ACTIVE_KEY, activeId);
        }

        const activeBackground = parsedList.find((bg) => bg.id === activeId);
        if (!activeBackground) {
          setCustomBackgroundUrl(null);
          return;
        }

        const fileExists = await exists(activeBackground.fileName, {
          baseDir: BaseDirectory.AppData,
        });

        if (!fileExists) {
          setCustomBackgroundUrl(null);
          return;
        }

        const appDataPath = await appDataDir();
        const fullPath = await join(appDataPath, activeBackground.fileName);
        const assetUrl = `${convertFileSrc(fullPath)}?v=${activeBackground.addedAt}`;
        setCustomBackgroundUrl(assetUrl);
      } catch (error) {
        console.error('加载自定义背景失败:', error);
      }
    };

    void loadCustomBackground();

    const handleBackgroundUpdate = () => {
      void loadCustomBackground();
    };

    window.addEventListener('background-settings-changed', handleBackgroundUpdate);
    return () => window.removeEventListener('background-settings-changed', handleBackgroundUpdate);
  }, []);

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
          // Pro 主题：自定义背景或默认山景背景图片
          <>
            <img
              src={customBackgroundUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuAn-1TBhuyjDS8e5LTj-Q2NbycbMUTLHCD4xC1NFVCRQV1UC_FY5DDCY1RApKEKfkDEnErwj3z_JOwepYSo4WqfFAvXQrxtEqMgcyW8vVOJuh5xY7k_cGLTOus7J-jzmnd53En18E84pSWYUDurg3AeKzCJNEiLQSHsyoTZNnHXTHs0I5DWPq2VoqDlElxpbOqPKI3DRRNcTGrYMgTJVkwu5WhU4y9_TTL5ZXCijhHxRvLxLuwYZLmSYSH_xE5CbW7kVHp28oboS5lL"}
              alt="Background"
              className="w-full h-full object-cover opacity-80"
            />
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(${backgroundBlur}px)`,
                WebkitBackdropFilter: `blur(${backgroundBlur}px)`,
                background: 'rgba(10, 12, 16, 0.18)',
              }}
            />
            <div className="absolute inset-0 bg-black/35"></div>
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

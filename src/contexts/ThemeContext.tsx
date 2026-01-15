import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme 必须在 ThemeProvider 中使用');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 挂载时从 localStorage 加载主题
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
    }

    // 防止初始加载时的过渡动画
    // Prevent transition on initial load
    document.documentElement.classList.add('no-transition');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('no-transition');
        setIsInitialized(true);
      });
    });
  }, []);

  useEffect(() => {
    // 将主题应用到文档
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // 为 markdown 编辑器更新 data-color-mode
    // Update data-color-mode for markdown editor
    document.documentElement.setAttribute('data-color-mode', theme);

    // 将主题保存到 localStorage
    // Save theme to localStorage
    localStorage.setItem('theme', theme);

    // 更新 Windows 标题栏颜色以匹配主题
    // Update Windows title bar color to match theme
    invoke('set_titlebar_theme', { isDark: theme === 'dark' }).catch((err) => {
      console.warn('Failed to update titlebar theme:', err);
    });
  }, [theme]);

  // 带过渡动画的主题切换
  // Theme switching with transition animation
  const setTheme = useCallback((newTheme: Theme) => {
    if (newTheme === theme || !isInitialized) {
      setThemeState(newTheme);
      return;
    }

    // 添加过渡类
    // Add transition class
    document.documentElement.classList.add('theme-transitioning');
    setIsTransitioning(true);

    // 设置新主题
    setThemeState(newTheme);

    // 移除过渡类
    // Remove transition class after animation
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
      setIsTransitioning(false);
    }, 300); // 匹配 --ds-duration-slow

    return () => clearTimeout(timer);
  }, [theme, isInitialized]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
};
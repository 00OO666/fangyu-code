/**
 * 主题上下文 - Theme Context
 * 管理应用主题状态和切换
 * 支持 Deep Glass Pro 和 Deep Glass Sci-Fi 主题
 */

import { logger } from '@/lib/logger';
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Theme, ThemeName, ThemeContextValue } from '@/types/theme';
import { themes, defaultTheme } from '@/themes';
import { getDefaultTheme, setLastTheme } from '@/lib/themePreferences';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

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
  const [themeName, setThemeName] = useState<ThemeName>('deep-glass-pro');
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 从 localStorage 加载主题偏好
  useEffect(() => {
    try {
      const savedTheme = getDefaultTheme();
      if (savedTheme && themes[savedTheme]) {
        setThemeName(savedTheme);
        setThemeState(themes[savedTheme]);
      }
    } catch (error) {
      logger.error('ThemeContext', 'Failed to load theme:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 应用主题到 CSS 变量和 DOM
  useEffect(() => {
    const root = document.documentElement;

    // 应用颜色变量
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // 应用字体变量（仅主题相关字体，正文由 FontContext 控制）
    root.style.setProperty('--font-display', theme.fonts.display);
    root.style.setProperty('--font-mono', theme.fonts.mono);

    // 应用模糊效果变量
    root.style.setProperty('--blur-glass', theme.effects.blurGlass);
    root.style.setProperty('--blur-glass-light', theme.effects.blurGlassLight);
    root.style.setProperty('--blur-glass-strong', theme.effects.blurGlassStrong);

    // 设置主题属性
    root.setAttribute('data-theme', theme.name);

    // 保持 dark 类（兼容现有代码）
    root.classList.add('dark');

    // 控制特效类名
    if (theme.effects.enableScanline) {
      root.classList.add('enable-scanline');
    } else {
      root.classList.remove('enable-scanline');
    }

    if (theme.effects.enableNeonGlow) {
      root.classList.add('enable-neon-glow');
    } else {
      root.classList.remove('enable-neon-glow');
    }

    if (theme.effects.enableBackgroundGlow) {
      root.classList.add('enable-background-glow');
    } else {
      root.classList.remove('enable-background-glow');
    }

    // 加载 Sci-Fi 字体（如果需要）
    if (theme.name === 'deep-glass-scifi') {
      loadSciFiFonts();
    }

    // 更新 Windows 标题栏颜色
    invoke('set_titlebar_theme', { isDark: true }).catch((err) => {
      logger.warn('ThemeContext', 'Failed to update titlebar theme:', err);
    });
  }, [theme]);

  const setTheme = useCallback(async (name: ThemeName, options?: { persistLast?: boolean }) => {
    if (themes[name]) {
      // 添加过渡效果
      document.documentElement.classList.add('theme-transitioning');
      setIsTransitioning(true);

      setThemeName(name);
      setThemeState(themes[name]);

      // 保存到 localStorage
      if (options?.persistLast !== false) {
        try {
          setLastTheme(name);
          logger.info('ThemeContext', `Theme changed to: ${name}`);
        } catch (error) {
          logger.error('ThemeContext', 'Failed to save theme:', error);
        }
      }

      // 移除过渡类
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
        setIsTransitioning(false);
      }, 300);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = themeName === 'deep-glass-pro'
      ? 'deep-glass-scifi'
      : 'deep-glass-pro';
    setTheme(newTheme);
  }, [themeName, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme, toggleTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 加载 Sci-Fi 字体
async function loadSciFiFonts() {
  try {
    // 检查字体是否已加载
    if (document.fonts.check('1em Orbitron')) {
      return;
    }

    // 创建 link 元素加载 Google Fonts
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&display=swap';
    document.head.appendChild(link);

    logger.info('ThemeContext', 'Sci-Fi fonts loaded');
  } catch (error) {
    logger.error('ThemeContext', 'Failed to load Sci-Fi fonts:', error);
  }
}

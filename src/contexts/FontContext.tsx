/**
 * 字体上下文 - Font Context
 * 管理应用字体配置和切换
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/lib/constants';
import { FontConfig, FontConfigId, FontContextValue } from '@/types/fonts';
import { fontConfigs, defaultFontConfig, getFontConfigById } from '@/themes/fonts';

const FontContext = createContext<FontContextValue | undefined>(undefined);

export const useFont = () => {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error('useFont 必须在 FontProvider 中使用');
  }
  // 确保 fontConfigs 始终可用（常量列表）
  return {
    ...context,
    fontConfigs,
  };
};

interface FontProviderProps {
  children: ReactNode;
}

export const FontProvider: React.FC<FontProviderProps> = ({ children }) => {
  const [currentFont, setCurrentFont] = useState<FontConfig>(defaultFontConfig);

  // 从 localStorage 加载字体偏好
  useEffect(() => {
    try {
      const savedFontId = localStorage.getItem(STORAGE_KEYS.FONT_CONFIG) as FontConfigId;
      if (savedFontId) {
        const fontConfig = getFontConfigById(savedFontId);
        if (fontConfig) {
          setCurrentFont(fontConfig);
        }
      }
    } catch (error) {
      logger.error('FontContext', 'Failed to load font config:', error);
    }
  }, []);

  // 应用字体到 CSS 变量
  useEffect(() => {
    const root = document.documentElement;

    // 构建字体栈
    const englishFontStack = `"${currentFont.englishFont}", ${currentFont.fallback}`;
    const chineseFontStack = `"${currentFont.chineseFont}", ${currentFont.fallback}`;
    const combinedFontStack = `"${currentFont.englishFont}", "${currentFont.chineseFont}", ${currentFont.fallback}`;

    // 更新 CSS 变量
    root.style.setProperty('--font-english', englishFontStack);
    root.style.setProperty('--font-chinese', chineseFontStack);
    root.style.setProperty('--font-sans', combinedFontStack);

    // 设置字体属性（用于调试）
    root.setAttribute('data-font-config', currentFont.id);

    logger.info('FontContext', 'Font applied:', currentFont.name);

    // 检查字体是否可用（缺失时走 fallback，不应产生警告噪音）
    const checkFontLoaded = async () => {
      if (!("fonts" in document)) {
        logger.debug('FontContext', 'Font API not available, skip font check');
        return;
      }

      try {
        await document.fonts.ready;
      } catch (error) {
        logger.debug('FontContext', 'Font readiness check failed:', error);
        return;
      }

      const englishAvailable = document.fonts.check(`12px "${currentFont.englishFont}"`);
      const chineseAvailable = document.fonts.check(`12px "${currentFont.chineseFont}"`);

      if (englishAvailable || chineseAvailable) {
        logger.debug('FontContext', 'Font available:', {
          english: currentFont.englishFont,
          chinese: currentFont.chineseFont,
        });
      } else {
        logger.debug('FontContext', 'Font missing, using fallback:', {
          english: currentFont.englishFont,
          chinese: currentFont.chineseFont,
          fallback: currentFont.fallback,
        });
      }
    };

    void checkFontLoaded();
  }, [currentFont]);

  const setFont = useCallback((fontId: FontConfigId) => {
    const fontConfig = getFontConfigById(fontId);
    if (fontConfig) {
      setCurrentFont(fontConfig);

      // 保存到 localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.FONT_CONFIG, fontId);
        logger.info('FontContext', 'Font config saved:', fontId);
      } catch (error) {
        logger.error('FontContext', 'Failed to save font config:', error);
      }
    }
  }, []);

  // 使用 useMemo 缓存 Context value，避免不必要的重渲染
  const value = useMemo(
    () => ({ currentFont, setFont, fontConfigs }),
    [currentFont, setFont, fontConfigs]
  );

  return (
    <FontContext.Provider value={value}>
      {children}
    </FontContext.Provider>
  );
};

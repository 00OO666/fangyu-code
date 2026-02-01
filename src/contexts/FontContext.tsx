/**
 * 字体上下文 - Font Context
 * 管理应用字体配置和切换
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { FontConfig, FontConfigId, FontContextValue } from '@/types/fonts';
import { fontConfigs, defaultFontConfig, getFontConfigById } from '@/themes/fonts';

const FontContext = createContext<FontContextValue | undefined>(undefined);

export const useFont = () => {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error('useFont 必须在 FontProvider 中使用');
  }
  return context;
};

interface FontProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'fangyu-font-config';

export const FontProvider: React.FC<FontProviderProps> = ({ children }) => {
  const [currentFont, setCurrentFont] = useState<FontConfig>(defaultFontConfig);

  // 从 localStorage 加载字体偏好
  useEffect(() => {
    try {
      const savedFontId = localStorage.getItem(STORAGE_KEY) as FontConfigId;
      if (savedFontId) {
        const fontConfig = getFontConfigById(savedFontId);
        if (fontConfig) {
          setCurrentFont(fontConfig);
        }
      }
    } catch (error) {
      console.error('Failed to load font config:', error);
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

    console.log('Font applied:', currentFont.name);
  }, [currentFont]);

  const setFont = useCallback((fontId: FontConfigId) => {
    const fontConfig = getFontConfigById(fontId);
    if (fontConfig) {
      setCurrentFont(fontConfig);

      // 保存到 localStorage
      try {
        localStorage.setItem(STORAGE_KEY, fontId);
        console.log('Font config saved:', fontId);
      } catch (error) {
        console.error('Failed to save font config:', error);
      }
    }
  }, []);

  return (
    <FontContext.Provider value={{ currentFont, setFont, fontConfigs }}>
      {children}
    </FontContext.Provider>
  );
};

/**
 * 字体配置类型定义
 * Font Configuration Type Definitions
 */

export type FontConfigId =
  | 'inter-noto'
  | 'geist-noto'
  | 'dmsans-alibaba'
  | 'lxgw-wenkai'
  | 'noto-sans'
  | 'alibaba-puhuiti';

export interface FontConfig {
  id: FontConfigId;
  name: string;
  description: string;
  englishFont: string;
  chineseFont: string;
  fallback: string;
  preview: {
    english: string;
    chinese: string;
  };
}

export interface FontContextValue {
  currentFont: FontConfig;
  setFont: (fontId: FontConfigId) => void;
  fontConfigs: FontConfig[];
}

/**
 * 字体配置类型定义
 * Font Configuration Type Definitions
 */

export type FontConfigId =
  | "inter-noto"
  | "geist-noto"
  | "cascadia-noto"
  | "dmsans-alibaba"
  | "lxgw-wenkai"
  | "noto-sans"
  | "alibaba-puhuiti";

/**
 * 字体配置对象
 * 包含字体的所有元数据和预览信息
 */
export interface FontConfig {
  readonly id: FontConfigId;
  readonly name: string;
  readonly description: string;
  readonly englishFont: string;
  readonly chineseFont: string;
  readonly fallback: string;
  readonly preview: Readonly<{
    english: string;
    chinese: string;
  }>;
}

/**
 * 字体上下文值
 * 提供当前字体配置和切换方法
 */
export interface FontContextValue {
  currentFont: FontConfig;
  setFont: (fontId: FontConfigId) => void;
  fontConfigs: FontConfig[];
}

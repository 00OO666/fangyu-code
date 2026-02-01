/**
 * 主题系统类型定义
 * Theme System Type Definitions
 */

export type ThemeName = 'deep-glass-pro' | 'deep-glass-scifi';

export interface ThemeColors {
  // 背景色
  bgMain: string;
  bgGlass: string;
  bgPanel: string;
  bgGlassLight: string;
  bgGlassStrong: string;

  // 文本色
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  // 强调色
  accentPrimary: string;    // 主强调色（Amber for sci-fi, Blue for pro）
  accentSecondary: string;  // 次强调色（Sci-Fi Blue for sci-fi）
  accentBlue: string;
  accentGreen: string;
  accentYellow: string;
  accentOrange: string;
  accentRed: string;

  // 边框
  borderGlass: string;
  borderGlassStrong: string;
  borderGlassSubtle: string;
}

export interface ThemeFonts {
  display: string;  // 显示字体（Orbitron for sci-fi, Inter for pro）
  mono: string;     // 等宽字体
  sans: string;     // 正文字体
}

export interface ThemeEffects {
  // 模糊效果
  blurGlass: string;
  blurGlassLight: string;
  blurGlassStrong: string;

  // 特效开关
  enableScanline: boolean;      // 扫描线效果
  enableNeonGlow: boolean;      // 霓虹灯发光
  enableBackgroundGlow: boolean; // 背景光晕

  // 性能模式
  performanceMode: 'full' | 'balanced' | 'minimal';
}

export interface Theme {
  name: ThemeName;
  displayName: string;
  description: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  effects: ThemeEffects;
}

export interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName, options?: { persistLast?: boolean }) => void;
  toggleTheme: () => void;
  isLoading: boolean;
}

/**
 * 主题配置定义
 * Theme Configurations
 */

import { Theme } from '@/types/theme';

// Deep Glass Pro 主题（当前默认）
export const deepGlassProTheme: Theme = {
  name: 'deep-glass-pro',
  displayName: 'Deep Glass Pro',
  description: '专业深色玻璃拟态风格，适合长时间工作',
  colors: {
    bgMain: '#0b0f14',
    bgGlass: 'rgba(20, 25, 34, 0.65)',
    bgPanel: 'rgba(30, 35, 45, 0.75)',
    bgGlassLight: 'rgba(20, 25, 34, 0.45)',
    bgGlassStrong: 'rgba(30, 35, 45, 0.85)',
    textPrimary: '#e5e7eb',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    textDisabled: '#4b5563',
    accentPrimary: '#3b82f6',      // Blue
    accentSecondary: '#60a5fa',
    accentBlue: '#3b82f6',
    accentGreen: '#22c55e',
    accentYellow: '#facc15',
    accentOrange: '#f97316',
    accentRed: '#ef4444',
    borderGlass: 'rgba(255, 255, 255, 0.08)',
    borderGlassStrong: 'rgba(255, 255, 255, 0.12)',
    borderGlassSubtle: 'rgba(255, 255, 255, 0.04)',
  },
  fonts: {
    display: 'Inter, sans-serif',
    mono: 'JetBrains Mono, Consolas, monospace',
    sans: 'Inter, sans-serif',
  },
  effects: {
    blurGlass: 'blur(28px)',
    blurGlassLight: 'blur(16px)',
    blurGlassStrong: 'blur(40px)',
    enableScanline: false,
    enableNeonGlow: false,
    enableBackgroundGlow: false,
    performanceMode: 'balanced',
  },
};

// Deep Glass Sci-Fi 主题（新增）
export const deepGlassSciFiTheme: Theme = {
  name: 'deep-glass-scifi',
  displayName: 'Deep Glass Sci-Fi',
  description: '科幻霓虹风格，炫酷视觉体验',
  colors: {
    bgMain: '#0a0c10',             // 更深的背景
    bgGlass: 'rgba(15, 18, 24, 0.4)',
    bgPanel: 'rgba(20, 25, 30, 0.6)',
    bgGlassLight: 'rgba(15, 18, 24, 0.3)',
    bgGlassStrong: 'rgba(20, 25, 30, 0.8)',
    textPrimary: '#e5e7eb',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    textDisabled: '#4b5563',
    accentPrimary: '#f59e0b',      // Amber（霓虹橙）
    accentSecondary: '#00f2ff',    // Sci-Fi Blue（霓虹蓝）
    accentBlue: '#00f2ff',
    accentGreen: '#22c55e',
    accentYellow: '#facc15',
    accentOrange: '#f59e0b',
    accentRed: '#ff4d4d',
    borderGlass: 'rgba(255, 255, 255, 0.08)',
    borderGlassStrong: 'rgba(245, 158, 11, 0.4)', // Amber 边框
    borderGlassSubtle: 'rgba(255, 255, 255, 0.04)',
  },
  fonts: {
    display: 'Orbitron, sans-serif',  // 科幻字体
    mono: 'JetBrains Mono, Consolas, monospace',
    sans: 'Inter, sans-serif',
  },
  effects: {
    blurGlass: 'blur(24px)',
    blurGlassLight: 'blur(16px)',
    blurGlassStrong: 'blur(40px)',
    enableScanline: true,           // 启用扫描线
    enableNeonGlow: true,           // 启用霓虹灯
    enableBackgroundGlow: true,     // 启用背景光晕
    performanceMode: 'balanced',
  },
};

// 主题映射
export const themes: Record<string, Theme> = {
  'deep-glass-pro': deepGlassProTheme,
  'deep-glass-scifi': deepGlassSciFiTheme,
};

// 默认主题
export const defaultTheme = deepGlassProTheme;

// 主题列表（用于 UI 选择）
export const themeList: Theme[] = [
  deepGlassProTheme,
  deepGlassSciFiTheme,
];

/**
 * 应用常量定义
 * Application Constants
 */

/**
 * localStorage 存储键
 * 集中管理所有 localStorage 的键名，避免魔法字符串
 */
export const STORAGE_KEYS = {
  /** 字体配置 */
  FONT_CONFIG: 'fangyu-font-config',
  /** 主题配置 */
  THEME: 'fangyu-theme',
  /** 背景图片列表 */
  BACKGROUND_LIST: 'custom-backgrounds',
  /** 当前激活的背景 */
  BACKGROUND_ACTIVE: 'custom-background-active',
  /** 背景图片路径 */
  BACKGROUND_PATH: 'custom-background-path',
  /** 背景图片文件名 */
  BACKGROUND_FILE: 'custom-background-file',
  /** 背景模糊度 */
  BACKGROUND_BLUR: 'custom-background-blur',
  /** 输出显示设置 */
  OUTPUT_DISPLAY: 'fangyu-output-display-settings',
} as const;

/**
 * 应用配置
 */
export const APP_CONFIG = {
  /** 应用名称 */
  APP_NAME: 'Fangyu Code',
  /** 默认背景模糊度 */
  DEFAULT_BLUR: 12,
  /** 最大背景模糊度 */
  MAX_BLUR: 30,
} as const;

/**
 * 字体配置定义
 * Font Configurations
 */

import { FontConfig } from "@/types/fonts";

/**
 * 字体配置列表
 * 包含所有可用的字体组合配置
 */
export const fontConfigs: FontConfig[] = [
  {
    id: "inter-noto",
    name: "Inter + 思源黑体",
    description: "最安全的选择，适合99%的场景。Inter 专为屏幕设计，思源黑体是最流行的中文字体。",
    englishFont: "Inter",
    chineseFont: "Noto Sans SC",
    fallback: "system-ui, -apple-system, sans-serif",
    preview: {
      english: "The quick brown fox jumps over the lazy dog. 0123456789",
      chinese: "快速的棕色狐狸跳过懒狗。中文字体预览测试。",
    },
  },
  {
    id: "geist-noto",
    name: "Geist Sans + 思源黑体",
    description: "现代科技感。Vercel 开发的 Geist Sans，简洁现代，适合技术类应用。",
    englishFont: "Geist Sans",
    chineseFont: "Noto Sans SC",
    fallback: "system-ui, -apple-system, sans-serif",
    preview: {
      english: "The quick brown fox jumps over the lazy dog. 0123456789",
      chinese: "快速的棕色狐狸跳过懒狗。中文字体预览测试。",
    },
  },
  {
    id: "cascadia-noto",
    name: "Cascadia Code + 思源黑体",
    description:
      "Windows 优化首选。微软开发的等宽字体，专为编程设计，在 Windows 125% DPI 下渲染效果极佳。",
    englishFont: "Cascadia Code",
    chineseFont: "Noto Sans SC",
    fallback: "Consolas, Monaco, monospace",
    preview: {
      english: "The quick brown fox jumps over the lazy dog. 0123456789",
      chinese: "快速的棕色狐狸跳过懒狗。中文字体预览测试。",
    },
  },
  {
    id: "dmsans-alibaba",
    name: "DM Sans + 阿里巴巴普惠体",
    description: "商业友好。DM Sans 低对比度设计，阿里巴巴普惠体现代商业感强。",
    englishFont: "DM Sans",
    chineseFont: "Alibaba PuHuiTi",
    fallback: "system-ui, -apple-system, sans-serif",
    preview: {
      english: "The quick brown fox jumps over the lazy dog. 0123456789",
      chinese: "快速的棕色狐狸跳过懒狗。中文字体预览测试。",
    },
  },
  {
    id: "lxgw-wenkai",
    name: "霞鹜文楷",
    description: "手写风格，温暖人性化。适合轻松、非正式的场景，如博客、笔记。",
    englishFont: "LXGW WenKai TC",
    chineseFont: "LXGW WenKai TC",
    fallback: "KaiTi, STKaiti, serif",
    preview: {
      english: "The quick brown fox jumps over the lazy dog. 0123456789",
      chinese: "快速的棕色狐狸跳过懒狗。中文字体预览测试。",
    },
  },
  {
    id: "noto-sans",
    name: "思源黑体",
    description: "经典黑体，Google 和 Adobe 联合开发。适合所有场景，可读性极佳。",
    englishFont: "Noto Sans SC",
    chineseFont: "Noto Sans SC",
    fallback: "Microsoft YaHei, PingFang SC, sans-serif",
    preview: {
      english: "The quick brown fox jumps over the lazy dog. 0123456789",
      chinese: "快速的棕色狐狸跳过懒狗。中文字体预览测试。",
    },
  },
  {
    id: "alibaba-puhuiti",
    name: "阿里巴巴普惠体",
    description: "现代商业字体，阿里巴巴开发。友好、现代，适合品牌和商业设计。",
    englishFont: "Alibaba PuHuiTi",
    chineseFont: "Alibaba PuHuiTi",
    fallback: "Microsoft YaHei, PingFang SC, sans-serif",
    preview: {
      english: "The quick brown fox jumps over the lazy dog. 0123456789",
      chinese: "快速的棕色狐狸跳过懒狗。中文字体预览测试。",
    },
  },
];

/**
 * 默认字体配置
 * 使用 Inter + 思源黑体 作为默认选择
 */
export const defaultFontConfig = fontConfigs[0]; // Inter + 思源黑体

/**
 * 根据字体配置 ID 获取对应的字体配置对象
 * @param id - 字体配置的唯一标识符
 * @returns 匹配的字体配置对象，如果未找到则返回 undefined
 * @example
 * const config = getFontConfigById('inter-noto');
 * if (config) {
 *   console.log(config.name); // "Inter + 思源黑体"
 * }
 */
export function getFontConfigById(id: string): FontConfig | undefined {
  return fontConfigs.find((config) => config.id === id);
}

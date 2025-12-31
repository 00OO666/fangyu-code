/**
 * 语法高亮兼容性检测工具
 *
 * 某些旧版浏览器（如 macOS 13.x 上的 Safari/WebKit）不支持现代正则表达式特性，
 * 会导致 react-syntax-highlighter (Prism) 抛出 "Invalid regular expression" 错误。
 *
 * 此工具用于检测浏览器是否支持语法高亮所需的正则表达式特性，
 * 以便在不支持的浏览器上优雅降级为纯文本显示。
 */

/**
 * 检测浏览器是否支持语法高亮所需的正则表达式特性
 *
 * 主要检测:
 * 1. Lookbehind assertions (?<=...) - 旧版 Safari/WebKit 不支持
 * 2. Named capture groups (?<name>...) - 旧版 Safari/WebKit 不支持
 */
export const checkSyntaxHighlightSupport = (() => {
  let cachedResult: boolean | null = null;

  return (): boolean => {
    if (cachedResult !== null) {
      return cachedResult;
    }

    try {
      // 测试 lookbehind assertions 支持
      new RegExp('(?<=test)');

      // 测试 named capture groups 支持 (这是 "invalid group specifier name" 错误的根源)
      new RegExp('(?<name>test)');

      // 测试 lookahead assertions 支持 (通常都支持，但以防万一)
      new RegExp('(?=test)');

      cachedResult = true;
    } catch {
      console.warn(
        '[SyntaxHighlight] Browser does not support required regex features. ' +
        'Falling back to plain text code blocks.'
      );
      cachedResult = false;
    }

    return cachedResult;
  };
})();

/**
 * 获取是否支持语法高亮的缓存结果
 * 用于在组件初始化时快速获取结果
 */
export const getSyntaxHighlightSupport = (): boolean => {
  return checkSyntaxHighlightSupport();
};

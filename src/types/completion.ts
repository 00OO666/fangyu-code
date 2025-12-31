/**
 * 代码补全类型定义
 *
 * 智能代码补全系统，支持：
 * - 关键字补全
 * - 变量/函数名补全
 * - 片段补全
 * - AI 辅助补全
 */

/**
 * 补全项类型
 */
export type CompletionItemKind =
  | 'keyword'      // 关键字
  | 'variable'     // 变量
  | 'function'     // 函数
  | 'method'       // 方法
  | 'property'     // 属性
  | 'class'        // 类
  | 'interface'    // 接口
  | 'type'         // 类型
  | 'enum'         // 枚举
  | 'constant'     // 常量
  | 'snippet'      // 代码片段
  | 'file'         // 文件
  | 'folder'       // 文件夹
  | 'module'       // 模块
  | 'unit'         // 单位
  | 'value'        // 值
  | 'event'        // 事件
  | 'operator'     // 运算符
  | 'text';        // 普通文本

/**
 * 补全项
 */
export interface CompletionItem {
  /** 显示标签 */
  label: string;
  /** 补全类型 */
  kind: CompletionItemKind;
  /** 详细描述（显示在右侧） */
  detail?: string;
  /** 文档说明（显示在底部） */
  documentation?: string;
  /** 插入文本（如果与 label 不同） */
  insertText?: string;
  /** 是否是代码片段（包含占位符 $1, $2 等） */
  isSnippet?: boolean;
  /** 排序优先级（数字越小越靠前） */
  sortPriority?: number;
  /** 过滤文本（用于匹配输入） */
  filterText?: string;
  /** 附加数据 */
  data?: any;
  /** 来源（用于分组显示） */
  source?: 'local' | 'ai' | 'snippet' | 'history';
}

/**
 * 补全上下文
 */
export interface CompletionContext {
  /** 当前光标位置 */
  position: {
    line: number;
    column: number;
  };
  /** 当前行内容 */
  lineContent: string;
  /** 光标前的文本 */
  textBeforeCursor: string;
  /** 光标后的文本 */
  textAfterCursor: string;
  /** 当前词（正在输入的） */
  currentWord: string;
  /** 触发字符（如 . 或 : 等） */
  triggerCharacter?: string;
  /** 文件语言 */
  language?: string;
  /** 文件路径 */
  filePath?: string;
  /** 完整文件内容（用于上下文分析） */
  fullContent?: string;
}

/**
 * 补全结果
 */
export interface CompletionResult {
  /** 补全项列表 */
  items: CompletionItem[];
  /** 是否已完成（true 表示不需要进一步请求） */
  isComplete: boolean;
  /** 替换范围（起始位置） */
  replaceStart?: number;
  /** 替换范围（结束位置） */
  replaceEnd?: number;
}

/**
 * 补全提供者
 */
export interface CompletionProvider {
  /** 提供者 ID */
  id: string;
  /** 提供者名称 */
  name: string;
  /** 支持的语言 */
  languages?: string[];
  /** 触发字符 */
  triggerCharacters?: string[];
  /** 提供补全项 */
  provideCompletions: (
    context: CompletionContext
  ) => Promise<CompletionResult> | CompletionResult;
}

/**
 * 补全配置
 */
export interface CompletionConfig {
  /** 启用补全 */
  enabled?: boolean;
  /** 自动触发（默认 true） */
  autoTrigger?: boolean;
  /** 延迟触发时间（毫秒） */
  triggerDelay?: number;
  /** 最大显示项数 */
  maxItems?: number;
  /** 启用 AI 补全 */
  enableAI?: boolean;
  /** AI 补全模型 */
  aiModel?: string;
  /** 显示文档预览 */
  showDocumentation?: boolean;
  /** 快捷键配置 */
  shortcuts?: {
    trigger?: string;      // 手动触发
    accept?: string;       // 接受补全
    next?: string;         // 下一项
    previous?: string;     // 上一项
    dismiss?: string;      // 关闭
  };
}

/**
 * 补全状态
 */
export interface CompletionState {
  /** 是否可见 */
  visible: boolean;
  /** 是否加载中 */
  loading: boolean;
  /** 当前选中索引 */
  selectedIndex: number;
  /** 补全结果 */
  result: CompletionResult | null;
  /** 触发上下文 */
  context: CompletionContext | null;
  /** 错误信息 */
  error?: string;
}

/**
 * 语言关键字映射
 */
export const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  javascript: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
    'throw', 'new', 'this', 'class', 'extends', 'import', 'export', 'default',
    'async', 'await', 'static', 'get', 'set', 'typeof', 'instanceof', 'delete',
    'void', 'null', 'undefined', 'true', 'false', 'in', 'of',
  ],
  typescript: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
    'throw', 'new', 'this', 'class', 'extends', 'import', 'export', 'default',
    'async', 'await', 'static', 'get', 'set', 'typeof', 'instanceof', 'delete',
    'void', 'null', 'undefined', 'true', 'false', 'in', 'of',
    'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract',
    'implements', 'private', 'protected', 'public', 'readonly', 'as', 'is',
    'keyof', 'never', 'unknown', 'any', 'string', 'number', 'boolean', 'object',
  ],
  python: [
    'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break',
    'continue', 'pass', 'try', 'except', 'finally', 'raise', 'import', 'from',
    'as', 'with', 'assert', 'yield', 'lambda', 'global', 'nonlocal', 'and',
    'or', 'not', 'in', 'is', 'True', 'False', 'None', 'async', 'await',
  ],
  rust: [
    'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait', 'impl',
    'type', 'mod', 'use', 'pub', 'crate', 'self', 'super', 'if', 'else',
    'match', 'loop', 'while', 'for', 'in', 'break', 'continue', 'return',
    'async', 'await', 'move', 'ref', 'where', 'unsafe', 'extern', 'dyn',
  ],
  go: [
    'package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface',
    'map', 'chan', 'if', 'else', 'for', 'range', 'switch', 'case', 'default',
    'break', 'continue', 'return', 'go', 'select', 'defer', 'panic', 'recover',
    'make', 'new', 'nil', 'true', 'false', 'iota',
  ],
  php: [
    'function', 'class', 'public', 'private', 'protected', 'static', 'final',
    'abstract', 'interface', 'trait', 'extends', 'implements', 'use', 'namespace',
    'if', 'else', 'elseif', 'for', 'foreach', 'while', 'do', 'switch', 'case',
    'default', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw',
    'new', 'echo', 'print', 'require', 'include', 'require_once', 'include_once',
    'true', 'false', 'null', 'self', 'parent', 'this', 'array', 'global',
  ],
};

/**
 * 常用代码片段
 */
export const COMMON_SNIPPETS: Record<string, CompletionItem[]> = {
  javascript: [
    {
      label: 'log',
      kind: 'snippet',
      detail: 'console.log()',
      insertText: 'console.log($1);',
      isSnippet: true,
    },
    {
      label: 'fn',
      kind: 'snippet',
      detail: 'Arrow function',
      insertText: 'const $1 = ($2) => {\n\t$3\n};',
      isSnippet: true,
    },
    {
      label: 'afn',
      kind: 'snippet',
      detail: 'Async arrow function',
      insertText: 'const $1 = async ($2) => {\n\t$3\n};',
      isSnippet: true,
    },
    {
      label: 'iife',
      kind: 'snippet',
      detail: 'Immediately Invoked Function Expression',
      insertText: '(($1) => {\n\t$2\n})($3);',
      isSnippet: true,
    },
    {
      label: 'trycatch',
      kind: 'snippet',
      detail: 'Try-catch block',
      insertText: 'try {\n\t$1\n} catch (error) {\n\t$2\n}',
      isSnippet: true,
    },
  ],
  typescript: [
    {
      label: 'interface',
      kind: 'snippet',
      detail: 'Interface declaration',
      insertText: 'interface $1 {\n\t$2\n}',
      isSnippet: true,
    },
    {
      label: 'type',
      kind: 'snippet',
      detail: 'Type alias',
      insertText: 'type $1 = $2;',
      isSnippet: true,
    },
    {
      label: 'enum',
      kind: 'snippet',
      detail: 'Enum declaration',
      insertText: 'enum $1 {\n\t$2,\n}',
      isSnippet: true,
    },
    {
      label: 'generic',
      kind: 'snippet',
      detail: 'Generic function',
      insertText: 'function $1<T>($2: T): T {\n\t$3\n}',
      isSnippet: true,
    },
  ],
  react: [
    {
      label: 'rfc',
      kind: 'snippet',
      detail: 'React Function Component',
      insertText: "import React from 'react';\n\ninterface $1Props {\n\t$2\n}\n\nexport const $1: React.FC<$1Props> = ($3) => {\n\treturn (\n\t\t<div>\n\t\t\t$4\n\t\t</div>\n\t);\n};",
      isSnippet: true,
    },
    {
      label: 'usestate',
      kind: 'snippet',
      detail: 'useState Hook',
      insertText: 'const [$1, set$1] = useState($2);',
      isSnippet: true,
    },
    {
      label: 'useeffect',
      kind: 'snippet',
      detail: 'useEffect Hook',
      insertText: 'useEffect(() => {\n\t$1\n}, [$2]);',
      isSnippet: true,
    },
    {
      label: 'usememo',
      kind: 'snippet',
      detail: 'useMemo Hook',
      insertText: 'const $1 = useMemo(() => {\n\treturn $2;\n}, [$3]);',
      isSnippet: true,
    },
    {
      label: 'usecallback',
      kind: 'snippet',
      detail: 'useCallback Hook',
      insertText: 'const $1 = useCallback(($2) => {\n\t$3\n}, [$4]);',
      isSnippet: true,
    },
  ],
  python: [
    {
      label: 'def',
      kind: 'snippet',
      detail: 'Function definition',
      insertText: 'def $1($2):\n\t$3',
      isSnippet: true,
    },
    {
      label: 'class',
      kind: 'snippet',
      detail: 'Class definition',
      insertText: 'class $1:\n\tdef __init__(self$2):\n\t\t$3',
      isSnippet: true,
    },
    {
      label: 'ifmain',
      kind: 'snippet',
      detail: 'if __name__ == "__main__"',
      insertText: 'if __name__ == "__main__":\n\t$1',
      isSnippet: true,
    },
    {
      label: 'with',
      kind: 'snippet',
      detail: 'With statement',
      insertText: 'with open($1, "$2") as $3:\n\t$4',
      isSnippet: true,
    },
  ],
};

/**
 * 获取语言的关键字补全项
 */
export function getKeywordCompletions(language: string): CompletionItem[] {
  const keywords = LANGUAGE_KEYWORDS[language] || [];
  return keywords.map((keyword) => ({
    label: keyword,
    kind: 'keyword' as CompletionItemKind,
    detail: 'keyword',
    source: 'local' as const,
    sortPriority: 100,
  }));
}

/**
 * 获取语言的代码片段补全项
 */
export function getSnippetCompletions(language: string): CompletionItem[] {
  const snippets = COMMON_SNIPPETS[language] || [];
  return snippets.map((snippet) => ({
    ...snippet,
    source: 'snippet' as const,
    sortPriority: 50,
  }));
}

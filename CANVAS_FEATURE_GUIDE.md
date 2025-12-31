# Canvas 实时预览功能 - 使用指南

> **版本**: v1.2.0
> **状态**: ✅ 已实现核心组件

---

## 功能简介

仿照 Gemini Canvas 的实时代码预览功能，支持：
- 📝 代码编辑 + 实时预览（分屏/全屏）
- 🎨 支持 HTML/JSX/TSX/Markdown/SVG
- 🔥 自动提取聊天消息中的代码
- ⌨️ 快捷键调出: `Ctrl+Shift+C`

---

## 已实现的组件

### 1. **CanvasPanel** (核心预览组件)
📁 `src/components/canvas/CanvasPanel.tsx`

**功能**:
- Code / Preview 模式切换
- Monaco 编辑器
- 实时预览（iframe 沙盒）
- 复制/刷新/新窗口打开

**使用示例**:
```tsx
import { CanvasPanel } from '@/components/canvas/CanvasPanel';

<CanvasPanel
  isOpen={true}
  onClose={() => setShowCanvas(false)}
  code={code}
  language="tsx"
  title="实时预览"
/>
```

---

### 2. **CanvasFloatingWindow** (悬浮窗)
📁 `src/components/canvas/CanvasFloatingWindow.tsx`

**功能**:
- 全局悬浮窗
- 可最小化到右下角
- 快捷键支持: `Ctrl+Shift+C`

**使用示例**:
```tsx
import { CanvasFloatingWindow } from '@/components/canvas/CanvasFloatingWindow';

<CanvasFloatingWindow
  isOpen={showCanvas}
  onClose={() => setShowCanvas(false)}
  extractedCode={code}
  language="tsx"
/>
```

---

### 3. **useCanvasExtractor** (代码提取 Hook)
📁 `src/hooks/useCanvasExtractor.ts`

**功能**:
- 自动提取聊天消息中的代码块
- 优先识别 HTML/JSX/TSX
- 返回 `{ code, language }`

**使用示例**:
```tsx
import { useCanvasExtractor } from '@/hooks/useCanvasExtractor';

const extractedCode = useCanvasExtractor(messages);
// extractedCode: { code: string, language: string } | null
```

---

## 集成到会话界面 (TODO)

要在 ClaudeCodeSession 中使用，需要以下步骤：

### 步骤 1: 添加状态

在 `ClaudeCodeSession.tsx` 的 `ClaudeCodeSessionInner` 组件中添加：

```tsx
const [showCanvas, setShowCanvas] = useState(false);
const extractedCode = useCanvasExtractor(messages);
```

### 步骤 2: 渲染悬浮窗

在组件返回的 JSX 末尾添加：

```tsx
{/* Canvas 悬浮窗 */}
<CanvasFloatingWindow
  isOpen={showCanvas}
  onClose={() => setShowCanvas(false)}
  extractedCode={extractedCode?.code || ''}
  language={extractedCode?.language || 'tsx'}
/>
```

### 步骤 3: 添加打开按钮

在 `FloatingPromptInput/ControlBar.tsx` 中添加 Canvas 按钮：

```tsx
import { Sparkles } from 'lucide-react';

<Button
  variant="ghost"
  size="icon"
  onClick={() => setShowCanvas(true)}
  className="h-7 w-7 text-gray-400 hover:text-white"
  title="打开 Canvas (Ctrl+Shift+C)"
>
  <Sparkles size={14} />
</Button>
```

---

## 支持的语言和渲染

| 语言 | 预览方式 |
|------|---------|
| `html`, `htm` | 直接渲染 HTML |
| `jsx`, `tsx`, `javascript`, `typescript` | React 组件（自动加载 React/Babel） |
| `markdown`, `md` | Markdown 渲染（使用 marked.js） |
| `svg` | SVG 图形 |
| 其他 | 显示代码 |

---

## 快捷键

- **打开 Canvas**: `Ctrl+Shift+C`
- **关闭 Canvas**: `Esc` 或点击关闭按钮
- **全屏模式**: 点击右上角全屏按钮

---

## 下一步优化建议

1. ✅ 添加分屏拖拽调整宽度
2. ✅ 支持实时错误提示
3. ⬜ 添加代码格式化
4. ⬜ 支持多个 Canvas 标签页
5. ⬜ 自动保存预览状态
6. ⬜ 支持导出为 CodePen/JSFiddle

---

## 故障排除

### 问题 1: 代码提取不到
**原因**: 聊天消息中没有代码块
**解决**: 确保代码块使用 \`\`\` 包裹

### 问题 2: 预览空白
**原因**: 代码有语法错误或缺少依赖
**解决**: 检查控制台错误，补充缺失的依赖

### 问题 3: 样式不对
**原因**: 黑色主题默认样式
**解决**: 在代码中添加自定义样式

---

**文档更新**: 2025-12-28
**作者**: Claude Opus 4.5

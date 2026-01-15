# Design Document: Fangyu Code UI Redesign v3

## Overview

本设计文档定义了 Fangyu Code 的全新视觉系统，采用 2025-2026 年最新设计趋势：Glassmorphism（玻璃拟态）、渐变色彩、微动效等。目标是打造一个高级感、现代感、专业感的 AI 编程工具界面。

### 设计理念

1. **层次感** - 使用玻璃拟态创建视觉深度，让界面元素有前后关系
2. **聚焦性** - 通过模糊背景突出前景内容，引导用户注意力
3. **流畅性** - 统一的动效系统，让交互感觉自然流畅
4. **一致性** - 完整的设计系统，确保所有组件风格统一

## Architecture

### 设计系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Design System v3                          │
├─────────────────────────────────────────────────────────────┤
│  Tokens (CSS Variables)                                      │
│  ├── Colors (Primary, Secondary, Semantic, Gradients)       │
│  ├── Typography (Font Family, Sizes, Weights)               │
│  ├── Spacing (4px base unit scale)                          │
│  ├── Border Radius (sm, md, lg, xl, 2xl)                    │
│  ├── Shadows (Glass, Elevation, Glow)                       │
│  └── Animations (Durations, Easings)                        │
├─────────────────────────────────────────────────────────────┤
│  Base Styles                                                 │
│  ├── Glassmorphism Utilities (.glass, .glass-strong)        │
│  ├── Gradient Utilities (.gradient-primary, .gradient-glow) │
│  └── Animation Utilities (.animate-fade-in, .animate-slide) │
├─────────────────────────────────────────────────────────────┤
│  Components                                                  │
│  ├── SmartRecommendationBar (智能推荐条)                     │
│  ├── SessionPanel (会话面板)                                 │
│  ├── Sidebar (侧边栏)                                        │
│  ├── FloatingPromptInput (输入区域)                          │
│  └── MessageBubble (消息气泡)                                │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Design Tokens (CSS Variables)

```css
:root {
  /* === Primary Colors === */
  --color-primary-50: #F5F3FF;
  --color-primary-100: #EDE9FE;
  --color-primary-200: #DDD6FE;
  --color-primary-300: #C4B5FD;
  --color-primary-400: #A78BFA;
  --color-primary-500: #8B5CF6;
  --color-primary-600: #7C3AED;
  --color-primary-700: #6D28D9;
  --color-primary-800: #5B21B6;
  --color-primary-900: #4C1D95;

  /* === Secondary Colors (Blue) === */
  --color-secondary-50: #EFF6FF;
  --color-secondary-100: #DBEAFE;
  --color-secondary-200: #BFDBFE;
  --color-secondary-300: #93C5FD;
  --color-secondary-400: #60A5FA;
  --color-secondary-500: #3B82F6;
  --color-secondary-600: #2563EB;
  --color-secondary-700: #1D4ED8;
  --color-secondary-800: #1E40AF;
  --color-secondary-900: #1E3A8A;

  /* === Gradients === */
  --gradient-primary: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%);
  --gradient-secondary: linear-gradient(135deg, #06B6D4 0%, #14B8A6 100%);
  --gradient-accent: linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%);
  --gradient-glow: linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(59, 130, 246, 0.5) 100%);

  /* === Semantic Colors === */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* === Spacing (4px base) === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* === Border Radius === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* === Animation === */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.87, 0, 0.13, 1);

  /* === Typography === */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

/* === Dark Theme === */
.dark {
  --bg-base: #0F172A;
  --bg-surface: #1E293B;
  --bg-elevated: #334155;
  --bg-glass: rgba(30, 41, 59, 0.8);
  --bg-glass-strong: rgba(15, 23, 42, 0.9);
  
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  
  --border-default: rgba(148, 163, 184, 0.1);
  --border-glass: rgba(148, 163, 184, 0.15);
  --border-glow: rgba(139, 92, 246, 0.3);
}

/* === Light Theme === */
.light {
  --bg-base: #F8FAFC;
  --bg-surface: #FFFFFF;
  --bg-elevated: #F1F5F9;
  --bg-glass: rgba(255, 255, 255, 0.7);
  --bg-glass-strong: rgba(255, 255, 255, 0.85);
  
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;
  
  --border-default: rgba(15, 23, 42, 0.1);
  --border-glass: rgba(15, 23, 42, 0.08);
  --border-glow: rgba(139, 92, 246, 0.2);
}
```

### 2. Glassmorphism Utilities

```css
/* Base glass effect */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-glass);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}

/* Strong glass effect for floating elements */
.glass-strong {
  background: var(--bg-glass-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass);
  box-shadow: 
    0 10px 15px -3px rgba(0, 0, 0, 0.2),
    0 4px 6px -4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
}

/* Gradient border glow */
.glow-border {
  position: relative;
}

.glow-border::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: var(--gradient-primary);
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.5;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.glow-border:hover::before,
.glow-border:focus-within::before {
  opacity: 1;
}
```

### 3. SmartRecommendationBar Component

```tsx
interface SmartRecommendationBarProps {
  recommendations: SmartRecommendation[];
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  onClearAll: () => void;
  onRefresh?: () => void;
}

// Visual Design:
// - Floating bar with glassmorphism background
// - Gradient accent border on left edge
// - Compact single-line layout
// - Horizontal pagination for multiple items
// - Color-coded type icons (MCP: blue, Skill: amber, Agent: purple)
// - Three action buttons: Enable (primary), Snooze (ghost), Dismiss (ghost)
```

**样式规范：**
- 背景：`glass` 效果 + 渐变边框
- 圆角：`--radius-xl` (16px)
- 内边距：`--space-3` (12px)
- 图标大小：16px
- 字体大小：14px (名称), 12px (描述)
- 动画：fade + slide-up 进入，fade + slide-down 退出

### 4. SessionPanel Component

**消息气泡设计：**

```tsx
// User Message Bubble
// - 右对齐
// - 渐变背景 (gradient-primary)
// - 白色文字
// - 圆角：左上、左下、右下圆角大，右上圆角小
// - 紧凑内边距：12px 16px

// Assistant Message Bubble  
// - 左对齐
// - Glass 背景（更轻薄）
// - 默认文字颜色
// - 圆角：右上、右下、左下圆角大，左上圆角小
// - 紧凑内边距：12px 16px
```

**文字渲染优化：**
- 行高：1.6（提高可读性）
- 段落间距：8px（紧凑但清晰）
- 代码内联：背景色 + 小圆角，字体稍小
- Markdown 渲染：紧凑的标题间距

**工具调用 UI 设计（重点优化）：**

```tsx
// Tool Call Card - 紧凑版
// - 高度：最小化，单行显示工具名和状态
// - 展开/收起：点击展开查看详情
// - 默认收起状态

interface ToolCallCardProps {
  toolName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
  input?: object;
  output?: object;
  isExpanded?: boolean;
}

// 视觉规范：
// - 收起状态高度：32px
// - 背景：subtle glass (更轻薄)
// - 左侧：工具图标 (16px)
// - 中间：工具名称 (12px 字体)
// - 右侧：状态指示器 + 耗时 + 展开按钮
// - 圆角：8px
// - 边框：1px subtle
```

**工具调用状态指示器：**
- Pending：灰色圆点 + 脉冲动画
- Running：蓝色圆点 + 旋转动画
- Success：绿色勾号（静态）
- Error：红色叉号（静态）

**工具调用详情（展开后）：**
- 输入参数：紧凑的 JSON 显示，可折叠
- 输出结果：紧凑的 JSON 显示，可折叠
- 最大高度：200px，超出滚动
- 字体大小：11px（代码）

**代码块设计：**
- 背景：深色 (#1E293B)
- 圆角：`--radius-lg` (12px)
- 语法高亮：使用 One Dark Pro 配色
- 复制按钮：右上角悬浮，glass 效果
- 行号：可选显示，更紧凑
- 内边距：12px（比之前更紧凑）

**消息间距优化：**
- 同一发送者连续消息：4px 间距
- 不同发送者消息：12px 间距
- 工具调用与消息：8px 间距

### 5. Sidebar Component

**设计规范：**
- 宽度：240px (展开), 64px (收起)
- 背景：`glass` 效果
- 导航项高度：40px
- 活跃指示器：左侧 3px 渐变条
- 悬停效果：背景色变化 + 轻微右移

### 6. FloatingPromptInput Component

**设计规范：**
- 背景：`glass-strong` 效果
- 圆角：`--radius-2xl` (24px)
- 聚焦状态：渐变发光边框
- 发送按钮：渐变背景，圆形
- 模型选择器：下拉菜单使用 `glass-strong` 效果

## Data Models

### Theme Configuration

```typescript
interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  accentColor: 'purple' | 'blue' | 'cyan' | 'pink';
  glassIntensity: 'subtle' | 'normal' | 'strong';
  animationSpeed: 'reduced' | 'normal' | 'fast';
}
```

### Component Style Variants

```typescript
type GlassVariant = 'default' | 'strong' | 'subtle';
type SizeVariant = 'sm' | 'md' | 'lg';
type ColorVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Theme Switching Consistency

*For any* theme switch operation (light ↔ dark), all CSS variables SHALL update atomically and all components SHALL reflect the new theme within one render cycle.

**Validates: Requirements 1.3**

### Property 2: Contrast Ratio Compliance

*For any* text element displayed on a glassmorphism background, the contrast ratio between text color and effective background color SHALL meet WCAG AA standard (≥4.5:1 for normal text, ≥3:1 for large text).

**Validates: Requirements 2.6, 9.6**

### Property 3: Recommendation Bar Pagination

*For any* set of N recommendations where N > 1, the pagination controls SHALL allow navigation through all N items, and the current index SHALL always be within bounds [0, N-1].

**Validates: Requirements 3.3**

### Property 4: Type-Color Mapping

*For any* recommendation of type T, the displayed icon color SHALL match the predefined color for type T (MCP: blue, Skill: amber, Agent: purple, Tool: green).

**Validates: Requirements 3.4**

### Property 5: Streaming Indicator Visibility

*For any* streaming response state, the typing indicator SHALL be visible, and *for any* non-streaming state, the typing indicator SHALL be hidden.

**Validates: Requirements 4.5**

### Property 6: Auto-Scroll Behavior

*For any* new message added while user has not manually scrolled, the scroll position SHALL automatically move to show the new message. *For any* manual scroll by user, auto-scroll SHALL be disabled until user scrolls back to bottom.

**Validates: Requirements 4.7**

### Property 7: Sidebar Collapse State

*For any* window width < 1024px, the sidebar SHALL be in collapsed (icon-only) mode. *For any* window width ≥ 1024px, the sidebar collapse state SHALL be user-controllable.

**Validates: Requirements 5.4, 5.6, 8.2**

### Property 8: Input Auto-Resize

*For any* text input that exceeds the initial height, the input area SHALL expand to accommodate the content up to a maximum height, then enable scrolling.

**Validates: Requirements 6.3**

### Property 9: Loading State Indication

*For any* loading/streaming state, the send button SHALL display a loading animation and be disabled. *For any* idle state with valid input, the send button SHALL be enabled.

**Validates: Requirements 6.6**

### Property 10: Reduced Motion Preference

*For any* user with `prefers-reduced-motion: reduce` system preference, all animations SHALL either be disabled or use minimal motion alternatives.

**Validates: Requirements 7.5**

## Error Handling

### Glassmorphism Fallback

当浏览器不支持 `backdrop-filter` 时：
- 使用纯色半透明背景作为降级方案
- 增加背景不透明度以保持可读性

```css
@supports not (backdrop-filter: blur(12px)) {
  .glass {
    background: rgba(30, 41, 59, 0.95);
  }
}
```

### Animation Fallback

当用户启用减少动画偏好时：
- 禁用所有过渡动画
- 使用即时状态切换

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Testing Strategy

### Unit Tests

1. **Design Token Tests**
   - 验证所有 CSS 变量已定义
   - 验证颜色值格式正确
   - 验证间距遵循 4px 基准

2. **Component Render Tests**
   - 验证组件正确渲染
   - 验证样式类正确应用
   - 验证主题切换正确响应

### Property-Based Tests

使用 fast-check 库进行属性测试：

1. **Theme Consistency Property**
   - 生成随机主题切换序列
   - 验证每次切换后 CSS 变量一致

2. **Contrast Ratio Property**
   - 生成随机文本/背景颜色组合
   - 验证对比度符合 WCAG AA

3. **Pagination Bounds Property**
   - 生成随机推荐列表长度
   - 验证分页索引始终在有效范围内

### Visual Regression Tests

使用 Playwright 进行视觉回归测试：
- 截图对比关键组件在不同主题下的外观
- 验证响应式布局在不同断点的表现

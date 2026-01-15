---
inclusion: manual
---

# Web Interface Guidelines - Vercel Labs

> 来源: https://github.com/vercel-labs/web-interface-guidelines
> 适用于 AI Agent 代码审查和生成

Web 界面设计规范，使用 MUST/SHOULD/NEVER 指导决策。

---

## 交互 (Interactions)

### 键盘

- **MUST**: 完整键盘支持，遵循 [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- **MUST**: 可见焦点环 (`:focus-visible`; 分组用 `:focus-within`)
- **MUST**: 管理焦点 (trap, move, return)
- **NEVER**: `outline: none` 除非有可见焦点替代

### 目标和输入

- **MUST**: 点击目标 ≥24px (移动端 ≥44px)
- **MUST**: 移动端 `<input>` font-size ≥16px 防止 iOS 缩放
- **NEVER**: 禁用浏览器缩放 (`user-scalable=no`, `maximum-scale=1`)
- **MUST**: `touch-action: manipulation` 防止双击缩放
- **SHOULD**: 设置 `-webkit-tap-highlight-color` 匹配设计

### 表单

- **MUST**: Hydration 安全的输入 (不丢失焦点/值)
- **NEVER**: 阻止 `<input>`/`<textarea>` 粘贴
- **MUST**: 加载按钮显示 spinner 并保留原始标签
- **MUST**: Enter 提交聚焦的输入; `<textarea>` 中 ⌘/Ctrl+Enter 提交
- **MUST**: 保持提交按钮启用直到请求开始; 然后禁用并显示 spinner
- **MUST**: 接受自由文本，验证后显示反馈 - 不要阻止输入
- **MUST**: 允许提交不完整表单以显示验证反馈
- **MUST**: 错误内联显示在字段旁; 提交时聚焦第一个错误
- **MUST**: 设置 `autocomplete` + 有意义的 `name`; 正确的 `type` 和 `inputmode`
- **SHOULD**: 对邮箱/代码/用户名禁用拼写检查
- **SHOULD**: 占位符以 `…` 结尾并显示示例模式
- **MUST**: 导航前警告未保存的更改
- **MUST**: 兼容密码管理器和 2FA; 允许粘贴验证码
- **MUST**: Trim 值以处理文本扩展尾随空格
- **MUST**: 复选框/单选框无死区; 标签和控件共享一个点击目标

### 状态和导航

- **MUST**: URL 反映状态 (深链接 filters/tabs/pagination/expanded panels)
- **MUST**: Back/Forward 恢复滚动位置
- **MUST**: 链接使用 `<a>`/`<Link>` 导航 (支持 Cmd/Ctrl/中键点击)
- **NEVER**: 使用 `<div onClick>` 导航

### 反馈

- **SHOULD**: 乐观 UI; 响应后协调; 失败时回滚或提供撤销
- **MUST**: 确认破坏性操作或提供撤销窗口
- **MUST**: 使用 polite `aria-live` 处理 toasts/内联验证
- **SHOULD**: 省略号 (`…`) 用于打开后续的选项 ("Rename…") 和加载状态 ("Loading…")

### 触摸和拖拽

- **MUST**: 慷慨的目标，清晰的可供性; 避免挑剔的交互
- **MUST**: 延迟第一个 tooltip; 后续同级立即显示
- **MUST**: 模态/抽屉中 `overscroll-behavior: contain`
- **MUST**: 拖拽时禁用文本选择并设置 `inert`
- **MUST**: 如果看起来可点击，就必须可点击

### 自动聚焦

- **SHOULD**: 桌面单一主输入时自动聚焦; 移动端很少自动聚焦

---

## 动画 (Animation)

- **MUST**: 尊重 `prefers-reduced-motion` (提供减少动画变体或禁用)
- **SHOULD**: 优先 CSS > Web Animations API > JS 库
- **MUST**: 只动画合成器友好的属性 (`transform`, `opacity`)
- **NEVER**: 动画布局属性 (`top`, `left`, `width`, `height`)
- **NEVER**: `transition: all` - 明确列出属性
- **SHOULD**: 只在澄清因果关系或添加刻意愉悦时动画
- **SHOULD**: 根据变化选择缓动 (大小/距离/触发器)
- **MUST**: 动画可中断且由输入驱动 (无自动播放)
- **MUST**: 正确的 `transform-origin` (动作从"物理"起点开始)
- **MUST**: SVG 变换在 `<g>` 包装器上，设置 `transform-box: fill-box`

---

## 布局 (Layout)

- **SHOULD**: 光学对齐; 当感知胜过几何时调整 ±1px
- **MUST**: 刻意对齐到网格/基线/边缘 - 无意外定位
- **SHOULD**: 平衡图标/文本锁定 (权重/大小/间距/颜色)
- **MUST**: 验证移动端、笔记本、超宽屏 (50% 缩放模拟超宽)
- **MUST**: 尊重安全区域 (`env(safe-area-inset-*)`)
- **MUST**: 避免不需要的滚动条; 修复溢出问题
- **SHOULD**: Flex/grid 优于 JS 测量布局

---

## 内容和可访问性 (Content & Accessibility)

- **SHOULD**: 内联帮助优先; tooltip 最后手段
- **MUST**: 骨架屏镜像最终内容以避免布局偏移
- **MUST**: `<title>` 匹配当前上下文
- **MUST**: 无死胡同; 总是提供下一步/恢复路径
- **MUST**: 设计空/稀疏/密集/错误状态
- **SHOULD**: 弯引号 (" "); 避免孤字 (`text-wrap: balance`)
- **MUST**: 数字比较用 `font-variant-numeric: tabular-nums`
- **MUST**: 冗余状态提示 (不仅靠颜色); 图标有文本标签
- **MUST**: 即使视觉省略标签，可访问名称也存在
- **MUST**: 使用 `…` 字符 (不是 `...`)
- **MUST**: 标题设置 `scroll-margin-top`; "Skip to content" 链接; 层级 `<h1>`–`<h6>`
- **MUST**: 对用户生成内容有弹性 (短/中/很长)
- **MUST**: 本地化日期/时间/数字 (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- **MUST**: 准确的 `aria-label`; 装饰元素 `aria-hidden`
- **MUST**: 纯图标按钮有描述性 `aria-label`
- **MUST**: 优先原生语义 (`button`, `a`, `label`, `table`) 再用 ARIA
- **MUST**: 不换行空格: `10&nbsp;MB`, `⌘&nbsp;K`, 品牌名

### 内容处理

- **MUST**: 文本容器处理长内容 (`truncate`, `line-clamp-*`, `break-words`)
- **MUST**: Flex 子元素需要 `min-w-0` 允许截断
- **MUST**: 处理空状态 - 空字符串/数组不破坏 UI

---

## 性能 (Performance)

- **SHOULD**: 测试 iOS 低电量模式和 macOS Safari
- **MUST**: 可靠测量 (禁用影响运行时的扩展)
- **MUST**: 跟踪并最小化重渲染 (React DevTools/React Scan)
- **MUST**: 使用 CPU/网络节流分析
- **MUST**: 批量布局读/写; 避免 reflows/repaints
- **MUST**: 变更 (`POST`/`PATCH`/`DELETE`) 目标 <500ms
- **SHOULD**: 优先非受控输入; 受控输入每次按键要便宜
- **MUST**: 虚拟化大列表 (>50 项)
- **MUST**: 预加载首屏图片; 懒加载其余
- **MUST**: 防止 CLS (明确图片尺寸)
- **SHOULD**: CDN 域名 `<link rel="preconnect">`
- **SHOULD**: 关键字体: `<link rel="preload" as="font">` 配合 `font-display: swap`

---

## 暗色模式和主题 (Dark Mode & Theming)

- **MUST**: 暗色主题在 `<html>` 上设置 `color-scheme: dark`
- **SHOULD**: `<meta name="theme-color">` 匹配页面背景
- **MUST**: 原生 `<select>`: 明确设置 `background-color` 和 `color` (Windows 修复)

---

## Hydration

- **MUST**: 带 `value` 的输入需要 `onChange` (或使用 `defaultValue`)
- **SHOULD**: 防止日期/时间渲染的 hydration 不匹配

---

## 设计 (Design)

- **SHOULD**: 分层阴影 (环境光 + 直射光)
- **SHOULD**: 清晰边缘通过半透明边框 + 阴影
- **SHOULD**: 嵌套圆角: 子 ≤ 父; 同心
- **SHOULD**: 色调一致性: 边框/阴影/文本倾向背景色调
- **MUST**: 可访问图表 (色盲友好调色板)
- **MUST**: 满足对比度 - 优先 [APCA](https://apcacontrast.com/) 而非 WCAG 2
- **MUST**: `:hover`/`:active`/`:focus` 增加对比度
- **SHOULD**: 匹配浏览器 UI 到背景
- **SHOULD**: 避免渐变条带 (需要时使用遮罩)

---

## Vercel 特定文案规范

- **主动语态**: "Install the CLI" 而非 "The CLI will be installed"
- **标题和按钮用 Title Case** (Chicago 风格)
- **清晰简洁**: 尽可能少的词
- **优先 `&` 而非 `and`**
- **行动导向语言**: "Install the CLI…" 而非 "You will need the CLI…"
- **第二人称**: 避免第一人称
- **数字和单位间加空格**: `10 MB` 而非 `10MB` (用 `&nbsp;`)
- **默认正面语言**: 即使错误也要鼓励、解决问题
- **错误消息指导出路**: 不只说出了什么问题 - 告诉用户如何修复
- **避免歧义**: 标签清晰具体，"Save API Key" 而非 "Continue"

---

## 使用方式

在聊天中引用: `#skills-web-interface-guidelines`

触发词: UI设计、界面规范、可访问性、a11y、响应式

---

## 参考链接

- https://github.com/vercel-labs/web-interface-guidelines
- https://www.w3.org/WAI/ARIA/apg/patterns/
- https://apcacontrast.com/

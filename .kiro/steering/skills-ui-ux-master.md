---
inclusion: manual
---

# UI/UX Master - 综合前端开发工具

> 从 Claude Code Skills 迁移

## 触发词
- "美化"、"设计"、"优化"、"升级"
- "UI"、"界面"、"好看"、"漂亮"
- "页面设计"、"CSS布局"、"颜色搭配"
- "响应式"、"组件开发"、"样式优化"

## 核心功能

### 1. 前端设计
- CSS 布局设计
- 颜色搭配方案
- 响应式设计
- 视觉层次规划
- 动画效果设计

### 2. 组件开发
- React/Vue/原生组件
- 响应式 UI 组件
- 交互效果实现
- 状态管理集成
- 可复用组件库

### 3. 样式优化
- CSS 架构优化
- 性能优化
- 浏览器兼容性
- 移动端适配
- 暗黑模式支持

### 4. 用户体验
- 交互流程优化
- 加载状态设计
- 错误提示优化
- 可访问性 (a11y)
- 用户反馈机制

## 工作流程

### 阶段1: 需求分析
1. 分析用户需求和设计目标
2. 确定技术栈（React/Vue/PbootCMS）
3. 评估现有代码结构
4. 制定设计方案

### 阶段2: 设计规划
1. 设计色彩方案（主色调、辅助色、渐变和阴影）
2. 规划布局结构（响应式断点、网格系统、间距规范）
3. 设计交互效果（动画过渡、Hover状态、加载状态）

### 阶段3: 组件开发
```jsx
// React 示例
const Button = ({ variant, size, children, ...props }) => {
  return (
    <button className={`btn btn-${variant} btn-${size}`} {...props}>
      {children}
    </button>
  );
};
```

```css
/* 响应式布局 - 移动优先 */
.container {
  padding: 1rem;
}

@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 3rem;
  }
}
```

### 阶段4: 测试验证
1. 多设备测试
2. 浏览器兼容性
3. 性能优化
4. 可访问性检查

## 最佳实践

### 1. 移动优先
```css
/* ✅ 好的做法 */
.element { width: 100%; }
@media (min-width: 768px) { .element { width: 50%; } }

/* ❌ 不好的做法 */
.element { width: 50%; }
@media (max-width: 767px) { .element { width: 100%; } }
```

### 2. 语义化 HTML
```html
<!-- ✅ 好的做法 -->
<header><nav><ul><li><a href="/">首页</a></li></ul></nav></header>

<!-- ❌ 不好的做法 -->
<div class="header"><div class="nav"><div><a href="/">首页</a></div></div></div>
```

### 3. CSS 变量
```css
:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --spacing-unit: 8px;
  --border-radius: 8px;
}

.button {
  background: var(--color-primary);
  padding: calc(var(--spacing-unit) * 2);
  border-radius: var(--border-radius);
}
```

### 4. 可访问性
```html
<!-- ✅ 好的做法 -->
<button aria-label="关闭对话框" onclick="closeDialog()">
  <svg aria-hidden="true">...</svg>
</button>
<img src="logo.png" alt="公司Logo">

<!-- ❌ 不好的做法 -->
<div onclick="closeDialog()">×</div>
<img src="logo.png">
```

## 性能优化

### CSS 优化
- 使用 CSS Grid/Flexbox 替代 float
- 避免过度嵌套选择器
- 使用 transform 代替 top/left 动画
- 启用 GPU 加速（will-change）

### 图片优化
- 使用 WebP 格式
- 实现懒加载
- 使用 srcset 响应式图片
- 压缩图片大小

## 输出标准

### 必须包含
1. ✅ 完整的 HTML 结构
2. ✅ 响应式 CSS 样式
3. ✅ 交互 JavaScript 代码
4. ✅ 多设备测试说明
5. ✅ 浏览器兼容性说明

### 禁止输出
1. ❌ Demo 版本或半成品
2. ❌ 仅桌面端的设计
3. ❌ 缺少交互的静态页面
4. ❌ 未经测试的代码

# message/ - 消息渲染组件

> **AI 和用户消息的渲染引擎** | Markdown + 代码高亮 + 工具调用显示

---

## 概述

message/ 目录包含所有消息渲染相关组件，负责：
- AI 消息渲染（Markdown、代码高亮）
- 流式消息实时渲染
- 工具调用显示
- 思考过程可视化
- 子代理消息分组

---

## 目录结构

```
message/
├── AIMessage.tsx             # AI 消息渲染 ⭐
├── StreamMessageV2.tsx       # 流式消息渲染 V2 ⭐
├── ToolCallsGroup.tsx        # 工具调用组 ⭐
├── ThinkingBlock.tsx         # 思考块显示 ⭐
├── MessageBubble.tsx         # 消息气泡容器
├── MessageContent.tsx        # 消息内容渲染
├── MessageHeader.tsx         # 消息头部
├── MessageActions.tsx        # 消息操作按钮
├── MessageImagePreview.tsx   # 消息图片预览
├── SubagentMessageGroup.tsx  # 子代理消息组
├── SummaryMessage.tsx        # 摘要消息
├── SystemMessage.tsx         # 系统消息
├── ResultMessage.tsx         # 结果消息
└── index.ts                  # 统一导出
```

---

## 核心文件详解

### AIMessage.tsx - AI 消息渲染
**用途**: 渲染 AI 回复的消息

**主要功能**:
- Markdown 渲染
- 代码语法高亮
- 工具调用显示
- 思考过程展示
- 消息复制/编辑/删除

**视觉描述**:
- 位置: 主内容区域，靠左
- 外观: 白色/灰色气泡，圆角，有头像
- 内容: Markdown 格式，代码块有语法高亮

**组件结构**:
```tsx
<MessageBubble>
  <MessageHeader author="Claude" timestamp="..." />
  <MessageContent content={markdownContent} />
  {hasToolCalls && <ToolCallsGroup calls={toolCalls} />}
  {hasThinking && <ThinkingBlock thinking={thinkingContent} />}
  <MessageActions onCopy={...} onEdit={...} />
</MessageBubble>
```

**使用示例**:
```tsx
<AIMessage
  message={message}
  onCopy={handleCopy}
  onEdit={handleEdit}
/>
```

---

### StreamMessageV2.tsx - 流式消息渲染
**用途**: 实时渲染流式 AI 回复

**主要功能**:
- 逐字符流式渲染
- 实时 Markdown 解析
- 工具调用实时显示
- 思考过程实时更新
- 自动滚动

**关键 Hook**:
- `useSessionStream` - 流式数据处理
- `useSmartAutoScroll` - 智能滚动

**性能优化**:
- 使用 `React.memo` 避免不必要的重新渲染
- 虚拟化长消息列表

---

### ToolCallsGroup.tsx - 工具调用组
**用途**: 显示 AI 使用的工具调用

**工具类型**:
- `Bash` - 命令执行
- `Read` - 文件读取
- `Write` - 文件写入
- `Edit` - 文件编辑
- `Grep` - 代码搜索
- `Glob` - 文件匹配
- `WebFetch` - 网络请求
- `LSP` - 语言服务器

**视觉描述**:
- 位置: AI 消息下方
- 外观: 可折叠的工具卡片
- 内容: 工具名称、参数、结果

**使用示例**:
```tsx
<ToolCallsGroup
  calls={[
    {
      type: 'Read',
      name: 'read_file',
      input: { file_path: '/path/to/file.ts' },
      output: '文件内容...'
    }
  ]}
/>
```

**添加新工具类型**:
1. 在 `types/claude.ts` 中添加工具类型定义
2. 在 `ToolCallsGroup.tsx` 中添加渲染逻辑

---

### ThinkingBlock.tsx - 思考块显示
**用途**: 显示 AI 的思考过程（Extended Thinking）

**主要功能**:
- 展示思考内容
- 可折叠显示
- 思考时间统计
- 思考步骤可视化

**视觉描述**:
- 位置: AI 消息内部或单独显示
- 外观: 灰色背景，斜体文本
- 交互: 点击展开/折叠

**使用示例**:
```tsx
<ThinkingBlock
  thinking="思考内容..."
  duration={1500}
  collapsed={false}
/>
```

---

### MessageBubble.tsx - 消息气泡容器
**用途**: 消息的容器组件

**主要功能**:
- 提供气泡样式
- 区分 AI/用户消息
- 头像显示
- 阴影和边框

**Props**:
```tsx
interface MessageBubbleProps {
  type: 'ai' | 'user'    // 消息类型
  children: ReactNode    // 子组件
  avatar?: string        // 头像 URL
  className?: string     // 自定义样式
}
```

---

### MessageContent.tsx - 消息内容渲染
**用途**: 渲染 Markdown 内容

**依赖库**:
- `react-markdown` - Markdown 解析
- `react-syntax-highlighter` - 代码高亮
- `remark-gfm` - GitHub Flavored Markdown

**主要功能**:
- Markdown 渲染
- 代码块语法高亮
- 表格支持
- 链接处理
- 图片渲染

**代码块语言支持**:
- JavaScript, TypeScript
- Python, Rust, Go
- Java, C++, C#
- HTML, CSS, SCSS
- Markdown, YAML, JSON
- Shell, Bash, PowerShell

**修改代码高亮主题**:
在组件中修改 `codeStyle` 属性：
```tsx
<SyntaxHighlighter
  style={atomDark}  // 修改为其他主题
  language={lang}
  customStyle={{ ... }}
>
  {code}
</SyntaxHighlighter>
```

---

### MessageHeader.tsx - 消息头部
**用途**: 显示消息元信息

**主要功能**:
- 显示发送者名称
- 显示时间戳
- 显示消息状态（发送中/已送达/失败）

**时间戳格式**:
- 今天: "HH:mm"
- 昨天: "昨天 HH:mm"
- 本周: "星期X HH:mm"
- 更早: "YYYY-MM-DD HH:mm"

---

### MessageActions.tsx - 消息操作按钮
**用途**: 提供消息操作功能

**操作按钮**:
- **复制**: 复制消息内容到剪贴板
- **编辑**: 编辑消息（用户消息）
- **删除**: 删除消息
- **重新生成**: 重新生成 AI 回复
- **分享**: 分享消息

**视觉描述**:
- 位置: 消息右上角（悬停显示）
- 外观: 图标按钮，工具提示

---

### SubagentMessageGroup.tsx - 子代理消息组
**用途**: 分组显示子代理的消息

**主要功能**:
- 子代理消息折叠/展开
- 显示子代理名称和状态
- 子消息递归渲染

**视觉描述**:
- 位置: AI 消息内部
- 外观: 嵌套缩进，可折叠

---

## 常见修改场景

### 场景 1: 修改消息气泡样式
**文件**: `MessageBubble.tsx`
**步骤**:
1. 找到气泡容器的 `className`
2. 修改 Tailwind CSS 类名
3. 或在 `src/index.css` 添加自定义样式

### 场景 2: 添加新的工具类型显示
**文件**: `ToolCallsGroup.tsx`
**步骤**:
1. 在 `types/claude.ts` 添加工具类型
2. 在 `ToolCallsGroup` 中添加 switch case
3. 定义工具的渲染组件

### 场景 3: 修改代码高亮主题
**文件**: `MessageContent.tsx`
**步骤**:
1. 导入新的主题（从 `react-syntax-highlighter/dist/esm/styles/prism`）
2. 修改 `style` 属性

### 场景 4: 修改 Markdown 渲染规则
**文件**: `MessageContent.tsx`
**步骤**:
1. 找到 `components` prop
2. 修改自定义组件映射

---

## 消息类型

### AIMessage (AI 回复)
```typescript
interface AIMessage {
  role: 'assistant'
  content: string          // Markdown 内容
  toolCalls?: ToolCall[]   // 工具调用
  thinking?: string        // 思考过程
  subagents?: Message[]    // 子代理消息
}
```

### UserMessage (用户输入)
```typescript
interface UserMessage {
  role: 'user'
  content: string        // 文本内容
  attachments?: File[]   // 附件
}
```

### SystemMessage (系统消息)
```typescript
interface SystemMessage {
  role: 'system'
  content: string
  type: 'info' | 'warning' | 'error'
}
```

---

## 消息渲染流程

```
消息数据 (JSON)
  ↓
StreamMessageV2 / AIMessage
  ↓
MessageBubble (容器)
  ├─ MessageHeader (头部)
  ├─ MessageContent (Markdown 渲染)
  ├─ ToolCallsGroup (工具调用)
  ├─ ThinkingBlock (思考过程)
  └─ MessageActions (操作按钮)
```

---

## 性能优化

### 虚拟化
长消息列表使用 TanStack React Virtual 虚拟化

### Memo
```tsx
const AIMessage = React.memo(({ message }) => {
  // 组件逻辑
}, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id
})
```

### 延迟渲染
- 代码块懒加载
- 图片懒加载
- 工具调用折叠

---

## 可访问性

- 使用语义化 HTML（`<article>`, `<time>`, `<button>`）
- ARIA 标签（`aria-label`, `role`）
- 键盘导航支持
- 屏幕阅读器友好

---

**最后更新**: 2025-12-27
**文件数**: 13 个核心文件

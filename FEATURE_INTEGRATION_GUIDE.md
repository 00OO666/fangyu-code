# 🎨 新功能集成指南

本指南介绍如何将新开发的所有功能集成到 Fangyu-Code 中。

---

## 📦 安装依赖

首先安装所需的 npm 包：

```bash
cd F:\Any-Code-Dev

# 必需依赖
npm install reactflow dagre uuid framer-motion anser @monaco-editor/react react-markdown react-syntax-highlighter

# 类型定义
npm install -D @types/dagre @types/uuid @types/react-syntax-highlighter

# 可选依赖（用于 PDF 和 OCR）
npm install pdf-parse tesseract.js
```

---

## 🎯 功能模块清单

### 1. **多代理工作流系统**（已完成）

**组件位置:**
- `src/core/planning/TaskPlanner.ts` - 任务规划器
- `src/core/agents/AgentSwarmManager.ts` - 多代理管理
- `src/core/sandbox/SandboxManager.ts` - Docker 沙盒
- `src/components/workflow/DAGVisualizer.tsx` - 工作流可视化
- `src/components/workflow/WorkflowControlPanel.tsx` - 控制面板
- `src/hooks/agents/useWorkflowOrchestrator.ts` - 编排 Hook

**集成方式:**

```tsx
// 在 App.tsx 或路由中添加
import { WorkflowControlPanel } from '@/components/workflow';

// 添加到视图类型
type View =
  | 'projects'
  | 'multi-agent-workflow'  // 新增
  | ...;

// 在渲染逻辑中
function renderView() {
  switch (currentView) {
    case 'multi-agent-workflow':
      return <WorkflowControlPanel />;
    // ... 其他 case
  }
}
```

**侧边栏配置:**

```tsx
// 在 Sidebar.tsx 中添加
import { Workflow } from 'lucide-react';

const mainNavItems: NavItem[] = [
  // ... 现有项
  {
    view: 'multi-agent-workflow',
    icon: Workflow,
    label: '多代理工作流'
  },
];
```

**详细文档:** `QUICK_START_MULTI_AGENT.md`

---

### 2. **Canvas 实时渲染**（Gemini 风格）

**组件位置:**
- `src/components/canvas/CanvasRenderer.tsx`

**功能:**
- 支持 HTML/JSX/TSX/Markdown/SVG
- 实时预览（防抖）
- 代码/预览/分屏模式
- Monaco Editor 集成

**使用示例:**

```tsx
import { CanvasRenderer } from '@/components/canvas';

function CodePlayground() {
  return (
    <CanvasRenderer
      language="tsx"
      initialCode={`function App() {\n  return <div>Hello World</div>;\n}`}
      livePreview={true}
      onCodeChange={(code) => console.log('Code changed:', code)}
    />
  );
}
```

**集成建议:**
- 可以作为 Claude 代码输出的实时预览窗口
- 在消息流中检测到代码块时自动触发
- 添加"在 Canvas 中打开"按钮

---

### 3. **Monaco Diff 编辑器**

**组件位置:**
- `src/components/editor/MonacoDiffEditor.tsx`

**功能:**
- 并排对比代码变更
- 高亮新增/删除/修改
- 统计差异（+/-）
- 一键接受/拒绝修改

**使用示例:**

```tsx
import { MonacoDiffEditor } from '@/components/editor';

function CodeReview() {
  return (
    <MonacoDiffEditor
      original={originalCode}
      modified={modifiedCode}
      filePath="src/App.tsx"
      onAccept={(newCode) => {
        // 应用修改
        applyChanges(newCode);
      }}
      onReject={() => {
        // 拒绝修改
        console.log('Changes rejected');
      }}
    />
  );
}
```

**集成场景:**
- Claude 建议代码修改时
- Git 差异对比
- 代码审查功能

---

### 4. **智能输出解析器**

**组件位置:**
- `src/components/output/SmartOutputParser.tsx`

**功能:**
- 自动检测输出类型（JSON、表格、Git 日志、测试结果、ANSI）
- 渲染对应的可视化
- 原始/智能视图切换

**使用示例:**

```tsx
import { SmartOutputParser } from '@/components/output';

function TerminalOutput({ output, command }) {
  return (
    <SmartOutputParser
      output={output}
      command={command}  // 用于类型推断
      showRawToggle={true}
    />
  );
}
```

**集成位置:**
- 替换现有的 `<pre>` 代码块输出
- 在 `StreamMessageV2.tsx` 或 `AIMessage.tsx` 中使用
- 工具调用结果展示

---

### 5. **文件树浏览器**

**组件位置:**
- `src/components/explorer/FileTreeExplorer.tsx`

**功能:**
- 虚拟化滚动（大型目录）
- 懒加载
- 右键上下文菜单
- 搜索过滤
- 多选支持
- .gitignore 过滤

**使用示例:**

```tsx
import { FileTreeExplorer } from '@/components/explorer';

function FileExplorer() {
  return (
    <FileTreeExplorer
      rootPath="/path/to/project"
      showHiddenFiles={false}
      onFileSelect={(file) => {
        console.log('Selected:', file);
      }}
      onFileOpen={(file) => {
        // 打开文件
        openInEditor(file.path);
      }}
      onContextAction={(action, files) => {
        switch (action) {
          case 'delete':
            deleteFiles(files);
            break;
          case 'rename':
            renameFile(files[0]);
            break;
          // ... 其他操作
        }
      }}
    />
  );
}
```

**集成建议:**
- 添加到侧边栏作为新的视图选项
- 与 Claude 交互时快速选择文件
- 项目浏览功能

---

### 6. **多模态输入**

**组件位置:**
- `src/components/input/MultiModalInput.tsx`

**功能:**
- 截图粘贴（Ctrl+V）
- 图片上传/拖拽
- PDF 文件上传和文本提取
- OCR 文本识别
- 图片预览和编辑

**使用示例:**

```tsx
import { MultiModalInput } from '@/components/input';

function ChatInput() {
  const [files, setFiles] = useState([]);

  return (
    <MultiModalInput
      files={files}
      onChange={setFiles}
      maxFiles={5}
      maxFileSize={10 * 1024 * 1024} // 10MB
      enableOCR={true}
      enableScreenCapture={true}
    />
  );
}
```

**集成位置:**
- 在 `InputArea.tsx` 中添加为附加功能
- 支持图片和 PDF 作为上下文
- 与 Claude Vision API 结合

---

### 7. **AI Copilot 侧边栏**

**组件位置:**
- `src/components/copilot/CopilotSidebar.tsx`

**功能:**
- 智能代码建议
- 上下文感知对话
- 斜杠命令（/explain, /refactor, /test 等）
- 快速操作
- 对话历史

**使用示例:**

```tsx
import { CopilotSidebar } from '@/components/copilot';

function MainLayout() {
  const [showCopilot, setShowCopilot] = useState(false);

  return (
    <div className="flex h-screen">
      <main className="flex-1">
        {/* 主内容 */}
      </main>

      <CopilotSidebar
        isOpen={showCopilot}
        onClose={() => setShowCopilot(false)}
        context={{
          filePath: currentFile,
          selectedCode: selectedText,
          language: 'typescript'
        }}
        onSend={(message, context) => {
          // 发送到 Claude API
          sendToClaude(message, context);
        }}
        onApplyCode={(code, language) => {
          // 应用代码到编辑器
          applyToEditor(code);
        }}
      />
    </div>
  );
}
```

**集成建议:**
- 添加快捷键切换（如 Ctrl+Shift+P）
- 固定/浮动模式切换
- 与主对话窗口联动

---

## 🔌 完整集成示例

以下是在 `App.tsx` 中集成所有功能的完整示例：

```tsx
import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Sidebar } from './components/layout/Sidebar';
import { WorkflowControlPanel } from './components/workflow';
import { FileTreeExplorer } from './components/explorer';
import { CopilotSidebar } from './components/copilot';

type View =
  | 'projects'
  | 'multi-agent-workflow'
  | 'file-explorer'
  | 'canvas-playground'
  | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('projects');
  const [showCopilot, setShowCopilot] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'multi-agent-workflow':
        return <WorkflowControlPanel />;

      case 'file-explorer':
        return (
          <FileTreeExplorer
            rootPath={getCurrentProjectPath()}
            onFileOpen={handleFileOpen}
          />
        );

      case 'canvas-playground':
        return (
          <CanvasRenderer
            language="tsx"
            livePreview={true}
          />
        );

      default:
        return <ProjectsView />;
    }
  };

  return (
    <div className="flex h-screen">
      {/* 侧边栏 */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* 主内容 */}
      <main className="flex-1 overflow-hidden">
        {renderView()}
      </main>

      {/* Copilot 侧边栏 */}
      <CopilotSidebar
        isOpen={showCopilot}
        onClose={() => setShowCopilot(false)}
      />
    </div>
  );
}

export default App;
```

---

## 🎨 UI 集成要点

### 1. 在现有消息流中集成智能输出

修改 `StreamMessageV2.tsx` 或 `AIMessage.tsx`:

```tsx
import { SmartOutputParser } from '@/components/output';

// 在渲染代码块时
if (block.type === 'code' && block.language === 'bash') {
  // 如果是命令输出，使用智能解析器
  return (
    <SmartOutputParser
      output={block.output}
      command={block.code}
    />
  );
} else {
  // 普通代码块，提供 Canvas 选项
  return (
    <div className="relative group">
      <pre>{block.code}</pre>
      <Button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
        onClick={() => openInCanvas(block.code, block.language)}
      >
        在 Canvas 中打开
      </Button>
    </div>
  );
}
```

### 2. 在输入框添加多模态支持

修改 `InputArea.tsx`:

```tsx
import { MultiModalInput } from '@/components/input';

function InputArea() {
  const [mediaFiles, setMediaFiles] = useState([]);

  return (
    <div className="space-y-2">
      {/* 多模态输入 */}
      <MultiModalInput
        files={mediaFiles}
        onChange={setMediaFiles}
        maxFiles={3}
      />

      {/* 原有的文本输入 */}
      <Textarea
        placeholder="输入消息..."
        onSubmit={() => {
          // 发送时包含媒体文件
          sendMessage(text, mediaFiles);
        }}
      />
    </div>
  );
}
```

### 3. 添加 Diff 对比视图

在 Claude 建议修改时：

```tsx
// 在工具调用处理中
if (tool.name === 'Edit' || tool.name === 'Write') {
  return (
    <MonacoDiffEditor
      original={tool.params.old_string}
      modified={tool.params.new_string}
      filePath={tool.params.file_path}
      onAccept={(code) => {
        // 应用修改
        applyEdit(code);
      }}
      onReject={() => {
        // 忽略修改
        console.log('Edit rejected');
      }}
    />
  );
}
```

---

## 🚀 渐进式集成策略

建议按以下顺序逐步集成：

1. **第一阶段（核心增强）**
   - ✅ 智能输出解析器 - 替换现有输出
   - ✅ Monaco Diff 编辑器 - 增强代码修改体验

2. **第二阶段（交互增强）**
   - ✅ 多模态输入 - 支持截图和文件
   - ✅ AI Copilot 侧边栏 - 提供快捷操作

3. **第三阶段（高级功能）**
   - ✅ Canvas 实时渲染 - 代码可视化
   - ✅ 文件树浏览器 - 项目管理

4. **第四阶段（革命性功能）**
   - ✅ 多代理工作流系统 - 复杂任务自动化

---

## 🔧 后续优化建议

### 1. 性能优化

```tsx
// 使用 React.lazy 和 Suspense 延迟加载大型组件
const WorkflowControlPanel = lazy(() => import('@/components/workflow'));
const MonacoDiffEditor = lazy(() => import('@/components/editor'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      {/* 组件 */}
    </Suspense>
  );
}
```

### 2. Tauri 集成

```rust
// src-tauri/src/commands/file_explorer.rs
#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    // 读取目录实现
}

#[tauri::command]
pub async fn screenshot_capture() -> Result<String, String> {
    // 截图实现
}
```

### 3. 持久化配置

```tsx
// 保存用户偏好
localStorage.setItem('copilot_enabled', 'true');
localStorage.setItem('canvas_mode', 'split');
localStorage.setItem('show_hidden_files', 'false');
```

---

## 📝 API 密钥配置

确保已配置 Claude API 密钥：

```javascript
// localStorage 配置
localStorage.setItem('claude_api_key', 'sk-your-api-key');
localStorage.setItem('claude_api_base_url', 'https://hongmacode.com/api');

// 或在设置界面添加配置项
```

---

## 🎉 完成！

现在你的 Fangyu-Code 已经拥有了：

- ✅ 多代理自动化编程系统
- ✅ 实时代码预览（Gemini 风格）
- ✅ 智能 Diff 对比
- ✅ 智能输出解析
- ✅ 文件树浏览器
- ✅ 多模态输入（截图/图片/PDF）
- ✅ AI Copilot 助手

这些功能让 Fangyu-Code 成为一个功能强大的 AI 驱动开发工具！

如有任何问题，请参考各组件的源代码注释或提交 issue。

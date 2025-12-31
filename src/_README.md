# src/ - 前端源码目录

> **React + TypeScript 前端代码** | Fangyu Code 的用户界面层

---

## 目录结构

```
src/
├── components/          # 85+ React 组件 ⭐
├── hooks/               # 35 个自定义 Hook ⭐
├── contexts/            # 8 个 React Context
├── lib/                 # 工具库和服务 ⭐
├── types/               # TypeScript 类型定义
├── i18n/                # 国际化配置
├── config/              # 配置文件
├── pages/               # 页面组件
├── assets/              # 静态资源
├── styles/              # 全局样式
├── App.tsx              # 应用主组件
├── main.tsx             # React 入口
└── index.css            # 全局样式
```

---

## 核心目录说明

### 📦 components/ - 组件库
**85+ 个 React 组件**，包含：
- **FloatingPromptInput/** - 用户输入核心 (15 个文件)
- **message/** - 消息渲染组件 (13 个文件)
- **layout/** - 布局组件 (4 个文件)
- **session/** - 会话管理组件
- **dialogs/** - 对话框组件 (4 个文件)
- **editor/** - 编辑器组件
- **settings/** - 设置组件
- **ui/** - 基础 UI 组件 (Radix UI)
- **widgets/** - 功能小部件
- **icons/** - 图标组件
- **common/** - 通用组件
- **skeletons/** - 加载骨架屏
- **sync/** - 同步组件

**详细文档**: `components/_README.md`

---

### 🔧 hooks/ - 自定义 Hook 库
**35 个自定义 Hook**，核心包括：
- `useSessionStream.ts` - 流式处理核心
- `useSmartSession.ts` - 智能会话管理
- `usePromptExecution.ts` - 提示执行
- `useMessageTranslation.ts` - 消息翻译
- `useExtendedThinking.ts` - 扩展思考
- `usePluginLoader.ts` - 插件加载
- `useTabs.ts` - 标签页管理

**详细文档**: `hooks/_README.md`

---

### 📚 lib/ - 工具库和服务
**40+ 个工具模块**，核心包括：
- `api.ts` - API 调用层
- `pricing.ts` - 定价逻辑
- `tokenCounter.ts` - Token 计数
- `translationMiddleware.ts` - 翻译中间件
- `stream/` - 流式处理核心
- `services/llmApiService.ts` - LLM API 服务

**详细文档**: `lib/_README.md`

---

### 🌐 contexts/ - React Context
**8 个 Context Provider**：
1. `MessagesContext.tsx` - 消息状态管理
2. `NavigationContext.tsx` - 导航状态
3. `PlanModeContext.tsx` - 计划模式
4. `ProjectContext.tsx` - 项目状态
5. `SessionContext.tsx` - 会话状态
6. `ThemeContext.tsx` - 主题状态
7. `UpdateContext.tsx` - 更新状态
8. `UserQuestionContext.tsx` - 用户问题状态

---

### 📝 types/ - TypeScript 类型定义
**11+ 个类型文件**：
- `claude.ts` - Claude API 类型
- `codex.ts` - Codex API 类型
- `completion.ts` - 自动补全类型
- `contextWindow.ts` - 上下文窗口类型
- `hooks.ts` - Hook 类型
- `plugins.ts` - 插件类型

---

### 🌍 i18n/ - 国际化
**3 种语言支持**：
- `locales/zh-CN/` - 简体中文
- `locales/zh-TW/` - 繁体中文
- `locales/en/` - 英文

**配置文件**: `i18n/index.ts`

---

### ⚙️ config/ - 配置文件
- `codexProviderPresets.ts` - Codex Provider 预设
- `geminiProviderPresets.ts` - Gemini Provider 预设

---

### 📄 pages/ - 页面组件
- `SessionWindow.tsx` - 会话窗口页面
- `PluginDemo.tsx` - 插件演示页面

---

## 核心文件

| 文件 | 作用 | 修改频率 |
|------|------|---------|
| `App.tsx` | 应用主组件，Context 嵌套 | 低 |
| `main.tsx` | React 入口，挂载根组件 | 低 |
| `index.css` | 全局样式和 Tailwind 配置 | 中 |
| `vite-env.d.ts` | Vite 环境类型定义 | 低 |

---

## App.tsx 结构

```tsx
function App() {
  return (
    <UpdateProvider>           {/* 更新检测 */}
      <OutputCacheProvider>    {/* 输出缓存 */}
        <NavigationProvider>   {/* 导航状态 */}
          <ProjectProvider>    {/* 项目状态 */}
            <TabProvider>      {/* 标签页管理 */}
              <AppLayout>      {/* 主布局 */}
                <ViewRouter /> {/* 视图路由 */}
              </AppLayout>
            </TabProvider>
          </ProjectProvider>
        </NavigationProvider>
      </OutputCacheProvider>
    </UpdateProvider>
  );
}
```

**Context 嵌套顺序**: 外层为全局状态，内层为页面状态

---

## 技术栈

### 核心框架
- **React**: 18.3.1
- **TypeScript**: 5.9.3
- **Vite**: 6.0.3

### UI 组件库
- **Radix UI**: 无头组件库
  - Dialog, Dropdown, Checkbox, RadioGroup, Select, Slider, Switch, Tabs, Toast, Tooltip 等
- **Lucide React**: 图标库

### 样式方案
- **Tailwind CSS**: 4.1.8
- **Framer Motion**: 12.23.24 (动画)
- **class-variance-authority**: CSS 变体管理
- **clsx / tailwind-merge**: 类名合并

### Markdown 和代码高亮
- **react-markdown**: 9.0.3
- **react-md-editor**: 4.0.8
- **react-syntax-highlighter**: 15.6.1
- **remark-gfm**: 4.0.0 (GitHub Flavored Markdown)
- **diff**: 8.0.2 (差异对比)

### 虚拟化
- **TanStack React Virtual**: 3.13.12

### 国际化
- **i18next**: 25.6.0
- **react-i18next**: 15.6.0
- **i18next-browser-languagedetector**: 8.2.0

### AI SDK
- **@anthropic-ai/sdk**: ^0.68.0
- **@anthropic-ai/claude-agent-sdk**: ^0.1.30

### Tauri 集成
- **@tauri-apps/api**: 2.9.0
- **@tauri-apps/plugin-***: 多个插件

---

## 代码组织原则

### 组件组织
- **目录组件**: 复杂组件放在独立目录（如 `FloatingPromptInput/`）
- **单文件组件**: 简单组件直接在 `components/` 根目录
- **UI 基础组件**: 放在 `components/ui/`

### Hook 组织
- **功能 Hook**: 按功能命名（如 `useSessionStream`）
- **UI Hook**: UI 相关 Hook（如 `useSmartAutoScroll`）
- **工具 Hook**: 工具类 Hook（如 `useGlobalEvents`）

### 样式组织
- **全局样式**: `index.css`
- **组件样式**: Tailwind 实用类
- **动画**: Framer Motion

---

## 常见修改场景

### 添加新组件
1. 在 `components/` 下创建 `MyComponent.tsx`
2. 如果组件复杂，创建 `MyComponent/` 目录
3. 使用 TypeScript + React.FC
4. 使用 Tailwind CSS 样式

### 添加新 Hook
1. 在 `hooks/` 下创建 `useMyHook.ts`
2. 遵循 React Hooks 规则
3. 添加 TypeScript 类型定义

### 添加新页面
1. 在 `pages/` 下创建页面组件
2. 在 `ViewRouter.tsx` 中添加路由

### 添加新的 Context
1. 在 `contexts/` 下创建 Context
2. 在 `App.tsx` 中添加 Provider

### 修改全局样式
1. 编辑 `index.css`
2. 或在 `tailwind.config.js` 中配置主题

---

## 性能优化

### 虚拟化
- 使用 TanStack React Virtual 处理长列表
- `message/` 中的消息列表使用虚拟化

### Memo 和 Callback
- 使用 `React.memo` 避免不必要的重新渲染
- 使用 `useMemo` 和 `useCallback` 缓存计算结果

### 代码分割
- 使用动态 import 延迟加载
- Vite 自动进行代码分割

---

## 开发规范

### TypeScript
- 严格模式启用
- 所有组件和 Hook 都有类型定义
- 避免使用 `any`

### 组件规范
- 函数式组件 + Hooks
- Props 使用 interface 定义
- 导出使用 named export（避免 default export）

### 样式规范
- 优先使用 Tailwind 实用类
- 复杂样式使用 CSS Modules
- 避免内联样式

### 命名规范
- 组件: PascalCase
- Hook: camelCase with `use` prefix
- 文件: 与导出的主要内容同名

---

**最后更新**: 2025-12-27

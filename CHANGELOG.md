# Fangyu Code 更新日志

所有重要的项目变更都会记录在此文件中。

---

## [v2.0.0] - 2026-01-02

### 🎉 重大更新：聊天历史回溯系统

**核心功能**:
- 📚 **FTS5 全文搜索** - 输入关键词找到历史对话
- 💾 **自动保存** - 所有对话存入 SQLite，WAL 模式 + 6 项索引优化
- 📊 **会话统计** - Token 使用量、数据库大小、会话数
- 🎯 **上下文加载** - 点击搜索结果立即恢复历史
- 🔮 **Phase 2 预留** - 向量 embedding 字段（语义搜索）

**文件变更**:
- 新增 src-tauri/src/commands/chat_history.rs - 后端完整实现
- 新增 src/components/HistorySearchPanel.tsx - 历史搜索面板
- 新增 src/hooks/useChatHistorySaver.ts - 消息自动保存 Hook

### ⭐ 改进
- 🔧 MCP 状态持久化修复
- 📋 搜索面板智能排序优化
- 🎯 工具推荐算法提升

---

## [v1.2.0] - 2025-12-28

### 🎉 重大新增功能

#### 1. **多代理工作流系统**（革命性）
- ✨ 智能任务分解和 DAG 工作流生成
- ✨ 支持最多 20 个并行代理执行
- ✨ 代理自动克隆和负载均衡
- ✨ Docker 沙盒环境隔离
- ✨ React Flow 可视化工作流
- ✨ 实时进度追踪和日志记录
- 📁 核心文件:
  - `src/core/planning/TaskPlanner.ts`
  - `src/core/agents/AgentSwarmManager.ts`
  - `src/core/sandbox/SandboxManager.ts`
  - `src/components/workflow/DAGVisualizer.tsx`
  - `src/components/workflow/WorkflowControlPanel.tsx`

#### 2. **Canvas 实时渲染**（Gemini 风格）
- ✨ 支持 HTML/JSX/TSX/Markdown/SVG 实时预览
- ✨ 三种显示模式：代码/预览/分屏
- ✨ Monaco Editor 集成
- ✨ 自动运行（防抖）
- ✨ 错误边界和安全沙盒
- 📁 `src/components/canvas/CanvasRenderer.tsx`

#### 3. **Monaco Diff 编辑器**
- ✨ 并排代码对比视图
- ✨ 高亮新增/删除/修改行
- ✨ 差异统计（+X -Y 行）
- ✨ 一键接受/拒绝修改
- ✨ 语言自动检测
- 📁 `src/components/editor/MonacoDiffEditor.tsx`

#### 4. **智能输出解析器**
- ✨ 自动检测输出类型（JSON/表格/Git/测试结果/ANSI）
- ✨ 智能渲染对应可视化
- ✨ 原始/智能视图切换
- ✨ 语法高亮和格式化
- 📁 `src/components/output/SmartOutputParser.tsx`

#### 5. **文件树浏览器**
- ✨ 虚拟化滚动（支持大型目录）
- ✨ 懒加载子目录
- ✨ 右键上下文菜单（复制/粘贴/重命名/删除）
- ✨ 搜索和过滤
- ✨ 多选支持
- ✨ .gitignore 智能过滤
- ✨ 文件类型图标
- 📁 `src/components/explorer/FileTreeExplorer.tsx`

#### 6. **多模态输入**
- ✨ 截图粘贴（Ctrl+V）
- ✨ 图片拖拽上传
- ✨ PDF 文件上传和文本提取
- ✨ OCR 文本识别（可选）
- ✨ 图片预览和编辑（缩放、旋转）
- ✨ 文件管理
- 📁 `src/components/input/MultiModalInput.tsx`

#### 7. **AI Copilot 侧边栏**
- ✨ 上下文感知对话
- ✨ 斜杠命令（/explain, /refactor, /test, /fix 等）
- ✨ 快速操作面板
- ✨ 代码应用和预览
- ✨ 对话历史
- ✨ 固定/浮动模式
- 📁 `src/components/copilot/CopilotSidebar.tsx`

### 📦 依赖更新

新增依赖包：
- `reactflow@^11.11.4` - 工作流可视化
- `dagre@^0.8.5` - DAG 布局算法
- `uuid@^10.0.0` - 唯一标识符
- `@monaco-editor/react@^4.6.0` - Monaco 编辑器
- `anser@^2.1.1` - ANSI 转换

新增类型定义：
- `@types/dagre@^0.7.52`
- `@types/uuid@^10.0.0`

可选依赖（PDF/OCR）：
- `pdf-parse` - PDF 文本提取
- `tesseract.js` - OCR 识别

### 📚 文档新增

- `QUICK_START_MULTI_AGENT.md` - 多代理系统快速入门
- `MULTI_AGENT_SYSTEM_README.md` - 多代理系统完整文档
- `FEATURE_INTEGRATION_GUIDE.md` - 功能集成指南
- `CHANGELOG.md` - 本更新日志
- `install-new-features.bat` / `.sh` - 依赖安装脚本

### 🛠️ 开发增强

- 📁 新增统一组件导出：`src/components/new-features/index.ts`
- 📁 功能演示页面：`src/examples/NewFeaturesDemo.tsx`
- 🔧 版本号升级：`1.0.0` → `1.2.0`

### 🎨 用户体验改进

- 所有新组件支持亮色/暗色主题
- Framer Motion 动画效果
- 响应式设计
- 键盘快捷键支持
- 无障碍访问优化

---

## [v1.1.0] - 2025-12-20

### 新增功能
- 基础 Claude Code 集成
- Tauri 2.x 框架
- 基本对话界面
- 文件操作工具

---

## [v1.0.0] - 2025-12-15

### 初始版本
- 项目初始化
- 基础架构搭建
- React + TypeScript + Tauri 配置

---

## 版本号说明

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

- **主版本号（MAJOR）**：不兼容的 API 修改
- **次版本号（MINOR）**：向下兼容的功能性新增
- **修订号（PATCH）**：向下兼容的问题修正

---

## 贡献指南

查看 [开发指南](E:\Desktop\Claude Code 相关md\Fangyu-Code-完整开发与升级指南.md) 了解如何参与项目开发。

---

**最后更新**: 2025-12-28
**维护者**: Fangyu

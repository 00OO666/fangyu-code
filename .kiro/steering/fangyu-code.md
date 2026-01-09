---
inclusion: fileMatch
fileMatchPattern: "**/*.{ts,tsx,rs,toml}"
---

# Fangyu Code 开发指南

## 项目信息
- 项目路径: `F:\Fangyu-Code-Dev`
- 当前版本: v2.5.0
- GitHub: https://github.com/00OO666/fangyu-code/
- 技术栈: React 18 + TypeScript + Vite + Tauri 2.9 + Rust
- 许可证: AGPL-3.0

## 🎯 项目定位
Fangyu Code 是下一代 AI 编程工具，核心特性：
- **提示词队列系统** - 边等边输入，业界首创
- **三引擎架构** - Claude Code / OpenAI Codex / Google Gemini
- **实时成本追踪** - 每一分钱心中有数
- **智能上下文管理** - 自动压缩，告别上下文超限
- **聊天历史回溯** - FTS5 全文搜索

## 🚨 核心规则（必须遵守）

### 1. 禁止自动构建
修改代码后不要自动执行构建命令：
- ❌ 禁止：`npm run build`、`npm run tauri build`
- ✅ 允许：提供修改代码，让用户自己构建
- 原因：构建耗时长（前端 30s + Rust 5-10min）

### 2. 版本号三处同步
每次升级必须同步更新三处版本号：
1. `src-tauri/tauri.conf.json` 中的 `"version"`
2. `package.json` 中的 `"version"`
3. `src-tauri/Cargo.toml` 中的 `version`

### 3. 更新公告发布
每次升级必须更新 CHANGELOGS：
1. 在 `src/hooks/useFirstLaunchChangelog.ts` 最前面添加新版本日志
2. 同步修改 `FALLBACK_VERSION` 为新版本号

### 4. 代码清理规范
重构时及时删除废弃的文件、函数、变量，避免注释掉的代码堆积

## 📁 文件定位速查

### 前端核心目录
| 目录 | 用途 |
|------|------|
| `src/components/` | UI 组件（70+ 组件） |
| `src/hooks/` | React Hooks（60+ hooks） |
| `src/lib/` | 工具库和服务 |
| `src/core/` | 核心引擎（agents/api/tools/workflow） |
| `src/contexts/` | React Context（Session/Project/Theme） |
| `src/types/` | TypeScript 类型定义 |
| `src/services/` | 业务服务层 |

### 前端核心文件
| 功能 | 文件路径 |
|------|----------|
| 标签页管理 | `src/hooks/useTabs.tsx` |
| 消息执行 | `src/hooks/usePromptExecution.ts` |
| 会话组件 | `src/components/ClaudeCodeSession.tsx` |
| API 调用 | `src/lib/api.ts` |
| Canvas 预览 | `src/components/canvas/CanvasPanel.tsx` |
| Token 优化 | `src/services/messageContextOptimizer.ts` |
| 费用统计 | `src/lib/sessionCost.ts` |
| 版本更新公告 | `src/hooks/useFirstLaunchChangelog.ts` |
| API 配置面板 | `src/components/settings/APIConfigPanel.tsx` |
| 智能会话续接 | `src/hooks/useSmartSessionContinue.ts` |

### 后端核心文件
| 功能 | 文件路径 |
|------|----------|
| Claude 执行 | `src-tauri/src/commands/claude/cli_runner.rs` |
| 智能会话 | `src-tauri/src/commands/smart_session.rs` |
| 自动更新 | `src-tauri/src/commands/auto_update.rs` |
| 聊天历史 | `src-tauri/src/commands/chat_history.rs` |
| Tauri 配置 | `src-tauri/tauri.conf.json` |
| Rust 依赖 | `src-tauri/Cargo.toml` |

### 测试文件
| 类型 | 文件路径 |
|------|----------|
| 单元测试 | `src/tests/*.test.ts` |
| 属性测试 | `src/core/**/*.property.test.ts` |
| 测试配置 | `vitest.config.ts` |

## 常用命令

```bash
# 开发模式
npm run dev          # 前端开发服务器
npm run tauri dev    # Tauri 开发模式（含热重载）

# 快速构建（1-2 分钟，调试版）
npm run build && npm run tauri:build-fast

# 生产构建（5-10 分钟）
npm run tauri build

# 测试
npm run test         # 运行所有测试
npm run test:unit    # 仅单元测试
npm run test:property # 仅属性测试
npm run test:watch   # 监听模式

# 代码质量
npm run lint         # ESLint 检查
npm run lint:fix     # 自动修复
npm run format       # Prettier 格式化

# 版本发布（触发 GitHub Actions）
git tag -a v2.x.x -m "Release v2.x.x" && git push origin main && git push origin v2.x.x
```

## 依赖说明
- **UI 组件**: Radix UI + Tailwind CSS 4 + Framer Motion
- **编辑器**: Monaco Editor
- **国际化**: i18next
- **流程图**: ReactFlow + Dagre
- **Markdown**: react-markdown + remark-gfm
- **测试**: Vitest + fast-check（属性测试）

## 调试命令（F12 控制台）
```javascript
// 重置版本记录，测试更新公告
window.__resetChangelogVersion();

// 强制显示更新公告
window.__forceShowChangelog = true;

// 查看 Token 优化统计
window.__getTokenOptimizationStats();
```


## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────┐
│                   Fangyu Code                        │
├─────────────────┬─────────────────┬─────────────────┤
│   React 前端    │   Tauri 桥接    │    Rust 后端    │
│                 │                 │                 │
│ • src/          │ • IPC 通信      │ • src-tauri/    │
│ • components/   │ • 事件流        │ • SQLite 存储   │
│ • hooks/        │ • 类型安全      │ • MCP 协议      │
│ • core/         │                 │ • 翻译服务      │
└─────────────────┴─────────────────┴─────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  Claude Code CLI    OpenAI Codex     Google Gemini
```

## 📝 开发注意事项

### Spec 系统
- Spec 文件位于 `.kiro/specs/` 目录
- 当前活跃 Spec: `api-integration-v2.5`（API 集成升级）
- Spec 包含 requirements.md、design.md、tasks.md

### 属性测试（Property-Based Testing）
- 使用 fast-check 库
- 文件命名: `*.property.test.ts`
- 运行: `npm run test:property`
- 示例: `src/core/spec/SpecExecutor.property.test.ts`

### 代码风格
- ESLint + Prettier 强制执行
- 配置文件: `.eslintrc.json`, `.prettierrc.json`, `biome.json`
- 提交前自动检查（Husky）

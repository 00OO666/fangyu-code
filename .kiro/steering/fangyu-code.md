---
inclusion: fileMatch
fileMatchPattern: "**/*.{ts,tsx,rs,toml}"
---

# Fangyu Code 开发指南

## 项目信息
- 项目路径: `F:\Any-Code-Dev`
- 当前版本: v2.2.0
- GitHub: https://github.com/00OO666/fangyu-code/
- 技术栈: React 18 + TypeScript + Vite + Tauri 2.x + Rust

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

### 后端核心文件
| 功能 | 文件路径 |
|------|----------|
| Claude 执行 | `src-tauri/src/commands/claude/cli_runner.rs` |
| 智能会话 | `src-tauri/src/commands/smart_session.rs` |
| 自动更新 | `src-tauri/src/commands/auto_update.rs` |
| 聊天历史 | `src-tauri/src/commands/chat_history.rs` |

## 常用命令

```bash
# 快速构建（1-2 分钟）
npm run build && npm run tauri:build-fast

# 生产构建（5-10 分钟）
npm run tauri build

# 版本发布（触发 GitHub Actions）
git tag -a v2.x.x -m "Release v2.x.x" && git push origin main && git push origin v2.x.x
```

## 调试命令（F12 控制台）
```javascript
// 重置版本记录，测试更新公告
window.__resetChangelogVersion();

// 强制显示更新公告
window.__forceShowChangelog = true;

// 查看 Token 优化统计
window.__getTokenOptimizationStats();
```

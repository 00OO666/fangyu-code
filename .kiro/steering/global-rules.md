# 全局规则 v3.1

> 从 Claude Code CLAUDE.md 迁移而来

## 核心原则
- 用中文回复所有内容
- 智能预判需求，用自己的话优化并直接执行
- "以后"规则：用户说"以后xxx"时，立即记录到 steering 文件
- 避免低成功率工具：WebFetch 成功率约 50%，MCP 成功率约 100%
- 按需启用 MCP：默认不开启（节省 token），需要时提示用户启用

## 项目目录规范
- 项目工作目录: `F:\projects\{project-name}\`
- 用户桌面: `E:\Desktop`（不在 C 盘！）
- 禁止在 `C:\Users\666\` 创建任何项目文件（除配置）
- 每个项目必须有明确的项目标记

## 失败后必须搜索
失败 2 次后必须 WebSearch 或使用 MCP 搜索解决方案

## PowerShell 单引号规则
执行 PowerShell 时，Bash 会展开 `$` 变量，PowerShell `-Command` 参数必须用单引号！

## 模型选择（自动判断）
| 任务类型 | 复杂度 | 示例 |
|---------|--------|------|
| 只读/简单操作 | 低 | 查找文件、读配置、搜关键词 |
| 开发任务（默认） | 中 | Edit/Write/部署/Bug修复 |
| 复杂任务 | 高 | UI设计、架构重构、难bug |

## 智能记忆系统
当提到特定项目时，系统会自动读取相关 steering 文件：
- **Fangyu Code** - 触发词：fangyu code, tauri, 桌面应用 → 参考 `fangyu-code.md`
- **PbootCMS** - 触发词：pbootcms, 外贸网站, 8.136.42.225 → 参考 `pbootcms.md`（手动引用 #pbootcms）

## MCP 工具索引
已配置的 MCP 服务器（默认禁用，需要时启用）：
- **fetch** - HTTP 请求（替代 WebFetch，成功率 100%）
- **github** - GitHub 操作（搜索仓库、读取文件、创建 PR/Issue）
- **context7** - 技术文档查询（React/Vue/Node.js 最新文档）
- **puppeteer** - 浏览器自动化（截图、爬虫、表单填充）
- **reactbits** - React 组件库
- **shadcn** - shadcn/ui 组件
- **vuetify** - Vue/Vuetify 组件

## Fangyu Code 核心规则
### 禁止自动构建
修改 Fangyu Code 代码后，不要自动执行构建命令：
- ❌ 禁止：`npm run build`、`npm run tauri build`、`npm run tauri:build-fast`
- ✅ 允许：提供修改代码，让用户自己构建
- 原因：构建耗时长（前端 30s + Rust 5-10min），用户希望批量修改后一次性构建

### 版本更新公告（重要！）
每次升级 Fangyu Code 功能后：
- ✅ 必须同步升级三处版本号（如 1.2.7 → 1.2.8）：
  - `src-tauri/tauri.conf.json` 中的 `"version"`
  - `package.json` 中的 `"version"`
  - `src-tauri/Cargo.toml` 中的 `version`
- ✅ 必须更新 CHANGELOGS：在 `src/hooks/useFirstLaunchChangelog.ts` 最前面添加新版本日志
- ✅ 必须更新 FALLBACK_VERSION：同步修改为新版本号

### 代码清理规范
在开发升级 Fangyu Code 时：
- ❌ 禁止保留任何旧的代码和数据
- ✅ 及时删除废弃的文件、函数、变量
- ✅ 避免注释掉的代码堆积
- ✅ 保持代码库整洁，不干扰后续重构

## 配置文件位置
- **Steering**: `.kiro/steering/*.md`（本目录）
- **Hooks**: `.kiro/hooks/`
- **Specs**: `.kiro/specs/`（相当于 Claude Code 的 Skills）
- **MCP**: `~/.kiro/settings/mcp.json`

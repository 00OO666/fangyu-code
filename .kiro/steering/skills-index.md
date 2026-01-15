---
inclusion: always
---

# Skills 索引 - 从 Claude Code 迁移

> 所有 Skills 已转换为 Kiro Steering 文件格式

## 📋 可用 Skills 列表

| Skill 名称 | 文件 | 触发词 | 用途 |
|-----------|------|--------|------|
| Smart Debug | `skills-smart-debug.md` | 调试、诊断、502错误 | 智能调试和故障排查 |
| Task Planner | `skills-task-planner.md` | 任务规划、帮我拆解 | 复杂任务规划与进度跟踪 |
| Security Scan | `skills-security-scan.md` | 安全扫描、漏洞检测 | 安全漏洞扫描 |
| PbootCMS Quick | `skills-pbootcms-quick.md` | 完整部署、查看日志 | PbootCMS 快速命令 |
| PbootCMS Codebase | `skills-pbootcms-codebase.md` | 定位文件、修改xxx | PbootCMS 代码库智能定位 |
| Project Documenter | `skills-project-documenter.md` | 生成文档、代码索引 | 项目文档生成 |
| Fangyu Code Audit | `skills-fangyu-code-audit.md` | 代码审查、质量检查 | 代码质量审查 |
| UI/UX Master | `skills-ui-ux-master.md` | 美化、UI设计、响应式 | 前端设计开发 |
| Config Doctor | `skills-config-doctor.md` | Token消耗、配置诊断 | 配置优化诊断 |
| Chrome Debug | `skills-chrome-debug.md` | 截图验证、浏览器测试 | 浏览器调试 |
| Code Index | `skills-code-index.md` | 代码索引、快速定位 | 代码索引快速定位 |
| Template Gen | `skills-template-gen.md` | 生成模板、新建页面 | PbootCMS 模板生成器 |
| Learner | `skills-learner.md` | 学习、记住这个 | 学习 Agent |
| Project Forker | `skills-project-forker.md` | fork项目、定制开源 | GitHub 项目 Fork 定制 |
| Thesis Proposal | `skills-thesis-proposal.md` | 开题报告、论文选题 | 学术开题报告撰写 |
| PHP Standards | `skills-php-standards.md` | PHP规范、代码风格 | PHP 编码规范 |
| **React Best Practices** | `skills-react-best-practices.md` | React性能、Next.js优化 | ⭐ Vercel 官方 React/Next.js 性能优化 |
| **Web Interface Guidelines** | `skills-web-interface-guidelines.md` | UI规范、可访问性、a11y | ⭐ Vercel 官方 Web 界面设计规范 |

## 🔧 使用方式

### 方式 1: 手动引用
在聊天中使用 `#skills-xxx` 引用特定 Skill：
- `#skills-smart-debug` - 智能调试
- `#skills-task-planner` - 任务规划
- `#skills-pbootcms-quick` - PbootCMS 快速命令
- `#skills-pbootcms-codebase` - PbootCMS 代码定位
- `#skills-ui-ux-master` - UI/UX 设计
- `#skills-code-index` - 代码索引
- `#skills-template-gen` - 模板生成
- `#skills-learner` - 学习记忆
- `#skills-project-forker` - 项目 Fork
- `#skills-thesis-proposal` - 开题报告
- `#skills-php-standards` - PHP 规范
- `#skills-react-best-practices` - ⭐ React/Next.js 性能优化 (Vercel)
- `#skills-web-interface-guidelines` - ⭐ Web 界面设计规范 (Vercel)

### 方式 2: 触发词自动识别
说出触发词，我会自动参考对应的 Skill 指南：
- "帮我调试一下" → Smart Debug
- "做一个任务计划" → Task Planner
- "完整部署 PbootCMS" → PbootCMS Quick
- "修改产品页" → PbootCMS Codebase
- "美化这个页面" → UI/UX Master
- "生成代码索引" → Code Index
- "新建一个模板" → Template Gen
- "记住这个规则" → Learner
- "fork 这个项目" → Project Forker
- "写开题报告" → Thesis Proposal
- "React性能优化" / "Next.js优化" → React Best Practices (Vercel)
- "UI规范" / "可访问性" / "a11y" → Web Interface Guidelines (Vercel)

## 📁 原始 Skills 位置
Claude Code Skills 原始文件位于：
`C:\Users\666\.claude\skills\`

## ⚠️ 注意事项
1. 这些 Steering 文件设置为 `inclusion: manual`，需要手动引用
2. 本索引文件设置为 `inclusion: always`，会自动加载
3. 部分 Skills 包含 SSH 命令，需要确保服务器连接正常
4. MCP 相关功能需要先在 Kiro 中配置对应的 MCP 服务器

## 🔄 未迁移的 Skills
以下 Skills 因功能重复或不适用于 Kiro 而未迁移：
- `skill-generator` - Claude Code 专用
- `skill-manager` - Claude Code 专用
- `skill-optimizer` - Claude Code 专用
- `skill-validator` - Claude Code 专用
- `session-manager` - Claude Code 专用
- `site-switcher` - 网站切换（已禁用）

如需迁移这些 Skills，请告诉我！

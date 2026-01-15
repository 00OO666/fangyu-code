# 全局规则 v3.2

> 从 Claude Code CLAUDE.md 迁移而来

## 核心原则
- 用中文回复所有内容
- 智能预判需求，用自己的话优化并直接执行
- "以后"规则：用户说"以后xxx"时，立即记录到 steering 文件
- 避免低成功率工具：WebFetch 成功率约 50%，MCP 成功率约 100%
- 按需启用 MCP：默认不开启（节省 token），需要时提示用户启用

## 🚀 大任务执行原则（重要！）
遇到大型任务时：
- ✅ 按最高标准一次性执行完所有任务，包括测试
- ✅ 执行过程中无需过问用户，直接推进
- ❌ 禁止说"准备好开始时告诉我"之类的废话
- ❌ 禁止中途停下来等待确认
- ✅ 遇到问题自行解决，实在解决不了再汇报

## 📋 Spec 完成后自动执行
- ✅ Spec 创建完成后立刻开始执行任务，不要让用户手动点击
- ❌ 禁止说"打开 tasks.md 文件，点击 Start task 按钮"
- ✅ 直接从 Task 1 开始实现

## 项目目录规范
- 项目工作目录: `F:\projects\{project-name}\`
- 用户桌面: `E:\Desktop`（不在 C 盘！）
- 禁止在 `C:\Users\666\` 创建任何项目文件（除配置）
- 每个项目必须有明确的项目标记
- **桌面文件规则**: 所有需要保存到桌面的文件，先在当前工作目录创建，然后用 `Copy-Item` 复制到 `E:\Desktop`（因为 Kiro 文件操作受限于 workspace）

## 🔴 读取工作区外文件（重要！）
- ❌ 禁止使用 `readFile` 工具读取工作区外的文件（会报 Access denied）
- ✅ 必须使用 `Get-Content` PowerShell 命令读取工作区外的文件
- 示例：`Get-Content 'E:\Desktop\xxx.md' -Encoding UTF8`
- 适用场景：桌面文件、其他项目目录、系统配置文件等

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

## ⭐ Vercel 官方最佳实践（自动调用）
以下任务必须参考对应的 Vercel Skills：

| 任务类型 | 触发词 | 参考文件 |
|---------|--------|----------|
| React/Next.js 开发 | React、Next.js、性能优化、重渲染、bundle | `#skills-react-best-practices` |
| UI/界面设计 | UI规范、可访问性、a11y、交互设计、表单 | `#skills-web-interface-guidelines` |

**自动调用规则**：
- ✅ 写 React 组件时 → 参考 React Best Practices（消除瀑布流、Bundle 优化）
- ✅ 审查 React 代码时 → 检查是否符合 40+ 条性能规则
- ✅ 设计 UI 交互时 → 参考 Web Interface Guidelines（MUST/SHOULD/NEVER）
- ✅ 处理表单/键盘/动画时 → 参考对应章节的具体规范

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

### 🚀 GitHub 发布流程（重要！）
发布新版本时必须严格遵循以下流程：

**第一步：本地验证**
1. 先在本地运行 `npm run build` 确保构建成功
2. 如果构建失败，修复问题后再继续

**第二步：版本号和更新公告**
1. 升级三处版本号（package.json、tauri.conf.json、Cargo.toml）
2. 更新 CHANGELOGS（useFirstLaunchChangelog.ts）
3. 更新 FALLBACK_VERSION

**第三步：提交和推送**
1. 用**产品功能描述**作为 commit message，不要用内部修复描述
   - ✅ 正确：`v2.7.3: 统一工作流系统 - DAG 可视化，智能代理调度`
   - ❌ 错误：`fix: 修复 EventEmitter 浏览器兼容性问题`
2. 推送到 main 分支
3. 创建 tag：`git tag -a v2.x.x -m "Release v2.x.x - 功能描述"`
4. 推送 tag：`git push origin-ssh v2.x.x`

**第四步：监控构建**
1. 等待 GitHub Actions 构建完成
2. 如果构建失败：
   - 在本地修复问题
   - **删除远程 tag**：`git push origin-ssh :refs/tags/v2.x.x`
   - **删除本地 tag**：`git tag -d v2.x.x`
   - 修复后重新提交，commit message 仍用产品功能描述
   - 重新创建并推送 tag

**关键原则**
- ❌ 禁止用内部修复信息作为 Release 标题（用户不需要知道构建问题）
- ✅ Release 标题必须是产品功能更新描述
- ✅ 构建失败时删除 tag 重来，而不是追加 fix commit

## 配置文件位置
- **Steering**: `.kiro/steering/*.md`（本目录）
- **Hooks**: `.kiro/hooks/`
- **Specs**: `.kiro/specs/`（相当于 Claude Code 的 Skills）
- **MCP**: `~/.kiro/settings/mcp.json`

## Kiro API 逆向工程（2026-01-11 完成）

### 🎯 核心结论

**✅ 已完全破解！** 可以脱离 Kiro IDE 直接调用 Claude API

| 关键点 | 值 |
|--------|-----|
| API 端点 | `https://q.us-east-1.amazonaws.com` |
| 认证方式 | `Authorization: Bearer {accessToken}` |
| Token 位置 | `~/.aws/sso/cache/kiro-auth-token.json` |
| 运行环境 | **必须用 Electron**（Node.js 会被封号） |

### 📋 可用模型列表

| 模型 ID | 名称 | 倍率 | 推荐场景 |
|---------|------|------|----------|
| `auto` | Auto | 1x | 默认，自动选择 |
| `claude-opus-4.5` | Claude Opus 4.5 | 2.2x | 复杂推理、创意写作 |
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | 1.3x | 日常编程 |
| `claude-sonnet-4` | Claude Sonnet 4 | 1.3x | 混合推理 |
| `claude-haiku-4.5` | Claude Haiku 4.5 | 0.4x | 简单任务、省钱 |

### 🔧 使用方法

```bash
# 对话测试（指定模型）
npx electron temp/test-kiro-api-electron.cjs "问题" "claude-opus-4.5"

# 获取模型列表
npx electron temp/list-kiro-models.cjs
```

### 📝 请求体格式

```json
{
  "conversationState": {
    "currentMessage": {
      "userInputMessage": {
        "content": "问题内容",
        "modelId": "claude-opus-4.5",  // ← 关键！模型ID放这里
        "origin": "AI_EDITOR"
      }
    },
    "chatTriggerType": "MANUAL"
  }
}
```

### ⚠️ 重要注意事项

1. **必须用 Electron** - Node.js 的 TLS 指纹与 Kiro 不同，会被检测封号
2. **modelId 位置** - 放在 `userInputMessage.modelId`，不是 `conversationState.currentLanguageModel`
3. **Token 有效期** - 约 8 小时，需要 Kiro 运行才能自动刷新
4. **模型自我认知** - 即使用 Opus 4.5，模型可能仍说自己是 3.5 Sonnet（正常现象）

### 🚨 封号风险（2026-01-11 更新）

**即使使用 Electron，频繁调用仍会导致封号！** 已确认的封号原因：

| 原因 | 说明 |
|------|------|
| 请求频率 | 短时间内多次 API 调用 |
| 行为模式 | 非正常的使用模式（如批量测试） |
| 会话状态 | 缺少完整的会话上下文 |
| 遥测缺失 | Kiro 会发送遥测数据，脚本没有 |

**安全使用建议**：
- ❌ 不要用于自动化或批量调用
- ❌ 不要构建代理服务器
- ✅ 仅用于偶尔的手动测试
- ✅ 每次调用间隔 > 30 秒
- ✅ 保持 Kiro IDE 运行（模拟正常使用）

### 📁 关键文件

| 文件 | 说明 |
|------|------|
| `temp/test-kiro-api-electron.cjs` | 对话测试脚本 |
| `temp/list-kiro-models.cjs` | 获取模型列表 |
| `E:\Desktop\Kiro-API-逆向工程完整指南.md` | 完整技术文档 |

### 🎯 官方替代方案：Kiro CLI

**重大发现**: Amazon Q Developer CLI 已重命名为 **Kiro CLI**，是官方闭源产品！

```bash
# Windows (WSL)
curl -fsSL https://cli.kiro.dev/install | bash
kiro-cli login
kiro-cli chat

# 功能
- Agentic 对话模式
- MCP 集成
- 支持 Haiku/Sonnet/Opus 模型
- 零封号风险（官方工具）
```

详见: https://kiro.dev/cli/

### 🔬 研究历程（踩坑记录）

| 尝试 | 结果 | 原因 |
|------|------|------|
| Node.js 直接调用 | ❌ 封号 | TLS 指纹不匹配 |
| `conversationState.currentLanguageModel` | ❌ 被忽略 | 服务端不处理此字段 |
| Anthropic 官方 modelId 格式 | ❌ INVALID_MODEL_ID | Kiro 用自己的 ID 格式 |
| `userInputMessage.modelId` + Kiro 格式 | ✅ 成功 | 正确方案 |

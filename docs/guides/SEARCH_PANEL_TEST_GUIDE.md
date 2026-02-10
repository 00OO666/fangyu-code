# 搜索框配置功能测试指南

## 功能说明

Fangyu Code 的统一搜索面板（UnifiedSearchPanel）提供了快速搜索和配置 MCP、SKILL、插件、Hooks 的功能。

## 如何打开搜索框

### 方法 1: 键盘快捷键
- **Windows/Linux**: `Ctrl + K`
- **macOS**: `Cmd + K`

### 方法 2: 点击搜索图标
- 在顶部工具栏找到搜索图标（🔍）
- 点击即可打开搜索面板

## 搜索框功能

### 1. 搜索功能
- 输入关键词搜索 MCP、SKILL、插件、Hooks
- 支持模糊搜索（匹配名称和描述）
- 实时过滤结果

### 2. 类型过滤
- **MCP**: Model Context Protocol 工具（如 GitHub、Puppeteer、Memory）
- **SKILL**: 自动化工作流（如 code-index、security-scan）
- **Plugin**: 插件扩展
- **Hook**: 事件钩子

### 3. 启用/禁用开关
每个项目都有一个开关，可以快速启用或禁用：
- ✅ **绿色开关**: 已启用
- ⚪ **灰色开关**: 已禁用

### 4. 打开本体文件
点击 "打开文件" 按钮可以直接查看配置文件：
- MCP: `~/.claude/settings.json` 或项目级 `.claude.json`
- SKILL: `~/.claude/skills/{skill-name}/SKILL.md`
- Hook: `~/.claude/hooks/{hook-name}.sh`

### 5. 作用域标识
- **User**: 全局配置（所有项目生效）
- **Project**: 项目级配置（仅当前项目生效）

## 测试步骤

### 测试 1: 打开搜索框
1. 按 `Ctrl + K`（或 `Cmd + K`）
2. 确认搜索面板从顶部下拉展开
3. 确认显示所有可用的 MCP、SKILL、插件、Hooks

### 测试 2: 搜索功能
1. 在搜索框输入 "github"
2. 确认只显示与 GitHub 相关的项目
3. 清空搜索框，确认显示所有项目

### 测试 3: 类型过滤
1. 点击 "MCP" 标签
2. 确认只显示 MCP 工具
3. 点击 "SKILL" 标签
4. 确认只显示 SKILL 工作流

### 测试 4: 启用/禁用开关
1. 找到一个已启用的 MCP（如 GitHub）
2. 点击开关，将其禁用
3. 确认开关变为灰色
4. 再次点击开关，重新启用
5. 确认开关变为绿色

### 测试 5: 打开本体文件
1. 找到任意一个 SKILL（如 code-index）
2. 点击 "打开文件" 按钮
3. 确认在编辑器中打开了对应的 SKILL.md 文件

### 测试 6: 工具使用统计
1. 在搜索框中查看每个工具的使用次数
2. 确认显示 "使用 X 次" 的统计信息
3. 使用某个工具后，确认统计数字增加

## 常见问题

### Q: 搜索框打不开？
A: 确保没有其他快捷键冲突。尝试点击顶部工具栏的搜索图标。

### Q: 开关切换后没有生效？
A: 配置更改需要重启会话才能生效。关闭当前会话并重新打开。

### Q: 找不到某个 MCP 工具？
A: 确认该 MCP 已在 `~/.claude/settings.json` 中配置。

### Q: SKILL 显示为禁用状态？
A: 检查 SKILL 文件名是否有 `_disabled_` 前缀。移除前缀即可启用。

## 配置文件位置

- **全局 MCP 配置**: `C:\Users\666\.claude\settings.json`
- **项目级 MCP 配置**: `{项目目录}\.claude.json`
- **SKILL 目录**: `C:\Users\666\.claude\skills\`
- **Hook 目录**: `C:\Users\666\.claude\hooks\`

## 技术实现

搜索框使用以下技术：
- **React**: UI 组件
- **Framer Motion**: 动画效果
- **Tauri API**: 文件系统操作
- **实时同步**: 配置更改立即保存到文件

## 相关文件

- `src/components/UnifiedSearchPanel.tsx` - 搜索面板主组件
- `src/components/TabManager.tsx` - 集成搜索面板
- `src/hooks/useToolUsageStats.ts` - 工具使用统计
- `src/lib/api.ts` - API 调用（启用/禁用、打开文件）

---

**测试完成后，请反馈以下信息：**
1. 搜索框是否正常打开？
2. 搜索功能是否准确？
3. 启用/禁用开关是否工作？
4. 打开文件功能是否正常？
5. 有无发现任何 bug 或改进建议？

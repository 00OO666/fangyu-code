# TODO 跟踪清单

> 生成时间: 2026-01-09
> 审计版本: v2.5.0

## 优先级说明
- 🔴 高优先级 - 影响核心功能
- 🟡 中优先级 - 功能增强
- 🟢 低优先级 - 未来计划

---

## 🔴 高优先级

### 1. Git 命令执行
- **文件**: `src/hooks/useGitAutoCommit.ts:21`
- **描述**: Git 命令执行未实现
- **影响**: Git 自动提交功能无法使用

### 2. 会话续接功能
- **文件**: `src/components/ClaudeCodeSession.tsx:685-688`
- **描述**: 打开新窗口并加载新会话未实现
- **影响**: 智能会话续接功能不完整

---

## 🟡 中优先级

### 3. 沙箱截图实现
- **文件**: `src/core/sandbox/SandboxManager.ts:675`
- **描述**: 实际截图实现使用占位符
- **影响**: 沙箱截图功能返回假数据

### 4. 沙箱执行逻辑
- **文件**: `src/core/agents/AgentSwarmManager.ts:603`
- **描述**: 沙箱执行逻辑是占位实现
- **影响**: Agent 任务沙箱执行不可用

### 5. 插件系统
- **文件**: `src/hooks/usePluginLoader.ts:268, 452, 681`
- **描述**: 插件加载、激活、发现功能未实现
- **影响**: 插件系统不可用

### 6. 工作流任务重试
- **文件**: `src/hooks/agents/useWorkflowOrchestrator.ts:312`
- **描述**: 任务重试功能未实现
- **影响**: 工作流任务失败后无法重试

### 7. Subagent 管理
- **文件**: `src/components/SubagentManager.tsx:193, 255`
- **描述**: 执行状态加载和删除 API 未实现
- **影响**: Subagent 管理功能不完整

### 8. 统一搜索面板
- **文件**: `src/components/UnifiedSearchPanel.tsx:459, 570`
- **描述**: 插件列表读取和启用/禁用未实现
- **影响**: 插件搜索和管理不可用

---

## 🟢 低优先级

### 9. 技术栈读取
- **文件**: `src/lib/sessionSummarizer.ts:384`
- **描述**: 从项目配置中读取技术栈
- **影响**: 会话摘要中技术栈为空

### 10. API 执行时长计算
- **文件**: `src/hooks/useSessionCostCalculation.ts:167`
- **描述**: 需要从消息中提取实际 API 响应时间
- **影响**: 成本计算使用粗略估算

### 11. Webview 导航
- **文件**: `src/components/WebviewPreview.tsx:21, 80, 234, 243`
- **描述**: 实际 Tauri webview 导航未实现
- **影响**: 预览面板导航按钮禁用

### 12. 提示词搜索
- **文件**: `src/components/PromptSearchModal.tsx:88`
- **描述**: 从后端加载实际数据未实现
- **影响**: 使用模拟数据

### 13. MCP 配置读取
- **文件**: `src/components/UnifiedSearchModal.tsx:142`
- **描述**: 从配置文件读取 MCP 配置
- **影响**: MCP 服务器列表使用模拟数据

### 14. 会话阈值集成
- **文件**: `docs/SESSION_THRESHOLD_INTEGRATION_EXAMPLE.tsx:103`
- **描述**: 创建新标签页或清空当前会话
- **影响**: 示例代码，非生产代码

### 15. Super Agent 控制
- **文件**: `src/components/SuperAgentCenter.tsx:46, 51`
- **描述**: 启动/停止 Agent 逻辑未实现
- **影响**: Super Agent 中心功能不可用

---

## 已解决的 TODO

### ✅ 事件监听器清理
- **文件**: `src/hooks/useEventCleanup.ts`
- **状态**: 已在 v2.5.0 审计中实现

### ✅ API 密钥安全存储
- **文件**: `src/lib/secureStorage.ts`
- **状态**: 已在 v2.5.0 审计中实现

### ✅ 错误处理增强
- **文件**: `src/lib/userFriendlyErrors.ts`
- **状态**: 已在 v2.5.0 审计中实现

---

## 统计

| 优先级 | 数量 |
|--------|------|
| 🔴 高 | 2 |
| 🟡 中 | 6 |
| 🟢 低 | 7 |
| **总计** | **15** |

---

## 下一步行动

1. 优先处理高优先级 TODO
2. 为中优先级 TODO 创建 GitHub Issues
3. 低优先级 TODO 可在后续版本中处理

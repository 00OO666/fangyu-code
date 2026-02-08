# Claude 引擎配置迁移 - 从 CLI 到 SDK

## 修改概述

将 Fangyu Code 中的 Claude 引擎配置从 CLI 方式改为使用 `@anthropic-ai/sdk` 直接集成。

## 修改日期

2026-02-08

## 修改文件

### 1. ClaudeSetup.tsx
**路径**: `src/components/EngineConfigPanel/OneClickSetup/ClaudeSetup.tsx`

**主要变更**:
- ✅ 移除了 CLI 安装和验证逻辑
- ✅ 使用 `claudeSDK.testConnection()` 验证 API 连接
- ✅ 移除了 Tauri 命令调用 (`invoke('save_claude_api_key')`)
- ✅ 直接使用 `claudeSDK.updateConfig()` 更新配置
- ✅ 简化了配置流程，移除了不必要的步骤

**新的配置流程**:
1. **setup_sdk** - SDK 配置说明（无需安装，SDK 已内置）
2. **config_api** - 配置 API Key（支持直接输入或环境变量）
3. **select_model** - 选择默认模型

**关键改进**:
- 不再依赖 CLI 工具
- 使用 SDK 的 `testConnection()` 方法验证连接
- 更简洁的用户界面
- 更快的配置流程

### 2. setupStateService.ts
**路径**: `src/services/setupStateService.ts`

**主要变更**:
- ✅ 更新 Claude 引擎的步骤定义
- ✅ 将 `install_cli` 改为 `setup_sdk`
- ✅ 移除 `verify` 步骤
- ✅ 保留 `config_api` 和 `select_model` 步骤

**修改前**:
```typescript
claude: [
    { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
    { id: 'install_cli', title: '安装 CLI', description: '安装 Claude Code CLI' },
    { id: 'config_api', title: '配置 API', description: '设置 API Key 或选择代理商' },
    { id: 'verify', title: '验证安装', description: '验证 CLI 可用' },
    { id: 'select_model', title: '选择模型', description: '设置默认模型', optional: true },
]
```

**修改后**:
```typescript
claude: [
    { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
    { id: 'setup_sdk', title: 'SDK 配置', description: '配置 Claude API SDK' },
    { id: 'config_api', title: '配置 API', description: '设置 API Key' },
    { id: 'select_model', title: '选择模型', description: '设置默认模型', optional: true },
]
```

## 技术细节

### SDK 集成方式

使用现有的 `claudeSDK` 服务（位于 `src/lib/claudeSDK.ts`）:

```typescript
import { claudeSDK } from '../../../lib/claudeSDK';

// 更新配置
claudeSDK.updateConfig({ apiKey: apiKey.trim() });

// 测试连接
const result = await claudeSDK.testConnection();

if (result.success) {
    // 连接成功
    console.log(`模型: ${result.model}`);
} else {
    // 连接失败
    console.error(result.error);
}
```

### API Key 配置方式

支持两种方式:
1. **直接输入** - 用户在界面中输入 API Key
2. **环境变量** - 使用 `ANTHROPIC_API_KEY` 环境变量

### 验证流程

- 使用 SDK 的 `testConnection()` 方法
- 发送测试消息到 Claude API
- 验证响应并显示使用的模型
- 提供详细的错误信息

## 优势

1. **更简单** - 无需安装和管理 CLI 工具
2. **更快速** - 直接 API 调用，无需启动外部进程
3. **更可靠** - SDK 提供更好的错误处理和重试机制
4. **更灵活** - 支持自定义 baseURL（代理商支持）
5. **更易维护** - 减少了外部依赖

## 兼容性

- ✅ 保持与现有 `claudeSDK` 服务的兼容性
- ✅ 不影响其他引擎（Codex、Gemini）的 CLI 配置
- ✅ 向后兼容现有的配置数据

## 测试

### 构建测试
```bash
npm run build
```
**结果**: ✅ 构建成功，无错误

### 功能测试清单
- [ ] SDK 配置步骤显示正确
- [ ] API Key 输入和验证功能正常
- [ ] 测试连接功能正常
- [ ] 模型选择功能正常
- [ ] 错误处理和提示正确
- [ ] 与现有配置系统集成正常

## 后续工作

1. 测试完整的配置流程
2. 验证 API 连接功能
3. 确认与现有引擎配置面板的集成
4. 更新用户文档（如需要）

## 注意事项

- 其他引擎（Codex、Gemini）仍然使用 CLI 方式，未受影响
- 现有的 `claudeSDK` 服务已经提供了完整的功能支持
- 配置数据存储在 localStorage 中，与之前保持一致

## 相关文件

- `src/lib/claudeSDK.ts` - Claude SDK 服务实现
- `src/components/EngineConfigPanel/index.tsx` - 引擎配置面板主组件
- `src/components/EngineConfigPanel/OneClickSetup/SetupWizard.tsx` - 配置向导组件

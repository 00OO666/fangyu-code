# Implementation Tasks - Kiro API Integration

## Task 1: 创建 Kiro 类型定义

**Requirements**: REQ-1, REQ-2, REQ-3

**Files to create/modify**:
- `src/services/kiro/types.ts` (新建) ✅
- `src/services/kiro/errors.ts` (新建) ✅
- `src/types/provider.ts` (修改) ✅

**Acceptance Criteria**:
- [x] 定义 KiroToken 接口（accessToken, expiresAt, region, profileArn）
- [x] 定义 KiroModel 接口（id, name, description, maxOutputTokens, supportedBy）
- [x] 定义 ChatMessage, ChatOptions, ChatResponse 接口
- [x] 定义 KiroApiError 错误类（code, message）
- [x] 扩展 ProviderType 添加 'kiro' 类型
- [x] 定义 KiroProviderConfig 接口

---

## Task 2: 实现 KiroTokenManager

**Requirements**: REQ-2

**Files to create/modify**:
- `src/services/kiro/KiroTokenManager.ts` (新建) ✅

**Acceptance Criteria**:
- [x] 实现 loadToken() 从文件读取 Token
- [x] 实现 isValid() 检查 Token 是否过期
- [x] 实现 getStatus() 返回 Token 状态信息
- [x] 实现 getMaskedToken() 返回遮蔽的 Token（安全）
- [x] 实现 getAccessToken(), getRegion(), getProfileArn() 获取器
- [x] 实现 clearCache() 清除内存缓存
- [x] 默认 Token 路径: ~/.aws/sso/cache/kiro-auth-token.json

---

## Task 3: 实现 Rust 后端命令

**Requirements**: REQ-2, REQ-3

**Files to create/modify**:
- `src-tauri/src/commands/kiro/api_client.rs` (新建) ✅
- `src-tauri/src/commands/kiro/mod.rs` (修改) ✅
- `src-tauri/src/main.rs` (修改) ✅

**Acceptance Criteria**:
- [x] 实现 read_kiro_token 命令读取 Token 文件
- [x] 实现 send_kiro_request 命令发送 API 请求
- [x] 正确设置请求头（Authorization, User-Agent, x-amzn-kiro-agent-mode）
- [x] 处理 ~ 路径展开
- [x] 注册命令到 Tauri

---

## Task 4: 实现 KiroApiClient

**Requirements**: REQ-3, REQ-4, REQ-6

**Files to create/modify**:
- `src/services/kiro/KiroApiClient.ts` (新建) ✅

**Acceptance Criteria**:
- [x] 实现 chat() 方法发送消息
- [x] 实现 buildRequestBody() 构建正确的请求体结构
- [x] 实现 parseSSEResponse() 解析 SSE 流响应
- [x] 实现 generateConversationId() 生成会话 ID
- [x] 实现 sendWithRetry() 带重试的请求发送
- [x] 支持流式回调 onChunk
- [x] 正确处理转义字符（\n, \t, \", \\）

---

## Task 5: 实现 KiroEngine

**Requirements**: REQ-1, REQ-4, REQ-5

**Files to create/modify**:
- `src/services/kiro/KiroEngine.ts` (新建) ✅
- `src/services/kiro/index.ts` (新建) ✅

**Acceptance Criteria**:
- [x] 实现 initialize() 初始化引擎
- [x] 实现 validateConfig() 验证配置
- [x] 实现 sendMessage() 发送消息
- [x] 实现 startNewConversation() 开始新会话
- [x] 实现 getAvailableModels() 获取可用模型
- [x] 实现 getAllModels() 获取所有模型
- [x] 实现 setModel() / getCurrentModel() 模型管理
- [x] 实现 getTokenStatus() 获取 Token 状态
- [x] 实现 dispose() 清理资源
- [x] 定义静态 MODELS 数组（4 个模型）

---

## Task 6: 创建 Kiro 配置 UI

**Requirements**: REQ-1, REQ-5

**Files to create/modify**:
- `src/components/EngineConfigPanel/KiroSettings.tsx` (新建) ✅
- `src/components/EngineConfigPanel/EngineCard.tsx` (修改) ✅

**Acceptance Criteria**:
- [x] 显示 Token 路径输入框（默认值）
- [x] 显示模型选择下拉框（5 个选项：Auto + 4 个模型）
- [x] 显示 Token 状态（有效/过期/不存在）
- [x] 显示账户类型（Builders ID / IAM Identity Center）
- [x] 显示 Token 过期时间
- [x] 验证按钮检查配置有效性
- [x] 错误提示引导用户登录 Kiro IDE

---

## Task 7: 集成到引擎选择器

**Requirements**: REQ-1

**Files to create/modify**:
- `src/components/EngineConfigPanel/EngineCardGrid.tsx` (修改) ✅
- `src/components/EngineConfigPanel/index.tsx` (修改) ✅
- `src/services/engineConfigService.ts` (修改) ✅

**Acceptance Criteria**:
- [x] 在引擎列表中添加 "Kiro" 选项
- [x] 选择 Kiro 时显示 KiroSettings 组件
- [x] 保存 Kiro 配置到 engineConfigService
- [x] 加载时恢复 Kiro 配置

---

## Task 8: 集成到聊天流程

**Requirements**: REQ-3, REQ-4, REQ-6

**Files to create/modify**:
- `src/hooks/usePromptExecution.ts` (修改) ✅
- `src/hooks/usePromptExecution/types.ts` (修改) ✅
- `src/types/usage.ts` (修改) ✅
- `src/lib/api/types.ts` (修改) ✅
- `src/lib/windowManager.ts` (修改) ✅
- `src/lib/utils.ts` (修改) ✅
- `src/lib/stream/converters/types.ts` (修改) ✅
- `src/lib/api/mcp/index.ts` (修改) ✅
- `src/hooks/useExecutionTracking.ts` (修改) ✅
- `src/hooks/useProjectMCPConfig.ts` (修改) ✅
- `src/hooks/useAutoMCPCallTracker.ts` (修改) ✅
- `src/components/FloatingPromptInput/hooks/useCustomSlashCommands.ts` (修改) ✅
- `src/components/FloatingPromptInput/hooks/useSlashCommandMenu.ts` (修改) ✅

**Acceptance Criteria**:
- [x] 当选择 Kiro 引擎时使用 KiroEngine 发送消息
- [x] 支持流式响应显示
- [x] 正确处理错误并显示用户友好消息
- [x] 支持多轮对话
- [x] 新建对话时重置会话状态
- [x] 更新所有 EngineType 类型定义添加 'kiro'

**Status**: ✅ 已完成

---

## Task 9: 错误处理和用户提示

**Requirements**: REQ-6, REQ-7

**Files to create/modify**:
- `src/services/kiro/errors.ts` (已完成) ✅
- `src/components/ErrorDisplay/KiroError.tsx` (可选)

**Acceptance Criteria**:
- [x] 401 错误显示 "Token 已过期，请重新登录 Kiro IDE"
- [x] 403 错误显示 "账户可能受限"
- [x] 429 错误自动重试，显示 "请求过于频繁，正在重试..."
- [x] 网络错误显示 "网络连接失败，请检查网络"
- [x] 所有错误记录到日志（Token 遮蔽）

**Status**: 核心错误处理已在 KiroApiError 类中实现

---

## Task 10: 测试和文档

**Requirements**: All

**Files to create/modify**:
- `src/services/kiro/__tests__/KiroTokenManager.test.ts` (可选)
- `src/services/kiro/__tests__/KiroApiClient.test.ts` (可选)
- `docs/kiro-integration.md` (可选)

**Acceptance Criteria**:
- [ ] KiroTokenManager 单元测试（Token 验证、过期判断）
- [ ] KiroApiClient 单元测试（请求构建、SSE 解析）
- [ ] 编写用户文档说明如何配置和使用 Kiro 引擎
- [ ] 记录已知限制（Opus 4.5 仅 Builders ID 支持）

**Status**: 待实现（可在后续迭代中添加）

---

## Implementation Order

推荐按以下顺序实现：

1. **Task 1** - 类型定义（基础）
2. **Task 3** - Rust 后端（依赖少）
3. **Task 2** - TokenManager（依赖 Task 1, 3）
4. **Task 4** - ApiClient（依赖 Task 1, 2）
5. **Task 5** - Engine（依赖 Task 2, 4）
6. **Task 6** - 配置 UI（依赖 Task 5）
7. **Task 7** - 引擎选择器集成（依赖 Task 6）
8. **Task 8** - 聊天流程集成（依赖 Task 5, 7）
9. **Task 9** - 错误处理（依赖 Task 8）
10. **Task 10** - 测试和文档（最后）

---

## Notes

- 所有代码修改后不要自动构建，让用户批量修改后一次性构建
- Token 文件由 Kiro IDE 管理，Fangyu Code 只读取
- 注意 Opus 4.5 仅 Builders ID 支持，UI 需要提示

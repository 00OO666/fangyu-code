# Implementation Tasks - 引擎配置系统重构

## Task 1: 基础服务层 - 加密服务 ✅

**文件**: `src/services/cryptoService.ts`

**实现内容**:
1. 创建 `CryptoService` 类
2. 实现 `encrypt(plaintext)` 方法 - AES-256-GCM 加密
3. 实现 `decrypt(ciphertext, iv)` 方法
4. 实现 `deriveKey()` 方法 - 基于设备指纹派生密钥
5. 实现 `secureWipe(data)` 方法 - 安全清除内存
6. 实现 `maskApiKey(key)` 工具函数

**验收标准**:
- [x] 加密后解密得到原始值
- [x] 每次加密生成唯一 IV
- [x] 支持空字符串和特殊字符
- [x] 属性测试通过

---

## Task 2: 基础服务层 - 连接测试服务 ✅

**文件**: `src/services/connectionTester.ts`

**实现内容**:
1. 创建 `ConnectionTester` 类
2. 实现各引擎的测试方法:
   - Claude: POST /v1/messages (最小请求)
   - Codex: GET /v1/models
   - Gemini: GET /v1/models
   - SiliconFlow: GET /v1/models
3. 实现超时处理 (10秒)
4. 实现错误消息映射


**验收标准**:
- [x] 有效凭证返回成功
- [x] 无效 API Key 返回明确错误
- [x] 超时后正确报告
- [x] 网络错误优雅处理

---

## Task 3: 基础服务层 - 配置迁移服务 ✅

**文件**: `src/services/configMigrator.ts`

**实现内容**:
1. 创建 `ConfigMigrator` 类
2. 实现 `checkNeedsMigration()` 方法
3. 实现 `migrate()` 方法 - v1 到 v2 迁移策略
4. 实现 `createBackup()` 和 `restoreBackup()` 方法
5. 实现迁移日志记录

**验收标准**:
- [x] 迁移前自动创建备份
- [x] 迁移失败自动回滚
- [x] 所有代理商数据完整保留
- [x] API Key 正确加密

---

## Task 4: 核心服务层 - 引擎配置服务 ✅

**文件**: `src/services/engineConfigService.ts`

**实现内容**:
1. 创建 `EngineConfigService` 类
2. 实现代理商 CRUD 方法
3. 实现 `reorderProviders()` 方法
4. 实现 `setCurrentEngine()` 和 `setCurrentProvider()` 方法
5. 实现 `exportConfig()` 和 `importConfig()` 方法
6. 集成 CryptoService、ConnectionTester、ConfigMigrator

**验收标准**:
- [x] CRUD 操作正确持久化
- [x] 排序顺序正确保存
- [x] 导出/导入往返一致
- [x] 敏感数据正确处理

---

## Task 5: 更新类型定义 ✅

**文件**: `src/types/provider.ts`

**实现内容**:
1. 更新 `UnifiedProviderConfig` 接口:
   - 添加 `apiKeyIv`, `authTokenIv` 字段
   - 添加 `sortOrder` 字段
   - 添加 `lastTestResult` 字段
2. 添加 `ConnectionTestResult` 接口
3. 更新 `ProviderStorage` 接口:
   - 版本升级到 2
   - 添加 `encryptionVersion` 字段
   - 添加 `migrationLog` 字段
4. 添加 `ExportedConfig` 和 `ExportedProvider` 接口
5. 添加表单字段配置类型

**验收标准**:
- [x] 类型定义完整
- [x] 向后兼容旧数据结构
- [x] TypeScript 编译通过

---

## Task 6: 统一配置 Hook ✅

**文件**: `src/hooks/useEngineConfig.ts`

**实现内容**:
1. 创建 `useEngineConfig` Hook
2. 实现状态管理 (useReducer)
3. 实现所有代理商操作方法
4. 实现引擎切换方法
5. 实现连接测试方法
6. 实现导入导出方法
7. 实现乐观更新与回滚

**验收标准**:
- [x] 状态更新正确
- [x] 乐观更新失败时回滚
- [x] 错误正确传播
- [x] 初始化时自动迁移

---

## Task 7: UI 组件 - 引擎卡片 ✅

**文件**: 
- `src/components/EngineConfigPanel/EngineCard.tsx`
- `src/components/EngineConfigPanel/EngineCardGrid.tsx`

**实现内容**:
1. 创建 `EngineCard` 组件:
   - 显示引擎图标、名称、状态
   - 激活状态高亮
   - Hover 动画效果
2. 创建 `EngineCardGrid` 组件:
   - 响应式网格布局
   - 键盘导航支持
   - ARIA 标签

**验收标准**:
- [x] 状态显示正确
- [x] 响应式布局正常
- [x] 键盘导航可用
- [x] 暗黑模式支持

---

## Task 8: UI 组件 - 代理商列表 ✅

**文件**:
- `src/components/EngineConfigPanel/ProviderList.tsx`
- `src/components/EngineConfigPanel/ProviderItem.tsx`

**实现内容**:
1. 创建 `ProviderItem` 组件:
   - 显示名称、状态、最后使用时间
   - Active 徽章
   - 操作按钮 (编辑/测试/删除)
2. 创建 `ProviderList` 组件:
   - 使用 @dnd-kit 实现拖拽排序
   - 拖拽动画效果
   - 空列表处理

**验收标准**:
- [x] 拖拽排序正常工作
- [x] 排序后正确保存
- [x] 操作按钮功能正常
- [x] 动画流畅

---

## Task 9: UI 组件 - 代理商表单 ✅

**文件**:
- `src/components/EngineConfigPanel/ProviderForm.tsx`
- `src/components/EngineConfigPanel/ApiKeyInput.tsx`

**实现内容**:
1. 创建 `ApiKeyInput` 组件:
   - 掩码显示
   - 显示/隐藏切换
   - 剪贴板粘贴按钮
2. 创建 `ProviderForm` 组件:
   - 动态字段渲染
   - 实时验证
   - 内联错误显示
   - 测试连接按钮

**验收标准**:
- [x] 动态字段正确渲染
- [x] 验证错误正确显示
- [x] API Key 掩码正确
- [x] 表单提交正常

---

## Task 10: UI 组件 - 空状态和预设 ✅

**文件**: `src/components/EngineConfigPanel/EmptyState.tsx`

**实现内容**:
1. 创建 `EmptyState` 组件:
   - 快速开始引导
   - 预设代理商列表
   - 添加按钮
2. 实现预设配置数据
3. 实现预设选择逻辑

**验收标准**:
- [x] 空状态正确显示
- [x] 预设列表完整
- [x] 选择预设后表单正确填充

---

## Task 11: UI 组件 - 高级设置 ✅

**文件**: `src/components/EngineConfigPanel/AdvancedSettings.tsx`

**实现内容**:
1. 创建可折叠的高级设置面板
2. 实现环境变量设置
3. 实现权限设置
4. 实现运行模式选择器
5. 根据引擎类型显示/隐藏设置项

**验收标准**:
- [x] 折叠/展开正常
- [x] 设置项根据引擎正确显示
- [x] 设置正确保存

---

## Task 12: UI 组件 - 配置操作 ✅

**文件**: `src/components/EngineConfigPanel/ConfigActions.tsx`

**实现内容**:
1. 创建导入按钮和文件选择
2. 创建导出按钮和选项对话框
3. 创建刷新按钮
4. 实现敏感数据导出确认对话框
5. 实现导入模式选择 (合并/替换)

**验收标准**:
- [x] 导出文件正确生成
- [x] 导入验证正确
- [x] 敏感数据警告显示
- [x] 导入模式正确应用

---

## Task 13: 主面板组件 ✅

**文件**: `src/components/EngineConfigPanel/index.tsx`

**实现内容**:
1. 创建 `EngineConfigPanel` 主组件
2. 集成所有子组件
3. 使用 `useEngineConfig` Hook
4. 实现 Toast 通知
5. 实现加载状态

**验收标准**:
- [x] 所有子组件正确集成
- [x] 状态正确传递
- [x] 错误正确显示
- [x] 加载状态正确

---

## Task 14: 集成到设置页面 ✅

**文件**: `src/components/Settings.tsx`

**实现内容**:
1. 移除旧的引擎配置组件引用
2. 集成新的 `EngineConfigPanel`
3. 调整布局和样式
4. 确保与其他设置项协调

**验收标准**:
- [x] 新组件正确显示
- [x] 布局协调
- [x] 无样式冲突

---

## Task 15: 清理旧代码 ✅

**删除文件**:
- `src/components/UnifiedProviderManager.tsx` ✅
- `src/components/UnifiedProviderForm.tsx` ✅
- `src/components/UnifiedEngineSelector.tsx` ✅
- `src/components/EngineStatusOverview.tsx` ✅
- `src/components/ConfigImportExport.tsx` ✅
- `src/hooks/useProviderConfig.ts` ✅
- ~~`src/hooks/useEngineStatus.ts`~~ (保留 - 被其他组件使用)
- `src/lib/providerUtils.ts` ✅
- `src/lib/providerMigration.ts` ✅

**实现内容**:
1. 删除上述文件
2. 移除所有对这些文件的引用
3. 更新相关导入

**验收标准**:
- [x] 所有旧文件已删除
- [x] 无残留引用
- [x] 编译通过

---

## Task 16: 属性测试 ✅

**文件**:
- `src/services/cryptoService.property.test.ts`
- `src/services/engineConfigService.property.test.ts`

**实现内容**:
1. 实现 10 个核心属性测试:
   - 引擎卡片状态显示
   - 引擎切换行为
   - 代理商排序
   - API Key 加密往返
   - API Key 掩码
   - 配置导入导出往返
   - 迁移数据完整性
   - 表单验证反馈
   - 删除后状态一致性
   - 空状态和预设行为

**验收标准**:
- [x] 所有属性测试通过
- [x] 覆盖设计文档中的所有属性

---

## Task 17: 单元测试 ✅

**文件**:
- `src/services/cryptoService.test.ts`
- `src/services/connectionTester.test.ts`
- `src/services/configMigrator.test.ts`
- `src/services/engineConfigService.test.ts`
- `src/hooks/useEngineConfig.test.ts`

**实现内容**:
1. 为每个服务编写单元测试
2. 为 Hook 编写集成测试
3. Mock 外部依赖

**验收标准**:
- [x] 所有单元测试通过
- [x] 覆盖主要功能路径
- [x] 覆盖错误处理路径

---

## 🎉 所有任务已完成！

## 依赖关系

```
Task 1 (加密服务)
    ↓
Task 2 (连接测试) ──┐
    ↓              │
Task 3 (迁移服务) ──┼──→ Task 4 (引擎配置服务)
    ↓              │         ↓
Task 5 (类型定义) ──┘    Task 6 (Hook)
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
              Task 7-12            Task 13 (主面板)
              (UI 组件)                 ↓
                    └─────────┬─────────┘
                              ↓
                        Task 14 (集成)
                              ↓
                        Task 15 (清理)
                              ↓
                      Task 16-17 (测试)
```

## 执行顺序

1. Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
2. Task 7 → Task 8 → Task 9 → Task 10 → Task 11 → Task 12
3. Task 13 → Task 14 → Task 15
4. Task 16 → Task 17

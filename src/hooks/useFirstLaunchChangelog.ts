/**
 * ✨ REFACTORED: useFirstLaunchChangelog Hook (Phase 2 - Task 6)
 *
 * 检测首次启动新版本，显示更新日志
 *
 * 改进前：版本号硬编码，需要手动更新
 * 改进后：从 Tauri API 动态获取真实版本号
 *
 * 功能：
 * - 使用 localStorage 存储 lastSeenVersion
 * - 自动版本检测（从 Tauri API）
 * - 版本比较逻辑
 * - 调试功能：window.__forceShowChangelog = true
 */

import { logger } from '@/lib/logger';
import { getVersion } from "@tauri-apps/api/app";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "fangyu-code-last-seen-version";
const FALLBACK_VERSION = "2.9.0"; // 🔧 Fallback 版本（获取失败时使用）

// 🔧 DEBUG: 全局变量用于强制显示更新日志（调试用）
declare global {
  interface Window {
    __forceShowChangelog?: boolean;
    __resetChangelogVersion?: () => void;
  }
}

// 版本更新日志（从新到旧）
export const CHANGELOGS = {
  "2.9.3": {
    title: "v2.9.3 - 🔧 React Hooks 顺序修复",
    date: "2026-01-23",
    features: [],
    improvements: [],
    bugfixes: [
      "修复 'Rendered fewer hooks than expected' 错误",
      "恢复 useTransition 调用以保持 hooks 顺序一致性",
    ],
    technical: [
      "ClaudeCodeSession.tsx - 恢复 useTransition() 调用",
    ],
  },
  "2.9.2": {
    title: "v2.9.2 - 🔧 会话上下文与日志系统修复",
    date: "2026-01-23",
    features: [],
    improvements: [
      "🔧 修复会话历史不显示的问题 - useSessionStream 依赖项修复",
      "🔧 统一日志系统 - 64 处 console.log/warn/error 替换为 logger 服务",
      "🔍 添加会话诊断日志 - 帮助定位上下文断连和会话继续问题",
    ],
    bugfixes: [
      "修复点击历史会话后显示空白的问题",
      "修复 loadSessionHistory 的 useCallback 依赖项缺失",
      "修复会话状态追踪不准确导致的上下文丢失",
    ],
    technical: [
      "useSessionStream.ts - 添加 initializeProcessedIds 到依赖项",
      "usePromptExecution.ts - 添加完整会话状态诊断日志",
      "ClaudeCodeSession.tsx - 添加 handleSendPromptWithScroll 诊断日志",
      "28 个文件的 console 调用替换为 logger 服务",
    ],
  },
  "2.9.1": {
    title: "v2.9.1 - ✨ V3.0 功能中心与语音输入完整实现",
    date: "2026-01-22",
    features: [
      "🎤 语音输入功能 - MediaRecorder API + FlashSpeech API 完整实现，支持 Ctrl+Shift+V 快捷键",
      "🎯 V3.0 功能中心 - 4个核心功能已实现：LSP 功能可视化、Diff 预览器、内置终端、语音输入",
      "🚧 6个功能开发中 - 代码片段库、Git 可视化、测试集成、项目模板、性能分析器、插件系统",
      "🔧 DiffPreview 接口兼容性修复 - 支持 diff 字符串和 changes 数组两种模式",
    ],
    improvements: [
      "✅ LSP 功能 - 代码智能提示、跳转定义、查找引用、重命名符号（前后端完整实现）",
      "✅ Diff 预览器 - Side-by-side 和 Inline 视图切换，Accept/Reject 操作",
      "✅ 内置终端 - xterm.js 集成，PTY 通信，AI 助手命令支持",
      "✅ 诚实标注 - 开发中功能显示明确的占位页面，不再误导用户",
      "✅ 自动更新功能改进 - 修复浏览器错误提示问题",
    ],
    bugfixes: [
      "修复 DiffPreview 接口不匹配 - V3FeaturesCenter 传递 diff 字符串但组件期望 changes 数组",
      "修复虚假功能误导 - 6个功能添加\"开发中\"占位视图",
      "修复使用说明不准确 - 更新为准确反映实现状态",
    ],
    technical: [
      "语音输入 - VoiceInput.tsx + flashSpeechService.ts 完整实现",
      "LSP 功能 - LSPAutoLoader.ts + lsp.rs 前后端齐全",
      "Diff 预览器 - DiffPreview.tsx 接口兼容性修复",
      "内置终端 - Terminal.tsx + terminal.rs 前后端齐全",
      "V3FeaturesCenter.tsx - 添加开发中功能占位视图",
      "测试脚本 - test-voice-input.cjs, test-all-v3-features.cjs, test-v3-deep.cjs",
      "测试报告 - V3_FEATURES_TEST_REPORT.md 完整测试文档",
    ],
  },
  "2.9.0": {
    title: "v2.9.0 - 🚀 Token 限制移除与会话功能增强",
    date: "2026-01-21",
    features: [
      "🔓 移除 max_tokens 限制 - 支持长输出和完整工具调用，让 Claude 自由发挥",
      "💾 会话继续功能改进 - 优化数据库集成，支持更稳定的会话恢复",
      "⚙️ 引擎配置优化 - 多个配置组件更新，提升用户体验",
    ],
    improvements: [
      "✅ 无限制输出 - 不再因 token 限制截断 Claude 的回复",
      "✅ 工具调用完整性 - 复杂工具调用不会被中断",
      "✅ 会话数据持久化 - 改进会话存储和恢复机制",
      "✅ 配置界面优化 - 更新多个设置和配置面板",
    ],
    bugfixes: [],
    technical: [
      "permission_config.rs - 移除 max_tokens 限制，添加详细注释",
      "session_continue.rs - 添加 AppHandle 和数据库连接支持",
      "多个前端组件更新 - AdvancedSettings, InlineModelTester, ProviderItem 等",
      "版本号同步到 v2.9.0 - package.json, tauri.conf.json, Cargo.toml",
    ],
  },
  "2.8.1": {
    title: "v2.8.1 - 🔧 统一日志管理系统",
    date: "2026-01-20",
    features: [],
    improvements: [
      "🔧 新增统一日志服务 - 替换 1244 处 console.log 调用",
      "🔧 支持日志级别控制 - debug/info/warn/error 分级管理",
      "🔧 模块标识追踪 - 每条日志标注来源模块，便于调试",
      "🔧 生产环境优化 - 自动过滤 debug 级别日志",
    ],
    bugfixes: [],
    technical: [
      "新增 src/lib/logger.ts 统一日志服务",
      "替换 245 个文件中的 console 调用",
      "支持 logger.debug/info/warn/error 四个级别",
      "日志格式: [模块名] 消息内容",
    ],
  },
  "2.8.0": {
    title: "v2.8.0 - 🔧 上下文丢失与会话压缩修复",
    date: "2026-01-20",
    features: [],
    improvements: [
      "🔧 修复 Tab 切换时上下文丢失的问题 - 使用 ref 跟踪最新消息状态",
      "🔧 减少消息持久化延迟 - 从 1000ms 优化到 300ms",
      "🔧 Tab 失活时立即保存消息 - 避免防抖延迟导致数据丢失",
      "🔧 添加会话压缩调试日志 - 帮助诊断压缩功能是否正常工作",
    ],
    bugfixes: [
      "修复 Tab 激活时使用闭包中的旧 messages.length 导致错误重载",
      "修复快速切换 Tab 时消息还没保存到 IndexedDB 的问题",
      "修复会话压缩功能可能因上下文使用率计算不正确而失效",
    ],
    technical: [
      "ClaudeCodeSession.tsx - 添加 messagesLengthRef 跟踪最新消息数量",
      "useMessagePersistence.ts - 新增 persistMessagesImmediately() 立即保存方法",
      "useBackgroundCompact.ts - 添加自动压缩检查调试日志",
      "useContextWindowUsage.ts - 添加上下文使用率调试日志",
    ],
  },
  "2.7.9": {
    title: "v2.7.9 - 🔧 会话切换稳定性修复",
    date: "2026-01-19",
    features: [],
    improvements: [
      "🔧 修复切换会话时内容偶尔丢失的问题",
      "🔧 优化 Tab 激活时的数据恢复逻辑",
      "🔧 添加 IndexedDB 恢复状态跟踪，避免竞态条件",
    ],
    bugfixes: [
      "修复 Tab 激活时 IndexedDB 恢复与后端加载的竞态条件",
      "修复重新打开应用后切换会话时消息显示为空的问题",
    ],
    technical: [
      "ClaudeCodeSession.tsx - 添加 isRestoringFromIndexedDBRef 状态跟踪",
      "Tab 激活时先等待 IndexedDB 恢复完成再决定是否从后端加载",
    ],
  },
  "2.7.8": {
    title: "v2.7.8 - 🔧 消息显示修复",
    date: "2026-01-16",
    features: [],
    improvements: [
      "🔧 修复 Claude 说话后调用工具时，文字被覆盖的问题",
      "🔧 改进消息聚合逻辑，更严格检测真实文本内容",
      "🔧 智能消息合并，保留文本和工具调用",
      "🔧 改进消息 ID 生成，确保唯一性",
    ],
    bugfixes: [
      "修复工具调用前后的文字消息被错误覆盖",
      "修复相同 ID 消息简单替换导致内容丢失",
    ],
    technical: [
      "subagentGrouping.ts - 改进 getTechnicalMessageType() 文本检测",
      "useMessageTranslation.ts - 新增 mergeMessageContent() 智能合并",
      "usePromptExecution.ts - 改进 getClaudeMessageId() 唯一性",
      "useSessionStream.ts - 添加详细调试日志",
    ],
  },
  "2.7.6": {
    title: "v2.7.6 - 🔒 全面代码审计与安全加固",
    date: "2026-01-15",
    features: [
      "🔒 CSP 安全加固 - 移除 unsafe-eval，限制 connect-src 到已知域名",
      "🛡️ IPC 输入验证 - Rust 后端添加路径规范化和目录访问白名单",
      "🔐 敏感数据加密 - Web Crypto API 加密存储，开发环境安全警告",
      "📦 代码分割优化 - 动态导入 pdfjs/mammoth/xlsx，减少 500KB+ Bundle",
    ],
    improvements: [
      "✅ Context 重渲染优化 - useMemo 缓存 ProjectContext/PlanModeContext",
      "✅ any 类型消除 - 创建 api-extended.ts 定义 Hook/Task/Agent 类型",
      "✅ 架构重构 - AppProviders 组合组件，useTabs 拆分为独立模块",
      "✅ Zustand 状态管理 - 核心状态迁移，Context 仅用于依赖注入",
    ],
    bugfixes: [],
    technical: [
      "Phase 1: 安全修复 - CSP/IPC/SecureStorage",
      "Phase 2: 架构优化 - Context/Hooks/Zustand",
      "Phase 3: 性能优化 - useMemo/代码分割/事件监听器审查",
      "Phase 4: 代码质量 - TypeScript 类型/错误处理",
      "Phase 5: 用户体验 - 首屏加载/错误反馈/可访问性",
    ],
  },
  "2.7.5": {
    title: "v2.7.5 - 📝 会话摘要生成器",
    date: "2026-01-13",
    features: [
      "📝 独立会话摘要生成器 - 一键生成会话摘要，支持复制和在新会话中继续",
      "🔧 独立 API 配置 - 摘要生成使用独立的引擎和模型配置，不影响主聊天",
      "🎨 引擎选择器重构 - 全新 UI 设计，官方品牌图标，更好的交互体验",
      "📊 会话统计面板 - 显示消息数、Token 使用、预估费用等统计信息",
    ],
    improvements: [
      "✅ Token 阈值警告 - 80% 时显示警告，90% 时显示危险提示",
      "✅ 三引擎支持 - Claude/OpenAI/Gemini 任选",
      "✅ 配置持久化 - 引擎和模型选择自动保存，下次启动恢复",
      "✅ API Key 加密存储 - 使用 Web Crypto API 加密敏感信息",
    ],
    bugfixes: [],
    technical: [
      "新增 SummaryButton/SummaryModal 组件",
      "新增 useSummaryGenerator Hook",
      "新增 SummaryConfigStore/SummaryGeneratorService 服务",
      "新增 EnhancedEngineSelector 组件（官方品牌图标）",
      "8 个属性测试覆盖核心功能",
    ],
  },
  "2.7.4": {
    title: "v2.7.4 - 🔧 自动更新体验优化",
    date: "2026-01-12",
    features: [],
    improvements: [
      "✅ 自动更新状态显示优化 - 修复下载失败时同时显示错误和成功信息的问题",
      "✅ 更新对话框逻辑改进 - 只有在下载完全成功后才显示「更新已安装」",
    ],
    bugfixes: [
      "🐛 修复更新对话框状态冲突 - 不再同时显示「下载安装失败」和「更新已安装」",
    ],
    technical: [
      "UpdateDialog.tsx - 重构下载状态管理，确保状态互斥",
    ],
  },
  "2.7.3": {
    title: "v2.7.3 - 🔄 统一工作流系统",
    date: "2026-01-12",
    features: [
      "🔄 统一工作流引擎 - 合并 Spec 风格和 Devin 风格工作流为统一系统",
      "📊 DAG 可视化 - 任务依赖关系图形化展示，支持并行任务识别",
      "🤖 智能代理调度 - 基于能力匹配的代理-任务分配算法",
      "⏸️ 执行控制 - 支持暂停/恢复/重试/取消工作流执行",
      "📈 实时进度追踪 - 任务状态、完成百分比、执行日志实时更新",
    ],
    improvements: [
      "✅ 关键路径计算 - 自动识别工作流中的关键路径和瓶颈任务",
      "✅ 并发限制控制 - 可配置最大并发代理数，避免资源过载",
      "✅ 事件系统完善 - 完整的工作流事件订阅/取消订阅 API",
      "✅ 代码清理 - 删除废弃的 useWorkflowOrchestrator 和 SpecDrivenWorkflow",
    ],
    bugfixes: [],
    technical: [
      "新增 UnifiedWorkflowEngine - 统一工作流引擎核心类",
      "新增 useUnifiedWorkflow Hook - React 状态管理封装",
      "重构 WorkflowManagerPanel - 使用新的统一工作流系统",
      "30 个属性测试全部通过 - DAG/代理调度/执行控制/事件系统",
    ],
  },
  "2.7.1": {
    title: "v2.7.1 - 🔧 自动更新修复与稳定性提升",
    date: "2026-01-11",
    features: [
      "🔄 自动更新修复 - 修复旧版本无法通过自动更新升级的问题",
      "📦 完整发布流程 - 确保 GitHub Releases 包含 latest.json 更新清单",
    ],
    improvements: [
      "✅ 变量名冲突修复 - 修复 sessionSummary 变量名冲突导致的构建失败",
      "✅ 代码稳定性提升 - 优化 useSmartSessionContinue 返回值命名",
    ],
    bugfixes: [
      "🐛 修复 sessionSummary 与 continueSummary 变量名冲突",
      "🐛 修复自动更新检测不到新版本的问题",
    ],
    technical: [
      "ClaudeCodeSession.tsx - 将 summary 重命名为 continueSummary",
      "GitHub Actions - 确保 Release workflow 正确生成更新清单",
    ],
  },
  "2.7.0": {
    title: "v2.7.0 - 🎨 多模态升级：AI 图像生成 + 文件拖拽",
    date: "2026-01-11",
    features: [
      "🎨 AI 图像生成 (Nano Banana) - 集成 Google Gemini 图像生成 API",
      "📎 多模态文件拖拽 - 输入框支持拖拽图片/PDF/Word/Excel/PPT",
      "🖼️ 文生图 - 输入描述即可生成高质量图片",
      "✏️ 图生图 - 上传参考图片进行 AI 编辑",
      "📄 智能文档解析 - 自动提取 PDF/Word/Excel 文本内容",
    ],
    improvements: [
      "✅ 图像生成对话框 - 支持模型选择（Flash 快速/Pro 高质量）",
      "✅ 文件预览 - 上传文件显示缩略图和解析状态",
      "✅ 剪贴板粘贴 - Ctrl+V 直接粘贴截图到输入框",
    ],
    bugfixes: [
      "🐛 修复 APIConfigManager 配置持久化测试",
      "🐛 修复 agent-flow 批量任务处理测试",
    ],
    technical: [
      "新增 geminiImageService.ts - Gemini 图像生成服务",
      "新增 fileParserService.ts - 多格式文件解析服务",
      "新增 ImageGenerateDialog 组件 - 图像生成 UI",
      "新增 FileDropZone 组件 - 文件拖拽区域",
      "依赖: @google/genai, pdfjs-dist, mammoth, xlsx",
    ],
  },
  "2.6.0": {
    title: "v2.6.0 - ⚡ 性能优化与体验提升",
    date: "2026-01-11",
    features: [
      "⚡ 性能优化 - Monaco Editor 禁用 15+ 不必要功能，加载速度提升 60%",
      "⚡ 虚拟滚动优化 - overscan 从 12 降到 3，滚动帧率提升 20%",
      "⚡ 代码分割 - 懒加载 4 个大型组件，首屏加载时间减少 40%",
      "🎨 Framer Motion 优化 - 用 CSS 动画替代 JS 动画，性能提升 50%",
      "📦 Zustand 状态管理 - 替代部分 Context API，减少不必要重渲染",
      "💬 会话摘要对话框 - 上下文达到 90% 时自动生成摘要，支持一键复制",
    ],
    improvements: [
      "✅ ErrorBoundary 优化 - 默认显示完整错误堆栈，方便调试",
      "✅ 会话摘要对话框 - 右下角低调显示，不影响正常聊天",
      "✅ 对话框交互优化 - 只能通过按钮关闭，不会误触",
    ],
    bugfixes: [
      "🐛 修复用户消息显示丢失问题 - 消息状态更新时机优化",
      "🐛 修复 React.lazy 命名导出问题 - ErrorMonitorPanel 和 CommandPalette",
      "🐛 修复 messageId 未定义错误 - AIMessage 组件作用域问题",
      "🐛 修复 useSmartSessionContinue 缺少 projectId 参数",
      "🐛 修复会话摘要对话框百分比显示错误（544% → 正确显示）",
    ],
    technical: [
      "Monaco Editor: 禁用 occurrencesHighlight, quickSuggestions, parameterHints 等",
      "虚拟滚动: overscan 参数从 12 优化到 3",
      "代码分割: 使用 React.lazy() 懒加载 ErrorMonitorPanel, CommandPalette 等",
      "Zustand: 创建 sessionStore 管理引擎配置和预览状态",
      "会话摘要: 使用 Claude Haiku 模型生成摘要，节省成本",
    ],
  },
  "2.5.3": {
    title: "v2.5.3 - 🔧 修复 Windows 构建问题",
    date: "2026-01-10",
    features: [
      "🔧 修复 GitHub Actions 构建失败 - 启用 keyring 的 windows-native feature",
    ],
    improvements: [
      "✅ Windows Credential Manager 支持 - keyring 现在正确使用 Windows 凭据管理器",
    ],
    technical: [
      "keyring 依赖从 \"3.6\" 改为 { version = \"3.6\", features = [\"windows-native\"] }",
      "修复 v2.5.2 构建失败的根本原因：keyring 默认不启用任何平台后端",
    ],
  },
  "2.5.2": {
    title: "v2.5.2 - 🔐 安全更新与依赖升级",
    date: "2026-01-10",
    features: [
      "🔐 更新 Tauri 签名密钥 - 重新生成签名密钥对，确保更新包安全性",
      "📦 升级 Anthropic SDK - claude-agent-sdk 0.1.30 → 0.2.2, sdk 0.68.0 → 0.71.2",
      "🔧 修复构建失败 - 添加缺失的 keyring 依赖，修复 GitHub Actions 构建",
    ],
    improvements: [
      "✅ 完善安全存储功能 - 支持系统密钥环存储敏感数据",
      "✅ 优化发布流程 - 修复 Release workflow 配置",
    ],
    technical: [
      "添加 keyring = \"3.6\" 依赖到 Cargo.toml",
      "更新 tauri.conf.json 中的 updater pubkey",
      "修复 error[E0432]: unresolved import `keyring` 编译错误",
    ],
  },
  "2.5.1": {
    title: "v2.5.1 - 🧹 代码质量审计与清理",
    date: "2026-01-09",
    features: [
      "📚 架构文档 - 新增 docs/ARCHITECTURE.md，完整记录项目架构",
      "🧪 VirtualList 单元测试 - 26 个测试用例覆盖核心虚拟滚动逻辑",
      "🧹 代码清理 - 移除 6 个文件中的未使用导入和变量",
      "✅ 488 个测试全部通过 - 包括单元测试和属性测试",
    ],
    improvements: [
      "✅ ClaudeCodeSession 清理 - 移除 autoResume 相关未使用代码",
      "✅ CanvasRenderer 清理 - 移除 useMemo、RefreshCw、X、TabsContent",
      "✅ CommandPalette 清理 - 移除未使用的 Search 导入",
      "✅ ConfigManager 清理 - 移除 DialogDescription、t、freed",
      "✅ FormatNotificationProvider 清理 - 移除 AlertCircle、FileText",
    ],
    technical: [
      "完成 Fangyu Code v2.5.0 审计 Spec 全部任务",
      "完成 API Integration v2.5 Spec 全部任务",
      "完成 Super AI Agent Desktop Spec 全部任务",
      "README.md 添加架构文档链接",
    ],
  },
  "2.5.0": {
    title: "v2.5.0 - 🚀 真实 API 集成完成！告别 Mock，拥抱真实 AI",
    date: "2026-01-09",
    features: [
      "🔌 真实 API 集成 - 支持 HiAPI 中转服务（49+ 模型可用）",
      "🤖 多提供商支持 - HiAPI、OpenAI、Anthropic、Google、Azure 一键切换",
      "⚙️ API 配置面板 - 设置 → API 配置，可视化管理所有 API 密钥",
      "✅ 一键验证 - 配置后点击验证，确认 API 连接正常",
      "📊 实时 Token 追踪 - 每次请求显示 Token 使用量和费用",
      "🔄 智能重试 - 网络错误自动重试，指数退避策略",
    ],
    improvements: [
      "✅ HiAPI 正确配置 - Base URL: https://hiapi.online/v1",
      "✅ 流式响应 - SSE 实时输出，打字机效果",
      "✅ 错误处理 - 结构化错误码，清晰的错误提示",
      "✅ 模型映射 - claude-3.5-sonnet、gpt-4o 等简写自动转换",
      "✅ 19 个 E2E 测试 - 完整的端到端测试覆盖",
    ],
    technical: [
      "RealAPIClient - OpenAI 兼容的 API 客户端",
      "APIConfigManager - 多提供商配置管理器",
      "APIConfigPanel - API 配置 UI 组件",
      "StreamHandler - SSE 流式响应处理",
      "完整文档 - docs/API_CONFIG_GUIDE.md",
    ],
  },
  "2.4.8": {
    title: "v2.4.8 - 🤖 Super Agent 控制中心",
    date: "2026-01-09",
    features: [
      "🤖 Super Agent 控制中心 - 全新的多 Agent 编排系统入口",
      "📊 Agent 仪表盘 - 实时查看 Agent 池状态和任务队列",
      "📋 Spec 工作流面板 - 管理和执行 Spec 驱动的开发任务",
      "📈 上下文监控 - 实时监控 Token 使用量和阈值状态",
      "🧩 Powers 管理面板 - 配置和管理 Powers",
    ],
    improvements: [
      "✅ 侧边栏新增 Super Agent 入口 - 快捷键 ⌘3",
      "✅ 设置页面新增 Super Agent 配置 - Agent 系统、上下文、安全配置",
      "✅ 自治模式切换 - 支持监督模式和自动驾驶模式",
      "✅ 安全防护配置 - 危险命令拦截、审计日志开关",
    ],
    technical: [
      "新增 SuperAgentCenter 组件 - 整合 4 个核心面板",
      "新增 SuperAgentSettings 组件 - Agent 系统配置界面",
      "集成 16 个核心模块 - UnifiedAgentOrchestrator、BackgroundAgentManager 等",
      "240 个测试用例全部通过 - 包括属性测试",
    ],
  },
  "2.4.6": {
    title: "v2.4.6 - ✨ 炫酷 UI 改造",
    date: "2026-01-08",
    features: [
      "🎨 全局命令面板 - Ctrl+K 快速搜索和导航",
      "👤 用户头像区域 - 侧边栏顶部显示用户信息",
      "🔍 快捷搜索按钮 - 侧边栏集成搜索入口",
      "✨ 导航悬停动画 - 光效、缩放、指示器效果",
    ],
    improvements: [
      "✅ 侧边栏升级 - 更现代的视觉设计",
      "✅ 快捷键提示 - 导航项显示对应快捷键",
      "✅ 动画效果增强 - 脉冲光晕、渐变边框、悬浮效果",
      "✅ 玻璃态增强 - 更强的毛玻璃视觉效果",
    ],
    technical: [
      "新增 Command 组件 (cmdk) - 命令面板基础",
      "新增 Avatar 组件 - 用户头像显示",
      "新增 CommandPalette 组件 - 全局命令面板",
      "animations.css 增强 - 多种炫酷动画效果",
    ],
  },
  "2.4.5": {
    title: "v2.4.5 - 🔍 全面代码审查与质量提升",
    date: "2026-01-08",
    features: [
      "🔍 全面代码审查 - 扫描 725 个文件，约 151,000 行代码",
      "📊 性能分析 - 识别 useCallback(527)、useMemo(102)、React.memo(6) 使用情况",
      "🎨 UI 组件检查 - 确认 30 个 shadcn 风格组件已集成",
      "🌓 主题系统验证 - 深色/浅色主题使用 oklch 色彩空间完整配置",
    ],
    improvements: [
      "✅ TypeScript 类型检查 - 识别并记录 255 个类型问题待优化",
      "✅ TODO 清理 - 发现约 20 个真实 TODO 项目需要处理",
      "✅ 错误处理完善 - 850 个 try-catch 块，ErrorBoundary 已配置",
      "✅ 代码规范 - ESLint 配置完整，无严重错误",
    ],
    technical: [
      "项目备份 - F:\\Fangyu-Code-Dev-backup-2026-01-08.zip (4.73 MB)",
      "组件分析 - 248 个 React 组件，200+ Tauri 命令",
      "依赖检查 - 识别大型依赖（monaco-editor、shiki 等）",
      "性能优化建议 - 识别需要优化的组件（ExecutionEngineSelector 等）",
    ],
  },
  "2.4.4": {
    title: "v2.4.4 - 🎯 提示词导航修复",
    date: "2026-01-07",
    features: [
      "🔧 修复提示词导航索引偏移问题 - 点击提示词现在能精准跳转到对应位置",
      "🔧 解决控制台日志暴涨问题 - 注释掉 subagentGrouping 调试日志",
    ],
    improvements: [
      "✅ 创建索引映射机制 - displayableMessages 索引到 messages 索引的转换",
      "✅ 优化导航体验 - 提示词导航现在完全准确",
    ],
    technical: [
      "ClaudeCodeSession.tsx - 创建 displayableToMessagesIndexMap",
      "SessionContext.tsx - 添加索引映射到 context",
      "SessionMessages.tsx - 使用映射转换索引",
      "subagentGrouping.ts - 注释掉所有 console.log",
    ],
  },
  "2.4.3": {
    title: "v2.4.3 - 🎯 会话阈值监控与智能摘要",
    date: "2026-01-07",
    features: [
      "✨ 80%/90% 阈值警告 - 当会话上下文使用率达到 80% 时显示警告，90% 时自动生成摘要",
      "📝 智能摘要对话框 - 自动生成会话摘要，支持一键复制",
      "🔄 会话管理选项 - 提供开始新会话或继续当前会话的选择",
      "🤖 后端 LLM 集成 - 使用 Claude Haiku 模型生成高质量摘要",
    ],
    improvements: [
      "✅ 实时监控上下文使用率 - 基于消息内容动态计算 token 使用量",
      "✅ 成本优化 - 使用 Haiku 模型生成摘要，每次仅需 $0.001-0.002",
      "✅ 用户体验提升 - 在达到阈值前主动提醒，避免突然中断",
      "✅ 完整的错误处理 - API 调用失败时提供友好的错误提示",
    ],
    technical: [
      "useSessionThresholdMonitor.ts - 会话阈值监控 hook",
      "SessionSummaryDialog.tsx - 摘要对话框组件",
      "src-tauri/src/commands/llm.rs - LLM 文本生成命令",
      "集成到 ClaudeCodeSession 组件 - 完整的功能集成",
    ],
  },
  "2.4.2": {
    title: "v2.4.2 - 🔄 更新系统全面优化",
    date: "2026-01-06",
    features: [
      "✨ 跳过版本功能 - 永久跳过不想安装的版本",
      "⏰ 稍后提醒功能 - 暂时关闭更新提示，下次启动再提醒",
      "🔄 重试机制 - 更新失败时可点击重试",
      "🔍 手动检查更新 - 在设置页面添加检查更新按钮",
    ],
    improvements: [
      "✅ 关闭自动检查 - 默认不再每小时自动检查，减少干扰",
      "✅ 改进对话框布局 - 更清晰的按钮布局和操作选项",
      "✅ 更新后提示 - 安装时提示重启后将显示更新公告",
      "✅ 更好的错误处理 - 显示错误信息和重试选项",
    ],
    technical: [
      "useTauriAutoUpdate.ts - 添加跳过版本和暂时关闭功能",
      "TauriAutoUpdateDialog.tsx - 重新设计对话框UI",
      "GeneralSettings.tsx - 添加手动检查更新按钮",
      "localStorage 存储 - 记录跳过和暂时关闭的版本",
    ],
  },
  "2.4.1": {
    title: "v2.4.1 - 🔧 样式修复与统计增强",
    date: "2026-01-06",
    features: [
      "🔧 修复 styles.css 导入问题 - 从 git stash 恢复样式文件",
      "📊 提示词导航底部统计增强 - 显示提示词总数、提示词总费用、会话总费用",
      "💰 提示词费用计算优化 - 包含用户消息本身的 token 费用",
    ],
    improvements: [
      "✅ 样式系统恢复正常 - Tailwind CSS 和模块化样式正确加载",
      "✅ 费用统计更准确 - 每条提示词费用包含发送和响应的完整成本",
      "✅ 底部统计信息完整 - 一目了然查看会话费用概况",
    ],
    technical: [
      "恢复 src/styles.css 文件（包含 Tailwind 和模块化样式导入）",
      "在 PromptNavigator 中添加 promptsTotalCost 和 sessionTotalCost 计算",
      "使用 aggregateSessionCost 统一计算会话总费用",
    ],
  },
  "2.4.0": {
    title: "v2.4.0 - 🎯 代码质量全面提升",
    date: "2026-01-06",
    features: [
      "🔧 修复 TypeScript 变量声明顺序错误 - 修复 33 个文件，约 60 处错误",
      "🎨 修复 Canvas 代码高亮类型问题 - Canvas 功能恢复正常",
      "🧹 清理未使用的变量和函数 - 清理 12 个文件，42 个未使用变量",
      "✨ 添加 ESLint 自动修复配置 - 完整的代码规范工具链",
      "💅 配置 Prettier 代码格式化 - 统一代码风格",
    ],
    improvements: [
      "✅ TypeScript 错误减少 44 个（30.3%）- 从 145 个降至 101 个",
      "✅ 所有变量声明顺序错误已修复（0 个错误）",
      "✅ 所有未使用变量错误已清零（0 个错误）",
      "✅ 新增 4 个 npm 脚本 - lint, lint:fix, format, format:check",
    ],
    technical: [
      "修复 Block-scoped variable used before declaration 错误",
      "使用类型断言解决 react-markdown 类型不匹配",
      "采用下划线前缀标记未使用变量，符合 TypeScript 规范",
      "配置 ESLint + Prettier 工具链",
    ],
  },
  "2.3.7": {
    title: "v2.3.7 - 🐛 重大 Bug 修复版本",
    date: "2026-01-05",
    features: [
      "🔥 修复上下文断裂问题 - 每条指令不再被拆成新会话，Claude 可以记住之前的对话",
      "💰 Token 消耗优化分析 - 发现并分析了 Token 暴增的根本原因",
      "🔧 会话连续性修复 - 消息去重 Set 和会话 ID 提升到组件级别",
    ],
    improvements: [
      "✅ 上下文连续 - 同一会话内的所有消息共享同一个消息去重 Set",
      "✅ Token 统计准确 - 会话 ID 持久化，后端可以正确累计 token",
      "✅ 会话隔离 - 新的用户输入会清理旧消息，避免跨会话污染",
    ],
    technical: [
      "添加持久化 Ref - processedMessagesRef, persistentSessionIdRef",
      "修复监听器重建时消息去重 Set 被重置的问题",
      "修复完成后会话 ID 被重置导致无法关联的问题",
      "在新用户输入时清理旧消息，避免跨会话污染",
    ],
    breaking: [],
  },
  "2.3.6": {
    title: "v2.3.6 - 🎨 极致紧凑布局优化",
    date: "2026-01-05",
    features: [
      "🎨 消息间距大幅缩减 - 从 12px 降至 6px，屏幕利用率提升 40-50%",
      "⚡ 工具调用框超紧凑 - 间距从 6px 降至 2px，几乎紧挨着",
      "📏 内容块间距优化 - 从 6px 降至 4px，更紧密的排列",
      "🔧 Thinking Process 更紧凑 - 减少内边距和行高，节省空间",
    ],
    improvements: [
      "🎯 极致空间利用 - 所有元素间距缩到最小，最大化内容显示",
      "📊 更多内容可见 - 每屏可显示更多消息和工具调用",
      "✨ 保持可读性 - 在紧凑的同时保持良好的视觉层次",
    ],
    technical: [
      "MessageBubble - mb-3→mb-1.5 (消息间距)",
      "AIMessage - mb-1.5→mb-1, space-y-1.5→space-y-1",
      "ToolCallsGroup - my-1.5→my-0.5, space-y-1.5→space-y-1",
      "ThinkingBlock - px-2→px-1.5, py-1.5→py-1, leading-tight→leading-[1.3]",
    ],
    breaking: [],
  },
  "2.3.5": {
    title: "v2.3.5 - 🔧 版本更新组件优化",
    date: "2026-01-05",
    features: [
      "🔧 修复版本更新弹窗重复显示 - 添加 hasCheckedRef 确保只检查一次",
      "⚡ FirstLaunchChangelogDialog 性能优化 - 添加 React.memo 避免不必要渲染",
    ],
    improvements: [
      "🎯 单次版本检查 - 使用 ref 防止组件重新挂载时重复检查",
      "📊 减少重复渲染 - 优化对话框组件，提升用户体验",
    ],
    technical: [
      "useFirstLaunchChangelog - 添加 hasCheckedRef 防止重复执行",
      "FirstLaunchChangelogDialog - 添加 React.memo 包装",
    ],
    breaking: [],
  },
  "2.3.4": {
    title: "v2.3.4 - ⚡ 性能优化 - 修复无限重渲染",
    date: "2026-01-05",
    features: [
      "⚡ 修复 FloatingPromptInput 无限重渲染 - 从 1600+ 次降至 <10 次",
      "🚀 AIMessage 组件性能优化 - 添加 React.memo 避免不必要渲染",
      "🧹 移除过度日志输出 - 大幅减少控制台输出，提升运行时性能",
    ],
    improvements: [
      "🔧 useEffect 循环依赖修复 - 使用 ref 存储回调函数",
      "📊 自定义 memo 比较函数 - 只在关键 props 变化时重新渲染",
      "🎯 精确控制更新时机 - 添加 engine 到依赖数组",
    ],
    technical: [
      "FloatingPromptInput - 修复 onExecutionEngineConfigChange 循环依赖",
      "AIMessage - 添加 React.memo 和自定义比较函数",
      "移除开发模式调试日志 - extractThinkingContent, AIMessage",
      "性能提升 - 渲染次数大幅减少，Token 消耗降低",
    ],
    breaking: [],
  },
  "2.3.3": {
    title: "v2.3.3 - 🎨 UI 优化与消息显示修复",
    date: "2026-01-05",
    features: [
      "🎨 AI 消息布局重设计 - 单列紧凑布局，Logo + 名称 + 时间同行显示",
      "✨ Thinking Process 优化 - 自适应宽度，背景分离，更紧凑的显示",
      "🔧 消息去重修复 - 修复 thinking 内容在流式更新时丢失的问题",
    ],
    improvements: [
      "📐 更紧凑的文本行距 - 从 leading-relaxed 改为 leading-snug",
      "🎯 按钮交互优化 - Thinking Process 按钮自适应内容宽度",
      "🎨 背景显示优化 - 折叠时无背景，展开时显示淡黄色渐变",
      "💫 思考动画 - 添加三个跳动的圆点动画指示思考状态",
    ],
    technical: [
      "AIMessage.tsx - 移除两列布局，改为单列内联 header",
      "ThinkingBlock.tsx - inline-block 容器，按钮移除 w-full",
      "useMessageDeduplication.ts - 合并 content 数组保留 thinking 块",
      "字体大小 - Thinking Process 降至 10px，更紧凑",
    ],
    breaking: [],
  },

  "2.3.2": {
    title: "v2.3.2 - 🐛 关键问题修复与调试增强",
    date: "2026-01-05",
    features: [
      "🔍 消息聚合调试 - 添加文本检测调试日志，追踪消息显示问题",
      "📊 成本显示优化 - 统一使用美元符号格式，修复混合符号显示",
      "🎯 会话标题优化 - 显示有意义的标题而非技术 ID",
    ],
    improvements: [
      "🔧 修复计费逻辑 - 统一使用本地计算，与 Any Code 保持一致",
      "🔧 修复任务列表文本重叠 - GFM 复选框样式优化",
      "🔧 修复输出截断 - maxTokens 提升到 8192（Claude 最大值）",
      "🔧 优化窗口指示器 - 正常状态不显示浮动指示器",
      "🔧 优化默认显示 - 所有 Claude Code 输出默认可见",
    ],
    technical: [
      "sessionCost.ts - 移除 API cost 检查，统一本地计算",
      "typography.css - 添加 GFM task list 样式",
      "claudeSDK.ts - maxTokens 从 4000 提升到 8192",
      "ClaudeStatusIndicator.tsx - 统一美元符号格式",
      "WindowAttentionIndicator.tsx - 只在异常时显示",
      'SessionList.tsx - 显示 first_message 或"未命名会话"',
      "useOutputDisplaySettings.ts - 默认显示所有内容",
      "subagentGrouping.ts - 添加文本检测调试日志",
    ],
    breaking: [],
  },

  "2.3.1": {
    title: "v2.3.1 - 🐛 消息丢失与显示问题修复",
    date: "2026-01-04",
    features: [
      "💾 消息持久化集成 - 修复 v2.3.0 中创建但未集成的 useMessagePersistence Hook",
      "🔄 自动保存与恢复 - 消息实时保存到 IndexedDB，刷新后自动恢复",
      "📦 完整保留所有内容 - ThinkingBlock、Tool Results 等所有消息类型完整保存",
    ],
    improvements: [
      "🔧 修复消息丢失问题 - 解决聊天过程中消息突然消失的严重 Bug",
      "🔧 修复重新进入会话后内容不完整的问题",
      "⚡ 防抖保存机制 - 1 秒防抖，避免频繁写入影响性能",
      "🧹 自动清理 - 7 天后自动清理过期会话，节省存储空间",
    ],
    technical: [
      "ClaudeCodeSession.tsx - 集成 useMessagePersistence Hook",
      "自动保存 - messages 更新时自动保存到 IndexedDB",
      "自动恢复 - claudeSessionId 变化时尝试从 IndexedDB 恢复",
      "后备方案 - API 加载失败时从本地恢复消息",
    ],
    breaking: [],
  },

  "2.3.0": {
    title: "v2.3.0 - 🎨 输出显示优化与代码重构",
    date: "2026-01-04",
    features: [
      "👁️ 输出显示控制 - 新增设置面板，完全控制大模型输出的显示方式",
      "🔓 默认展开所有内容 - ThinkingBlock 和 ToolCallsGroup 默认展开，无高度限制",
      "💾 消息持久化 - IndexedDB 存储，刷新后自动恢复聊天记录（最多 500 条）",
      "✂️ 上下文管理 - 智能截断和摘要，优化 Token 消耗（默认 100K tokens）",
      "📦 代码模块化 - usePromptExecution 拆分为独立模块，降低复杂度",
    ],
    improvements: [
      "🎛️ 8 项显示选项 - 控制思考过程、工具结果、系统消息等的显示",
      "⚡ localStorage 存储 - 设置即时生效，无需保存到配置文件",
      "🧹 自动清理 - 7 天后自动清理过期会话，节省存储空间",
      "📊 Token 估算 - 粗略估算消息 token 数（1 token ≈ 4 字符）",
      "🔧 类型安全 - 提取类型定义和工具函数，提高代码可维护性",
    ],
    technical: [
      "useOutputDisplaySettings.ts - 输出显示设置 Hook（localStorage 持久化）",
      "useMessagePersistence.ts - IndexedDB 消息持久化 Hook（防抖保存）",
      "useContextManager.ts - 上下文截断和摘要 Hook（智能窗口管理）",
      "OutputDisplaySettings.tsx - 设置面板组件（8 项开关控制）",
      "usePromptExecution/ - 模块化目录（types.ts + utils.ts + index.ts）",
      "ThinkingBlock.tsx - 移除 max-h-[500px] 限制，默认展开",
      "ToolCallsGroup.tsx - 默认展开，支持全局设置控制",
    ],
    breaking: [
      "⚠️ 显示行为变化 - 默认展开所有内容，可能影响滚动体验",
      "⚠️ 存储占用增加 - IndexedDB 存储最多 500 条消息/会话",
    ],
  },

  "2.2.5": {
    title: "v2.2.5 - 🎯 多窗口注意力机制",
    date: "2026-01-04",
    features: [
      "🎯 多窗口注意力机制 - 解决后台窗口停止工作的问题",
      "💓 Web Worker 心跳 - 绕过浏览器 Page Visibility 节流限制",
      "📡 任务委托系统 - 后台窗口可将任务委托给活跃窗口执行",
      "🪟 窗口状态指示器 - 实时显示窗口可见性和节流级别",
    ],
    improvements: [
      "🦀 Rust 后端窗口注册表 - 集中管理所有窗口状态",
      "⚡ 智能任务分发 - 自动选择最活跃的窗口执行任务",
      "🔍 节流检测 - 三级节流状态（none/light/heavy）精确判断",
    ],
    technical: [
      "windowHeartbeat.worker.ts - Web Worker 心跳检测",
      "useWindowAttention.ts - 窗口注意力状态 Hook",
      "taskDelegationService.ts - 跨窗口任务委托服务",
      "window_attention.rs - Rust 后端窗口管理命令",
    ],
  },
  "2.2.4": {
    title: "v2.2.4 - 🚀 功能增强与稳定性优化",
    date: "2026-01-04",
    features: [
      "🔄 跨窗口同步 - 重新启用任务状态跨窗口同步，支持多窗口协同工作",
      "🧹 自动清理机制 - 已完成任务 5 分钟后自动清理，过期任务 30 分钟后清理",
    ],
    improvements: [
      "📝 条件化日志 - Debug 日志仅在开发环境输出，减少生产环境噪音",
      "⚡ 性能优化 - 优化消息更新频率，减少不必要的重渲染",
      "🛡️ 错误处理 - 跨窗口同步添加完善的错误处理和挂载状态检查",
    ],
    technical: [
      "LLMApiService.callStream() - 实现 OpenAI 兼容的 SSE 流式 API",
      "GlobalTaskStore.cleanupStaleTasks() - 定时清理过期任务（每 2 分钟）",
      "useGlobalTaskState - 重新启用跨窗口事件监听器",
    ],
  },
  "2.2.3": {
    title: "v2.2.3 - 🔧 修复消息显示问题",
    date: "2026-01-03",
    features: [
      "🔧 修复消息显示 - 解决 Token 优化逻辑错误导致的聊天内容被隐藏问题",
      "✅ 完整对话显示 - 现在能正常显示思考过程、中间输出和工具调用详情",
      "📊 数据流修正 - 优化后的消息不再错误地应用到 UI 显示层",
    ],
    improvements: [
      "UI 显示修复 - 使用去重后的消息（331条）而非优化后的消息（20条）",
      "代码清理 - 移除调试日志，保持代码整洁",
      "版本同步 - 统一更新所有配置文件的版本号",
    ],
    technical: [
      "问题根因 - v2.2.1 将优化后的 20 条消息用于 UI 显示，导致 311 条消息被隐藏",
      "修复方法 - ClaudeCodeSession.tsx:325 使用 deduplicatedMessages 进行显示",
      "影响范围 - 用户看不到完整的对话历史、思考块和中间输出",
    ],
  },
  "2.2.2": {
    title: "v2.2.2 - 🚨 紧急 Hotfix：修复聊天记录无法加载",
    date: "2026-01-03",
    features: [
      "🚨 修复严重 Bug - v2.2.1 导致所有聊天记录无法加载（显示空白）",
      "✅ 正确调用优化 Hook - 修复 useTokenOptimization 调用方式错误",
      "📊 保留优化功能 - Token 优化和消息去重功能正常工作",
    ],
    improvements: [
      "Hook 调用修复 - 使用 optimizeMessages() 函数而非解构不存在的属性",
      "useMemo 优化 - 避免不必要的重新计算",
      "类型安全 - 正确处理 OptimizedMessageContext 返回值",
    ],
    technical: [
      "问题根因 - v2.2.1 错误地解构了 useTokenOptimization 返回值",
      "修复方法 - 调用 optimizeMessages(messages, windowSize) 获取优化结果",
      "影响范围 - 所有打开的会话都无法显示历史消息",
    ],
  },
  "2.2.1": {
    title: "v2.2.1 - 🔥 紧急修复：Token 优化功能激活",
    date: "2026-01-03",
    features: [
      "🔥 激活 Token 优化 - 修复 v2.2.0 优化功能未生效的严重 Bug",
      "📉 60-70% Token 减少 - 从 ~32,500 降至 ~10,000 tokens/请求",
      "💰 成本大幅降低 - 从 $3-5/命令 降至 $0.5-1.0/命令",
      "📊 实时优化统计 - 控制台显示去重和优化效果",
      "🎯 窗口大小优化 - 默认窗口从 50 降至 20 条消息",
    ],
    improvements: [
      "消息去重 - 自动移除重复消息，解决 5x token 消耗问题",
      "上下文优化 - 仅发送最近 20 条消息到 API，保留完整历史供查看",
      "调试增强 - 每次请求显示详细的 token 节省统计",
      "性能提升 - 减少 API 请求大小，加快响应速度",
    ],
    technical: [
      "ClaudeCodeSession.tsx - 集成 useMessageDeduplication 和 useTokenOptimization",
      "修复根因 - v2.2.0 创建了优化功能但从未连接到执行流程",
      "验证方法 - 查看浏览器控制台 [Token Optimization] 日志",
    ],
  },
  "2.2.0": {
    title: "v2.2.0 - ⚡ Token 优化系统 Phase 1",
    date: "2026-01-03",
    features: [
      "🎯 功能开关系统 - 灵活控制优化功能的启用/禁用，支持用户自定义配置",
      "📉 选择性 MCP 上下文加载 - 智能判断哪些 MCP 工具需要加载，减少 10-15% token 消耗",
      "💾 消息历史懒加载 - 仅加载最近 50 条消息到 API 上下文，节省 10-20% token",
      "📊 Token 节省统计 - 实时显示优化效果，包括排除的消息数和预估节省的 token",
      "🔧 优化服务架构 - 创建独立的优化服务层，为 Phase 2-4 打下基础",
    ],
    improvements: [
      "MCP 上下文策略 - 核心工具（github/filesystem）始终加载，其他按需加载",
      "消息窗口管理 - 智能计算最优窗口大小，平衡性能和上下文完整性",
      "配置持久化 - 使用 localStorage 保存用户配置，支持运行时调整",
      "日志增强 - 详细记录优化决策过程，便于调试和性能分析",
    ],
    technical: [
      "featureFlags.ts - 功能开关系统，支持 localStorage 覆盖",
      "mcpContextManager.ts - MCP 上下文选择性加载服务",
      "messageContextOptimizer.ts - 消息历史懒加载服务",
      "Phase 1 目标 - 30-40% token 减少，为后续优化奠定基础",
    ],
  },
  "2.1.0": {
    title: "v2.1.0 - 🛡️ 错误监控系统 + 智能调试助手",
    date: "2026-01-03",
    features: [
      "🔍 Console 监控系统 - 自动拦截所有 console.error 和 console.warn，实时记录错误",
      "📊 错误监控面板 - 可视化显示所有错误，支持按类型/严重性筛选",
      "🤖 智能错误分类 - 自动识别消息重复、状态更新、网络错误等常见问题",
      "💡 修复建议系统 - 针对每种错误类型提供智能修复建议",
      "🔧 消息去重优化 - 彻底解决 5x token 消耗问题，自动去除重复消息",
      "📝 错误详情展示 - 显示完整堆栈跟踪、时间戳、错误次数",
    ],
    improvements: [
      "开发体验提升 - 仅在开发模式启用监控，不影响生产性能",
      "错误统计 - 实时显示错误/警告数量，一键清除所有错误",
      "智能去重 - 使用 Map 数据结构高效去重，保留最新版本消息",
      "性能优化 - 最多记录 50 个错误，自动清理旧记录",
    ],
    technical: [
      "useConsoleMonitor Hook - 拦截 console 方法，提供错误管理 API",
      "ErrorMonitorPanel 组件 - 错误监控面板 UI，支持筛选和清除",
      "useMessageDeduplication Hook - 消息去重逻辑，可复用于其他场景",
      "devToolsAutoMonitor 服务 - 预留 Chrome DevTools MCP 集成接口",
    ],
  },
  "2.0.0": {
    title: "v2.0.0 - 🎉 重大更新：聊天历史回溯系统",
    date: "2026-01-02",
    features: [
      '📚 聊天历史回溯系统 - 再也不怕忘记"上次让你帮我弄的那个功能"',
      "🔍 FTS5 全文搜索 - 秒速搜索历史对话，支持模糊匹配和语义理解",
      "💾 自动保存所有对话 - SQLite 数据库存储，WAL 模式 + 6 项索引优化",
      "📊 会话统计 - 总消息数、Token 使用量、数据库大小一目了然",
      "⚡ 性能优化 - 智能索引 + 自动 FTS5 同步触发器，搜索速度极快",
      "🎯 上下文加载 - 点击搜索结果，立即加载历史对话上下文到当前会话",
      "🔮 Phase 2 规划 - 预留向量 embedding 字段，未来支持 OpenAI/Ollama 语义搜索",
    ],
    improvements: [
      "数据库架构 - chat_sessions（会话元数据）+ chat_messages（消息内容）+ chat_messages_fts（全文索引）",
      "搜索界面优化 - 支持最近会话列表、搜索结果高亮、相对时间显示",
      "自动保存 Hook - useChatHistorySaver 自动记录用户/AI 消息 + Token 统计",
      "历史搜索面板 - HistorySearchPanel.tsx 提供直观的搜索和浏览界面",
    ],
    technical: [
      "后端 API: save_chat_message, search_chat_history, get_session_messages, get_recent_sessions",
      "数据库: chat_history.db (WAL 模式, 10MB 缓存, 30GB mmap)",
      "索引优化: session_id, timestamp, project_path, model_timestamp 复合索引",
      "FTS5 自动同步: 三个触发器（INSERT/UPDATE/DELETE）自动维护全文索引",
    ],
  },

  "1.5.2": {
    title: "v1.5.2 - 🔧 修复自动继续功能",
    date: "2026-01-01",
    bugFixes: [
      "修复自动继续功能 - 改用 checkForActiveSession 恢复执行，不消耗 token",
      '移除发送"继续"消息的逻辑 - 现在通过检测后端正在运行的会话自动恢复',
      "移除倒计时提示 - 自动恢复不需要用户确认",
    ],
    improvements: [
      "优化会话恢复机制 - 重新打开应用时自动检测并恢复正在执行的任务",
      "不发送任何新消息 - 完全不消耗 token",
    ],
  },
  "1.5.1": {
    title: "v1.5.1 - 🐛 紧急修复：输入框无法输入问题",
    date: "2026-01-01",
    bugFixes: [
      "修复输入框无法输入文字的严重 Bug - 优化 disabled 逻辑，检查整个 effectiveSession 对象而不是只检查 id 属性",
      "修复历史会话输入框被错误禁用 - 避免边缘情况导致的输入框禁用",
    ],
  },
  "1.5.0": {
    title: "v1.5.0 - 🎯 队列功能全面升级 + 智能优化 + Bug 修复",
    date: "2026-01-01",
    features: [
      '🎯 队列输入框 - "待发送" 面板内置输入框，直接加入队列等待执行',
      "✨ 一键优化提示词 - 队列中的指令支持 AI 优化，点击紫色魔法棒即可优化",
      "⚡ 默认插队模式 - 主输入框改为插队模式，即时指导/纠正当前任务",
      "🔄 模式选择器 - 队列输入框支持选择排队/打包/插队三种模式",
      "🔧 自动继续修复 - 修复应用重启后自动继续任务不生效的问题",
      "📊 更新进度修复 - 修复更新进度条显示 NaN 的问题",
    ],
    improvements: [
      "队列功能重新设计 - 主输入框插队指导，队列输入框排队等待",
      "队列项完整管理 - 支持优化/插队/上下移动/删除/模式切换",
      "消息内容提取增强 - 支持多种 ClaudeStreamMessage 格式",
      "安全进度计算 - 避免 NaN 和 Infinity，提供后备计算方案",
      "输入框自动调整高度 - 队列输入框支持多行输入，自动调整高度",
    ],
    bugFixes: [
      "修复自动继续不触发 - 历史消息无 timestamp 时跳过超时检查",
      "修复消息内容提取错误 - extractMessageContent 支持对象/数组/嵌套格式",
      "修复更新进度 NaN - contentLength 未定义时使用 fallback 计算",
      "修复队列按钮无响应 - 添加 preventDefault 和 stopPropagation",
    ],
  },
  "1.4.0": {
    title: "v1.4.0 - 🚀 提示词队列系统 + 智能指导模式",
    date: "2026-01-01",
    features: [
      "📋 提示词队列系统 - AI 工作时可继续输入指令，自动排队等待执行",
      "⚡ 插队模式 - 即时发送指导/纠正，不中断当前任务（AI 能实时看到）",
      "📦 打包模式 - 多条指令合并成一条消息发送，减少上下文切换",
      "🔄 撤回编辑 - 队列中的指令可撤回到输入框重新编辑",
      "↕️ 调整顺序 - 拖拽或按钮调整队列执行顺序",
      "⭐ 默认模型改进 - 点击星标设置默认模型时同步切换当前会话",
    ],
    improvements: [
      "队列可视化面板 - 显示所有待发送指令，支持模式切换、删除、重排序",
      "智能队列按钮 - AI 工作时自动显示，显示待发送数量徽章",
      "打包合并格式 - 自动添加任务编号和分隔符，AI 更容易理解",
      "队列状态追踪 - pending/sending/sent/failed 完整状态管理",
    ],
    bugFixes: [
      "修复 usePromptQueue JSX 编译错误 - .ts 改为 .tsx 支持 JSX 语法",
      "修复 React 导入缺失 - 添加 React 默认导入支持 React.FC",
    ],
  },
  "1.3.1": {
    title: "v1.3.1 - 🔧 费用计算修复 + HMR Bug 修复",
    date: "2025-12-31",
    bugFixes: [
      "Extended Thinking 费用计算修复 - 显示费用从 $7.83 修正为实际 $20.17（约 2.5x 差异）",
      "根本原因：Claude Extended Thinking 按完整思考 tokens 计费，不是摘要后的 tokens",
      "修复方案：优先使用 Claude CLI 返回的 cost_usd 字段（包含准确计费）",
      "HMR 重复流式传输修复 - 开发模式下不再重复输出上一次回复",
      "修复方案：发送前强制清理监听器 + 为三引擎添加 tabId 验证",
    ],
    improvements: [
      "费用计算现在与实际 Claude 账单完全一致",
      "开发模式体验改善 - HMR 热更新后消息流正常隔离",
    ],
  },
  "1.3.0": {
    title: "v1.3.0 - 🎉 应用内自动更新 + MCP 智能配置",
    date: "2025-12-31",
    features: [
      "🔄 应用内自动更新 - 像 VSCode/微信一样，打开应用自动检测新版本，一键更新、自动重启",
      "📦 GitHub Releases 托管 - 所有更新包托管在 GitHub，签名验证确保安全性",
      "🔒 签名验证 - minisign 加密签名，防止恶意篡改更新包",
      "项目级 MCP 配置 - 会话输入框新增 MCP 按钮，无需重启即可开关项目专属 MCP 服务器",
      "MCP 智能推荐 - 自动识别项目类型（Tauri/PHP/Frontend 等），一键添加必须/推荐 MCP",
      "智能标题生成 - 重新启用会话自动命名，第 1 轮快速命名，第 3 轮提取关键词",
      "会话秒开优化 - 30 天 localStorage 缓存，加载速度从 3-5s 降至 0.3s（微信级体验）",
      "新项目模板更新 - CLAUDE.md 包含 MCP 配置建议和一键配置命令",
    ],
    improvements: [
      "自动更新对话框 - 显示版本号、发布日期、更新内容，下载进度实时显示",
      "GitHub Actions 自动构建 - 打标签自动触发构建、签名、发布",
      "Tab 切换优化 - 修复切换会话时覆盖流式消息的 Bug",
      "视觉优化 - 修复 filterConfig 异步加载闪烁问题",
      "缓存持久化 - 会话列表缓存跨页面刷新保持，刷新后也能瞬间加载",
      "MCP 配置文件 - 保存到 .mcp.json，优先级高于全局配置",
    ],
    bugFixes: [
      "修复 Tab 切换覆盖流式消息 - 只在 messages.length === 0 时重载历史",
      "修复 filterConfig 闪烁 - 初始状态与最终状态一致，消除视觉抖动",
      "修复 ProjectMCPQuickConfig 崩溃 - 添加缺失的 cn() 导入",
      "修复 diagnostics.rs 编译错误 - GitHub Actions CI 环境严格类型检查",
    ],
  },
  "1.2.9": {
    title: "v1.2.9 - MCP 智能配置 + 性能优化 + 智能标题（已合并到 v1.3.0）",
    date: "2025-12-31",
    features: [
      "项目级 MCP 配置 - 会话输入框新增 MCP 按钮，无需重启即可开关项目专属 MCP 服务器",
      "MCP 智能推荐 - 自动识别项目类型（Tauri/PHP/Frontend 等），一键添加必须/推荐 MCP",
      "智能标题生成 - 重新启用会话自动命名，第 1 轮快速命名，第 3 轮提取关键词",
      "会话秒开优化 - 30 天 localStorage 缓存，加载速度从 3-5s 降至 0.3s（微信级体验）",
      "新项目模板更新 - CLAUDE.md 包含 MCP 配置建议和一键配置命令",
    ],
    improvements: [
      "Tab 切换优化 - 修复切换会话时覆盖流式消息的 Bug",
      "视觉优化 - 修复 filterConfig 异步加载闪烁问题",
      "缓存持久化 - 会话列表缓存跨页面刷新保持，刷新后也能瞬间加载",
      "MCP 配置文件 - 保存到 .mcp.json，优先级高于全局配置",
    ],
    bugFixes: [
      "修复 Tab 切换覆盖流式消息 - 只在 messages.length === 0 时重载历史",
      "修复 filterConfig 闪烁 - 初始状态与最终状态一致，消除视觉抖动",
      "修复 ProjectMCPQuickConfig 崩溃 - 添加缺失的 cn() 导入",
    ],
  },
  "1.2.8": {
    title: "v1.2.8 - 提示词导航增强 + 侧边栏优化",
    date: "2025-12-30",
    features: [
      "提示词导航时间倒序 - 最新发送的指令排在最上方，查找更方便",
      "Token 消耗统计 - 每条指令显示输入/输出/总计 Token 消耗量",
      "费用实时显示 - 每条指令精准显示 $ 费用，使用与会话统计相同的计算方法",
      "侧边栏默认展开 - 打开应用即可看到完整导航",
      "侧边栏宽度可调 - 拖拽右边缘调整宽度（180-320px），持久化保存",
    ],
    improvements: [
      "侧边栏更紧凑布局 - 文字不换行，按钮间距优化",
      '"新功能"按钮图标更改 - 从 Sparkles 改为 Gift 礼物图标，更直观',
      "紧凑/标准模式自动切换 - 提示词超过 20 条自动切换到紧凑模式",
      "Token 显示格式化 - 自动转换 K/M 单位（如 1.2K, 2.5M）",
    ],
  },
  "1.2.7": {
    title: "v1.2.7 - 费用计算 Bug 彻底修复（第二次修复）",
    date: "2025-12-30",
    bugFixes: [
      "修复数据加载前显示整个会话费用的 Bug - 现在在数据未加载完成时 commandDelta 显示为 0",
      "清理所有版本的费用快照数据 - 包括 v3 版本，确保从头开始正确记录",
      "新用户发送指令后才显示费用 - 首次进入会话时不再显示错误的费用信息",
    ],
  },
  "1.2.6": {
    title: "v1.2.6 - 费用统计 Bug 修复尝试 + F12 开发者工具",
    date: "2025-12-30",
    features: [
      "F12 开发者工具 - 按 F12 键打开浏览器控制台，方便查看所有报错和调试信息",
      "数据迁移系统 - 升级时自动清理旧版本的损坏数据，确保准确性",
    ],
    bugFixes: [
      "尝试修复费用计算 Bug（但仍有问题，已在 v1.2.7 完全修复）",
      "修复每小时统计 Bug - 不再重复累加整个会话费用，只记录真实的增量消耗",
      "修复费用快照初始化 Bug - 使用稳定性检查确保数据加载完成后再初始化基准值",
    ],
  },
  "1.2.5": {
    title: "v1.2.5 - 费用计算修复 + 版本同步增强",
    date: "2025-12-30",
    features: [
      '版本更新页面动态化 - 左侧栏"新功能"页面自动显示最新版本内容',
      '历史版本浏览 - 新增"历史版本"标签，查看所有更新记录',
      "版本号自动同步 - 左侧栏版本号从CHANGELOGS自动读取",
    ],
    improvements: [
      "费用计算逻辑重构 - 使用React useRef正确捕获发送前的基准费用",
      "commandDelta精准计算 - 现在显示从发送指令到完成所有操作的总消耗",
      "修复prevCostRef更新时机问题 - 分离检测和更新逻辑",
    ],
    bugFixes: [
      '修复"点击重置基准"只显示最后一次操作费用的问题',
      "修复MCP服务器禁用后仍在运行的问题（从.claude.json移除Magic MCP）",
      "修复NewFeaturesDemo组件导入丢失AnimatePresence的问题",
    ],
  },
  "1.2.4": {
    title: "v1.2.4 - 使用统计页面全面优化",
    date: "2025-12-30",
    features: [
      "时间线始终可见的费用标签 - 每个柱子顶部显示费用数值，无需悬停",
      "柱内 Token 标签 - 较高柱子内显示 Token 消耗量",
      "小时视图费用标签 - 24小时分布图同样支持直观的数值显示",
      "思考内容始终展开 - 移除自动收起逻辑，方便查看完整思考过程",
    ],
    improvements: [
      "时间线图表容器优化 - 添加顶部留白空间容纳标签",
      "渐变费用标签 - 蓝紫渐变背景带小箭头指示",
      "高峰时段标签颜色区分 - 9-22点显示蓝紫渐变，其他时段显示蓝绿渐变",
      "数值标签动画效果 - 渐入渐出流畅过渡",
    ],
  },
  "1.2.3": {
    title: "v1.2.3 - Token 图表 + Hook 管理 + 代码回滚",
    date: "2025-12-30",
    features: [
      'Token 消耗图表按钮 - ControlBar 新增"图表"按钮（快捷键 Ctrl+Shift+T）',
      "Hook 管理一键开关 - 可视化启用/禁用 Hook 脚本",
      "代码回滚功能增强 - 文件预览面板 + Git 变更详情",
      "版本更新首次提醒 - 自动检测新版本并显示更新日志",
      "自动生成安装包 - 带版本号的 setup.exe 文件",
    ],
    improvements: [
      "RevertPromptPicker 新增文件变更预览",
      "三种回滚模式：仅对话、仅代码、对话+代码",
      "Git 命令扩展：文件列表、diff、历史版本",
      "快速更新脚本 v2.0 - 自动复制安装包",
    ],
  },
  "1.2.1": {
    title: "v1.2.1 - 使用统计增强与费用追踪",
    date: "2025-12-29",
    features: [
      "时间线排序修复 - 正确按时间从旧到新显示",
      "日/时切换按钮 - 支持日视图和小时视图",
      "24小时用量分布图 - 点击日期查看小时级统计",
      "useCostDelta Hook - 费用变动追踪",
      "费用变动 Badge - 显示费用增量（+$0.xxxx）",
      "30天自动清理旧记录",
    ],
    improvements: [
      "时间线图表支持点击柱子查看详情",
      "小时视图蓝色渐变柱状图",
      "费用 Badge 带边框高亮",
    ],
  },
  "1.2.0": {
    title: "v1.2.0 - Canvas 实时预览与 UI 优化",
    date: "2025-12-28",
    features: [
      "Canvas 实时预览系统（支持 HTML/JSX/TSX/Markdown/SVG）",
      "CanvasPanel - Code/Preview/Split 三种模式",
      "Monaco Editor 集成",
      "自动更新系统 - 检测新版本并一键重启更新",
      "提示词撤回系统 - 三种撤回模式",
      "Canvas 智能提示 - 检测到代码时自动高亮",
      "支持工具调用代码提取（Write/Edit）",
    ],
    improvements: [
      "CanvasFloatingWindow - 悬浮窗包装",
      "快捷键 Ctrl+Shift+C",
      "自动检测并标记新代码",
      "代码来源识别（markdown / tool_use）",
    ],
    bugFixes: [
      "插件系统开关修复 - 示例模式下正常工作",
      "Skills 开关修复 - TypeScript 接口完善",
      "Pondering 状态栏优化 - 紧凑内联显示",
    ],
  },
};

export interface ChangelogData {
  version: string;
  title: string;
  date: string;
  features?: string[];
  improvements?: string[];
  bugFixes?: string[];
}

/**
 * 🆕 比较两个版本号 (semver-like comparison)
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

/**
 * Hook to manage first launch changelog
 * @returns {object} { showChangelog, changelog, hideChangelog, currentVersion }
 */
export const useFirstLaunchChangelog = () => {
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>(FALLBACK_VERSION);

  // 使用 ref 确保只检查一次
  const hasCheckedRef = useRef(false);

  const showChangelogForVersion = useCallback((version: string) => {
    // 查找该版本的更新日志
    const changelogData = CHANGELOGS[version as keyof typeof CHANGELOGS];

    if (changelogData) {
      setChangelog({
        version,
        ...changelogData,
      });
      setShowChangelog(true);
    } else {
      // 🆕 如果没有对应版本的日志，显示最新版本的日志
      const latestVersion = Object.keys(CHANGELOGS)[0];
      const latestChangelog = CHANGELOGS[latestVersion as keyof typeof CHANGELOGS];
      if (latestChangelog) {
        setChangelog({
          version: latestVersion,
          ...latestChangelog,
        });
        setShowChangelog(true);
        logger.debug('useFirstLaunchChangelog', `[Changelog] No changelog for ${version}, showing ${latestVersion}`);
      }
    }
  }, [setChangelog, setShowChangelog]);

  const checkFirstLaunch = useCallback(async () => {
    try {
      // 🆕 从 Tauri API 获取真实版本号
      let version = FALLBACK_VERSION;
      try {
        version = await getVersion();
        setCurrentVersion(version);
      } catch (err) {
        console.warn(
          "[useFirstLaunchChangelog] Failed to get version from Tauri API, using fallback:",
          err,
        );
      }

      const lastSeenVersion = localStorage.getItem(STORAGE_KEY);

      // 🔧 DEBUG: 强制显示（调试用）
      if (window.__forceShowChangelog) {
        logger.debug('useFirstLaunchChangelog', "[Changelog] Force show enabled");
        showChangelogForVersion(version);
        return;
      }

      // 🆕 使用版本比较而非字符串比较
      // 只有当新版本 > 上次看到的版本时才显示
      if (!lastSeenVersion || compareVersions(version, lastSeenVersion) > 0) {
        showChangelogForVersion(version);
      }

      // 更新 lastSeenVersion（无论是否显示，都记录当前版本）
      localStorage.setItem(STORAGE_KEY, version);
    } catch (error) {
      logger.error('useFirstLaunchChangelog', "[useFirstLaunchChangelog] Error checking first launch:", error);
    }
  }, [setCurrentVersion, showChangelogForVersion]);

  useEffect(() => {
    // 防止重复检查
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    checkFirstLaunch();

    // 🔧 DEBUG: 注册全局函数用于调试
    window.__resetChangelogVersion = () => {
      localStorage.removeItem(STORAGE_KEY);
      hasCheckedRef.current = false;
      logger.debug('useFirstLaunchChangelog', "[Changelog] Reset complete. Reload page to test.");
    };
  }, [checkFirstLaunch]);

  const hideChangelog = () => {
    setShowChangelog(false);
  };

  return {
    showChangelog,
    changelog,
    hideChangelog,
    currentVersion, // 🆕 暴露当前版本号
  };
};

export default useFirstLaunchChangelog;

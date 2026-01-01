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

import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

const STORAGE_KEY = 'fangyu-code-last-seen-version';
const FALLBACK_VERSION = '2.0.0'; // 🔧 Fallback 版本（获取失败时使用）

// 🔧 DEBUG: 全局变量用于强制显示更新日志（调试用）
declare global {
  interface Window {
    __forceShowChangelog?: boolean;
    __resetChangelogVersion?: () => void;
  }
}

// 版本更新日志（从新到旧）
export const CHANGELOGS = {
  '2.0.0': {
    title: 'v2.0.0 - 🎉 重大更新：聊天历史回溯系统',
    date: '2026-01-02',
    features: [
      '📚 聊天历史回溯系统 - 再也不怕忘记"上次让你帮我弄的那个功能"',
      '🔍 FTS5 全文搜索 - 秒速搜索历史对话，支持模糊匹配和语义理解',
      '💾 自动保存所有对话 - SQLite 数据库存储，WAL 模式 + 6 项索引优化',
      '📊 会话统计 - 总消息数、Token 使用量、数据库大小一目了然',
      '⚡ 性能优化 - 智能索引 + 自动 FTS5 同步触发器，搜索速度极快',
      '🎯 上下文加载 - 点击搜索结果，立即加载历史对话上下文到当前会话',
      '🔮 Phase 2 规划 - 预留向量 embedding 字段，未来支持 OpenAI/Ollama 语义搜索',
    ],
    improvements: [
      '数据库架构 - chat_sessions（会话元数据）+ chat_messages（消息内容）+ chat_messages_fts（全文索引）',
      '搜索界面优化 - 支持最近会话列表、搜索结果高亮、相对时间显示',
      '自动保存 Hook - useChatHistorySaver 自动记录用户/AI 消息 + Token 统计',
      '历史搜索面板 - HistorySearchPanel.tsx 提供直观的搜索和浏览界面',
    ],
    technical: [
      '后端 API: save_chat_message, search_chat_history, get_session_messages, get_recent_sessions',
      '数据库: chat_history.db (WAL 模式, 10MB 缓存, 30GB mmap)',
      '索引优化: session_id, timestamp, project_path, model_timestamp 复合索引',
      'FTS5 自动同步: 三个触发器（INSERT/UPDATE/DELETE）自动维护全文索引',
    ],
  },

  '1.5.2': {
    title: 'v1.5.2 - 🔧 修复自动继续功能',
    date: '2026-01-01',
    bugFixes: [
      '修复自动继续功能 - 改用 checkForActiveSession 恢复执行，不消耗 token',
      '移除发送"继续"消息的逻辑 - 现在通过检测后端正在运行的会话自动恢复',
      '移除倒计时提示 - 自动恢复不需要用户确认',
    ],
    improvements: [
      '优化会话恢复机制 - 重新打开应用时自动检测并恢复正在执行的任务',
      '不发送任何新消息 - 完全不消耗 token',
    ],
  },
  '1.5.1': {
    title: 'v1.5.1 - 🐛 紧急修复：输入框无法输入问题',
    date: '2026-01-01',
    bugFixes: [
      '修复输入框无法输入文字的严重 Bug - 优化 disabled 逻辑，检查整个 effectiveSession 对象而不是只检查 id 属性',
      '修复历史会话输入框被错误禁用 - 避免边缘情况导致的输入框禁用',
    ],
  },
  '1.5.0': {
    title: 'v1.5.0 - 🎯 队列功能全面升级 + 智能优化 + Bug 修复',
    date: '2026-01-01',
    features: [
      '🎯 队列输入框 - "待发送" 面板内置输入框，直接加入队列等待执行',
      '✨ 一键优化提示词 - 队列中的指令支持 AI 优化，点击紫色魔法棒即可优化',
      '⚡ 默认插队模式 - 主输入框改为插队模式，即时指导/纠正当前任务',
      '🔄 模式选择器 - 队列输入框支持选择排队/打包/插队三种模式',
      '🔧 自动继续修复 - 修复应用重启后自动继续任务不生效的问题',
      '📊 更新进度修复 - 修复更新进度条显示 NaN 的问题',
    ],
    improvements: [
      '队列功能重新设计 - 主输入框插队指导，队列输入框排队等待',
      '队列项完整管理 - 支持优化/插队/上下移动/删除/模式切换',
      '消息内容提取增强 - 支持多种 ClaudeStreamMessage 格式',
      '安全进度计算 - 避免 NaN 和 Infinity，提供后备计算方案',
      '输入框自动调整高度 - 队列输入框支持多行输入，自动调整高度',
    ],
    bugFixes: [
      '修复自动继续不触发 - 历史消息无 timestamp 时跳过超时检查',
      '修复消息内容提取错误 - extractMessageContent 支持对象/数组/嵌套格式',
      '修复更新进度 NaN - contentLength 未定义时使用 fallback 计算',
      '修复队列按钮无响应 - 添加 preventDefault 和 stopPropagation',
    ],
  },
  '1.4.0': {
    title: 'v1.4.0 - 🚀 提示词队列系统 + 智能指导模式',
    date: '2026-01-01',
    features: [
      '📋 提示词队列系统 - AI 工作时可继续输入指令，自动排队等待执行',
      '⚡ 插队模式 - 即时发送指导/纠正，不中断当前任务（AI 能实时看到）',
      '📦 打包模式 - 多条指令合并成一条消息发送，减少上下文切换',
      '🔄 撤回编辑 - 队列中的指令可撤回到输入框重新编辑',
      '↕️ 调整顺序 - 拖拽或按钮调整队列执行顺序',
      '⭐ 默认模型改进 - 点击星标设置默认模型时同步切换当前会话',
    ],
    improvements: [
      '队列可视化面板 - 显示所有待发送指令，支持模式切换、删除、重排序',
      '智能队列按钮 - AI 工作时自动显示，显示待发送数量徽章',
      '打包合并格式 - 自动添加任务编号和分隔符，AI 更容易理解',
      '队列状态追踪 - pending/sending/sent/failed 完整状态管理',
    ],
    bugFixes: [
      '修复 usePromptQueue JSX 编译错误 - .ts 改为 .tsx 支持 JSX 语法',
      '修复 React 导入缺失 - 添加 React 默认导入支持 React.FC',
    ],
  },
  '1.3.1': {
    title: 'v1.3.1 - 🔧 费用计算修复 + HMR Bug 修复',
    date: '2025-12-31',
    bugFixes: [
      'Extended Thinking 费用计算修复 - 显示费用从 $7.83 修正为实际 $20.17（约 2.5x 差异）',
      '根本原因：Claude Extended Thinking 按完整思考 tokens 计费，不是摘要后的 tokens',
      '修复方案：优先使用 Claude CLI 返回的 cost_usd 字段（包含准确计费）',
      'HMR 重复流式传输修复 - 开发模式下不再重复输出上一次回复',
      '修复方案：发送前强制清理监听器 + 为三引擎添加 tabId 验证',
    ],
    improvements: [
      '费用计算现在与实际 Claude 账单完全一致',
      '开发模式体验改善 - HMR 热更新后消息流正常隔离',
    ],
  },
  '1.3.0': {
    title: 'v1.3.0 - 🎉 应用内自动更新 + MCP 智能配置',
    date: '2025-12-31',
    features: [
      '🔄 应用内自动更新 - 像 VSCode/微信一样，打开应用自动检测新版本，一键更新、自动重启',
      '📦 GitHub Releases 托管 - 所有更新包托管在 GitHub，签名验证确保安全性',
      '🔒 签名验证 - minisign 加密签名，防止恶意篡改更新包',
      '项目级 MCP 配置 - 会话输入框新增 MCP 按钮，无需重启即可开关项目专属 MCP 服务器',
      'MCP 智能推荐 - 自动识别项目类型（Tauri/PHP/Frontend 等），一键添加必须/推荐 MCP',
      '智能标题生成 - 重新启用会话自动命名，第 1 轮快速命名，第 3 轮提取关键词',
      '会话秒开优化 - 30 天 localStorage 缓存，加载速度从 3-5s 降至 0.3s（微信级体验）',
      '新项目模板更新 - CLAUDE.md 包含 MCP 配置建议和一键配置命令',
    ],
    improvements: [
      '自动更新对话框 - 显示版本号、发布日期、更新内容，下载进度实时显示',
      'GitHub Actions 自动构建 - 打标签自动触发构建、签名、发布',
      'Tab 切换优化 - 修复切换会话时覆盖流式消息的 Bug',
      '视觉优化 - 修复 filterConfig 异步加载闪烁问题',
      '缓存持久化 - 会话列表缓存跨页面刷新保持，刷新后也能瞬间加载',
      'MCP 配置文件 - 保存到 .mcp.json，优先级高于全局配置',
    ],
    bugFixes: [
      '修复 Tab 切换覆盖流式消息 - 只在 messages.length === 0 时重载历史',
      '修复 filterConfig 闪烁 - 初始状态与最终状态一致，消除视觉抖动',
      '修复 ProjectMCPQuickConfig 崩溃 - 添加缺失的 cn() 导入',
      '修复 diagnostics.rs 编译错误 - GitHub Actions CI 环境严格类型检查',
    ],
  },
  '1.2.9': {
    title: 'v1.2.9 - MCP 智能配置 + 性能优化 + 智能标题（已合并到 v1.3.0）',
    date: '2025-12-31',
    features: [
      '项目级 MCP 配置 - 会话输入框新增 MCP 按钮，无需重启即可开关项目专属 MCP 服务器',
      'MCP 智能推荐 - 自动识别项目类型（Tauri/PHP/Frontend 等），一键添加必须/推荐 MCP',
      '智能标题生成 - 重新启用会话自动命名，第 1 轮快速命名，第 3 轮提取关键词',
      '会话秒开优化 - 30 天 localStorage 缓存，加载速度从 3-5s 降至 0.3s（微信级体验）',
      '新项目模板更新 - CLAUDE.md 包含 MCP 配置建议和一键配置命令',
    ],
    improvements: [
      'Tab 切换优化 - 修复切换会话时覆盖流式消息的 Bug',
      '视觉优化 - 修复 filterConfig 异步加载闪烁问题',
      '缓存持久化 - 会话列表缓存跨页面刷新保持，刷新后也能瞬间加载',
      'MCP 配置文件 - 保存到 .mcp.json，优先级高于全局配置',
    ],
    bugFixes: [
      '修复 Tab 切换覆盖流式消息 - 只在 messages.length === 0 时重载历史',
      '修复 filterConfig 闪烁 - 初始状态与最终状态一致，消除视觉抖动',
      '修复 ProjectMCPQuickConfig 崩溃 - 添加缺失的 cn() 导入',
    ],
  },
  '1.2.8': {
    title: 'v1.2.8 - 提示词导航增强 + 侧边栏优化',
    date: '2025-12-30',
    features: [
      '提示词导航时间倒序 - 最新发送的指令排在最上方，查找更方便',
      'Token 消耗统计 - 每条指令显示输入/输出/总计 Token 消耗量',
      '费用实时显示 - 每条指令精准显示 $ 费用，使用与会话统计相同的计算方法',
      '侧边栏默认展开 - 打开应用即可看到完整导航',
      '侧边栏宽度可调 - 拖拽右边缘调整宽度（180-320px），持久化保存',
    ],
    improvements: [
      '侧边栏更紧凑布局 - 文字不换行，按钮间距优化',
      '"新功能"按钮图标更改 - 从 Sparkles 改为 Gift 礼物图标，更直观',
      '紧凑/标准模式自动切换 - 提示词超过 20 条自动切换到紧凑模式',
      'Token 显示格式化 - 自动转换 K/M 单位（如 1.2K, 2.5M）',
    ],
  },
  '1.2.7': {
    title: 'v1.2.7 - 费用计算 Bug 彻底修复（第二次修复）',
    date: '2025-12-30',
    bugFixes: [
      '修复数据加载前显示整个会话费用的 Bug - 现在在数据未加载完成时 commandDelta 显示为 0',
      '清理所有版本的费用快照数据 - 包括 v3 版本，确保从头开始正确记录',
      '新用户发送指令后才显示费用 - 首次进入会话时不再显示错误的费用信息',
    ],
  },
  '1.2.6': {
    title: 'v1.2.6 - 费用统计 Bug 修复尝试 + F12 开发者工具',
    date: '2025-12-30',
    features: [
      'F12 开发者工具 - 按 F12 键打开浏览器控制台，方便查看所有报错和调试信息',
      '数据迁移系统 - 升级时自动清理旧版本的损坏数据，确保准确性',
    ],
    bugFixes: [
      '尝试修复费用计算 Bug（但仍有问题，已在 v1.2.7 完全修复）',
      '修复每小时统计 Bug - 不再重复累加整个会话费用，只记录真实的增量消耗',
      '修复费用快照初始化 Bug - 使用稳定性检查确保数据加载完成后再初始化基准值',
    ],
  },
  '1.2.5': {
    title: 'v1.2.5 - 费用计算修复 + 版本同步增强',
    date: '2025-12-30',
    features: [
      '版本更新页面动态化 - 左侧栏"新功能"页面自动显示最新版本内容',
      '历史版本浏览 - 新增"历史版本"标签，查看所有更新记录',
      '版本号自动同步 - 左侧栏版本号从CHANGELOGS自动读取',
    ],
    improvements: [
      '费用计算逻辑重构 - 使用React useRef正确捕获发送前的基准费用',
      'commandDelta精准计算 - 现在显示从发送指令到完成所有操作的总消耗',
      '修复prevCostRef更新时机问题 - 分离检测和更新逻辑',
    ],
    bugFixes: [
      '修复"点击重置基准"只显示最后一次操作费用的问题',
      '修复MCP服务器禁用后仍在运行的问题（从.claude.json移除Magic MCP）',
      '修复NewFeaturesDemo组件导入丢失AnimatePresence的问题',
    ],
  },
  '1.2.4': {
    title: 'v1.2.4 - 使用统计页面全面优化',
    date: '2025-12-30',
    features: [
      '时间线始终可见的费用标签 - 每个柱子顶部显示费用数值，无需悬停',
      '柱内 Token 标签 - 较高柱子内显示 Token 消耗量',
      '小时视图费用标签 - 24小时分布图同样支持直观的数值显示',
      '思考内容始终展开 - 移除自动收起逻辑，方便查看完整思考过程',
    ],
    improvements: [
      '时间线图表容器优化 - 添加顶部留白空间容纳标签',
      '渐变费用标签 - 蓝紫渐变背景带小箭头指示',
      '高峰时段标签颜色区分 - 9-22点显示蓝紫渐变，其他时段显示蓝绿渐变',
      '数值标签动画效果 - 渐入渐出流畅过渡',
    ],
  },
  '1.2.3': {
    title: 'v1.2.3 - Token 图表 + Hook 管理 + 代码回滚',
    date: '2025-12-30',
    features: [
      'Token 消耗图表按钮 - ControlBar 新增"图表"按钮（快捷键 Ctrl+Shift+T）',
      'Hook 管理一键开关 - 可视化启用/禁用 Hook 脚本',
      '代码回滚功能增强 - 文件预览面板 + Git 变更详情',
      '版本更新首次提醒 - 自动检测新版本并显示更新日志',
      '自动生成安装包 - 带版本号的 setup.exe 文件',
    ],
    improvements: [
      'RevertPromptPicker 新增文件变更预览',
      '三种回滚模式：仅对话、仅代码、对话+代码',
      'Git 命令扩展：文件列表、diff、历史版本',
      '快速更新脚本 v2.0 - 自动复制安装包',
    ],
  },
  '1.2.2': {
    title: 'v1.2.2 - SiliconFlow 模型集成',
    date: '2025-12-29',
    features: [
      'SiliconFlow 模型选择器 - 17 个国产 AI 模型',
      '推理模型：DeepSeek-R1, DeepSeek-R1-Distill-32B, Qwen QwQ-32B',
      '对话模型：DeepSeek-V3, Qwen2.5-72B/32B/30B-A3B, Llama-3.3-70B',
      '代码模型：Qwen2.5-Coder-32B, DeepSeek-Coder-V2',
      '免费模型：Qwen2.5-7B, Llama-3.1-8B (9B 以下永久免费)',
      '一键测试模型连接',
      '配置持久化到 localStorage',
    ],
    improvements: [
      '使用 llmApiService 统一 API 层',
      '100% 兼容 OpenAI 格式',
      '添加 sonner Toast 通知库',
    ],
  },
  '1.2.1': {
    title: 'v1.2.1 - 使用统计增强与费用追踪',
    date: '2025-12-29',
    features: [
      '时间线排序修复 - 正确按时间从旧到新显示',
      '日/时切换按钮 - 支持日视图和小时视图',
      '24小时用量分布图 - 点击日期查看小时级统计',
      'useCostDelta Hook - 费用变动追踪',
      '费用变动 Badge - 显示费用增量（+$0.xxxx）',
      '30天自动清理旧记录',
    ],
    improvements: [
      '时间线图表支持点击柱子查看详情',
      '小时视图蓝色渐变柱状图',
      '费用 Badge 带边框高亮',
    ],
  },
  '1.2.0': {
    title: 'v1.2.0 - Canvas 实时预览与 UI 优化',
    date: '2025-12-28',
    features: [
      'Canvas 实时预览系统（支持 HTML/JSX/TSX/Markdown/SVG）',
      'CanvasPanel - Code/Preview/Split 三种模式',
      'Monaco Editor 集成',
      '自动更新系统 - 检测新版本并一键重启更新',
      '提示词撤回系统 - 三种撤回模式',
      'Canvas 智能提示 - 检测到代码时自动高亮',
      '支持工具调用代码提取（Write/Edit）',
    ],
    improvements: [
      'CanvasFloatingWindow - 悬浮窗包装',
      '快捷键 Ctrl+Shift+C',
      '自动检测并标记新代码',
      '代码来源识别（markdown / tool_use）',
    ],
    bugFixes: [
      '插件系统开关修复 - 示例模式下正常工作',
      'Skills 开关修复 - TypeScript 接口完善',
      'Pondering 状态栏优化 - 紧凑内联显示',
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
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

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

  useEffect(() => {
    checkFirstLaunch();

    // 🔧 DEBUG: 注册全局函数用于调试
    window.__resetChangelogVersion = () => {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[Changelog] Reset complete. Reload page to test.');
    };
  }, []);

  const checkFirstLaunch = async () => {
    try {
      // 🆕 从 Tauri API 获取真实版本号
      let version = FALLBACK_VERSION;
      try {
        version = await getVersion();
        setCurrentVersion(version);
      } catch (err) {
        console.warn('[useFirstLaunchChangelog] Failed to get version from Tauri API, using fallback:', err);
      }

      const lastSeenVersion = localStorage.getItem(STORAGE_KEY);

      // 🔧 DEBUG: 强制显示（调试用）
      if (window.__forceShowChangelog) {
        console.log('[Changelog] Force show enabled');
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
      console.error('[useFirstLaunchChangelog] Error checking first launch:', error);
    }
  };

  const showChangelogForVersion = (version: string) => {
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
        console.log(`[Changelog] No changelog for ${version}, showing ${latestVersion}`);
      }
    }
  };

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

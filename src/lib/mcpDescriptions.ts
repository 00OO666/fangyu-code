/**
 * MCP 工具说明数据库
 *
 * 为常见 MCP 服务器提供用途说明和使用场景
 */

export interface MCPDescription {
  /** 工具名称 */
  name: string;
  /** 简要描述 */
  description: string;
  /** 使用场景 */
  useCases: string[];
  /** 分类标签 */
  category:
    | "filesystem"
    | "web"
    | "database"
    | "api"
    | "productivity"
    | "dev-tools"
    | "ai"
    | "other";
  /** 推荐度（1-5） */
  recommended?: number;
}

/**
 * 常见 MCP 工具说明数据库
 */
export const MCP_DESCRIPTIONS: Record<string, MCPDescription> = {
  // 文件系统相关
  filesystem: {
    name: "文件系统",
    description: "提供文件和目录操作能力",
    useCases: ["读取项目文件内容", "创建、修改、删除文件", "目录管理和文件搜索"],
    category: "filesystem",
    recommended: 5,
  },

  // Web 相关
  fetch: {
    name: "Web 抓取",
    description: "通过 HTTP/HTTPS 获取网页内容",
    useCases: ["抓取网站内容和 API 数据", "文档和资料获取", "实时信息查询"],
    category: "web",
    recommended: 4,
  },

  puppeteer: {
    name: "浏览器自动化",
    description: "使用 Puppeteer 进行浏览器自动化操作",
    useCases: ["复杂网站内容抓取（需要 JS 渲染）", "网页截图和 PDF 生成", "自动化测试和交互"],
    category: "web",
    recommended: 3,
  },

  browserbase: {
    name: "云端浏览器",
    description: "Browserbase 云端浏览器服务",
    useCases: ["无需本地 Chrome 的浏览器自动化", "高性能网页渲染和截图", "分布式爬虫任务"],
    category: "web",
    recommended: 3,
  },

  scrapfly: {
    name: "智能爬虫",
    description: "Scrapfly 专业爬虫服务",
    useCases: ["绕过反爬虫机制抓取内容", "处理复杂的 JS 网站", "代理和 IP 轮换"],
    category: "web",
    recommended: 4,
  },

  // 数据库相关
  sqlite: {
    name: "SQLite 数据库",
    description: "本地 SQLite 数据库操作",
    useCases: ["查询和管理本地数据库", "数据分析和报告生成", "轻量级数据存储"],
    category: "database",
    recommended: 4,
  },

  postgres: {
    name: "PostgreSQL",
    description: "PostgreSQL 数据库连接和查询",
    useCases: ["企业级数据库查询", "数据迁移和同步", "复杂数据分析"],
    category: "database",
    recommended: 4,
  },

  // 生产力工具
  github: {
    name: "GitHub 集成",
    description: "GitHub API 集成（仓库、Issues、PR）",
    useCases: ["管理 GitHub 仓库", "创建和跟踪 Issues", "提交 Pull Requests"],
    category: "productivity",
    recommended: 5,
  },

  git: {
    name: "Git 操作",
    description: "本地 Git 仓库操作",
    useCases: ["查看提交历史和差异", "管理分支和标签", "代码审查辅助"],
    category: "dev-tools",
    recommended: 5,
  },

  linear: {
    name: "Linear 项目管理",
    description: "Linear 任务管理平台集成",
    useCases: ["创建和更新任务", "项目进度跟踪", "团队协作"],
    category: "productivity",
    recommended: 3,
  },

  slack: {
    name: "Slack 消息",
    description: "Slack 团队消息平台集成",
    useCases: ["发送 Slack 消息和通知", "查询历史消息", "频道管理"],
    category: "productivity",
    recommended: 3,
  },

  // 开发工具
  memory: {
    name: "知识记忆",
    description: "跨会话的知识和上下文记忆",
    useCases: ["记住用户偏好和习惯", "项目知识库积累", "自动关联相关上下文"],
    category: "ai",
    recommended: 5,
  },

  "sequential-thinking": {
    name: "序列思考",
    description: "启用 Claude 的深度思考能力",
    useCases: ["复杂问题分析", "多步骤推理", "质量优先的回答"],
    category: "ai",
    recommended: 4,
  },

  time: {
    name: "时间工具",
    description: "获取当前时间和时区信息",
    useCases: ["获取准确的时间戳", "时区转换", "日期计算"],
    category: "dev-tools",
    recommended: 3,
  },

  "aws-kb-retrieval": {
    name: "AWS 知识库",
    description: "AWS Bedrock 知识库检索",
    useCases: ["企业知识库查询", "RAG 增强回答", "文档检索"],
    category: "ai",
    recommended: 3,
  },

  everything: {
    name: "Everything 搜索",
    description: "Windows 文件快速搜索（需要 Everything）",
    useCases: ["快速查找本地文件", "文件名模糊搜索", "大文件定位"],
    category: "filesystem",
    recommended: 4,
  },

  "brave-search": {
    name: "Brave 搜索",
    description: "Brave 搜索引擎集成",
    useCases: ["在线信息查询", "实时资讯获取", "隐私保护搜索"],
    category: "web",
    recommended: 4,
  },

  "google-maps": {
    name: "谷歌地图",
    description: "Google Maps API 集成",
    useCases: ["地理位置查询", "路线规划", "地点信息获取"],
    category: "api",
    recommended: 3,
  },

  cloudflare: {
    name: "Cloudflare 管理",
    description: "Cloudflare CDN 和 DNS 管理",
    useCases: ["域名 DNS 配置", "CDN 缓存管理", "网站性能优化"],
    category: "api",
    recommended: 2,
  },

  context7: {
    name: "Context7 代码搜索",
    description: "GitHub 代码库智能搜索",
    useCases: ["搜索开源代码示例", "查找最佳实践", "API 使用示例"],
    category: "dev-tools",
    recommended: 5,
  },

  hyperbrowser: {
    name: "云端浏览器",
    description: "Hyperbrowser 云端浏览器服务（网页抓取/AI代理/绕过反爬虫）",
    useCases: ["访问被限制的网站", "执行复杂的网页交互", "绕过反爬虫机制"],
    category: "web",
    recommended: 4,
  },

  "code-index": {
    name: "代码索引",
    description: "项目代码快速索引和搜索",
    useCases: ["快速定位代码文件", "搜索函数和类定义", "项目代码导航"],
    category: "dev-tools",
    recommended: 5,
  },
};

/**
 * 根据 MCP 服务器 ID 获取描述信息
 *
 * 支持多种 ID 格式匹配：
 * - 移除 _disabled_ 前缀后匹配
 * - 精确匹配：完全相同的 ID
 * - 模糊匹配：ID 包含关键词
 * - 后备方案：返回默认描述
 */
export function getMCPDescription(serverId: string): MCPDescription {
  // 0. 移除 _disabled_ 前缀（用户现在可以后台启用/禁用，不需要显示前缀）
  const cleanId = serverId.replace(/^_disabled_/, "");

  // 1. 精确匹配（使用清理后的 ID）
  if (MCP_DESCRIPTIONS[cleanId]) {
    return MCP_DESCRIPTIONS[cleanId];
  }

  // 2. 模糊匹配（ID 包含关键词）
  const normalizedId = cleanId.toLowerCase();
  for (const [key, desc] of Object.entries(MCP_DESCRIPTIONS)) {
    if (normalizedId.includes(key) || key.includes(normalizedId)) {
      return desc;
    }
  }

  // 3. 返回默认描述（使用清理后的 ID 作为名称）
  return {
    name: cleanId,
    description: "自定义 MCP 工具",
    useCases: ["提供特定功能和服务"],
    category: "other",
    recommended: 3,
  };
}

/**
 * 获取分类的显示名称
 */
export function getCategoryLabel(category: MCPDescription["category"]): string {
  const labels: Record<MCPDescription["category"], string> = {
    filesystem: "文件系统",
    web: "网络抓取",
    database: "数据库",
    api: "API 服务",
    productivity: "生产力",
    "dev-tools": "开发工具",
    ai: "AI 增强",
    other: "其他",
  };
  return labels[category] || category;
}

/**
 * 获取分类的颜色
 */
export function getCategoryColor(category: MCPDescription["category"]): string {
  const colors: Record<MCPDescription["category"], string> = {
    filesystem: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    web: "bg-green-500/10 text-green-600 border-green-500/20",
    database: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    api: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    productivity: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    "dev-tools": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    ai: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    other: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };
  return colors[category] || colors.other;
}

/**
 * MCP 智能推荐配置
 *
 * 根据项目类型和特征自动推荐合适的 MCP 服务器
 */

import type { MCPServerSpec } from '@/lib/api';

/**
 * 官方 MCP 服务器默认配置
 * 用于一键自动配置推荐的 MCP 服务器
 */
export const OFFICIAL_MCP_DEFAULTS: Record<string, {
  name: string;
  spec: MCPServerSpec;
  description: string;
}> = {
  'filesystem': {
    name: 'Filesystem',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
    description: '读取和写入本地文件系统',
  },
  'fetch': {
    name: 'Fetch',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
    description: '发送 HTTP 请求获取网页内容',
  },
  'sequential-thinking': {
    name: 'Sequential Thinking',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequentialthinking'],
    },
    description: '复杂逻辑的分步推理',
  },
  'memory': {
    name: 'Memory',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
    description: '持久化记忆存储',
  },
  'puppeteer': {
    name: 'Puppeteer',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
    description: '浏览器自动化和网页截图',
  },
  'brave-search': {
    name: 'Brave Search',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: '',  // 需要用户填写
      },
    },
    description: '使用 Brave 搜索引擎搜索网页',
  },
  'github': {
    name: 'GitHub',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: '',  // 用户需要填写自己的 GitHub Token
      },
    },
    description: 'GitHub 仓库操作（搜索仓库、管理 PR/Issue、读取代码）',
  },
  'postgres': {
    name: 'PostgreSQL',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: {
        DATABASE_URL: '',  // 需要用户填写
      },
    },
    description: 'PostgreSQL 数据库操作',
  },
  'sqlite': {
    name: 'SQLite',
    spec: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './data.db'],
    },
    description: 'SQLite 数据库操作',
  },
};

/**
 * 检查 MCP 是否是官方服务器（可以自动配置）
 */
export function isOfficialMCP(serverId: string): boolean {
  return serverId in OFFICIAL_MCP_DEFAULTS;
}

/**
 * 获取官方 MCP 的默认配置
 */
export function getOfficialMCPDefault(serverId: string): typeof OFFICIAL_MCP_DEFAULTS[string] | null {
  return OFFICIAL_MCP_DEFAULTS[serverId] || null;
}

/**
 * 项目类型定义
 */
export type ProjectType =
  | 'frontend-react'      // React 前端项目
  | 'frontend-vue'        // Vue 前端项目
  | 'frontend-nextjs'     // Next.js 项目
  | 'backend-node'        // Node.js 后端
  | 'backend-python'      // Python 后端
  | 'backend-php'         // PHP 后端（PbootCMS 等）
  | 'fullstack'           // 全栈项目
  | 'desktop-tauri'       // Tauri 桌面应用
  | 'mobile-rn'           // React Native 移动应用
  | 'devops'              // DevOps/部署相关
  | 'data-analysis'       // 数据分析
  | 'general';            // 通用项目

/**
 * 项目类型检测规则
 * 根据文件存在情况判断项目类型
 */
export interface ProjectTypeRule {
  type: ProjectType;
  label: string;
  description: string;
  /** 必须存在的文件（任一） */
  requiredFiles?: string[];
  /** 必须存在的依赖（package.json 中） */
  dependencies?: string[];
  /** 必须存在的目录 */
  directories?: string[];
  /** 优先级（数字越大优先级越高） */
  priority: number;
}

export const PROJECT_TYPE_RULES: ProjectTypeRule[] = [
  // Tauri 桌面应用（最高优先级）
  {
    type: 'desktop-tauri',
    label: 'Tauri 桌面应用',
    description: '使用 Rust + Web 技术的桌面应用',
    requiredFiles: ['src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml'],
    priority: 100,
  },
  // Next.js
  {
    type: 'frontend-nextjs',
    label: 'Next.js 项目',
    description: 'React 全栈框架',
    requiredFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    priority: 90,
  },
  // React 前端
  {
    type: 'frontend-react',
    label: 'React 前端项目',
    description: 'React SPA 或组件库',
    dependencies: ['react', 'react-dom'],
    priority: 70,
  },
  // Vue 前端
  {
    type: 'frontend-vue',
    label: 'Vue 前端项目',
    description: 'Vue.js 前端项目',
    dependencies: ['vue'],
    priority: 70,
  },
  // React Native
  {
    type: 'mobile-rn',
    label: 'React Native 移动应用',
    description: '跨平台移动应用',
    dependencies: ['react-native'],
    priority: 85,
  },
  // PHP/PbootCMS
  {
    type: 'backend-php',
    label: 'PHP 后端项目',
    description: 'PHP 网站或 CMS（如 PbootCMS）',
    requiredFiles: ['index.php', 'config/database.php', 'core/pbootcms.php'],
    directories: ['apps', 'template'],
    priority: 80,
  },
  // Python
  {
    type: 'backend-python',
    label: 'Python 项目',
    description: 'Python 后端或脚本',
    requiredFiles: ['requirements.txt', 'pyproject.toml', 'setup.py', 'main.py'],
    priority: 75,
  },
  // Node.js 后端
  {
    type: 'backend-node',
    label: 'Node.js 后端项目',
    description: 'Express/Fastify/NestJS 等',
    dependencies: ['express', 'fastify', '@nestjs/core', 'koa'],
    priority: 75,
  },
  // DevOps
  {
    type: 'devops',
    label: 'DevOps 项目',
    description: '部署和运维相关',
    requiredFiles: ['Dockerfile', 'docker-compose.yml', 'kubernetes', '.github/workflows'],
    priority: 60,
  },
  // 数据分析
  {
    type: 'data-analysis',
    label: '数据分析项目',
    description: 'Jupyter/Pandas 数据分析',
    requiredFiles: ['*.ipynb'],
    dependencies: ['pandas', 'numpy', 'jupyter'],
    priority: 65,
  },
  // 通用（兜底）
  {
    type: 'general',
    label: '通用项目',
    description: '未识别的项目类型',
    priority: 0,
  },
];

/**
 * MCP 推荐配置
 */
export interface MCPRecommendation {
  /** MCP 服务器 ID */
  serverId: string;
  /** 显示名称 */
  name: string;
  /** 推荐理由 */
  reason: string;
  /** 推荐强度：required=必须, recommended=推荐, optional=可选 */
  strength: 'required' | 'recommended' | 'optional';
}

/**
 * 项目类型 -> MCP 推荐映射
 */
export const MCP_RECOMMENDATIONS: Record<ProjectType, MCPRecommendation[]> = {
  'desktop-tauri': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取项目文件', strength: 'required' },
    { serverId: 'sequential-thinking', name: 'Sequential Thinking', reason: '复杂逻辑推理', strength: 'recommended' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 请求测试', strength: 'optional' },
  ],
  'frontend-react': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取组件文件', strength: 'required' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 请求', strength: 'recommended' },
    { serverId: 'puppeteer', name: 'Puppeteer', reason: 'E2E 测试', strength: 'optional' },
  ],
  'frontend-vue': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取组件文件', strength: 'required' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 请求', strength: 'recommended' },
  ],
  'frontend-nextjs': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取页面和 API 路由', strength: 'required' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 请求', strength: 'recommended' },
    { serverId: 'postgres', name: 'PostgreSQL', reason: '数据库操作', strength: 'optional' },
  ],
  'backend-node': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取项目文件', strength: 'required' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 测试', strength: 'recommended' },
    { serverId: 'postgres', name: 'PostgreSQL', reason: '数据库操作', strength: 'optional' },
  ],
  'backend-python': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取 Python 文件', strength: 'required' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 测试', strength: 'recommended' },
    { serverId: 'postgres', name: 'PostgreSQL', reason: '数据库操作', strength: 'optional' },
  ],
  'backend-php': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取 PHP 文件', strength: 'required' },
    { serverId: 'sqlite', name: 'SQLite', reason: '本地数据库操作', strength: 'recommended' },
    { serverId: 'fetch', name: 'Fetch', reason: '外部 API 请求', strength: 'optional' },
  ],
  'fullstack': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取项目文件', strength: 'required' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 请求', strength: 'required' },
    { serverId: 'postgres', name: 'PostgreSQL', reason: '数据库操作', strength: 'recommended' },
  ],
  'mobile-rn': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取组件文件', strength: 'required' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 请求', strength: 'recommended' },
  ],
  'devops': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取配置文件', strength: 'required' },
    { serverId: 'github', name: 'GitHub', reason: 'CI/CD 和仓库管理', strength: 'recommended' },
    { serverId: 'fetch', name: 'Fetch', reason: 'API 请求', strength: 'optional' },
  ],
  'data-analysis': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '读取数据文件', strength: 'required' },
    { serverId: 'sqlite', name: 'SQLite', reason: '本地数据库', strength: 'recommended' },
    { serverId: 'postgres', name: 'PostgreSQL', reason: '远程数据库', strength: 'optional' },
  ],
  'general': [
    { serverId: 'filesystem', name: 'Filesystem', reason: '通用文件读取', strength: 'recommended' },
    { serverId: 'fetch', name: 'Fetch', reason: '网络请求', strength: 'optional' },
  ],
};

/**
 * 根据项目特征检测项目类型
 */
export async function detectProjectType(projectPath: string): Promise<{
  type: ProjectType;
  rule: ProjectTypeRule;
  confidence: 'high' | 'medium' | 'low';
}> {
  // 这个函数需要在前端调用后端 API 来检测文件存在性
  // 暂时返回通用类型，具体实现需要配合后端
  return {
    type: 'general',
    rule: PROJECT_TYPE_RULES.find(r => r.type === 'general')!,
    confidence: 'low',
  };
}

/**
 * 根据项目类型获取 MCP 推荐
 */
export function getMCPRecommendations(projectType: ProjectType): MCPRecommendation[] {
  return MCP_RECOMMENDATIONS[projectType] || MCP_RECOMMENDATIONS.general;
}

/**
 * 生成 CLAUDE.md 中的 MCP 配置说明
 */
export function generateMCPDocumentation(projectType: ProjectType): string {
  const recommendations = getMCPRecommendations(projectType);
  const rule = PROJECT_TYPE_RULES.find(r => r.type === projectType);

  const requiredMCPs = recommendations.filter(r => r.strength === 'required');
  const recommendedMCPs = recommendations.filter(r => r.strength === 'recommended');
  const optionalMCPs = recommendations.filter(r => r.strength === 'optional');

  let doc = `## MCP 配置建议\n\n`;
  doc += `项目类型: **${rule?.label || projectType}**\n\n`;

  if (requiredMCPs.length > 0) {
    doc += `### 必须启用\n`;
    requiredMCPs.forEach(mcp => {
      doc += `- **${mcp.name}** (${mcp.serverId}) - ${mcp.reason}\n`;
    });
    doc += '\n';
  }

  if (recommendedMCPs.length > 0) {
    doc += `### 推荐启用\n`;
    recommendedMCPs.forEach(mcp => {
      doc += `- **${mcp.name}** (${mcp.serverId}) - ${mcp.reason}\n`;
    });
    doc += '\n';
  }

  if (optionalMCPs.length > 0) {
    doc += `### 可选\n`;
    optionalMCPs.forEach(mcp => {
      doc += `- **${mcp.name}** (${mcp.serverId}) - ${mcp.reason}\n`;
    });
    doc += '\n';
  }

  doc += `> 提示：点击会话输入区的 **MCP** 按钮可快速配置项目级 MCP\n`;

  return doc;
}

/**
 * MCP 验证状态
 */
export type MCPVerificationStatus = 'official' | 'community' | 'unverified';

/**
 * 获取 MCP 的验证状态
 */
export function getMCPVerificationStatus(serverId: string): MCPVerificationStatus {
  // 检查是否是官方 MCP
  if (isOfficialMCP(serverId)) {
    return 'official';
  }

  // 检查是否是社区验证的 MCP（可以由用户自定义）
  // 这里可以从配置文件读取用户自定义的社区验证列表
  // 暂时返回 unverified
  return 'unverified';
}

/**
 * 获取验证状态的显示标签
 */
export function getVerificationLabel(status: MCPVerificationStatus): string {
  switch (status) {
    case 'official':
      return '官方';
    case 'community':
      return '社区';
    case 'unverified':
      return '未验证';
  }
}

/**
 * 获取验证状态的颜色类名
 */
export function getVerificationColor(status: MCPVerificationStatus): string {
  switch (status) {
    case 'official':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'community':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'unverified':
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}


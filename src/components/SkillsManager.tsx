/**
 * SkillsManager - 技能管理组件
 *
 * 功能:
 * - 列表展示所有技能（用户级 + 项目级）
 * - 创建/编辑/删除技能
 * - 技能搜索和过滤
 * - 技能市场（预设模板）
 * - 技能触发词配置
 *
 * 来源: Claude Code Skills + Cursor Custom Instructions
 */

import { logger } from "@/lib/logger";
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  Search,
  Plus,
  FolderOpen,
  Zap,
  Edit2,
  Trash2,
  Download,
  Tag,
  Play,
  Copy,
  Check,
  RefreshCw,
  Globe,
  User,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

// ============================================================
// 类型定义
// ============================================================

export interface Skill {
  name: string;
  path: string;
  scope: "user" | "project";
  description?: string;
  content?: string;
  triggers?: string[]; // 触发词列表
  isEnabled?: boolean; // 是否启用
  lastUsed?: string; // 最后使用时间
  usageCount?: number; // 使用次数
  tags?: string[]; // 标签
}

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  triggers?: string[];
  tags?: string[];
  author?: string;
  downloads?: number;
}

// ============================================================
// 预设技能模板
// ============================================================

const PRESET_TEMPLATES: SkillTemplate[] = [
  {
    id: "code-review",
    name: "Code Review",
    description: "代码审查技能，自动检查代码质量、安全性和最佳实践",
    category: "代码质量",
    triggers: ["/review", "/code-review"],
    tags: ["代码审查", "质量"],
    content: `# Code Review Skill

当用户请求代码审查时，执行以下检查：

## 代码质量检查
1. 代码风格一致性
2. 命名规范（变量、函数、类）
3. 代码复杂度
4. 重复代码检测

## 安全性检查
1. SQL 注入风险
2. XSS 漏洞
3. 敏感信息泄露
4. 输入验证

## 性能检查
1. 潜在的性能瓶颈
2. 内存泄漏风险
3. 不必要的计算

## 输出格式
- 问题严重程度：🔴 严重 | 🟡 警告 | 🔵 建议
- 具体位置和修改建议
- 示例代码`,
    author: "Fangyu",
    downloads: 1250,
  },
  {
    id: "git-commit",
    name: "Git Commit",
    description: "智能生成 Git 提交消息，遵循 Conventional Commits 规范",
    category: "Git",
    triggers: ["/commit", "/git-commit"],
    tags: ["Git", "提交"],
    content: `# Git Commit Skill

生成符合 Conventional Commits 规范的提交消息。

## 消息格式
\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

## 类型 (type)
- feat: 新功能
- fix: Bug 修复
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- perf: 性能优化
- test: 测试
- chore: 构建/工具

## 执行步骤
1. 运行 git diff --cached 查看暂存的更改
2. 分析更改的性质和范围
3. 生成简洁但描述性的提交消息
4. 如果更改复杂，添加详细的 body`,
    author: "Fangyu",
    downloads: 2100,
  },
  {
    id: "test-generator",
    name: "Test Generator",
    description: "自动生成单元测试，支持多种测试框架",
    category: "测试",
    triggers: ["/test", "/generate-test"],
    tags: ["测试", "单元测试"],
    content: `# Test Generator Skill

为指定代码生成单元测试。

## 支持的框架
- Jest (JavaScript/TypeScript)
- Vitest (Vite 项目)
- pytest (Python)
- Go testing (Go)
- RSpec (Ruby)

## 测试覆盖
1. 正常情况测试
2. 边界条件测试
3. 错误处理测试
4. Mock 依赖

## 测试结构
- describe: 测试套件描述
- it/test: 单个测试用例
- beforeEach/afterEach: 设置和清理
- expect: 断言`,
    author: "Fangyu",
    downloads: 980,
  },
  {
    id: "doc-generator",
    name: "Documentation Generator",
    description: "自动生成代码文档，支持 JSDoc、TSDoc、Docstring 等格式",
    category: "文档",
    triggers: ["/doc", "/document"],
    tags: ["文档", "JSDoc"],
    content: `# Documentation Generator Skill

为代码生成文档注释。

## 支持格式
- JSDoc (JavaScript)
- TSDoc (TypeScript)
- Docstring (Python)
- GoDoc (Go)
- XML Comments (C#)

## 文档内容
1. 函数/方法描述
2. 参数说明 (@param)
3. 返回值 (@returns)
4. 示例代码 (@example)
5. 异常说明 (@throws)

## 自动检测
- 函数签名分析
- 类型推断
- 复杂度评估`,
    author: "Fangyu",
    downloads: 750,
  },
  {
    id: "refactor-assistant",
    name: "Refactor Assistant",
    description: "代码重构助手，提供重构建议和自动重构",
    category: "重构",
    triggers: ["/refactor", "/improve"],
    tags: ["重构", "优化"],
    content: `# Refactor Assistant Skill

分析代码并提供重构建议。

## 重构模式
1. 提取方法 (Extract Method)
2. 提取变量 (Extract Variable)
3. 内联变量 (Inline Variable)
4. 重命名 (Rename)
5. 移动方法 (Move Method)
6. 提取接口 (Extract Interface)

## 代码异味检测
- 过长方法
- 过长参数列表
- 重复代码
- 过深嵌套
- God Class

## 输出格式
- 问题描述
- 重构建议
- 重构后的代码`,
    author: "Fangyu",
    downloads: 620,
  },
];

// ============================================================
// 组件
// ============================================================

interface SkillsManagerProps {
  projectPath?: string;
  onSkillExecute?: (skill: Skill) => void;
}

export function SkillsManager({ projectPath, onSkillExecute }: SkillsManagerProps) {
  // 状态
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterScope, setFilterScope] = useState<"all" | "user" | "project">("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMarketDialog, setShowMarketDialog] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 编辑器状态
  const [editorName, setEditorName] = useState("");
  const [editorDescription, setEditorDescription] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorScope, setEditorScope] = useState<"user" | "project">("user");
  const [editorTriggers, setEditorTriggers] = useState("");

  // 加载技能列表
  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listAgentSkills(projectPath);

      // 转换为 Skill 类型并加载内容
      const skillsWithContent: Skill[] = await Promise.all(
        result.map(async (s: any) => {
          let content = "";
          try {
            content = await api.readSkill(s.path);
          } catch {
            // 忽略读取错误
          }

          return {
            name: s.name,
            path: s.path,
            scope: s.scope || "user",
            description: s.description || extractDescription(content),
            content,
            triggers: extractTriggers(content),
            tags: extractTags(content),
            isEnabled: s.isEnabled ?? true, // 使用后端返回的 isEnabled 字段
          };
        })
      );

      setSkills(skillsWithContent);
    } catch (error) {
      logger.error("SkillsManager", "加载技能失败:", error);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // 从内容中提取描述
  const extractDescription = (content: string): string => {
    const match = content.match(/^#\s+(.+?)(?:\n|$)/m);
    return match ? match[1].trim() : "";
  };

  // 从内容中提取触发词
  const extractTriggers = (content: string): string[] => {
    const triggers: string[] = [];
    const match = content.match(/triggers?:\s*\[([^\]]+)\]/i);
    if (match) {
      triggers.push(...match[1].split(",").map((t) => t.trim().replace(/['"]/g, "")));
    }
    // 也匹配 /command 格式
    const commands = content.match(/\/[a-z-]+/gi);
    if (commands) {
      triggers.push(...commands);
    }
    return [...new Set(triggers)];
  };

  // 从内容中提取标签
  const extractTags = (content: string): string[] => {
    const tags: string[] = [];
    const match = content.match(/tags?:\s*\[([^\]]+)\]/i);
    if (match) {
      tags.push(...match[1].split(",").map((t) => t.trim().replace(/['"]/g, "")));
    }
    return tags;
  };

  // 过滤技能
  const filteredSkills = useMemo(() => {
    let result = skills;

    // 按搜索词过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query) ||
          s.triggers?.some((t) => t.toLowerCase().includes(query))
      );
    }

    // 按范围过滤
    if (filterScope !== "all") {
      result = result.filter((s) => s.scope === filterScope);
    }

    // 按标签过滤
    if (filterTag) {
      result = result.filter((s) => s.tags?.includes(filterTag));
    }

    return result;
  }, [skills, searchQuery, filterScope, filterTag]);

  // 获取所有标签
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    skills.forEach((s) => s.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [skills]);

  // 创建/更新技能
  const handleSaveSkill = async () => {
    try {
      const name = editorName.trim();
      const description = editorDescription.trim();
      const content = editorContent.trim();

      if (!name || !content) {
        alert("请填写技能名称和内容");
        return;
      }

      await api.createSkill(name, description, content, editorScope, projectPath);
      loadSkills();
      resetEditor();
      setShowCreateDialog(false);
      setEditingSkill(null);
    } catch (error) {
      logger.error("SkillsManager", "保存技能失败:", error);
      alert("保存技能失败");
    }
  };

  // 删除技能
  const handleDelete = async (skill: Skill) => {
    if (!confirm(`确定要删除技能 "${skill.name}" 吗？`)) return;

    try {
      // 通过重命名为 _disabled_ 前缀来禁用（软删除）
      // 实际删除需要文件系统操作
      await api.openSkillsDirectory(projectPath);
      loadSkills();
    } catch (error) {
      logger.error("SkillsManager", "删除技能失败:", error);
    }
  };

  // 编辑技能
  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setEditorName(skill.name);
    setEditorDescription(skill.description || "");
    setEditorContent(skill.content || "");
    setEditorScope(skill.scope);
    setEditorTriggers(skill.triggers?.join(", ") || "");
    setShowCreateDialog(true);
  };

  // 重置编辑器
  const resetEditor = () => {
    setEditorName("");
    setEditorDescription("");
    setEditorContent("");
    setEditorScope("user");
    setEditorTriggers("");
  };

  // 从模板创建
  const handleImportTemplate = async (template: SkillTemplate) => {
    try {
      await api.createSkill(
        template.name.toLowerCase().replace(/\s+/g, "-"),
        template.description,
        template.content,
        "user",
        projectPath
      );
      loadSkills();
      setShowMarketDialog(false);
    } catch (error) {
      logger.error("SkillsManager", "导入模板失败:", error);
    }
  };

  // 复制触发词
  const handleCopyTrigger = (trigger: string) => {
    navigator.clipboard.writeText(trigger);
    setCopiedId(trigger);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 执行技能
  const handleExecute = (skill: Skill) => {
    if (onSkillExecute) {
      onSkillExecute(skill);
    }
  };

  // 切换技能启用/禁用状态
  const handleToggleSkill = async (skill: Skill, enabled: boolean) => {
    try {
      await api.toggleSkill(skill.name, skill.scope, enabled, projectPath);
      await loadSkills(); // 重新加载技能列表
    } catch (error) {
      logger.error("SkillsManager", "切换技能状态失败:", error);
      alert(`切换技能状态失败: ${error}`);
    }
  };

  // 打开技能目录
  const handleOpenDirectory = async () => {
    try {
      await api.openSkillsDirectory(projectPath);
    } catch (error) {
      logger.error("SkillsManager", "打开目录失败:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* 头部工具栏 */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--border-primary)]">
        {/* 搜索框 */}
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <Input
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* 过滤器 */}
        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value as any)}
          className="h-8 px-2 text-sm rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]"
        >
          <option value="all">全部</option>
          <option value="user">用户级</option>
          <option value="project">项目级</option>
        </select>

        {/* 刷新 */}
        <Button variant="ghost" size="sm" onClick={loadSkills} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>

        {/* 打开目录 */}
        <Button variant="ghost" size="sm" onClick={handleOpenDirectory}>
          <FolderOpen className="w-4 h-4" />
        </Button>

        {/* 技能市场 */}
        <Button variant="ghost" size="sm" onClick={() => setShowMarketDialog(true)}>
          <Download className="w-4 h-4" />
        </Button>

        {/* 新建技能 */}
        <Button
          size="sm"
          onClick={() => {
            resetEditor();
            setShowCreateDialog(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Button>
      </div>

      {/* 标签过滤 */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-primary)] overflow-x-auto">
          <Tag className="w-3 h-3 text-[var(--text-tertiary)] mr-1" />
          <button
            onClick={() => setFilterTag(null)}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
              filterTag === null
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag === filterTag ? null : tag)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                filterTag === tag
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 技能列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
              <Zap className="w-8 h-8 mb-2 opacity-50" />
              <p>暂无技能</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowMarketDialog(true)}
                className="mt-2"
              >
                从市场导入
              </Button>
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <div
                key={skill.path}
                className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden"
              >
                {/* 技能头部 */}
                <div
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-[var(--bg-hover)]"
                  onClick={() => setExpandedSkill(expandedSkill === skill.name ? null : skill.name)}
                >
                  {expandedSkill === skill.name ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                  )}

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Zap
                      className={`w-4 h-4 ${skill.isEnabled ? "text-yellow-500" : "text-gray-400"}`}
                    />
                    <span
                      className={`font-medium truncate ${!skill.isEnabled ? "text-[var(--text-tertiary)]" : ""}`}
                    >
                      {/* 移除 _disabled_ 前缀显示 */}
                      {skill.name.replace(/^_disabled_/, "")}
                    </span>

                    {/* 范围标识 */}
                    {skill.scope === "user" ? (
                      <span title="用户级">
                        <User className="w-3 h-3 text-blue-400" />
                      </span>
                    ) : (
                      <span title="项目级">
                        <Globe className="w-3 h-3 text-green-400" />
                      </span>
                    )}
                  </div>

                  {/* 触发词 */}
                  {skill.triggers && skill.triggers.length > 0 && (
                    <div className="flex items-center gap-1">
                      {skill.triggers.slice(0, 2).map((trigger) => (
                        <code
                          key={trigger}
                          className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--accent-primary)]"
                        >
                          {trigger}
                        </code>
                      ))}
                      {skill.triggers.length > 2 && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                          +{skill.triggers.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 操作按钮 - TEST123 */}
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 启用/禁用开关 */}
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={skill.isEnabled ?? false}
                        onCheckedChange={(checked) => handleToggleSkill(skill, checked)}
                        title={skill.isEnabled ? "点击禁用" : "点击启用"}
                      />
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {skill.isEnabled ? "启用" : "禁用"}
                      </span>
                    </div>

                    <div className="h-4 w-px bg-[var(--border-primary)]" />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExecute(skill)}
                      title="执行技能"
                      disabled={!skill.isEnabled}
                    >
                      <Play className="w-4 h-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(skill)}
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(skill)}
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* 展开内容 */}
                {expandedSkill === skill.name && (
                  <div className="px-3 pb-3 border-t border-[var(--border-primary)]">
                    {/* 描述 */}
                    {skill.description && (
                      <p className="text-sm text-[var(--text-secondary)] mt-2">
                        {skill.description}
                      </p>
                    )}

                    {/* 触发词列表 */}
                    {skill.triggers && skill.triggers.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-[var(--text-tertiary)]">触发词：</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.triggers.map((trigger) => (
                            <button
                              key={trigger}
                              onClick={() => handleCopyTrigger(trigger)}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
                            >
                              {trigger}
                              {copiedId === trigger ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 标签 */}
                    {skill.tags && skill.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {skill.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 内容预览 */}
                    {skill.content && (
                      <div className="mt-2">
                        <span className="text-xs text-[var(--text-tertiary)]">内容预览：</span>
                        <pre className="mt-1 p-2 text-xs rounded bg-[var(--bg-primary)] overflow-x-auto max-h-32">
                          {skill.content.slice(0, 500)}
                          {skill.content.length > 500 && "..."}
                        </pre>
                      </div>
                    )}

                    {/* 文件路径 */}
                    <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                      路径: {skill.path}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* 创建/编辑对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? "编辑技能" : "创建新技能"}</DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>配置技能的名称、描述、触发词等信息</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 名称 */}
            <div>
              <label className="text-sm font-medium">技能名称</label>
              <Input
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="my-skill"
                className="mt-1"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                只能包含字母、数字、连字符和下划线
              </p>
            </div>

            {/* 描述 */}
            <div>
              <label className="text-sm font-medium">描述</label>
              <Input
                value={editorDescription}
                onChange={(e) => setEditorDescription(e.target.value)}
                placeholder="技能的简短描述"
                className="mt-1"
              />
            </div>

            {/* 范围 */}
            <div>
              <label className="text-sm font-medium">范围</label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setEditorScope("user")}
                  className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
                    editorScope === "user"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>用户级</span>
                </button>
                <button
                  onClick={() => setEditorScope("project")}
                  className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
                    editorScope === "project"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>项目级</span>
                </button>
              </div>
            </div>

            {/* 触发词 */}
            <div>
              <label className="text-sm font-medium">触发词（可选）</label>
              <Input
                value={editorTriggers}
                onChange={(e) => setEditorTriggers(e.target.value)}
                placeholder="/my-skill, /ms"
                className="mt-1"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">多个触发词用逗号分隔</p>
            </div>

            {/* 内容 */}
            <div>
              <label className="text-sm font-medium">技能内容</label>
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="# 技能名称&#10;&#10;技能说明和指令..."
                className="mt-1 w-full h-64 p-3 text-sm font-mono rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSkill}>{editingSkill ? "保存" : "创建"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 技能市场对话框 */}
      <Dialog open={showMarketDialog} onOpenChange={setShowMarketDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              技能市场
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
            {PRESET_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-medium">{template.name}</h3>
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">{template.category}</span>
                </div>

                <p className="text-sm text-[var(--text-secondary)] mt-2">{template.description}</p>

                {/* 触发词 */}
                {template.triggers && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.triggers.map((t) => (
                      <code
                        key={t}
                        className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--accent-primary)]"
                      >
                        {t}
                      </code>
                    ))}
                  </div>
                )}

                {/* 底部信息 */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <span>by {template.author}</span>
                    <span>•</span>
                    <span>{template.downloads} 次下载</span>
                  </div>
                  <Button size="sm" onClick={() => handleImportTemplate(template)}>
                    <Download className="w-4 h-4 mr-1" />
                    导入
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SkillsManager;

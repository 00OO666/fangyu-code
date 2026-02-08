/**
 * SubagentManager - 子代理管理器
 *
 * 功能:
 * - 子代理列表和搜索
 * - 创建/编辑/删除子代理
 * - 子代理模板市场
 * - 执行状态追踪
 * - @mention 调用支持
 *
 * 来源: Claude Code Subagents + Cursor Agent Presets
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, Search, Edit, Trash2, Download, Play, CheckCircle2, AlertCircle, Loader2, Star, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

interface Subagent {
  name: string;
  description: string;
  system_prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: string[];
  tags?: string[];
  created_at?: string;
  author?: string;
  is_template?: boolean;
  usage_count?: number;
}

interface SubagentExecution {
  id: string;
  subagent_name: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  result?: any;
  error?: string;
}

interface SubagentManagerProps {
  onSelectSubagent?: (name: string) => void;
  className?: string;
}

// 预设模板市场
const PRESET_TEMPLATES: Subagent[] = [
  {
    name: 'code-reviewer',
    description: '代码审查专家，提供详细的代码质量分析和改进建议',
    system_prompt: `你是一位经验丰富的代码审查专家。分析代码时请关注：
1. 代码质量和可读性
2. 潜在的bug和性能问题
3. 安全漏洞
4. 最佳实践和设计模式
5. 提供具体的改进建议`,
    model: 'claude-sonnet-4-5',
    temperature: 0.3,
    tags: ['代码', '审查', '质量'],
    is_template: true,
    author: 'Fangyu Code',
  },
  {
    name: 'test-generator',
    description: '测试用例生成器，为代码自动生成全面的单元测试',
    system_prompt: `你是测试用例生成专家。为给定的代码生成：
1. 边界条件测试
2. 异常处理测试
3. 正常流程测试
4. 集成测试建议
使用最适合的测试框架（Jest/Pytest/etc.）`,
    model: 'claude-sonnet-4-5',
    temperature: 0.5,
    tags: ['测试', '质量保证'],
    is_template: true,
    author: 'Fangyu Code',
  },
  {
    name: 'documentation-writer',
    description: '文档撰写专家，生成清晰的API文档和使用说明',
    system_prompt: `你是技术文档撰写专家。为代码生成：
1. API文档（参数、返回值、示例）
2. 使用指南
3. 最佳实践
4. 常见问题解答
使用Markdown格式，示例代码清晰`,
    model: 'claude-sonnet-4-5',
    temperature: 0.6,
    tags: ['文档', '技术写作'],
    is_template: true,
    author: 'Fangyu Code',
  },
  {
    name: 'bug-hunter',
    description: '调试专家，快速定位和修复代码中的bug',
    system_prompt: `你是调试专家。分析代码时：
1. 识别潜在的bug和错误
2. 分析错误原因
3. 提供具体的修复方案
4. 建议预防类似问题的方法
使用清晰的步骤说明`,
    model: 'claude-sonnet-4-5',
    temperature: 0.4,
    tags: ['调试', '修复'],
    is_template: true,
    author: 'Fangyu Code',
  },
  {
    name: 'refactor-advisor',
    description: '重构顾问，提供代码重构和优化建议',
    system_prompt: `你是代码重构专家。分析代码后提供：
1. 代码结构改进建议
2. 性能优化方案
3. 设计模式应用
4. 代码简化和去重
保持功能不变的前提下改进代码`,
    model: 'claude-sonnet-4-5',
    temperature: 0.5,
    tags: ['重构', '优化'],
    is_template: true,
    author: 'Fangyu Code',
  },
];

// ============================================================
// 组件
// ============================================================

export function SubagentManager({ onSelectSubagent, className }: SubagentManagerProps) {
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [executions, setExecutions] = useState<SubagentExecution[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingSubagent, setEditingSubagent] = useState<Subagent | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载子代理列表
  const loadSubagents = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.listSubagents();
      setSubagents(list);
    } catch (error) {
      logger.error('SubagentManager', '加载子代理列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载执行状态
  const loadExecutions = useCallback(async () => {
    // TODO: 实现执行状态加载
    setExecutions([]);
  }, []);

  useEffect(() => {
    loadSubagents();
    loadExecutions();
    const interval = setInterval(loadExecutions, 3000);
    return () => clearInterval(interval);
  }, [loadSubagents, loadExecutions]);

  // 获取所有标签
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    [...subagents, ...PRESET_TEMPLATES].forEach((agent) => {
      agent.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [subagents]);

  // 过滤子代理
  const filteredSubagents = useMemo(() => {
    let result = [...subagents, ...PRESET_TEMPLATES];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query)
      );
    }

    if (filterTag !== 'all') {
      result = result.filter((agent) => agent.tags?.includes(filterTag));
    }

    return result;
  }, [subagents, searchQuery, filterTag]);

  // 创建/更新子代理
  const handleSaveSubagent = async (data: Partial<Subagent>) => {
    try {
      const mergedData = editingSubagent ? { ...editingSubagent, ...data } : data;
      const name = mergedData.name || '';
      const description = mergedData.description || '';
      const content = mergedData.system_prompt || '';

      await api.createSubagent(name, description, content, 'user');
      loadSubagents();
      setShowCreateDialog(false);
      setEditingSubagent(null);
    } catch (error) {
      logger.error('SubagentManager', '保存子代理失败:', error);
    }
  };

  // 删除子代理
  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除子代理 "${name}" 吗？`)) return;

    try {
      // TODO: 实现删除API
      loadSubagents();
    } catch (error) {
      logger.error('SubagentManager', '删除子代理失败:', error);
    }
  };

  // 从模板创建
  const handleCreateFromTemplate = (template: Subagent) => {
    setEditingSubagent({
      ...template,
      name: `${template.name}-copy`,
      is_template: false,
    });
    setShowCreateDialog(true);
    setShowTemplateDialog(false);
  };

  // 导出子代理
  const handleExport = (subagent: Subagent) => {
    const blob = new Blob([JSON.stringify(subagent, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subagent.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* 头部 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">子代理管理</h2>
            <Badge variant="outline">{subagents.length} 个</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateDialog(true)}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              模板市场
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingSubagent(null);
                setShowCreateDialog(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索子代理..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部标签</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 子代理列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredSubagents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Bot className="h-8 w-8 mb-2 opacity-50" />
            <p>暂无子代理</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredSubagents.map((agent) => (
                <SubagentCard
                  key={agent.name}
                  subagent={agent}
                  onEdit={() => {
                    setEditingSubagent(agent);
                    setShowCreateDialog(true);
                  }}
                  onDelete={() => handleDelete(agent.name)}
                  onExport={() => handleExport(agent)}
                  onSelect={() => onSelectSubagent?.(agent.name)}
                  executions={executions.filter((e) => e.subagent_name === agent.name)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 执行状态面板 */}
      {executions.length > 0 && (
        <div className="border-t p-3 bg-muted/30">
          <h3 className="text-sm font-medium mb-2">执行中的任务</h3>
          <div className="space-y-1">
            {executions.map((exec) => (
              <ExecutionStatus key={exec.id} execution={exec} />
            ))}
          </div>
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <SubagentEditor
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        subagent={editingSubagent}
        onSave={handleSaveSubagent}
      />

      {/* 模板市场对话框 */}
      <TemplateMarketDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        templates={PRESET_TEMPLATES}
        onSelectTemplate={handleCreateFromTemplate}
      />
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

interface SubagentCardProps {
  subagent: Subagent;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onSelect: () => void;
  executions: SubagentExecution[];
}

function SubagentCard({
  subagent,
  onEdit,
  onDelete,
  onExport,
  onSelect,
  executions,
}: SubagentCardProps) {
  const isRunning = executions.some((e) => e.status === 'running');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded', isRunning ? 'bg-blue-500/10' : 'bg-muted')}>
            <Bot className={cn('h-4 w-4', isRunning ? 'text-blue-500' : 'text-muted-foreground')} />
          </div>
          <div>
            <h3 className="font-medium text-sm">{subagent.name}</h3>
            {subagent.is_template && (
              <Badge variant="secondary" className="text-[10px] h-4 mt-0.5">
                模板
              </Badge>
            )}
          </div>
        </div>

        {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{subagent.description}</p>

      {subagent.tags && subagent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {subagent.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] h-4">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        {subagent.model && <span>{subagent.model}</span>}
        {subagent.usage_count !== undefined && <span>{subagent.usage_count} 次使用</span>}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onSelect} className="flex-1 h-7 text-xs">
          <Play className="h-3 w-3 mr-1" />
          调用
        </Button>
        {!subagent.is_template && (
          <>
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0">
              <Edit className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0">
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onExport} className="h-7 w-7 p-0">
          <Download className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

interface ExecutionStatusProps {
  execution: SubagentExecution;
}

function ExecutionStatus({ execution }: ExecutionStatusProps) {
  const StatusIcon =
    execution.status === 'running'
      ? Loader2
      : execution.status === 'completed'
        ? CheckCircle2
        : AlertCircle;

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-background text-xs">
      <StatusIcon
        className={cn(
          'h-3 w-3',
          execution.status === 'running' && 'animate-spin text-blue-500',
          execution.status === 'completed' && 'text-green-500',
          execution.status === 'failed' && 'text-red-500'
        )}
      />
      <span className="flex-1 truncate">{execution.subagent_name}</span>
      <span className="text-muted-foreground">
        {execution.status === 'running' ? '执行中...' : execution.status}
      </span>
    </div>
  );
}

interface SubagentEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subagent: Subagent | null;
  onSave: (data: Partial<Subagent>) => void;
}

function SubagentEditor({ open, onOpenChange, subagent, onSave }: SubagentEditorProps) {
  const [formData, setFormData] = useState<Partial<Subagent>>({});

  useEffect(() => {
    if (open && subagent) {
      setFormData(subagent);
    } else if (open) {
      setFormData({
        name: '',
        description: '',
        system_prompt: '',
        model: 'claude-sonnet-4-5',
        temperature: 0.7,
        tags: [],
      });
    }
  }, [open, subagent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subagent ? '编辑子代理' : '创建子代理'}</DialogTitle>
          <VisuallyHidden.Root>
            <DialogDescription>配置子代理的名称、描述、系统提示词和模型参数</DialogDescription>
          </VisuallyHidden.Root>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: code-reviewer"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">描述</label>
            <Input
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="简短描述子代理的功能"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">系统提示词</label>
            <Textarea
              value={formData.system_prompt || ''}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="定义子代理的行为和能力..."
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">模型</label>
              <Select
                value={formData.model}
                onValueChange={(value) => setFormData({ ...formData, model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-opus-4-5">Claude Opus 4.5</SelectItem>
                  <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                  <SelectItem value="claude-haiku-4">Claude Haiku 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">温度</label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={formData.temperature || 0.7}
                onChange={(e) =>
                  setFormData({ ...formData, temperature: parseFloat(e.target.value) })
                }
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">标签 (逗号分隔)</label>
            <Input
              value={formData.tags?.join(', ') || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="代码, 审查, 质量"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateMarketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Subagent[];
  onSelectTemplate: (template: Subagent) => void;
}

function TemplateMarketDialog({
  open,
  onOpenChange,
  templates,
  onSelectTemplate,
}: TemplateMarketDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            子代理模板市场
          </DialogTitle>
          <VisuallyHidden.Root>
            <DialogDescription>浏览和选择预设的子代理模板</DialogDescription>
          </VisuallyHidden.Root>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((template) => (
            <div
              key={template.name}
              className="p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectTemplate(template)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-medium text-sm">{template.name}</h3>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {template.author}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground mb-3">{template.description}</p>

              {template.tags && (
                <div className="flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] h-4">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent >
    </Dialog >
  );
}

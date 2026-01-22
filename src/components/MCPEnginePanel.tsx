import { logger } from '@/lib/logger';
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Network from 'lucide-react/dist/esm/icons/network'
import Globe from 'lucide-react/dist/esm/icons/globe'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Edit from 'lucide-react/dist/esm/icons/edit'
import Power from 'lucide-react/dist/esm/icons/power'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Search from 'lucide-react/dist/esm/icons/search';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { api, type MCPServerSpec, type McpServerWithStatus } from "@/lib/api";
import { copyTextToClipboard } from "@/lib/clipboard";
import { MCPServerDialog } from "./MCPServerDialog";
import { getMCPDescription, getCategoryLabel, getCategoryColor } from "@/lib/mcpDescriptions";
import { useMCPCallTimes } from "@/hooks/useMCPCallTimes";

interface MCPEnginePanelProps {
  /**
   * 引擎名称
   */
  engine: "claude" | "codex" | "gemini";
  /**
   * 引擎显示名称
   */
  engineLabel: string;
  /**
   * 引擎图标组件
   */
  EngineIcon: React.ComponentType<{ className?: string }>;
  /**
   * 引擎主题色
   */
  engineColor: string;
  /**
   * 可选的 className
   */
  className?: string;
}

// 使用从 api.ts 导入的 McpServerWithStatus 类型
type MCPServerItem = McpServerWithStatus;

/**
 * 单个引擎的 MCP 管理面板
 * 显示该引擎独立的 MCP 工具列表，支持添加、删除操作
 */
export const MCPEnginePanel: React.FC<MCPEnginePanelProps> = ({
  engine,
  engineLabel,
  EngineIcon,
  engineColor,
  className,
}) => {
  const [servers, setServers] = useState<MCPServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingServer, setRemovingServer] = useState<string | null>(null);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [copiedServer, setCopiedServer] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<{
    id: string;
    spec: MCPServerSpec;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 使用 MCP 调用时间追踪 hook
  const { callTimes, updateCallTime, getCallTime, formatCallTime, formatCallTimeFull } = useMCPCallTimes(engine);

  // 按最近调用时间排序的服务器列表（最近调用的在前）
  const sortedServers = useMemo(() => {
    return [...servers].sort((a, b) => {
      const timeA = callTimes[a.id] || 0;
      const timeB = callTimes[b.id] || 0;
      // 降序排列（最近调用的在前）
      return timeB - timeA;
    });
  }, [servers, callTimes]);

    const filteredServers = useMemo(() => {
    if (!searchQuery) return sortedServers;

    const query = searchQuery.toLowerCase();
    return sortedServers.filter(server => {
      const description = getMCPDescription(server.id);
      const descText = typeof description === 'string' ? description : description.description || '';
      return (
        server.id.toLowerCase().includes(query) ||
        server.spec.command?.toLowerCase().includes(query) ||
        server.spec.url?.toLowerCase().includes(query) ||
        descText.toLowerCase().includes(query)
      );
    });
  }, [sortedServers, searchQuery]);

  // 加载该引擎的服务器列表
  useEffect(() => {
    loadServers();
  }, [engine]);

  const loadServers = async () => {
    try {
      setLoading(true);
      // 使用新的 API 获取包含禁用服务器的列表
      const serversList = await api.mcpGetEngineServersWithStatus(engine);
      setServers(serversList);
    } catch (error) {
      logger.error('MCPEnginePanel', `Failed to load ${engine} MCP servers:`, error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 切换展开状态
   */
  const toggleExpanded = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  /**
   * 复制命令到剪贴板
   */
  const copyCommand = async (command: string, serverId: string) => {
    try {
      await copyTextToClipboard(command);
      setCopiedServer(serverId);
      setTimeout(() => setCopiedServer(null), 2000);
    } catch (error) {
      logger.error('MCPEnginePanel', "Failed to copy command:", error);
    }
  };

  /**
   * 切换启用状态
   */
  const handleToggleEnabled = async (server: MCPServerItem) => {
    const newEnabled = !server.enabled;

    try {
      await api.mcpToggleEngineServer(engine, server.id, server.spec, newEnabled);

      // 🔧 修复：不需要调用 syncSettingsToClaudeJson()，因为 mcpToggleEngineServer 已经直接更新了 ~/.claude.json
      // 避免从 settings.json 读取旧配置覆盖刚才的更改

      // 启用时更新调用时间（视为一次"调用"）
      if (newEnabled) {
        updateCallTime(server.id);
      }

      // 更新本地状态
      setServers((prev) =>
        prev.map((s) =>
          s.id === server.id ? { ...s, enabled: newEnabled } : s
        )
      );
    } catch (error) {
      logger.error('MCPEnginePanel', `Failed to toggle ${engine} MCP server:`, error);
    }
  };

  /**
   * 手动标记为"已调用"（更新调用时间）
   */
  const handleMarkAsCalled = (serverId: string) => {
    updateCallTime(serverId);
  };

  /**
   * 打开添加对话框
   */
  const handleAdd = () => {
    setEditingServer(null);
    setDialogOpen(true);
  };

  /**
   * 打开编辑对话框
   */
  const handleEdit = (server: MCPServerItem) => {
    setEditingServer({ id: server.id, spec: server.spec });
    setDialogOpen(true);
  };

  /**
   * 对话框保存后的回调
   */
  const handleDialogSaved = () => {
    loadServers(); // 刷新列表
  };

  /**
   * 删除服务器（永久删除）
   */
  const handleRemoveServer = async (id: string) => {
    if (!confirm(`确定要删除 MCP 服务器 "${id}" 吗？`)) {
      return;
    }

    try {
      setRemovingServer(id);
      await api.mcpDeleteEngineServer(engine, id);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      logger.error('MCPEnginePanel', `Failed to remove server from ${engine}:`, error);
    } finally {
      setRemovingServer(null);
    }
  };

  /**
   * 获取传输类型图标
   */
  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case "stdio":
        return <Terminal className="h-4 w-4 text-amber-500" />;
      case "sse":
        return <Globe className="h-4 w-4 text-emerald-500" />;
      case "http":
        return <Network className="h-4 w-4 text-blue-500" />;
      default:
        return <Network className="h-4 w-4 text-blue-500" />;
    }
  };

  /**
   * 渲染单个服务器项
   */
  const renderServerItem = (server: MCPServerItem, _index: number) => {
    const isExpanded = expandedServers.has(server.id);
    const isCopied = copiedServer === server.id;

    const transport = server.spec.type || "stdio";
    const command = server.spec.command;
    const url = server.spec.url;

    // 获取 MCP 说明
    const mcpDesc = getMCPDescription(server.id);
    const categoryLabel = getCategoryLabel(mcpDesc.category);
    const categoryColor = getCategoryColor(mcpDesc.category);

    // 获取调用时间
    const lastCalledAt = getCallTime(server.id);
    const lastCalledText = formatCallTime(lastCalledAt);
    const lastCalledFullText = formatCallTimeFull(lastCalledAt);

    return (
      <motion.div
        key={server.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="group p-4 rounded-lg border border-border bg-card hover:bg-accent/5 hover:border-primary/20 transition-all"
      >
        {/* 主行：服务器信息 + 启用开关 + 操作按钮 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="p-1.5 bg-primary/10 rounded">
                {getTransportIcon(transport)}
              </div>
              <h4 className="font-medium truncate">{mcpDesc.name || server.id}</h4>
              {/* 分类标签 */}
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  color: categoryColor,
                  borderColor: categoryColor,
                  backgroundColor: `${categoryColor}10`
                }}
              >
                {categoryLabel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {transport}
              </Badge>
              {server.enabled ? (
                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                  <Power className="h-3 w-3 mr-1" />
                  已启用
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-gray-500 border-gray-500">
                  已禁用
                </Badge>
              )}
            </div>
            {/* MCP 描述 */}
            <p className="text-xs text-muted-foreground pl-9 mb-1">
              {mcpDesc.description}
            </p>
            {/* 服务器 ID（帮助区分同名服务器） */}
            <p className="text-[10px] text-muted-foreground/50 font-mono pl-9 mb-1">
              ID: {server.id}
            </p>
            {/* 最近调用时间 */}
            <div
              className="flex items-center gap-1 text-[11px] text-muted-foreground/70 pl-9 mb-1 cursor-pointer hover:text-muted-foreground"
              onClick={() => handleMarkAsCalled(server.id)}
              title={lastCalledFullText ? `点击更新调用时间\n上次调用: ${lastCalledFullText}` : '点击标记为已调用'}
            >
              <Clock className="h-3 w-3" />
              <span>上次调用: {lastCalledText}</span>
            </div>
            {command && !isExpanded && (
              <p className="text-xs text-muted-foreground/60 font-mono truncate pl-9">
                {command}
              </p>
            )}
            {transport === "sse" && url && !isExpanded && (
              <p className="text-xs text-muted-foreground/60 font-mono truncate pl-9">
                {url}
              </p>
            )}
          </div>

          {/* 右侧：启用开关 + 操作按钮 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 启用/禁用开关 */}
            <div className="flex items-center gap-2">
              <label
                htmlFor={`${server.id}-enabled`}
                className="text-sm text-muted-foreground cursor-pointer"
              >
                启用
              </label>
              <Switch
                id={`${server.id}-enabled`}
                checked={server.enabled}
                onCheckedChange={() => handleToggleEnabled(server)}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(server)}
                className="h-8 px-2 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600"
                title="编辑配置"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpanded(server.id)}
                className="h-8 px-2 hover:bg-primary/10"
                title={isExpanded ? "收起" : "展开"}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveServer(server.id)}
                disabled={removingServer === server.id}
                className="hover:bg-destructive/10 hover:text-destructive"
                title="删除"
              >
                {removingServer === server.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 展开的详细信息 */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="pl-9 space-y-3 pt-3 mt-3 border-t border-border/50"
          >
            {/* 使用场景 */}
            {mcpDesc.useCases && mcpDesc.useCases.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">使用场景</p>
                <ul className="text-xs space-y-1 pl-4">
                  {mcpDesc.useCases.map((useCase, idx) => (
                    <li key={idx} className="list-disc text-muted-foreground">
                      {useCase}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {command && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Command</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyCommand(command, server.id)}
                    className="h-6 px-2 text-xs hover:bg-primary/10"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {isCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                  {command}
                </p>
              </div>
            )}

            {server.spec.args && server.spec.args.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Arguments</p>
                <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                  {server.spec.args.map((arg, idx) => (
                    <div key={idx} className="break-all">
                      <span className="text-muted-foreground mr-2">[{idx}]</span>
                      {arg}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {url && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">URL</p>
                <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                  {url}
                </p>
              </div>
            )}

            {server.spec.env && Object.keys(server.spec.env).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Environment Variables
                </p>
                <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                  {Object.entries(server.spec.env).map(([key, value]) => (
                    <div key={key} className="break-all">
                      <span className="text-primary">{key}</span>
                      <span className="text-muted-foreground mx-1">=</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <Card className={`p-6 ${className || ""}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${engineColor}20` }}
          >
            <EngineIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{engineLabel}</h3>
            <p className="text-xs text-muted-foreground">
              {servers.filter(s => s.enabled).length} / {servers.length} 个工具已启用
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="gap-2 hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600"
          >
            <Plus className="h-4 w-4" />
            添加工具
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadServers}
            className="gap-2 hover:bg-primary/10"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索 MCP 工具..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 服务器列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {searchQuery ? (
            <>
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2 font-medium">
                未找到匹配的 MCP 工具
              </p>
              <p className="text-sm text-muted-foreground">
                尝试使用不同的关键词搜索
              </p>
            </>
          ) : (
            <>
              <div
                className="p-4 rounded-full mb-4"
                style={{ backgroundColor: `${engineColor}20` }}
              >
                <EngineIcon className="h-12 w-12" />
              </div>
              <p className="text-muted-foreground mb-2 font-medium">
                暂无 MCP 工具
              </p>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            为 {engineLabel} 添加 MCP 工具以扩展功能
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredServers.map((server, index) => renderServerItem(server, index))}
          </AnimatePresence>
        </div>
      )}

      {/* 添加/编辑对话框 */}
      <MCPServerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        engine={engine}
        serverId={editingServer?.id}
        serverSpec={editingServer?.spec}
        onSaved={handleDialogSaved}
      />
    </Card>
  );
};

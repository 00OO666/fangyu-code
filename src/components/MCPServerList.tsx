import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  Globe,
  Terminal,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api, type McpServer } from "@/lib/api";
import { copyTextToClipboard } from "@/lib/clipboard";
import { MCPServerListSkeleton } from "@/components/skeletons/MCPServerListSkeleton";

interface MCPServerListProps {
  /**
   * List of MCP servers to display
   */
  servers: McpServer[];
  /**
   * Whether the list is loading
   */
  loading: boolean;
  /**
   * Callback when a server is removed
   */
  onServerRemoved: (id: string) => void;
  /**
   * Callback to refresh the server list
   */
  onRefresh: () => void;
}

/**
 * Component for displaying a list of MCP servers
 * Shows servers grouped by scope with status indicators
 */
export const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  loading,
  onServerRemoved,
  onRefresh,
}) => {
  const [removingServer, setRemovingServer] = useState<string | null>(null);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [copiedServer, setCopiedServer] = useState<string | null>(null);

  /**
   * Toggles expanded state for a server
   */
  const toggleExpanded = (serverId: string) => {
    setExpandedServers(prev => {
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
   * Copies command to clipboard
   */
  const copyCommand = async (command: string, serverId: string) => {
    try {
      await copyTextToClipboard(command);
      setCopiedServer(serverId);
      setTimeout(() => setCopiedServer(null), 2000);
    } catch (error) {
      console.error("Failed to copy command:", error);
    }
  };

  /**
   * Removes a server
   */
  const handleRemoveServer = async (server: McpServer) => {
    try {
      setRemovingServer(server.id);
      // 使用新的 API 删除服务器
      await api.mcpDeleteServer(server.id, server.apps);
      onServerRemoved(server.id);
    } catch (error) {
      console.error("Failed to remove server:", error);
    } finally {
      setRemovingServer(null);
    }
  };

  /**
   * Gets icon for transport type
   */
  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case "stdio":
        return <Terminal className="h-4 w-4 text-amber-500" />;
      case "sse":
        return <Globe className="h-4 w-4 text-emerald-500" />;
      default:
        return <Network className="h-4 w-4 text-blue-500" />;
    }
  };

  /**
   * 切换应用启用状态（新增）
   */
  const handleToggleApp = async (server: McpServer, app: string, enabled: boolean) => {
    try {
      await api.mcpToggleApp(server.id, server.server, app, enabled);
      // 刷新列表
      onRefresh();
    } catch (error) {
      console.error("Failed to toggle app:", error);
    }
  };

  /**
   * Renders a single server item
   */
  const renderServerItem = (server: McpServer) => {
    const isExpanded = expandedServers.has(server.id);
    const isCopied = copiedServer === server.id;
    
    // 获取传输类型
    const transport = server.server.type || "stdio";
    const command = server.server.command;
    const url = server.server.url;

    return (
      <motion.div
        key={server.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="group p-4 rounded-lg border border-border bg-card hover:bg-accent/5 hover:border-primary/20 transition-all overflow-hidden"
      >
        {/* 主行：服务器信息 + 应用开关 + 操作按钮 */}
        <div className="flex items-center gap-4">
          {/* 左侧：服务器信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-primary/10 rounded">
                {getTransportIcon(transport)}
              </div>
              <h4 className="font-medium truncate">{server.name}</h4>
            </div>
            {server.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 pl-9">
                {server.description}
              </p>
            )}
          </div>

          {/* 中间：应用 Switch 开关 */}
          <div className="flex flex-col gap-2 flex-shrink-0 min-w-[140px]">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={`${server.id}-claude`}
                className="text-sm font-medium cursor-pointer"
              >
                Claude
              </label>
              <Switch
                id={`${server.id}-claude`}
                checked={server.apps.claude}
                onCheckedChange={(checked) => handleToggleApp(server, "claude", checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={`${server.id}-codex`}
                className="text-sm font-medium cursor-pointer"
              >
                Codex
              </label>
              <Switch
                id={`${server.id}-codex`}
                checked={server.apps.codex}
                onCheckedChange={(checked) => handleToggleApp(server, "codex", checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={`${server.id}-gemini`}
                className="text-sm font-medium cursor-pointer"
              >
                Gemini
              </label>
              <Switch
                id={`${server.id}-gemini`}
                checked={server.apps.gemini}
                onCheckedChange={(checked) => handleToggleApp(server, "gemini", checked)}
              />
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveServer(server)}
              disabled={removingServer === server.id}
              className="hover:bg-destructive/10 hover:text-destructive"
              title="删除服务器"
            >
              {removingServer === server.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* 简要信息行 */}
        {command && !isExpanded && (
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs text-muted-foreground font-mono truncate pl-9 flex-1" title={command}>
              {command}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpanded(server.id)}
              className="h-6 px-2 text-xs hover:bg-primary/10"
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              详情
            </Button>
          </div>
        )}

        {transport === "sse" && url && !isExpanded && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground font-mono truncate pl-9" title={url}>
              {url}
            </p>
          </div>
        )}

        {server.server.env && Object.keys(server.server.env).length > 0 && !isExpanded && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground pl-9">
              环境变量: {Object.keys(server.server.env).length} 个
            </p>
          </div>
        )}
          
          {/* Expanded Details */}
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pl-9 space-y-3 pt-2 border-t border-border/50"
            >
              {command && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Command</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCommand(command, server.id)}
                        className="h-6 px-2 text-xs hover:bg-primary/10"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {isCopied ? "Copied!" : "Copy"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(server.id)}
                        className="h-6 px-2 text-xs hover:bg-primary/10"
                      >
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                    {command}
                  </p>
                </div>
              )}

              {server.server.args && server.server.args.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Arguments</p>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                    {server.server.args.map((arg, idx) => (
                      <div key={idx} className="break-all">
                        <span className="text-muted-foreground mr-2">[{idx}]</span>
                        {arg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {transport === "sse" && url && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">URL</p>
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                    {url}
                  </p>
                </div>
              )}

              {server.server.env && Object.keys(server.server.env).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Environment Variables</p>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                    {Object.entries(server.server.env).map(([key, value]) => (
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

  if (loading) {
    return <MCPServerListSkeleton />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold">Configured Servers</h3>
          <p className="text-sm text-muted-foreground">
            {servers.length} server{servers.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <Network className="h-12 w-12 text-primary" />
          </div>
          <p className="text-muted-foreground mb-2 font-medium">No MCP servers configured</p>
          <p className="text-sm text-muted-foreground">
            Add a server to get started with Model Context Protocol
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {servers.map((server) => renderServerItem(server))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}; 

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Code, Settings } from "lucide-react";
import { api, type MCPServerSpec } from "@/lib/api";

interface MCPServerDialogProps {
  /**
   * 是否打开对话框
   */
  open: boolean;
  /**
   * 关闭对话框的回调
   */
  onClose: () => void;
  /**
   * 引擎名称
   */
  engine: "claude" | "codex" | "gemini";
  /**
   * 编辑模式下的服务器 ID（为空表示新建）
   */
  serverId?: string;
  /**
   * 编辑模式下的服务器规范
   */
  serverSpec?: MCPServerSpec;
  /**
   * 保存成功的回调
   */
  onSaved: () => void;
}

/**
 * MCP 服务器添加/编辑对话框
 */
export const MCPServerDialog: React.FC<MCPServerDialogProps> = ({
  open,
  onClose,
  engine,
  serverId,
  serverSpec,
  onSaved,
}) => {
  const isEditMode = !!serverId;

  // 表单状态
  const [id, setId] = useState("");
  const [type, setType] = useState<"stdio" | "http" | "sse">("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [env, setEnv] = useState<Record<string, string>>({});
  const [cwd, setCwd] = useState("");
  const [headers, setHeaders] = useState<Record<string, string>>({});

  // UI 状态
  const [saving, setSaving] = useState(false);
  const [newArgInput, setNewArgInput] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  // JSON 模式状态
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 初始化表单（编辑模式）
  useEffect(() => {
    if (open) {
      if (isEditMode && serverSpec) {
        setId(serverId || "");
        setType((serverSpec.type as "stdio" | "http" | "sse") || "stdio");
        setCommand(serverSpec.command || "");
        setArgs(serverSpec.args || []);
        setUrl(serverSpec.url || "");
        setEnv(serverSpec.env || {});
        setCwd(serverSpec.cwd || "");
        setHeaders(serverSpec.headers || {});
        // 编辑模式下生成 JSON
        setJsonInput(JSON.stringify(serverSpec, null, 2));
      } else {
        // 新建模式：重置表单
        setId("");
        setType("stdio");
        setCommand("");
        setArgs([]);
        setUrl("");
        setEnv({});
        setCwd("");
        setHeaders({});
        setJsonInput("");
      }
      setInputMode("form");
      setJsonError(null);
    }
  }, [open, isEditMode, serverId, serverSpec]);

  /**
   * 添加参数
   */
  const handleAddArg = () => {
    if (newArgInput.trim()) {
      setArgs([...args, newArgInput.trim()]);
      setNewArgInput("");
    }
  };

  /**
   * 更新参数
   */
  const handleUpdateArg = (index: number, value: string) => {
    setArgs(args.map((arg, i) => (i === index ? value : arg)));
  };

  /**
   * 移除参数
   */
  const handleRemoveArg = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  /**
   * 添加环境变量
   */
  const handleAddEnv = () => {
    if (newEnvKey.trim() && newEnvValue.trim()) {
      setEnv({ ...env, [newEnvKey.trim()]: newEnvValue.trim() });
      setNewEnvKey("");
      setNewEnvValue("");
    }
  };

  /**
   * 更新环境变量
   */
  const handleUpdateEnv = (oldKey: string, newKey: string, value: string) => {
    const newEnv = { ...env };
    if (oldKey !== newKey) {
      delete newEnv[oldKey];
    }
    newEnv[newKey] = value;
    setEnv(newEnv);
  };

  /**
   * 移除环境变量
   */
  const handleRemoveEnv = (key: string) => {
    const newEnv = { ...env };
    delete newEnv[key];
    setEnv(newEnv);
  };

  /**
   * 添加请求头
   */
  const handleAddHeader = () => {
    if (newHeaderKey.trim() && newHeaderValue.trim()) {
      setHeaders({ ...headers, [newHeaderKey.trim()]: newHeaderValue.trim() });
      setNewHeaderKey("");
      setNewHeaderValue("");
    }
  };

  /**
   * 更新请求头
   */
  const handleUpdateHeader = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...headers };
    if (oldKey !== newKey) {
      delete newHeaders[oldKey];
    }
    newHeaders[newKey] = value;
    setHeaders(newHeaders);
  };

  /**
   * 移除请求头
   */
  const handleRemoveHeader = (key: string) => {
    const newHeaders = { ...headers };
    delete newHeaders[key];
    setHeaders(newHeaders);
  };

  /**
   * 解析 JSON 输入，支持两种格式：
   * 1. 直接服务器配置：{ "type": "stdio", "command": "...", ... }
   * 2. 完整 MCP 配置：{ "mcpServers": { "server-id": { ... } } }
   */
  const parseJsonInput = (): { id?: string; spec: MCPServerSpec } | null => {
    try {
      const parsed = JSON.parse(jsonInput);

      // 检测是否为完整 MCP 配置格式
      if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        const serverIds = Object.keys(parsed.mcpServers);
        if (serverIds.length === 0) {
          setJsonError("mcpServers 中没有服务器配置");
          return null;
        }
        if (serverIds.length > 1) {
          setJsonError(`检测到多个服务器配置，将使用第一个: ${serverIds[0]}`);
        }
        const serverId = serverIds[0];
        const serverSpec = parsed.mcpServers[serverId];
        setJsonError(null);
        return { id: serverId, spec: serverSpec as MCPServerSpec };
      }

      // 直接服务器配置格式
      setJsonError(null);
      return { spec: parsed as MCPServerSpec };
    } catch (e) {
      setJsonError(`JSON 解析错误: ${e instanceof Error ? e.message : "格式无效"}`);
      return null;
    }
  };

  /**
   * 保存服务器
   */
  const handleSave = async () => {
    let serverId = id.trim();

    // JSON 模式下先解析获取可能的 ID
    if (inputMode === "json") {
      const result = parseJsonInput();
      if (!result) {
        return;
      }
      // 如果 JSON 中包含服务器 ID，使用它（仅在新建模式下）
      if (result.id && !isEditMode) {
        serverId = result.id;
        setId(result.id); // 更新 UI 显示
      }
    }

    // 验证 ID
    if (!serverId) {
      alert("请输入服务器 ID");
      return;
    }

    let spec: MCPServerSpec;

    if (inputMode === "json") {
      // JSON 模式（已在上面解析过，这里重新获取 spec）
      const result = parseJsonInput();
      if (!result) {
        return;
      }
      spec = result.spec;
    } else {
      // 表单模式验证
      if (type === "stdio" && !command.trim()) {
        alert("stdio 类型必须填写 command");
        return;
      }

      if ((type === "http" || type === "sse") && !url.trim()) {
        alert(`${type} 类型必须填写 URL`);
        return;
      }

      // 构建服务器规范
      spec = {
        type,
        ...(type === "stdio" && {
          command,
          ...(args.length > 0 && { args }),
          ...(cwd && { cwd }),
          ...(Object.keys(env).length > 0 && { env }),
        }),
        ...((type === "http" || type === "sse") && {
          url,
          ...(Object.keys(headers).length > 0 && { headers }),
        }),
      };
    }

    setSaving(true);

    try {
      // 调用 API
      await api.mcpUpsertEngineServer(engine, serverId, spec);

      // 成功后关闭对话框并刷新
      onSaved();
      onClose();
    } catch (error) {
      console.error("Failed to save MCP server:", error);
      alert(`保存失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "编辑" : "添加"} MCP 服务器 - {engine.toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Server ID */}
          <div>
            <Label htmlFor="server-id">服务器 ID *</Label>
            <Input
              id="server-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="my-mcp-server"
              disabled={isEditMode}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {isEditMode ? "编辑模式下无法修改 ID" : "唯一标识符，不可重复"}
            </p>
          </div>

          {/* 输入模式切换 */}
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "form" | "json")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="form" className="gap-2">
                <Settings className="h-4 w-4" />
                表单模式
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-2">
                <Code className="h-4 w-4" />
                JSON 模式
              </TabsTrigger>
            </TabsList>

            {/* 表单模式 */}
            <TabsContent value="form" className="space-y-4 mt-4">
              {/* Transport Type */}
              <div>
                <Label htmlFor="transport-type">传输类型 *</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger id="transport-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stdio">stdio (标准输入输出)</SelectItem>
                    <SelectItem value="http">http (HTTP 流式)</SelectItem>
                    <SelectItem value="sse">sse (Server-Sent Events)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

          {/* stdio 配置 */}
          {type === "stdio" && (
            <>
              {/* Command */}
              <div>
                <Label htmlFor="command">命令 *</Label>
                <Input
                  id="command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="node"
                />
              </div>

              {/* Args */}
              <div>
                <Label>参数（可选）</Label>
                <div className="space-y-2">
                  {args.map((arg, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={arg}
                        onChange={(e) => handleUpdateArg(index, e.target.value)}
                        className="flex-1"
                        placeholder={`参数 ${index + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveArg(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newArgInput}
                      onChange={(e) => setNewArgInput(e.target.value)}
                      placeholder="添加参数..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddArg();
                        }
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={handleAddArg}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Working Directory */}
              <div>
                <Label htmlFor="cwd">工作目录（可选）</Label>
                <Input
                  id="cwd"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="/path/to/working/directory"
                />
              </div>

              {/* Environment Variables */}
              <div>
                <Label>环境变量（可选）</Label>
                <div className="space-y-2">
                  {Object.entries(env).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Input
                        value={key}
                        onChange={(e) => handleUpdateEnv(key, e.target.value, value)}
                        className="flex-1"
                        placeholder="KEY"
                      />
                      <span className="text-muted-foreground">=</span>
                      <Input
                        value={value}
                        onChange={(e) => handleUpdateEnv(key, key, e.target.value)}
                        className="flex-1"
                        placeholder="value"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEnv(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      placeholder="KEY"
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">=</span>
                    <Input
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                      placeholder="value"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddEnv();
                        }
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={handleAddEnv}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* http/sse 配置 */}
          {(type === "http" || type === "sse") && (
            <>
              {/* URL */}
              <div>
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:3000"
                />
              </div>

              {/* Headers */}
              <div>
                <Label>请求头（可选）</Label>
                <div className="space-y-2">
                  {Object.entries(headers).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Input
                        value={key}
                        onChange={(e) => handleUpdateHeader(key, e.target.value, value)}
                        className="flex-1"
                        placeholder="Header-Name"
                      />
                      <span className="text-muted-foreground">:</span>
                      <Input
                        value={value}
                        onChange={(e) => handleUpdateHeader(key, key, e.target.value)}
                        className="flex-1"
                        placeholder="value"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveHeader(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newHeaderKey}
                      onChange={(e) => setNewHeaderKey(e.target.value)}
                      placeholder="Header-Name"
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      value={newHeaderValue}
                      onChange={(e) => setNewHeaderValue(e.target.value)}
                      placeholder="value"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddHeader();
                        }
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={handleAddHeader}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
            </TabsContent>

            {/* JSON 模式 */}
            <TabsContent value="json" className="space-y-4 mt-4">
              <div>
                <Label>服务器配置 JSON</Label>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    setJsonError(null);
                  }}
                  placeholder={`{
  "type": "stdio",
  "command": "node",
  "args": ["server.js"],
  "env": {
    "API_KEY": "your-key"
  }
}`}
                  className="font-mono text-sm min-h-[300px]"
                />
                {jsonError && (
                  <p className="text-sm text-destructive mt-2">{jsonError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  直接输入或粘贴 MCP 服务器配置的 JSON 格式
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

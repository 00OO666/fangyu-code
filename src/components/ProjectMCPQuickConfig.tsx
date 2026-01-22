/**
 * ProjectMCPQuickConfig - 项目级 MCP 快捷配置对话框
 *
 * 在会话中快速管理当前项目的 MCP 服务器开关
 * 支持从全局配置复制到项目配置，或在项目级别禁用某些服务器
 */

import { logger } from '@/lib/logger';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Network from 'lucide-react/dist/esm/icons/network'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Globe from 'lucide-react/dist/esm/icons/globe'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Power from 'lucide-react/dist/esm/icons/power'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import Check from 'lucide-react/dist/esm/icons/check'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, type MCPServerSpec, type McpServerWithStatus, type MCPProjectConfig } from '@/lib/api';
import { getMCPDescription, getCategoryLabel, getCategoryColor } from '@/lib/mcpDescriptions';
import { useProjectMCPConfig } from '@/hooks/useProjectMCPConfig';
import { getMCPRecommendations, type ProjectType, type MCPRecommendation, getOfficialMCPDefault } from '@/config/mcpRecommendations';
import { ClaudeIcon } from './icons/ClaudeIcon';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2';
import { useNavigation } from '@/contexts/NavigationContext';

interface ProjectMCPQuickConfigProps {
  /**
   * 对话框是否打开
   */
  open: boolean;
  /**
   * 关闭对话框回调
   */
  onClose: () => void;
  /**
   * 当前项目路径
   */
  projectPath: string;
  /**
   * 引擎类型（默认 claude）
   */
  engine?: 'claude' | 'codex' | 'gemini' | 'siliconflow';
}

/**
 * 项目级 MCP 快捷配置对话框
 */
export const ProjectMCPQuickConfig: React.FC<ProjectMCPQuickConfigProps> = ({
  open,
  onClose,
  projectPath,
  engine = 'claude',
}) => {
  const { navigateTo } = useNavigation();
  const [activeTab, setActiveTab] = useState<'recommend' | 'project' | 'global'>('recommend');
  const [globalServers, setGlobalServers] = useState<McpServerWithStatus[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copyingToProject, setCopyingToProject] = useState(false);
  const [addingRecommended, setAddingRecommended] = useState(false);
  const [autoConfiguringId, setAutoConfiguringId] = useState<string | null>(null);

  // 智能检测项目类型（简化版：根据项目路径名推断）
  const detectedProjectType = useMemo((): ProjectType => {
    const pathLower = projectPath.toLowerCase();
    if (pathLower.includes('tauri') || pathLower.includes('any-code') || pathLower.includes('fangyu')) {
      return 'desktop-tauri';
    }
    if (pathLower.includes('pboot') || pathLower.includes('cms')) {
      return 'backend-php';
    }
    if (pathLower.includes('next')) {
      return 'frontend-nextjs';
    }
    if (pathLower.includes('react') || pathLower.includes('vite')) {
      return 'frontend-react';
    }
    if (pathLower.includes('vue')) {
      return 'frontend-vue';
    }
    if (pathLower.includes('python') || pathLower.includes('django') || pathLower.includes('flask')) {
      return 'backend-python';
    }
    if (pathLower.includes('node') || pathLower.includes('express')) {
      return 'backend-node';
    }
    return 'general';
  }, [projectPath]);

  // 获取推荐的 MCP 列表
  const recommendations = useMemo(() => getMCPRecommendations(detectedProjectType), [detectedProjectType]);

  // 项目级配置 Hook
  const {
    projectConfig,
    loading: loadingProject,
    error: projectError,
    reloadProjectConfig,
    toggleProjectServer,
    isServerEnabledInProject,
  } = useProjectMCPConfig({
    projectPath,
    engine,
    scope: 'project',
  });

  // 加载全局服务器列表
  const loadGlobalServers = useCallback(async () => {
    try {
      setLoadingGlobal(true);
      const servers = await api.mcpGetEngineServersWithStatus(engine);
      logger.debug('ProjectMCPQuickConfig', `[ProjectMCPQuickConfig] 加载了 ${servers.length} 个全局服务器:`, servers.map(s => ({ id: s.id, enabled: s.enabled })));
      setGlobalServers(servers);
    } catch (error) {
      logger.error('ProjectMCPQuickConfig', '[ProjectMCPQuickConfig] Failed to load global servers:', error);
    } finally {
      setLoadingGlobal(false);
    }
  }, [engine]);

  // 加载数据
  useEffect(() => {
    if (open) {
      loadGlobalServers();
      reloadProjectConfig();
    }
  }, [open, loadGlobalServers, reloadProjectConfig]);

  // 获取项目配置中的服务器列表
  const projectServers = projectConfig?.mcpServers
    ? Object.entries(projectConfig.mcpServers).map(([id, spec]) => ({
        id,
        spec: spec as MCPServerSpec,
        enabled: true,
      }))
    : [];

  // 切换服务器在项目配置中的启用状态
  const handleToggleServer = async (serverId: string, spec: MCPServerSpec, currentEnabled: boolean) => {
    try {
      setSavingId(serverId);
      await toggleProjectServer(serverId, spec, !currentEnabled);
    } catch (error) {
      logger.error('ProjectMCPQuickConfig', '[ProjectMCPQuickConfig] Toggle failed:', error);
    } finally {
      setSavingId(null);
    }
  };

  // 复制全部启用的全局服务器到项目配置
  const handleCopyAllToProject = async () => {
    try {
      setCopyingToProject(true);
      const enabledServers = globalServers.filter(s => s.enabled);
      const newConfig: MCPProjectConfig = {
        mcpServers: {},
      };
      for (const server of enabledServers) {
        newConfig.mcpServers[server.id] = server.spec;
      }
      await api.mcpSaveProjectConfig(projectPath, newConfig);
      await reloadProjectConfig();
    } catch (error) {
      logger.error('ProjectMCPQuickConfig', '[ProjectMCPQuickConfig] Copy all failed:', error);
    } finally {
      setCopyingToProject(false);
    }
  };

  // 一键添加推荐的 MCP 服务器到项目
  const handleAddRecommendations = async (strength: 'required' | 'recommended' | 'all') => {
    try {
      setAddingRecommended(true);

      const toAdd = recommendations.filter(rec => {
        if (strength === 'all') return true;
        if (strength === 'required') return rec.strength === 'required';
        if (strength === 'recommended') return rec.strength === 'required' || rec.strength === 'recommended';
        return false;
      });

      const newConfig: MCPProjectConfig = {
        mcpServers: { ...(projectConfig?.mcpServers || {}) },
      };

      let addedCount = 0;
      for (const rec of toAdd) {
        // 找到全局服务器中匹配的 spec（模糊匹配 ID，支持 @anthropic/filesystem 匹配 filesystem）
        const globalServer = globalServers.find(s =>
          s.id === rec.serverId ||
          s.id.endsWith(`/${rec.serverId}`) ||
          s.id.toLowerCase().includes(rec.serverId.toLowerCase())
        );

        if (globalServer && globalServer.enabled) {
          // 使用全局服务器的真实 ID，而不是推荐的 serverId
          newConfig.mcpServers[globalServer.id] = globalServer.spec;
          addedCount++;
          logger.debug('ProjectMCPQuickConfig', `[ProjectMCPQuickConfig] Added ${rec.name} (${globalServer.id});`);
        } else {
          console.warn(`[ProjectMCPQuickConfig] 未找到全局服务器: ${rec.serverId}`, {
            available: globalServers.map(s => s.id),
            enabled: globalServers.filter(s => s.enabled).map(s => s.id),
          });
        }
      }

      await api.mcpSaveProjectConfig(projectPath, newConfig);
      await reloadProjectConfig();

      logger.debug('ProjectMCPQuickConfig', `[ProjectMCPQuickConfig] 成功添加 ${addedCount}/${toAdd.length} 个推荐服务器`);
    } catch (error) {
      logger.error('ProjectMCPQuickConfig', '[ProjectMCPQuickConfig] Add recommendations failed:', error);
    } finally {
      setAddingRecommended(false);
    }
  };

  // 获取传输类型图标
  const getTransportIcon = (spec: MCPServerSpec) => {
    const transport = spec.type || 'stdio';
    switch (transport) {
      case 'stdio':
        return <Terminal className="h-4 w-4 text-amber-500" />;
      case 'sse':
        return <Globe className="h-4 w-4 text-emerald-500" />;
      default:
        return <Network className="h-4 w-4 text-blue-500" />;
    }
  };

  // 渲染智能推荐列表
  const renderRecommendations = () => {
    const requiredList = recommendations.filter(r => r.strength === 'required');
    const recommendedList = recommendations.filter(r => r.strength === 'recommended');
    const optionalList = recommendations.filter(r => r.strength === 'optional');

    return (
      <div className="space-y-4">
        {/* 项目类型说明 */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm text-blue-900 dark:text-blue-100">
              检测到项目类型：{detectedProjectType === 'desktop-tauri' ? 'Tauri 桌面应用' :
                          detectedProjectType === 'backend-php' ? 'PHP 后端' :
                          detectedProjectType === 'frontend-react' ? 'React 前端' :
                          detectedProjectType}
            </span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            基于项目路径分析，为你推荐以下 MCP 服务器
          </p>
        </div>

        {/* 快速操作 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddRecommendations('required')}
            disabled={addingRecommended || requiredList.length === 0}
            className="gap-1 flex-1 bg-red-50 dark:bg-red-950 border-red-300 hover:bg-red-100 dark:hover:bg-red-900"
          >
            {addingRecommended ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            添加必须项
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddRecommendations('recommended')}
            disabled={addingRecommended || recommendedList.length === 0}
            className="gap-1 flex-1 bg-green-50 dark:bg-green-950 border-green-300 hover:bg-green-100 dark:hover:bg-green-900"
          >
            {addingRecommended ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            添加推荐项
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddRecommendations('all')}
            disabled={addingRecommended}
            className="gap-1 flex-1"
          >
            {addingRecommended ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
            添加全部
          </Button>
        </div>

        {/* 推荐列表 */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {/* 必须项 */}
          {requiredList.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                必须启用
              </h4>
              {requiredList.map(rec => renderRecommendationItem(rec))}
            </div>
          )}

          {/* 推荐项 */}
          {recommendedList.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                推荐启用
              </h4>
              {recommendedList.map(rec => renderRecommendationItem(rec))}
            </div>
          )}

          {/* 可选项 */}
          {optionalList.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full"></span>
                可选
              </h4>
              {optionalList.map(rec => renderRecommendationItem(rec))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 查找匹配的全局服务器（模糊匹配）
  const findMatchingGlobalServer = useCallback((serverId: string) => {
    return globalServers.find(s =>
      s.id === serverId ||
      s.id.endsWith(`/${serverId}`) ||
      s.id.toLowerCase().includes(serverId.toLowerCase())
    );
  }, [globalServers]);

  // 检查服务器是否在项目配置中（模糊匹配）
  const isServerInProject = useCallback((serverId: string) => {
    if (!projectConfig?.mcpServers) return false;
    const keys = Object.keys(projectConfig.mcpServers);
    return keys.some(key =>
      key === serverId ||
      key.endsWith(`/${serverId}`) ||
      key.toLowerCase().includes(serverId.toLowerCase())
    );
  }, [projectConfig]);

  // 一键自动配置官方 MCP
  const handleAutoConfigureMCP = useCallback(async (serverId: string, spec: MCPServerSpec) => {
    try {
      setAutoConfiguringId(serverId);
      logger.debug('ProjectMCPQuickConfig', `[ProjectMCPQuickConfig] 开始自动配置: ${serverId}`);

      // 1. 添加到全局 Claude 配置
      await api.mcpUpsertEngineServer(engine, serverId, spec);
      logger.debug('ProjectMCPQuickConfig', `[ProjectMCPQuickConfig] 已添加到全局 ${engine} 配置`);

      // 2. 重新加载全局服务器列表
      await loadGlobalServers();

      // 3. 自动添加到当前项目配置
      const newConfig: MCPProjectConfig = {
        mcpServers: {
          ...(projectConfig?.mcpServers || {}),
          [serverId]: spec,
        },
      };
      await api.mcpSaveProjectConfig(projectPath, newConfig);
      await reloadProjectConfig();

      logger.debug('ProjectMCPQuickConfig', `[ProjectMCPQuickConfig] ✅ ${serverId} 配置成功！`);
    } catch (error) {
      logger.error('ProjectMCPQuickConfig', `[ProjectMCPQuickConfig] 自动配置失败:`, error);
      // 如果失败，跳转到设置页面让用户手动配置
      onClose();
      navigateTo('settings');
    } finally {
      setAutoConfiguringId(null);
    }
  }, [engine, loadGlobalServers, projectConfig, projectPath, reloadProjectConfig, onClose, navigateTo]);

  // 跳转到设置页面配置 MCP（非官方 MCP 或自动配置失败时使用）
  const handleGoToSettings = useCallback(() => {
    onClose(); // 先关闭对话框
    navigateTo('settings'); // 导航到设置页面
  }, [navigateTo, onClose]);

  // 渲染单个推荐项
  const renderRecommendationItem = (rec: MCPRecommendation) => {
    const globalServer = findMatchingGlobalServer(rec.serverId);
    const isInProject = isServerInProject(rec.serverId) || (globalServer && isServerEnabledInProject(globalServer.id));
    const isAvailable = globalServer && globalServer.enabled;
    const officialDefault = getOfficialMCPDefault(rec.serverId);
    const isConfiguring = autoConfiguringId === rec.serverId;

    return (
      <motion.div
        key={rec.serverId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border transition-colors",
          isInProject ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-border hover:bg-accent/5"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {globalServer ? (
            <div className="p-1.5 bg-primary/10 rounded">
              {getTransportIcon(globalServer.spec)}
            </div>
          ) : (
            <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded">
              <Terminal className="h-4 w-4 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{rec.name}</span>
              {isInProject && (
                <Badge variant="outline" className="text-[10px] h-5 text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  已添加
                </Badge>
              )}
              {!isAvailable && officialDefault && (
                <Badge variant="outline" className="text-[10px] h-5 text-blue-500 border-blue-500">
                  官方
                </Badge>
              )}
              {!isAvailable && !officialDefault && (
                <Badge variant="outline" className="text-[10px] h-5 text-orange-500">
                  未配置
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{rec.reason}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {isAvailable ? (
            <Switch
              checked={!!isInProject}
              disabled={savingId === rec.serverId || savingId === globalServer?.id}
              onCheckedChange={() => globalServer && handleToggleServer(globalServer.id, globalServer.spec, !!isInProject)}
            />
          ) : officialDefault ? (
            // 官方 MCP - 显示一键配置按钮
            <Button
              variant="default"
              size="sm"
              className="text-xs gap-1 bg-blue-600 hover:bg-blue-700"
              disabled={isConfiguring}
              onClick={() => handleAutoConfigureMCP(rec.serverId, officialDefault.spec)}
            >
              {isConfiguring ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              {isConfiguring ? '配置中...' : '一键配置'}
            </Button>
          ) : (
            // 非官方 MCP - 跳转设置页面
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-orange-500 hover:text-orange-600"
              onClick={handleGoToSettings}
            >
              去配置
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  // 渲染全局服务器列表（可选择添加到项目）
  const renderGlobalServerList = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          选择要在此项目中使用的 MCP 服务器
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAllToProject}
          disabled={copyingToProject || globalServers.filter(s => s.enabled).length === 0}
          className="gap-1"
        >
          {copyingToProject ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          复制全部启用
        </Button>
      </div>

      {loadingGlobal ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : globalServers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">无可用的全局 MCP 服务器</p>
          <p className="text-xs mt-1">请先在设置中添加 MCP 服务器</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {globalServers.map(server => {
            const mcpDesc = getMCPDescription(server.id);
            const categoryColor = getCategoryColor(mcpDesc.category);
            const isInProject = isServerEnabledInProject(server.id);

            return (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-1.5 bg-primary/10 rounded">
                    {getTransportIcon(server.spec)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {mcpDesc.name || server.id}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5"
                        style={{
                          color: categoryColor,
                          borderColor: categoryColor,
                        }}
                      >
                        {getCategoryLabel(mcpDesc.category)}
                      </Badge>
                      {!server.enabled && (
                        <Badge variant="outline" className="text-[10px] h-5 text-gray-400">
                          全局禁用
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {mcpDesc.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {isInProject && (
                    <Badge variant="outline" className="text-[10px] h-5 text-green-600 border-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      已添加
                    </Badge>
                  )}
                  <Switch
                    checked={isInProject}
                    disabled={savingId === server.id}
                    onCheckedChange={() => handleToggleServer(server.id, server.spec, isInProject)}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

  // 渲染项目配置中的服务器列表
  const renderProjectServerList = () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        当前项目的 .mcp.json 配置（优先于全局配置）
      </p>

      {loadingProject ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projectError ? (
        <div className="text-center py-8 text-red-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{projectError}</p>
        </div>
      ) : projectServers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">此项目暂无独立的 MCP 配置</p>
          <p className="text-xs mt-1">将使用全局配置，或从下方添加服务器</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {projectServers.map(server => {
            const mcpDesc = getMCPDescription(server.id);
            const categoryColor = getCategoryColor(mcpDesc.category);

            return (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-1.5 bg-primary/10 rounded">
                    {getTransportIcon(server.spec)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {mcpDesc.name || server.id}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5"
                        style={{
                          color: categoryColor,
                          borderColor: categoryColor,
                        }}
                      >
                        {getCategoryLabel(mcpDesc.category)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5 text-green-600 border-green-600">
                        <Power className="h-3 w-3 mr-1" />
                        项目启用
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {mcpDesc.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleServer(server.id, server.spec, true)}
                  disabled={savingId === server.id}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  {savingId === server.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '移除'
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-500/10 rounded">
              <ClaudeIcon className="h-5 w-5 text-orange-500" />
            </div>
            项目级 MCP 配置
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <Folder className="h-3 w-3" />
            <span className="font-mono truncate">{projectPath}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'recommend' | 'project' | 'global')} className="h-full flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-4">
              <TabsTrigger value="recommend" className="gap-2">
                <Sparkles className="h-4 w-4" />
                智能推荐
              </TabsTrigger>
              <TabsTrigger value="project" className="gap-2">
                <Folder className="h-4 w-4" />
                项目配置
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-2">
                <Globe className="h-4 w-4" />
                全局选择
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="recommend" className="mt-0">
                {renderRecommendations()}
              </TabsContent>
              <TabsContent value="project" className="mt-0">
                {renderProjectServerList()}
              </TabsContent>
              <TabsContent value="global" className="mt-0">
                {renderGlobalServerList()}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            配置保存到项目根目录的 <code className="bg-muted px-1 rounded">.mcp.json</code>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reloadProjectConfig}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              刷新
            </Button>
            <Button variant="default" size="sm" onClick={onClose}>
              完成
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

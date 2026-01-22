/**
 * PowersPanel - Powers 管理面板组件
 * 
 * 显示已安装 Powers、配置界面
 * 
 * Requirements: 9.7
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import Search from 'lucide-react/dist/esm/icons/search'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Settings from 'lucide-react/dist/esm/icons/settings'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Package from 'lucide-react/dist/esm/icons/package'
import Server from 'lucide-react/dist/esm/icons/server'
import FileText from 'lucide-react/dist/esm/icons/file-text';

// =============================================================================
// 类型定义
// =============================================================================

interface MCPServer {
  name: string;
  status: 'running' | 'stopped' | 'error';
  tools: string[];
}

interface SteeringFile {
  name: string;
  description?: string;
}

interface Power {
  name: string;
  displayName: string;
  description: string;
  keywords: string[];
  enabled: boolean;
  mcpServers: MCPServer[];
  steeringFiles: SteeringFile[];
}

interface PowersPanelProps {
  powers?: Power[];
  onActivate?: (powerName: string) => void;
  onDeactivate?: (powerName: string) => void;
  onConfigure?: () => void;
  onRefresh?: () => void;
}

// =============================================================================
// 辅助组件
// =============================================================================

const ServerStatusBadge: React.FC<{ status: MCPServer['status'] }> = ({ status }) => {
  const variants: Record<MCPServer['status'], { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
    running: { variant: 'default', label: 'Running' },
    stopped: { variant: 'secondary', label: 'Stopped' },
    error: { variant: 'destructive', label: 'Error' },
  };

  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};


// =============================================================================
// Power 卡片组件
// =============================================================================

const PowerCard: React.FC<{
  power: Power;
  onActivate?: () => void;
  onDeactivate?: () => void;
}> = ({ power, onActivate, onDeactivate }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={power.enabled ? 'border-primary/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${power.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
              <Zap className={`w-5 h-5 ${power.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{power.displayName}</h3>
                {power.enabled && (
                  <Badge variant="default" className="text-xs">Active</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{power.description}</p>
              
              {/* Keywords */}
              <div className="flex flex-wrap gap-1 mt-2">
                {power.keywords.slice(0, 5).map(keyword => (
                  <Badge key={keyword} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {power.keywords.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{power.keywords.length - 5}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={power.enabled}
              onCheckedChange={() => {
                if (power.enabled) {
                  onDeactivate?.();
                } else {
                  onActivate?.();
                }
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 展开详情 */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* MCP Servers */}
            {power.mcpServers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4" />
                  MCP Servers ({power.mcpServers.length})
                </h4>
                <div className="space-y-2">
                  {power.mcpServers.map(server => (
                    <div
                      key={server.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">{server.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {server.tools.length} tools
                        </p>
                      </div>
                      <ServerStatusBadge status={server.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Steering Files */}
            {power.steeringFiles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  Steering Files ({power.steeringFiles.length})
                </h4>
                <div className="space-y-1">
                  {power.steeringFiles.map(file => (
                    <div
                      key={file.name}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// 主组件
// =============================================================================

export const PowersPanel: React.FC<PowersPanelProps> = ({
  powers = [],
  onActivate,
  onDeactivate,
  onConfigure,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // 过滤 Powers
  const filteredPowers = powers.filter(power => {
    if (showActiveOnly && !power.enabled) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        power.name.toLowerCase().includes(query) ||
        power.displayName.toLowerCase().includes(query) ||
        power.description.toLowerCase().includes(query) ||
        power.keywords.some(k => k.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const activePowers = powers.filter(p => p.enabled).length;

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              Powers
            </CardTitle>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
              {onConfigure && (
                <Button variant="outline" size="sm" onClick={onConfigure}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 统计 */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm">
                <span className="font-medium">{activePowers}</span> active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">{powers.length}</span> installed
              </span>
            </div>
          </div>

          {/* 搜索和过滤 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search powers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={showActiveOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowActiveOnly(!showActiveOnly)}
            >
              Active Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Powers 列表 */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {filteredPowers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No powers match your search' : 'No powers installed'}
                </p>
                {onConfigure && (
                  <Button variant="outline" className="mt-4" onClick={onConfigure}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Browse Powers
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredPowers.map(power => (
              <PowerCard
                key={power.name}
                power={power}
                onActivate={() => onActivate?.(power.name)}
                onDeactivate={() => onDeactivate?.(power.name)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PowersPanel;

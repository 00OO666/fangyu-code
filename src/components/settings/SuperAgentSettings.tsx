/**
 * Super Agent 设置组件
 * 配置 Agent 系统、自治模式、Powers 等
 */
import React, { useState } from 'react';
import { Bot, Shield, Zap, Settings2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export const SuperAgentSettings: React.FC = () => {
  // Agent 配置状态
  const [maxConcurrentAgents, setMaxConcurrentAgents] = useState(3);
  const [defaultAutonomyMode, setDefaultAutonomyMode] = useState<'supervised' | 'autopilot'>('supervised');
  const [enableBackgroundTasks, setEnableBackgroundTasks] = useState(true);
  const [autoApproveLevel, setAutoApproveLevel] = useState<'none' | 'low' | 'medium'>('low');
  
  // 上下文配置
  const [contextWarningThreshold, setContextWarningThreshold] = useState(70);
  const [contextCriticalThreshold, setContextCriticalThreshold] = useState(85);
  const [enableAutoCompaction, setEnableAutoCompaction] = useState(true);

  // 安全配置
  const [enableSecurityGuard, setEnableSecurityGuard] = useState(true);
  const [blockDangerousCommands, setBlockDangerousCommands] = useState(true);
  const [enableAuditLog, setEnableAuditLog] = useState(true);

  return (
    <div className="space-y-6">
      {/* Agent 系统配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agent 系统配置
          </CardTitle>
          <CardDescription>
            配置多 Agent 编排系统的行为
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>最大并发 Agent 数</Label>
              <p className="text-xs text-muted-foreground">
                同时运行的后台 Agent 数量上限
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Slider
                value={[maxConcurrentAgents]}
                onValueChange={([v]) => setMaxConcurrentAgents(v)}
                min={1}
                max={10}
                step={1}
                className="w-32"
              />
              <Badge variant="secondary">{maxConcurrentAgents}</Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>默认自治模式</Label>
              <p className="text-xs text-muted-foreground">
                新会话的默认自治模式
              </p>
            </div>
            <Select value={defaultAutonomyMode} onValueChange={(v: 'supervised' | 'autopilot') => setDefaultAutonomyMode(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supervised">👁️ 监督模式</SelectItem>
                <SelectItem value="autopilot">🚀 自动驾驶</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>启用后台任务</Label>
              <p className="text-xs text-muted-foreground">
                允许 Agent 在后台执行长时间任务
              </p>
            </div>
            <Switch
              checked={enableBackgroundTasks}
              onCheckedChange={setEnableBackgroundTasks}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>自动批准级别</Label>
              <p className="text-xs text-muted-foreground">
                自动驾驶模式下自动批准的操作风险级别
              </p>
            </div>
            <Select value={autoApproveLevel} onValueChange={(v: 'none' | 'low' | 'medium') => setAutoApproveLevel(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无（全部确认）</SelectItem>
                <SelectItem value="low">低风险</SelectItem>
                <SelectItem value="medium">中低风险</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 上下文管理配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            上下文管理
          </CardTitle>
          <CardDescription>
            配置智能上下文管理和 Token 优化
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>警告阈值</Label>
              <p className="text-xs text-muted-foreground">
                上下文使用量达到此比例时显示警告
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Slider
                value={[contextWarningThreshold]}
                onValueChange={([v]) => setContextWarningThreshold(v)}
                min={50}
                max={90}
                step={5}
                className="w-32"
              />
              <Badge variant="outline">{contextWarningThreshold}%</Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>临界阈值</Label>
              <p className="text-xs text-muted-foreground">
                上下文使用量达到此比例时触发压缩
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Slider
                value={[contextCriticalThreshold]}
                onValueChange={([v]) => setContextCriticalThreshold(v)}
                min={70}
                max={95}
                step={5}
                className="w-32"
              />
              <Badge variant="destructive">{contextCriticalThreshold}%</Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>自动压缩</Label>
              <p className="text-xs text-muted-foreground">
                达到临界阈值时自动压缩上下文
              </p>
            </div>
            <Switch
              checked={enableAutoCompaction}
              onCheckedChange={setEnableAutoCompaction}
            />
          </div>
        </CardContent>
      </Card>

      {/* 安全配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            安全防护
          </CardTitle>
          <CardDescription>
            配置安全防护和审计功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>启用安全防护</Label>
              <p className="text-xs text-muted-foreground">
                启用路径验证和命令安全检查
              </p>
            </div>
            <Switch
              checked={enableSecurityGuard}
              onCheckedChange={setEnableSecurityGuard}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                拦截危险命令
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
              </Label>
              <p className="text-xs text-muted-foreground">
                自动拦截 rm -rf、format 等危险命令
              </p>
            </div>
            <Switch
              checked={blockDangerousCommands}
              onCheckedChange={setBlockDangerousCommands}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>审计日志</Label>
              <p className="text-xs text-muted-foreground">
                记录所有 Agent 操作用于审计
              </p>
            </div>
            <Switch
              checked={enableAuditLog}
              onCheckedChange={setEnableAuditLog}
            />
          </div>
        </CardContent>
      </Card>

      {/* 快捷入口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            快捷入口
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            点击侧边栏的 <strong>Super Agent</strong> 进入控制中心，可以：
          </p>
          <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>查看 Agent 池状态和任务队列</li>
            <li>管理 Spec 工作流</li>
            <li>监控上下文使用量</li>
            <li>配置和管理 Powers</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

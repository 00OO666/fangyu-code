/**
 * Super Agent 控制中心
 * 整合 Agent Dashboard、Spec Workflow、Context Monitor、Powers Panel
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bot, FileText, Activity, Puzzle, Settings2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// 导入 Super Agent 组件
import { AgentDashboard } from '@/components/agents/AgentDashboard';
import { SpecWorkflowPanel } from '@/components/agents/SpecWorkflowPanel';
import { ContextMonitor } from '@/components/agents/ContextMonitor';
import { PowersPanel } from '@/components/agents/PowersPanel';

// 导入核心模块
import { AutonomyController, AutonomyMode } from '@/core/autonomy/AutonomyController';

interface SuperAgentCenterProps {
  onBack: () => void;
}

export const SuperAgentCenter: React.FC<SuperAgentCenterProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('supervised');
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  // 初始化 AutonomyController
  const [autonomyController] = useState(() => new AutonomyController({
    mode: 'supervised',
    autoApproveRiskLevels: ['low'],
  }));

  const handleModeToggle = (checked: boolean) => {
    const newMode: AutonomyMode = checked ? 'autopilot' : 'supervised';
    autonomyController.setMode(newMode);
    setAutonomyMode(newMode);
  };

  const handleStartAgent = () => {
    setIsAgentRunning(true);
    // TODO: 实际启动 Agent 逻辑
  };

  const handleStopAgent = () => {
    setIsAgentRunning(false);
    // TODO: 实际停止 Agent 逻辑
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-4 border-b border-border"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Super Agent 控制中心</h1>
          </div>
          <Badge variant={isAgentRunning ? "default" : "secondary"}>
            {isAgentRunning ? "运行中" : "已停止"}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          {/* 自治模式切换 */}
          <div className="flex items-center gap-2">
            <Label htmlFor="autonomy-mode" className="text-sm text-muted-foreground">
              {autonomyMode === 'autopilot' ? '自动驾驶' : '监督模式'}
            </Label>
            <Switch
              id="autonomy-mode"
              checked={autonomyMode === 'autopilot'}
              onCheckedChange={handleModeToggle}
            />
          </div>

          {/* 启动/停止按钮 */}
          <Button
            variant={isAgentRunning ? "destructive" : "default"}
            size="sm"
            onClick={isAgentRunning ? handleStopAgent : handleStartAgent}
            className="gap-2"
          >
            {isAgentRunning ? (
              <>
                <Pause className="h-4 w-4" />
                停止 Agent
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                启动 Agent
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="dashboard" className="gap-2">
              <Bot className="h-4 w-4" />
              Agent 仪表盘
            </TabsTrigger>
            <TabsTrigger value="spec" className="gap-2">
              <FileText className="h-4 w-4" />
              Spec 工作流
            </TabsTrigger>
            <TabsTrigger value="context" className="gap-2">
              <Activity className="h-4 w-4" />
              上下文监控
            </TabsTrigger>
            <TabsTrigger value="powers" className="gap-2">
              <Puzzle className="h-4 w-4" />
              Powers 管理
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="dashboard" className="h-full m-0">
              <AgentDashboard />
            </TabsContent>

            <TabsContent value="spec" className="h-full m-0">
              <SpecWorkflowPanel />
            </TabsContent>

            <TabsContent value="context" className="h-full m-0">
              <ContextMonitor />
            </TabsContent>

            <TabsContent value="powers" className="h-full m-0">
              <PowersPanel />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Status Bar */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>模式: {autonomyMode === 'autopilot' ? '🚀 自动驾驶' : '👁️ 监督模式'}</span>
          <span>|</span>
          <span>Agent 池: 0/10</span>
          <span>|</span>
          <span>任务队列: 0</span>
        </div>
        <div className="flex items-center gap-2">
          <Settings2 className="h-3 w-3" />
          <span>Super Agent v1.0.0</span>
        </div>
      </div>
    </div>
  );
};

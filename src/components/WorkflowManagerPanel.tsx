/**
 * Workflow Manager Panel - 工作流管理面板
 *
 * 管理和可视化规范驱动工作流的执行
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { SpecDrivenWorkflow, type WorkflowExecutionResult } from '@/core/workflow/SpecDrivenWorkflow';
import type { SpecType } from '@/core/spec/SpecGenerationEngine';
import type { RealAPIClient } from '@/core/api/RealAPIClient';
import type { CollaborationTask } from '@/core/agents/AgentCollaborationSystem';

interface WorkflowManagerPanelProps {
  workspaceRoot: string;
  apiClient: RealAPIClient;
}

export const WorkflowManagerPanel: React.FC<WorkflowManagerPanelProps> = ({
  workspaceRoot,
  apiClient,
}) => {
  const [requirements, setRequirements] = useState('');
  const [specType, setSpecType] = useState<SpecType>('feature');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<WorkflowExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async (dryRun: boolean = false) => {
    if (!requirements.trim()) return;

    setIsExecuting(true);
    setError(null);

    try {
      const workflow = new SpecDrivenWorkflow({
        workspaceRoot,
        apiClient,
        enableLSP: true,
      });

      await workflow.initialize();

      const executionResult = await workflow.executeFromRequirements(
        requirements,
        specType,
        { dryRun, parallelExecution: true, stopOnError: false }
      );

      setResult(executionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h2 className="text-xl font-semibold">工作流管理器</h2>
        <p className="text-sm text-muted-foreground mt-1">
          规范驱动的多代理协作开发
        </p>
      </div>

      <div className="flex-1 px-6 py-4 space-y-4 overflow-auto">
        <Card className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">需求描述</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="描述你的开发需求..."
              className="w-full h-24 p-3 border rounded-md resize-none"
              disabled={isExecuting}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">类型</label>
            <select
              value={specType}
              onChange={(e) => setSpecType(e.target.value as SpecType)}
              className="w-full p-2 border rounded-md"
              disabled={isExecuting}
            >
              <option value="feature">新功能</option>
              <option value="bugfix">Bug修复</option>
              <option value="refactor">重构</option>
              <option value="architecture">架构设计</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => handleExecute(false)}
              disabled={!requirements.trim() || isExecuting}
              className="flex-1"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  执行工作流
                </>
              )}
            </Button>
            <Button
              onClick={() => handleExecute(true)}
              disabled={!requirements.trim() || isExecuting}
              variant="outline"
            >
              <Pause className="h-4 w-4 mr-2" />
              预览
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-red-900">执行失败</div>
                <div className="text-sm text-red-700 mt-1">{error}</div>
              </div>
            </div>
          </Card>
        )}

        {result && (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {result.success ? '执行成功' : '执行失败'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{(result.duration / 1000).toFixed(2)}s</span>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">规范信息</div>
              <div className="text-sm space-y-1">
                <div>标题: {result.spec.metadata.title}</div>
                <div>类型: {result.spec.metadata.type}</div>
                <div>版本: {result.spec.metadata.version}</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">工作流状态</div>
              <div className="text-sm space-y-1">
                <div>ID: {result.workflowId}</div>
                <div>状态: {result.workflow.status}</div>
                <div>任务数: {result.workflow.phases.flatMap(p => p.tasks).length}</div>
              </div>
            </div>

            {result.workflow.phases.flatMap(p => p.tasks).length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">任务列表</div>
                <div className="space-y-2">
                  {result.workflow.phases.flatMap(p => p.tasks).map((task: CollaborationTask) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        {task.status === 'completed' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {task.status === 'failed' && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        {task.status === 'in_progress' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {task.status === 'pending' && (
                          <Clock className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">{task.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {task.assignedAgent}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.report && (
              <div>
                <div className="text-sm font-medium mb-2">执行报告</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                  {result.report}
                </pre>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkflowManagerPanel;

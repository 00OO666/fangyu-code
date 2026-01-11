/**
 * Developer Tools - 开发工具页面
 *
 * 提供规范驱动开发相关的工具入口
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, FileText, Workflow, Sparkles } from 'lucide-react';
import { useNavigation } from '@/contexts/NavigationContext';

interface DeveloperToolsProps {
  onBack?: () => void;
}

export const DeveloperTools: React.FC<DeveloperToolsProps> = ({ onBack }) => {
  const { navigateTo } = useNavigation();

  const tools = [
    {
      id: 'spec-generation',
      title: '规范生成引擎',
      description: '将自然语言需求转换为结构化技术规范',
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      onClick: () => navigateTo('spec-generation', { apiClient: null }),
    },
    {
      id: 'workflow-manager',
      title: '工作流管理器',
      description: '规范驱动的多代理协作开发',
      icon: Workflow,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      onClick: () => navigateTo('workflow-manager', { workspaceRoot: '', apiClient: null }),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">开发工具</h2>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          规范驱动开发工具集 - 灵感来自 OpenCode 和 Kiro
        </p>
      </div>

      <div className="flex-1 px-6 py-8 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={tool.onClick}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${tool.bgColor}`}>
                    <Icon className={`h-6 w-6 ${tool.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 max-w-4xl">
          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-3">功能说明</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">规范生成引擎：</strong>
                <p>输入自然语言需求，AI 自动生成包含架构设计、API 设计、测试策略和部署计划的完整技术规范。</p>
              </div>
              <div>
                <strong className="text-foreground">工作流管理器：</strong>
                <p>基于生成的技术规范，自动创建多代理协作工作流，由专业代理（代码生成、测试、部署等）协同完成开发任务。</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs">
                  💡 提示：这些工具需要配置 API 客户端才能使用。请先在设置中配置 Provider。
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeveloperTools;

/**
 * Spec Generation Panel - 规范生成面板
 *
 * 提供 UI 界面用于生成技术规范
 */

import { logger } from '@/lib/logger';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Download from 'lucide-react/dist/esm/icons/download'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { SpecGenerationEngine, type SpecType, type TechnicalSpec } from '@/core/spec/SpecGenerationEngine';
import { RealAPIClient } from '@/core/api/RealAPIClient';

interface SpecGenerationPanelProps {
  apiClient: RealAPIClient;
}

export const SpecGenerationPanel: React.FC<SpecGenerationPanelProps> = ({
  apiClient,
}) => {
  const [requirements, setRequirements] = useState('');
  const [specType, setSpecType] = useState<SpecType>('feature');
  const [detailLevel, setDetailLevel] = useState<'brief' | 'standard' | 'detailed'>('standard');
  const [includeArchitecture, setIncludeArchitecture] = useState(true);
  const [includeAPI, setIncludeAPI] = useState(true);
  const [includeTesting, setIncludeTesting] = useState(true);
  const [includeDeployment, setIncludeDeployment] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<TechnicalSpec | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');

  const handleGenerate = async () => {
    if (!requirements.trim()) return;

    setIsGenerating(true);
    try {
      const engine = new SpecGenerationEngine(apiClient);
      const spec = await engine.generateSpec(requirements, specType, {
        includeArchitecture,
        includeAPI,
        includeTesting,
        includeDeployment,
        detailLevel,
      });
      setGeneratedSpec(spec);
      setActiveTab('output');
    } catch (error) {
      logger.error('SpecGenerationPanel', 'Failed to generate spec:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: 'json' | 'yaml' | 'markdown') => {
    if (!generatedSpec) return;

    const engine = new SpecGenerationEngine(apiClient);
    const exported = await engine.exportSpec(generatedSpec, format);

    const blob = new Blob([exported], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spec-${generatedSpec.metadata.id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">规范生成引擎</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          将自然语言需求转换为结构化技术规范
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'input' | 'output')} className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4">
          <TabsTrigger value="input">输入需求</TabsTrigger>
          <TabsTrigger value="output" disabled={!generatedSpec}>查看规范</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="flex-1 px-6 pb-6 space-y-4">
          <Card className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">需求描述</label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="描述你的需求，例如：实现一个用户认证系统，支持邮箱登录和第三方OAuth登录..."
                className="w-full h-32 p-3 border rounded-md resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">规范类型</label>
                <select
                  value={specType}
                  onChange={(e) => setSpecType(e.target.value as SpecType)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="feature">新功能</option>
                  <option value="bugfix">Bug修复</option>
                  <option value="refactor">重构</option>
                  <option value="architecture">架构设计</option>
                  <option value="deployment">部署方案</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">详细程度</label>
                <select
                  value={detailLevel}
                  onChange={(e) => setDetailLevel(e.target.value as any)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="brief">简要</option>
                  <option value="standard">标准</option>
                  <option value="detailed">详细</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">包含内容</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeArchitecture}
                    onChange={(e) => setIncludeArchitecture(e.target.checked)}
                  />
                  <span className="text-sm">架构设计</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeAPI}
                    onChange={(e) => setIncludeAPI(e.target.checked)}
                  />
                  <span className="text-sm">API 设计</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeTesting}
                    onChange={(e) => setIncludeTesting(e.target.checked)}
                  />
                  <span className="text-sm">测试策略</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeDeployment}
                    onChange={(e) => setIncludeDeployment(e.target.checked)}
                  />
                  <span className="text-sm">部署计划</span>
                </label>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!requirements.trim() || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  生成技术规范
                </>
              )}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="output" className="flex-1 px-6 pb-6 space-y-4">
          {generatedSpec && (
            <>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleExport('json')}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 JSON
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport('yaml')}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 YAML
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport('markdown')}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 Markdown
                </Button>
              </div>

              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{generatedSpec.metadata.title}</h3>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>类型: {generatedSpec.metadata.type}</span>
                    <span>版本: {generatedSpec.metadata.version}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">需求概述</h4>
                  <p className="text-sm">{generatedSpec.requirements.summary}</p>
                </div>

                {generatedSpec.requirements.acceptanceCriteria.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">验收标准</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {generatedSpec.requirements.acceptanceCriteria.map((criteria, i) => (
                        <li key={i}>{criteria}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {generatedSpec.architecture.components.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">架构组件</h4>
                    <div className="space-y-2">
                      {generatedSpec.architecture.components.map((comp, i) => (
                        <div key={i} className="border-l-2 border-primary pl-3">
                          <div className="font-medium text-sm">{comp.name} ({comp.type})</div>
                          <div className="text-sm text-muted-foreground">{comp.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {generatedSpec.implementation.phases.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">实现阶段</h4>
                    <div className="space-y-3">
                      {generatedSpec.implementation.phases.map((phase, i) => (
                        <div key={i} className="border rounded-md p-3">
                          <div className="font-medium text-sm">阶段 {phase.phase}: {phase.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">{phase.description}</div>
                          {phase.tasks.length > 0 && (
                            <ul className="mt-2 space-y-1 text-sm">
                              {phase.tasks.map((task, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  <span>{task.title}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SpecGenerationPanel;

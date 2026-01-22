import { logger } from '@/lib/logger';
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Brain from 'lucide-react/dist/esm/icons/brain'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Code2 from 'lucide-react/dist/esm/icons/code-2'
import Image from 'lucide-react/dist/esm/icons/image'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Check from 'lucide-react/dist/esm/icons/check'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import { cn } from "@/lib/utils";
import {
  SILICONFLOW_MODELS,
  SiliconFlowModel,
  loadSiliconFlowConfig,
  saveSiliconFlowConfig,
  getModelsByCategory,
} from "@/config/siliconflowConfig";
import { LLMApiService, LLMProvider } from "@/lib/services/llmApiService";
import { toast } from "sonner";

interface SiliconFlowModelSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelSelected?: (modelId: string) => void;
}

const categoryConfig = {
  reasoning: { label: '推理模型', icon: Brain, color: 'text-purple-600' },
  chat: { label: '对话模型', icon: MessageSquare, color: 'text-blue-600' },
  code: { label: '代码模型', icon: Code2, color: 'text-green-600' },
  multimodal: { label: '多模态', icon: Image, color: 'text-orange-600' },
  free: { label: '免费模型', icon: Sparkles, color: 'text-pink-600' },
};

export const SiliconFlowModelSelector: React.FC<SiliconFlowModelSelectorProps> = ({
  open,
  onOpenChange,
  onModelSelected,
}) => {
  const [config, setConfig] = useState(loadSiliconFlowConfig());
  const [selectedModel, setSelectedModel] = useState(config.selectedModel);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chat');

  const modelsByCategory = getModelsByCategory();

  useEffect(() => {
    if (open) {
      const loaded = loadSiliconFlowConfig();
      setConfig(loaded);
      setApiKey(loaded.apiKey);
      setSelectedModel(loaded.selectedModel);
    }
  }, [open]);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    const model = SILICONFLOW_MODELS.find(m => m.id === modelId);
    if (model) {
      setActiveTab(model.category);
    }
  };

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('请先输入 API Key');
      return;
    }

    const newConfig = {
      ...config,
      apiKey: apiKey.trim(),
      selectedModel,
    };

    saveSiliconFlowConfig(newConfig);
    toast.success(`已选择模型: ${SILICONFLOW_MODELS.find(m => m.id === selectedModel)?.name}`);
    onModelSelected?.(selectedModel);
    onOpenChange(false);
  };

  const handleTestModel = async (modelId: string) => {
    if (!apiKey.trim()) {
      toast.error('请先输入 API Key');
      return;
    }

    setTestingModel(modelId);

    try {
      const provider: LLMProvider = {
        id: 'siliconflow',
        name: 'SiliconFlow',
        apiUrl: config.baseUrl,
        apiKey: apiKey.trim(),
        model: modelId,
        temperature: 0.7,
        maxTokens: 100,
        apiFormat: 'openai', // SiliconFlow 兼容 OpenAI 格式
      };

      const response = await LLMApiService.callSimple(
        provider,
        '你是一个AI助手',
        '请回复"测试成功"三个字'
      );

      toast.success(`模型测试成功: ${response.slice(0, 50)}...`);
    } catch (error: any) {
      logger.error('SiliconFlowModelSelector', 'Model test failed:', error);
      toast.error(`测试失败: ${error.message}`);
    } finally {
      setTestingModel(null);
    }
  };

  const renderModelCard = (model: SiliconFlowModel) => {
    const isSelected = selectedModel === model.id;
    const isTesting = testingModel === model.id;
    const categoryInfo = categoryConfig[model.category];

    return (
      <div
        key={model.id}
        className={cn(
          "relative p-4 rounded-lg border transition-all cursor-pointer group",
          isSelected
            ? "border-primary bg-accent/50"
            : "border-border/50 hover:border-primary/50 hover:bg-accent/30"
        )}
        onClick={() => handleSelectModel(model.id)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <categoryInfo.icon className={cn("h-4 w-4", categoryInfo.color)} />
              <span className="font-medium text-sm">{model.name}</span>
              {model.isFree && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-green-500/50 text-green-600">
                  Free
                </Badge>
              )}
              {isSelected && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{model.description}</p>
            {model.contextWindow && (
              <div className="text-xs text-muted-foreground">
                上下文: {(model.contextWindow / 1000).toFixed(0)}K tokens
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleTestModel(model.id);
            }}
            disabled={isTesting || !apiKey.trim()}
          >
            {isTesting ? '测试中...' : '测试'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            SiliconFlow 模型选择
          </DialogTitle>
          <VisuallyHidden.Root>
            <DialogDescription>选择 SiliconFlow 平台的 AI 模型</DialogDescription>
          </VisuallyHidden.Root>
        </DialogHeader>

        <div className="space-y-4">
          {/* API Key 输入 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey">API Key</Label>
              <a
                href="https://siliconflow.cn/account/ak"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                获取 API Key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              9B 及以下模型永久免费 | 支持 DeepSeek、Qwen、Llama 等 20+ 模型
            </p>
          </div>

          {/* 模型选择 Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
            <TabsList className="grid grid-cols-5 w-full">
              {Object.entries(categoryConfig).map(([key, config]) => {
                const Icon = config.icon;
                const count = modelsByCategory[key]?.length || 0;
                return (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    <Icon className={cn("h-3.5 w-3.5 mr-1.5", config.color)} />
                    {config.label}
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <ScrollArea className="h-[400px] pr-4">
              {Object.entries(categoryConfig).map(([key]) => (
                <TabsContent key={key} value={key} className="space-y-2 mt-0">
                  {modelsByCategory[key]?.map(renderModelCard)}
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>

          {/* 底部按钮 */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              当前选择: <span className="font-medium text-foreground">
                {SILICONFLOW_MODELS.find(m => m.id === selectedModel)?.name || '未选择'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={!apiKey.trim()}>
                确认选择
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

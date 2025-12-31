import React, { useState, useEffect } from "react";
import { Settings, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  loadContextConfig,
  saveContextConfig,
  resetContextConfig,
  applyPreset,
  CONTEXT_PRESETS,
  type PromptContextConfig,
} from "@/lib/promptContextConfig";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";

interface PromptContextConfigSettingsProps {
  className?: string;
}

export const PromptContextConfigSettings: React.FC<PromptContextConfigSettingsProps> = ({
  className
}) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<PromptContextConfig>(loadContextConfig());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loaded = loadContextConfig();
    setConfig(loaded);
  }, []);

  const handleChange = (updates: Partial<PromptContextConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveContextConfig(config);
    setHasChanges(false);
  };

  const handleReset = () => {
    resetContextConfig();
    setConfig(loadContextConfig());
    setHasChanges(false);
  };

  const handleApplyPreset = (presetKey: keyof typeof CONTEXT_PRESETS) => {
    applyPreset(presetKey);
    setConfig(loadContextConfig());
    setHasChanges(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('promptContext.title')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('promptContext.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              {t('promptContext.unsaved')}
            </Badge>
          )}
          <Button onClick={handleReset} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('promptContext.reset')}
          </Button>
          <Button onClick={handleSave} size="sm" disabled={!hasChanges}>
            {t('promptContext.saveConfig')}
          </Button>
        </div>
      </div>

      {/* 预设模板 */}
      <Card className="p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-3">{t('promptContext.quickPresets')}</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CONTEXT_PRESETS).map(([key, preset]) => (
            <TooltipProvider key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPreset(key as keyof typeof CONTEXT_PRESETS)}
                  >
                    {t(preset.nameKey)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t(preset.descriptionKey)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </Card>

      {/* 配置项 */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* 最大消息数量 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{t('promptContext.maxMessages')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('promptContext.maxMessagesDesc')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Badge variant="secondary">{config.maxMessages} {t('promptContext.messages')}</Badge>
            </div>
            <Slider
              value={[config.maxMessages]}
              onValueChange={(values: number[]) => handleChange({ maxMessages: values[0] })}
              min={3}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('promptContext.minMessages')}</span>
              <span>{t('promptContext.maxMessagesLimit')}</span>
            </div>
          </div>

          {/* 助手消息长度 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{t('promptContext.maxAssistantLength')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('promptContext.maxAssistantLengthDesc')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Badge variant="secondary">{config.maxAssistantMessageLength} {t('promptContext.characters')}</Badge>
            </div>
            <Slider
              value={[config.maxAssistantMessageLength]}
              onValueChange={(values: number[]) => handleChange({ maxAssistantMessageLength: values[0] })}
              min={200}
              max={10000}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('promptContext.minAssistantLength')}</span>
              <span>{t('promptContext.maxAssistantLengthLimit')}</span>
            </div>
          </div>

          {/* 用户消息长度 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{t('promptContext.maxUserLength')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('promptContext.maxUserLengthDesc')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Badge variant="secondary">{config.maxUserMessageLength} {t('promptContext.characters')}</Badge>
            </div>
            <Slider
              value={[config.maxUserMessageLength]}
              onValueChange={(values: number[]) => handleChange({ maxUserMessageLength: values[0] })}
              min={200}
              max={5000}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('promptContext.minUserLength')}</span>
              <span>{t('promptContext.maxUserLengthLimit')}</span>
            </div>
          </div>

          {/* 包含执行结果 */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Label>{t('promptContext.includeResults')}</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('promptContext.includeResultsDesc')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              checked={config.includeExecutionResults}
              onCheckedChange={(checked) => handleChange({ includeExecutionResults: checked })}
            />
          </div>

          {/* 执行结果长度（仅在启用时显示） */}
          {config.includeExecutionResults && (
            <div className="space-y-3 pl-6 border-l-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">{t('promptContext.maxResultLength')}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('promptContext.maxResultLengthDesc')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Badge variant="secondary">{config.maxExecutionResultLength} {t('promptContext.characters')}</Badge>
              </div>
              <Slider
                value={[config.maxExecutionResultLength]}
                onValueChange={(values: number[]) => handleChange({ maxExecutionResultLength: values[0] })}
                min={100}
                max={2000}
                step={50}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('promptContext.minResultLength')}</span>
                <span>{t('promptContext.maxResultLengthLimit')}</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 配置说明 */}
      <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {t('promptContext.recommendations')}
            </p>
            <ul className="space-y-1 text-blue-800 dark:text-blue-200 list-disc list-inside">
              <li>{t('promptContext.simpleTask')}</li>
              <li>{t('promptContext.normalTask')}</li>
              <li>{t('promptContext.complexTask')}</li>
              <li>{t('promptContext.contextNote')}</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};


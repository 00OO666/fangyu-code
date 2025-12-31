import React from "react";
import { ChevronUp, Check, Star, Sparkles, Brain, FlaskConical, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Gemini model configuration
 */
export interface GeminiModelConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isDefault?: boolean;
}

/**
 * Gemini models (Gemini 3 series only)
 * Updated: December 2025
 */
export const GEMINI_MODELS: GeminiModelConfig[] = [
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    description: '最新最快模型（2025年12月17日）',
    icon: <Gauge className="h-4 w-4 text-yellow-500" />,
    isDefault: true,
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    description: '最强推理和编码能力',
    icon: <Sparkles className="h-4 w-4 text-blue-500" />,
    isDefault: false,
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    description: '实验性预览版本',
    icon: <FlaskConical className="h-4 w-4 text-purple-500" />,
    isDefault: false,
  },
  {
    id: 'gemini-3-flash-thinking',
    name: 'Gemini 3 Flash Thinking',
    description: '带思考链的快速模型',
    icon: <Brain className="h-4 w-4 text-green-500" />,
    isDefault: false,
  },
];

interface GeminiModelSelectorProps {
  selectedModel: string | undefined;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

/**
 * GeminiModelSelector component - Dropdown for selecting Gemini model
 * Styled similarly to Claude's ModelSelector
 */
export const GeminiModelSelector: React.FC<GeminiModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);

  // Find selected model or default
  const selectedModelData = GEMINI_MODELS.find(m => m.id === selectedModel)
    || GEMINI_MODELS.find(m => m.isDefault)
    || GEMINI_MODELS[0];

  return (
    <Popover
      trigger={
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-2 min-w-[160px] justify-start border-border/50 bg-background/50 hover:bg-accent/50"
        >
          {selectedModelData.icon}
          <span className="flex-1 text-left">{selectedModelData.name}</span>
          {selectedModelData.isDefault && (
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          )}
          <ChevronUp className="h-4 w-4 opacity-50" />
        </Button>
      }
      content={
        <div className="w-[320px] p-1">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/50 mb-1">
            选择 Gemini 模型
          </div>
          {GEMINI_MODELS.map((model) => {
            const isSelected = selectedModel === model.id ||
              (!selectedModel && model.isDefault);
            return (
              <button
                key={model.id}
                onClick={() => {
                  onModelChange(model.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left group",
                  "hover:bg-accent",
                  isSelected && "bg-accent"
                )}
              >
                <div className="mt-0.5">{model.icon}</div>
                <div className="flex-1 space-y-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {model.name}
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                    {model.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        推荐
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {model.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      }
      open={open}
      onOpenChange={setOpen}
      align="start"
      side="top"
    />
  );
};

import React from "react";
import { ChevronUp, Check, Star, Brain, Cpu, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Codex model configuration
 */
export interface CodexModelConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isDefault?: boolean;
}

/**
 * Codex models (GPT-5.1 series, GPT-5.1-Codex series, GPT-5.2 series)
 * Updated: December 2025
 */
export const CODEX_MODELS: CodexModelConfig[] = [
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    description: '最新代码模型（2025年12月18日发布）',
    icon: <Rocket className="h-4 w-4 text-emerald-500" />,
    isDefault: true,
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: '最新旗舰模型（2025年12月）',
    icon: <Star className="h-4 w-4 text-yellow-500" />,
    isDefault: false,
  },
  {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    description: '代码编写优化，速度与质量平衡',
    icon: <Rocket className="h-4 w-4 text-green-500" />,
    isDefault: false,
  },
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    description: '专注代码生成的基础版本',
    icon: <Cpu className="h-4 w-4 text-blue-500" />,
    isDefault: false,
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: '通用大语言模型',
    icon: <Brain className="h-4 w-4 text-orange-500" />,
    isDefault: false,
  },
];

interface CodexModelSelectorProps {
  selectedModel: string | undefined;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

/**
 * CodexModelSelector component - Dropdown for selecting Codex model
 * Styled similarly to Claude's ModelSelector
 */
export const CodexModelSelector: React.FC<CodexModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);

  // Find selected model or default
  const selectedModelData = CODEX_MODELS.find(m => m.id === selectedModel)
    || CODEX_MODELS.find(m => m.isDefault)
    || CODEX_MODELS[0];

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
            选择 Codex 模型
          </div>
          {CODEX_MODELS.map((model) => {
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

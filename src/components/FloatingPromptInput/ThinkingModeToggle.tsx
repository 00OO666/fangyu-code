import React from "react";
import { Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThinkingModeToggleProps {
  isEnabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * ThinkingModeToggle component - Simple on/off toggle for extended thinking
 * Conforms to official Claude Code standard (Tab key to toggle)
 */
export const ThinkingModeToggle: React.FC<ThinkingModeToggleProps> = ({
  isEnabled,
  onToggle,
  disabled = false
}) => {
  const { t } = useTranslation();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isEnabled ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            onClick={onToggle}
            className={cn(
              "h-8 gap-2 transition-all duration-200",
              isEnabled
                ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm shadow-amber-500/20"
                : "bg-background/50 hover:bg-accent/50 text-muted-foreground border-border/50"
            )}
          >
            <Brain className={cn(
              "h-4 w-4 transition-all duration-200",
              isEnabled ? "animate-pulse text-white" : "text-muted-foreground"
            )} />
            <span className="text-sm font-medium">
              {isEnabled ? t('promptInput.thinkingOn') : t('promptInput.thinkingOff')}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">
              {isEnabled ? t('promptInput.thinkingEnabled') : t('promptInput.thinkingDisabled')}
            </p>
            <p className="text-xs text-muted-foreground">
              {isEnabled ? t('promptInput.deepThinkingTokens') : t('promptInput.normalSpeed')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('common.back')}: <kbd className="px-1 py-0.5 bg-muted rounded">Tab</kbd>
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

import React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PlanModeToggleProps {
  isPlanMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * PlanModeToggle component - Toggle button for Plan Mode
 */
export const PlanModeToggle: React.FC<PlanModeToggleProps> = ({
  isPlanMode,
  onToggle,
  disabled = false
}) => {
  const { t } = useTranslation();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isPlanMode ? "default" : "outline"}
            size="sm"
            onClick={onToggle}
            disabled={disabled}
            className={cn(
              "h-8 gap-2 relative border-border/50",
              isPlanMode
                ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white border-blue-600 dark:border-blue-500"
                : "bg-background/50 hover:bg-accent/50"
            )}
          >
            {/* Active indicator */}
            {isPlanMode && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-green-500 dark:bg-green-400 rounded-full border-2 border-background animate-pulse" />
            )}
            <Search className="h-4 w-4" />
            <span className="text-sm font-medium">Plan</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {isPlanMode ? t('promptInput.planModeActive') : t('promptInput.planMode')}
          </p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {isPlanMode 
              ? t('promptInput.planModeDesc')
              : t('promptInput.enablePlanMode')
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

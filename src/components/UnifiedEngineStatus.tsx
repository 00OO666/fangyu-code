import React from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { ClaudeIcon } from "@/components/icons/ClaudeIcon";
import { CodexIcon } from "@/components/icons/CodexIcon";
import { GeminiIcon } from "@/components/icons/GeminiIcon";
import { cn } from "@/lib/utils";
import { useEngineStatus } from "@/hooks/useEngineStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UnifiedEngineStatusProps {
  className?: string;
  compact?: boolean;
}

interface EngineStatusDisplay {
  type: 'claude' | 'codex' | 'gemini';
  isInstalled: boolean;
  statusText: string;
  version?: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

export const UnifiedEngineStatus: React.FC<UnifiedEngineStatusProps> = ({
  className,
  compact = false,
}) => {
  const {
    loading,
    claudeInstalled,
    claudeVersion,
    codexAvailable,
    codexVersion,
    geminiInstalled,
    geminiVersion,
  } = useEngineStatus();

  const statuses: EngineStatusDisplay[] = [
    {
      type: 'claude',
      isInstalled: claudeInstalled,
      statusText: claudeInstalled ? '已安装' : '未检测到',
      version: claudeVersion,
      label: 'Claude Code',
      icon: ClaudeIcon,
      color: 'text-orange-500'
    },
    {
      type: 'codex',
      isInstalled: codexAvailable,
      statusText: codexAvailable ? '已配置' : '未配置',
      version: codexVersion,
      label: 'OpenAI Codex',
      icon: CodexIcon,
      color: 'text-blue-500'
    },
    {
      type: 'gemini',
      isInstalled: geminiInstalled,
      statusText: geminiInstalled ? '已安装' : '未安装',
      version: geminiVersion,
      label: 'Google Gemini',
      icon: GeminiIcon,
      color: 'text-purple-500'
    },
  ];

  if (loading) {
    return (
      <div className={cn("flex justify-center py-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      {compact ? (
        // Compact view (collapsed sidebar)
        <div className="flex flex-col items-center gap-2">
          {statuses.map((engine) => (
            <TooltipProvider key={engine.type}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative group cursor-default">
                    <engine.icon className={cn("h-5 w-5 transition-opacity", engine.isInstalled ? engine.color : "text-muted-foreground/40")} />
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
                      engine.isInstalled ? "bg-green-500" : "bg-red-500"
                    )} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="p-2">
                  <div className="text-xs font-medium flex items-center gap-2">
                    <engine.icon className={cn("h-3.5 w-3.5", engine.color)} />
                    <span>{engine.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {engine.statusText} {engine.version && `(${engine.version})`}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      ) : (
        // Expanded view
        <div className="space-y-2 px-2">
          <div className="text-xs font-medium text-muted-foreground mb-1 ml-1">
            引擎状态
          </div>
          
          <div className="grid gap-1.5">
            {statuses.map((engine) => (
              <div 
                key={engine.type} 
                className="flex items-center justify-between bg-muted/30 hover:bg-muted/50 rounded px-2 py-1.5 transition-colors border border-transparent hover:border-border/50"
              >
                <div className="flex items-center gap-2">
                  <engine.icon className={cn("h-3.5 w-3.5", engine.isInstalled ? engine.color : "text-muted-foreground")} />
                  <span className={cn("text-xs", !engine.isInstalled && "text-muted-foreground")}>{engine.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {engine.isInstalled ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

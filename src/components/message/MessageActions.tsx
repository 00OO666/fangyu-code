import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, RefreshCw, Edit2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { clipboardService } from "@/lib/clipboard";

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  onEdit?: () => void;
  className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  content,
  onRegenerate,
  onEdit,
  className,
}) => {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");

  const handleCopy = async () => {
    try {
      await clipboardService.writeText(content);
      setCopyState("success");
    } catch (error) {
      console.error("[MessageActions] Copy failed:", error);
      setCopyState("error");
    } finally {
      setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  const copyTooltip =
    copyState === "success"
      ? t("messages.copied")
      : copyState === "error"
        ? t("session.copyFailed")
        : t("session.copyToClipboard");

  return (
    <TooltipProvider>
      <div className={cn(
        "flex items-center gap-1 bg-background/80 backdrop-blur-sm border border-border/50 rounded-md shadow-sm p-1 transition-all",
        className
      )}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleCopy}
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {copyState === "success" ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : copyState === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copyTooltip}</TooltipContent>
        </Tooltip>

        {onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onRegenerate}
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('message.regenerate')}</TooltipContent>
          </Tooltip>
        )}

        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onEdit}
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('message.editMessage')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

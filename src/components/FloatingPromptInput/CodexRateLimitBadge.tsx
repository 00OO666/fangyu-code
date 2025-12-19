import React from "react";
import { Clock, AlertTriangle, Calendar, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CodexRateLimits, CodexRateLimit } from "@/types/codex";

interface CodexRateLimitBadgeProps {
  rateLimits: CodexRateLimits | null;
  className?: string;
}

/**
 * Formats seconds into a human-readable duration string
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "已重置";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}天 ${remainingHours}时` : `${days}天`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}时 ${minutes}分` : `${hours}时`;
  }

  return `${minutes}分`;
}

/**
 * Gets variant based on usage percentage
 */
function getVariant(percent: number): "success" | "warning" | "destructive" {
  if (percent >= 90) return "destructive";
  if (percent >= 70) return "warning";
  return "success";
}

/**
 * Simple progress bar with custom color
 */
const ColoredProgressBar: React.FC<{
  value: number;
  variant: "success" | "warning" | "destructive";
}> = ({ value, variant }) => {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn(
          "h-full transition-all duration-300",
          variant === "destructive" && "bg-red-500",
          variant === "warning" && "bg-amber-500",
          variant === "success" && "bg-emerald-500"
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

/**
 * Rate limit progress bar component
 */
const RateLimitProgress: React.FC<{
  label: string;
  limit: CodexRateLimit;
  icon: React.ReactNode;
}> = ({ label, limit, icon }) => {
  const variant = getVariant(limit.usedPercent);
  const resetTime = limit.resetsInSeconds !== undefined
    ? formatDuration(limit.resetsInSeconds)
    : limit.resetsAt !== undefined
      ? formatDuration((limit.resetsAt - Date.now() / 1000))
      : "未知";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={cn(
          "font-mono font-medium",
          variant === "destructive" && "text-red-500",
          variant === "warning" && "text-amber-500",
          variant === "success" && "text-emerald-500"
        )}>
          {limit.usedPercent.toFixed(1)}%
        </span>
      </div>
      <ColoredProgressBar value={limit.usedPercent} variant={variant} />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>已用 {limit.usedPercent.toFixed(1)}%</span>
        <span>重置于: {resetTime}</span>
      </div>
    </div>
  );
};

/**
 * CodexRateLimitBadge - Displays Codex usage limits (5h and weekly)
 *
 * Shows a compact badge with the primary (5h) limit usage percentage.
 * Clicking/hovering shows detailed information in a popover.
 */
export const CodexRateLimitBadge: React.FC<CodexRateLimitBadgeProps> = ({
  rateLimits,
  className
}) => {
  const [open, setOpen] = React.useState(false);

  // Don't render if no rate limits data
  if (!rateLimits || (!rateLimits.primary && !rateLimits.secondary)) {
    return null;
  }

  // Use primary (5h) limit for badge display, fallback to secondary
  const primaryLimit = rateLimits.primary;
  const secondaryLimit = rateLimits.secondary;

  const displayLimit = primaryLimit || secondaryLimit;
  if (!displayLimit) return null;

  const variant = getVariant(displayLimit.usedPercent);
  const badgeVariant = variant === "destructive" ? "destructive"
    : variant === "warning" ? "warning"
    : "outline";

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Badge
          variant={badgeVariant}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 h-8 cursor-pointer hover:opacity-80 transition-opacity",
            className
          )}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {variant === "destructive" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          <span className="font-mono text-xs">
            {displayLimit.usedPercent.toFixed(0)}%
          </span>
          <Info className="h-3 w-3 opacity-50" />
        </Badge>
      }
      content={
        <div className="space-y-4 p-1">
          <div className="font-medium text-sm border-b pb-2">
            Codex 用量限制
          </div>

          {primaryLimit && (
            <RateLimitProgress
              label="5小时限制"
              limit={primaryLimit}
              icon={<Clock className="h-3.5 w-3.5" />}
            />
          )}

          {secondaryLimit && (
            <RateLimitProgress
              label="每周限制"
              limit={secondaryLimit}
              icon={<Calendar className="h-3.5 w-3.5" />}
            />
          )}

          {rateLimits.updatedAt && (
            <div className="text-[10px] text-muted-foreground pt-2 border-t">
              更新于: {new Date(rateLimits.updatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      }
      side="top"
      align="center"
      className="w-72"
    />
  );
};

export default CodexRateLimitBadge;

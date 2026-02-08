import React from "react";
import { Sparkles, Zap } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ThemeToggleProps {
  /**
   * 显示模式：icon-only（仅图标）或 with-text（带文字）
   */
  variant?: "icon-only" | "with-text";
  /**
   * 按钮尺寸
   */
  size?: "sm" | "default" | "lg";
  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 主题切换组件 - Deep Glass Sci-Fi 风格
 * 参考游戏大厅侧边栏设计
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = "icon-only",
  size = "sm",
  className = "",
}) => {
  const { themeName, toggleTheme, isLoading } = useTheme();

  if (isLoading) {
    return null;
  }

  const isSciFi = themeName === "deep-glass-scifi";

  const button = (
    <button
      onClick={toggleTheme}
      className={cn(
        "flex items-center gap-2 text-slate-400 hover:text-white transition-all duration-200 cursor-pointer",
        size === "sm" && "text-sm",
        size === "default" && "text-base",
        size === "lg" && "text-lg",
        isSciFi && "text-amber-500 hover:text-amber-400",
        className
      )}
    >
      {isSciFi ? (
        <>
          <Sparkles
            className={cn(
              "flex-shrink-0",
              size === "sm" && "w-4 h-4",
              size === "default" && "w-5 h-5",
              size === "lg" && "w-6 h-6"
            )}
            strokeWidth={2}
          />
          {variant === "with-text" && (
            <span className="font-display text-xs tracking-wider uppercase">Pro</span>
          )}
        </>
      ) : (
        <>
          <Zap
            className={cn(
              "flex-shrink-0",
              size === "sm" && "w-4 h-4",
              size === "default" && "w-5 h-5",
              size === "lg" && "w-6 h-6"
            )}
            strokeWidth={2}
          />
          {variant === "with-text" && (
            <span className="font-display text-xs tracking-wider uppercase">Sci-Fi</span>
          )}
        </>
      )}
    </button>
  );

  // 仅图标模式时显示 tooltip
  if (variant === "icon-only") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{isSciFi ? "切换到 Pro 主题" : "切换到 Sci-Fi 主题"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

/**
 * ProgressIndicator - 进度指示器组件
 *
 * 支持不确定进度（加载中）和确定进度（百分比）
 * 提供多种样式变体和尺寸选项
 *
 * _Requirements: 6.2_
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// =============================================================================
// 类型定义
// =============================================================================

export type ProgressVariant = "default" | "success" | "warning" | "error" | "info";
export type ProgressSize = "sm" | "md" | "lg";
export type ProgressType = "linear" | "circular" | "dots";

export interface ProgressIndicatorProps {
  /** 进度类型 */
  type?: ProgressType;
  /** 进度值 (0-100)，undefined 表示不确定进度 */
  value?: number;
  /** 样式变体 */
  variant?: ProgressVariant;
  /** 尺寸 */
  size?: ProgressSize;
  /** 是否显示百分比文本 */
  showPercentage?: boolean;
  /** 自定义标签 */
  label?: string;
  /** 是否显示动画 */
  animated?: boolean;
  /** 容器类名 */
  className?: string;
}

// =============================================================================
// 样式配置
// =============================================================================

const variantColors: Record<ProgressVariant, { bg: string; fill: string; text: string }> = {
  default: {
    bg: "bg-gray-200 dark:bg-gray-700",
    fill: "bg-blue-500 dark:bg-blue-400",
    text: "text-blue-500 dark:text-blue-400",
  },
  success: {
    bg: "bg-green-100 dark:bg-green-900/30",
    fill: "bg-green-500 dark:bg-green-400",
    text: "text-green-500 dark:text-green-400",
  },
  warning: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    fill: "bg-yellow-500 dark:bg-yellow-400",
    text: "text-yellow-500 dark:text-yellow-400",
  },
  error: {
    bg: "bg-red-100 dark:bg-red-900/30",
    fill: "bg-red-500 dark:bg-red-400",
    text: "text-red-500 dark:text-red-400",
  },
  info: {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    fill: "bg-cyan-500 dark:bg-cyan-400",
    text: "text-cyan-500 dark:text-cyan-400",
  },
};

const sizeConfig: Record<
  ProgressSize,
  { height: string; circular: number; dotSize: string; fontSize: string }
> = {
  sm: { height: "h-1", circular: 24, dotSize: "w-1.5 h-1.5", fontSize: "text-xs" },
  md: { height: "h-2", circular: 32, dotSize: "w-2 h-2", fontSize: "text-sm" },
  lg: { height: "h-3", circular: 48, dotSize: "w-3 h-3", fontSize: "text-base" },
};

// =============================================================================
// 子组件
// =============================================================================

/** 线性进度条 */
const LinearProgress: React.FC<{
  value?: number;
  variant: ProgressVariant;
  size: ProgressSize;
  animated: boolean;
}> = ({ value, variant, size, animated }) => {
  const colors = variantColors[variant];
  const sizeStyle = sizeConfig[size];
  const isIndeterminate = value === undefined;

  return (
    <div className={cn("w-full rounded-full overflow-hidden", colors.bg, sizeStyle.height)}>
      {isIndeterminate ? (
        <motion.div
          className={cn("h-full rounded-full", colors.fill)}
          initial={{ x: "-100%", width: "40%" }}
          animate={{ x: "250%" }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ) : (
        <motion.div
          className={cn("h-full rounded-full", colors.fill)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={animated ? { duration: 0.3, ease: "easeOut" } : { duration: 0 }}
        />
      )}
    </div>
  );
};

/** 圆形进度指示器 */
const CircularProgress: React.FC<{
  value?: number;
  variant: ProgressVariant;
  size: ProgressSize;
  showPercentage: boolean;
}> = ({ value, variant, size, showPercentage }) => {
  const colors = variantColors[variant];
  const circularSize = sizeConfig[size].circular;
  const strokeWidth = size === "sm" ? 2 : size === "md" ? 3 : 4;
  const radius = (circularSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const isIndeterminate = value === undefined;

  const strokeDashoffset = isIndeterminate
    ? circumference * 0.75
    : circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={circularSize}
        height={circularSize}
        className={isIndeterminate ? "animate-spin" : ""}
        style={{ animationDuration: "1.5s" }}
      >
        {/* 背景圆 */}
        <circle
          cx={circularSize / 2}
          cy={circularSize / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn(
            "stroke-current",
            colors.bg.replace("bg-", "text-").replace("dark:bg-", "dark:text-")
          )}
          style={{ opacity: 0.3 }}
        />
        {/* 进度圆 */}
        <motion.circle
          cx={circularSize / 2}
          cy={circularSize / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn("stroke-current", colors.text)}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
          }}
          initial={false}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </svg>
      {showPercentage && !isIndeterminate && (
        <span className={cn("absolute", sizeConfig[size].fontSize, colors.text)}>
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
};

/** 点状加载指示器 */
const DotsProgress: React.FC<{
  variant: ProgressVariant;
  size: ProgressSize;
}> = ({ variant, size }) => {
  const colors = variantColors[variant];
  const dotSize = sizeConfig[size].dotSize;

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={cn("rounded-full", dotSize, colors.fill)}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

// =============================================================================
// 主组件
// =============================================================================

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  type = "linear",
  value,
  variant = "default",
  size = "md",
  showPercentage = false,
  label,
  animated = true,
  className,
}) => {
  const colors = variantColors[variant];
  const fontSize = sizeConfig[size].fontSize;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* 标签和百分比 */}
      {(label || (showPercentage && type === "linear" && value !== undefined)) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className={cn(fontSize, "text-gray-600 dark:text-gray-400")}>{label}</span>
          )}
          {showPercentage && type === "linear" && value !== undefined && (
            <span className={cn(fontSize, colors.text)}>{Math.round(value)}%</span>
          )}
        </div>
      )}

      {/* 进度指示器 */}
      {type === "linear" && (
        <LinearProgress value={value} variant={variant} size={size} animated={animated} />
      )}
      {type === "circular" && (
        <CircularProgress
          value={value}
          variant={variant}
          size={size}
          showPercentage={showPercentage}
        />
      )}
      {type === "dots" && <DotsProgress variant={variant} size={size} />}
    </div>
  );
};

export default ProgressIndicator;

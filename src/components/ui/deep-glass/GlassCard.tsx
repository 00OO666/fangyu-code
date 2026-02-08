import React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Glass intensity: 'deep' | 'medium' | 'light'
   * @default 'deep'
   */
  intensity?: "deep" | "medium" | "light";
  /**
   * Enable glow border effect
   * @default false
   */
  glow?: boolean;
  /**
   * Glow color: 'orange' | 'white' | 'blue'
   * @default 'white'
   */
  glowColor?: "orange" | "white" | "blue";
  /**
   * Enable hover lift effect
   * @default false
   */
  hover?: boolean;
}

/**
 * Deep Glass Card Component
 *
 * A glassmorphism card with customizable blur intensity and glow effects.
 * Inspired by Deep Glass Pro AI Station V1 design.
 *
 * @example
 * ```tsx
 * <GlassCard intensity="deep" glow glowColor="orange">
 *   <h2>Title</h2>
 *   <p>Content</p>
 * </GlassCard>
 * ```
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      intensity = "deep",
      glow = false,
      glowColor = "white",
      hover = false,
      ...props
    },
    ref
  ) => {
    const glassClass = {
      deep: "deep-glass",
      medium: "medium-glass",
      light: "light-glass",
    }[intensity];

    const glowClass = glow
      ? {
          orange: "glow-border-orange",
          white: "glow-border-white",
          blue: "glow-border-blue",
        }[glowColor]
      : "";

    return (
      <div
        ref={ref}
        className={cn(
          glassClass,
          glowClass,
          "rounded-xl",
          hover && "transition-transform duration-300 hover:-translate-y-1",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

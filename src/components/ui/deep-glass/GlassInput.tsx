import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Enable glow effect on focus
   * @default true
   */
  glow?: boolean;
  /**
   * Input size: 'sm' | 'md' | 'lg'
   * @default 'md'
   */
  inputSize?: 'sm' | 'md' | 'lg';
}

/**
 * Deep Glass Input Component
 *
 * A glassmorphism input field with orange glow on focus.
 * Inspired by Deep Glass Pro AI Station V1 design.
 *
 * @example
 * ```tsx
 * <GlassInput
 *   placeholder="Enter text..."
 *   glow
 *   inputSize="md"
 * />
 * ```
 */
export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      className,
      glow = true,
      inputSize = 'md',
      ...props
    },
    ref
  ) => {
    const sizeClass = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-5 py-3 text-lg',
    }[inputSize];

    return (
      <input
        ref={ref}
        className={cn(
          'input-glass',
          sizeClass,
          'rounded-lg w-full',
          'transition-all duration-300',
          'placeholder:text-white/40',
          glow && 'focus:border-[var(--accent-orange)] focus:shadow-[var(--glow-orange)]',
          className
        )}
        {...props}
      />
    );
  }
);

GlassInput.displayName = 'GlassInput';

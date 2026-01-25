import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /**
   * Button variant: 'orange' | 'glass' | 'ghost'
   * @default 'glass'
   */
  variant?: 'orange' | 'glass' | 'ghost';
  /**
   * Button size: 'sm' | 'md' | 'lg'
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Enable loading state
   * @default false
   */
  loading?: boolean;
}

/**
 * Deep Glass Button Component
 *
 * A glassmorphism button with orange-gold gradient variant.
 * Inspired by Deep Glass Pro AI Station V1 design.
 *
 * @example
 * ```tsx
 * <GlassButton variant="orange" size="md">
 *   Submit
 * </GlassButton>
 * ```
 */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      children,
      className,
      variant = 'glass',
      size = 'md',
      loading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantClass = {
      orange: 'btn-glass-orange',
      glass: 'btn-glass',
      ghost: 'bg-transparent hover:bg-white/5',
    }[variant];

    const sizeClass = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }[size];

    return (
      <button
        ref={ref}
        className={cn(
          variantClass,
          sizeClass,
          'rounded-lg font-medium',
          'transition-all duration-300',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          variant === 'orange' && 'focus:ring-orange-500',
          variant === 'glass' && 'focus:ring-white/20',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

/**
 * ValidationFeedback - 输入验证反馈组件
 *
 * 支持内联错误显示，提供成功/警告/错误状态
 * 可配合表单输入使用
 *
 * _Requirements: 6.3_
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

// =============================================================================
// 类型定义
// =============================================================================

export type ValidationStatus = 'idle' | 'validating' | 'success' | 'warning' | 'error' | 'info';

export interface ValidationMessage {
  /** 消息内容 */
  message: string;
  /** 消息状态 */
  status: ValidationStatus;
  /** 可选的字段名 */
  field?: string;
}

export interface ValidationFeedbackProps {
  /** 验证状态 */
  status?: ValidationStatus;
  /** 验证消息 */
  message?: string;
  /** 多条验证消息 */
  messages?: ValidationMessage[];
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否可关闭 */
  dismissible?: boolean;
  /** 关闭回调 */
  onDismiss?: () => void;
  /** 是否内联显示（紧凑模式） */
  inline?: boolean;
  /** 容器类名 */
  className?: string;
  /** 动画持续时间（毫秒） */
  animationDuration?: number;
}

// =============================================================================
// 样式配置
// =============================================================================

const statusConfig: Record<
  ValidationStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    textColor: string;
    borderColor: string;
    iconColor: string;
  }
> = {
  idle: {
    icon: Info,
    bgColor: 'bg-transparent',
    textColor: 'text-gray-500 dark:text-gray-400',
    borderColor: 'border-transparent',
    iconColor: 'text-gray-400 dark:text-gray-500',
  },
  validating: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500 dark:text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500 dark:text-red-400',
  },
  info: {
    icon: Info,
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    iconColor: 'text-cyan-500 dark:text-cyan-400',
  },
};

// =============================================================================
// 子组件
// =============================================================================

/** 加载动画 */
const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={cn('animate-spin', className)}
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
);

/** 单条消息 */
const SingleMessage: React.FC<{
  status: ValidationStatus;
  message: string;
  showIcon: boolean;
  dismissible: boolean;
  onDismiss?: () => void;
  inline: boolean;
  animationDuration: number;
}> = ({ status, message, showIcon, dismissible, onDismiss, inline, animationDuration }) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (status === 'idle' && !message) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: inline ? 0 : -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: inline ? 0 : -10, height: 0 }}
      transition={{ duration: animationDuration / 1000 }}
      className={cn(
        'flex items-start gap-2',
        inline
          ? 'py-1'
          : cn('px-3 py-2 rounded-md border', config.bgColor, config.borderColor)
      )}
    >
      {showIcon && (
        <span className="flex-shrink-0 mt-0.5">
          {status === 'validating' ? (
            <LoadingSpinner className={cn('w-4 h-4', config.iconColor)} />
          ) : (
            <Icon className={cn('w-4 h-4', config.iconColor)} />
          )}
        </span>
      )}
      <span className={cn('flex-1 text-sm', config.textColor)}>{message}</span>
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
            config.textColor
          )}
          aria-label="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
};

// =============================================================================
// 主组件
// =============================================================================

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  status = 'idle',
  message,
  messages,
  showIcon = true,
  dismissible = false,
  onDismiss,
  inline = false,
  className,
  animationDuration = 200,
}) => {
  // 如果有多条消息，渲染消息列表
  if (messages && messages.length > 0) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <AnimatePresence mode="sync">
          {messages.map((msg, index) => (
            <SingleMessage
              key={`${msg.field ?? index}-${msg.message}`}
              status={msg.status}
              message={msg.field ? `${msg.field}: ${msg.message}` : msg.message}
              showIcon={showIcon}
              dismissible={dismissible}
              onDismiss={onDismiss}
              inline={inline}
              animationDuration={animationDuration}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // 单条消息
  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {message && (
          <SingleMessage
            key={message}
            status={status}
            message={message}
            showIcon={showIcon}
            dismissible={dismissible}
            onDismiss={onDismiss}
            inline={inline}
            animationDuration={animationDuration}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ValidationFeedback;

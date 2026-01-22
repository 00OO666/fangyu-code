/**
 * 自动继续指示器 - 微妙的 UI 提示
 *
 * 设计原则（Non-Intrusive UX）：
 * 1. 显眼但不打断：固定在底部，用户可看到但不影响操作
 * 2. 倒计时可视化：清晰显示剩余时间，用户可预判
 * 3. 一键取消：大按钮方便点击，立即响应
 * 4. 动画过渡：平滑进出，不突兀
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayCircle from 'lucide-react/dist/esm/icons/play-circle'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AutoResumeIndicatorProps {
  /** 是否显示 */
  show: boolean;
  /** 倒计时剩余秒数 */
  countdown: number;
  /** 剩余可继续次数 */
  remainingAttempts: number;
  /** 取消回调 */
  onCancel: () => void;
  /** 手动继续回调 */
  onResume: () => void;
  /** 类名 */
  className?: string;
}

export const AutoResumeIndicator: React.FC<AutoResumeIndicatorProps> = ({
  show,
  countdown,
  remainingAttempts,
  onCancel,
  onResume,
  className,
}) => {
  return (
    <AnimatePresence>
      {show && countdown > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
          className={cn(
            'fixed bottom-28 left-1/2 -translate-x-1/2',
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl',
            'bg-gradient-to-r from-blue-500/90 to-indigo-500/90',
            'backdrop-blur-md border border-white/20',
            className
          )}
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          {/* 左侧图标 + 文本 */}
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">
                检测到未完成任务
              </span>
              <span className="text-xs text-white/80">
                {countdown} 秒后自动继续
              </span>
            </div>
          </div>

          {/* 倒计时圆环 */}
          <div className="relative flex items-center justify-center w-12 h-12">
            {/* 背景圆 */}
            <svg className="absolute w-full h-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="3"
              />
              {/* 进度圆 */}
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - countdown / 5)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            {/* 倒计时数字 */}
            <span className="text-lg font-bold text-white">{countdown}</span>
          </div>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-2">
            {/* 立即继续按钮 */}
            <Button
              size="sm"
              variant="secondary"
              onClick={onResume}
              className="h-8 px-3 bg-white/90 hover:bg-white text-blue-600 font-medium"
            >
              <PlayCircle className="h-4 w-4 mr-1" />
              立即继续
            </Button>

            {/* 取消按钮 */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="h-8 px-3 text-white hover:bg-white/20"
            >
              <XCircle className="h-4 w-4 mr-1" />
              取消
            </Button>
          </div>

          {/* 剩余次数标记 */}
          {remainingAttempts > 0 && (
            <Badge
              variant="outline"
              className="ml-2 bg-white/20 text-white border-white/30"
            >
              剩余 {remainingAttempts} 次
            </Badge>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AutoResumeIndicator;

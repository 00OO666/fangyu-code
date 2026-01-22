/**
 * DuplicateRateWarning Component
 *
 * 显示消息重复率警告，帮助用户了解潜在的性能问题
 */

import React from "react";
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import X from 'lucide-react/dist/esm/icons/x';
import { cn } from "@/lib/utils";

interface DuplicateRateWarningProps {
    /** 重复率 (0-1) */
    rate: number;
    /** 重复消息数量 */
    count: number;
    /** 总消息数量 */
    total: number;
    /** 是否显示 */
    show?: boolean;
    /** 关闭回调 */
    onDismiss?: () => void;
}

/**
 * 重复率警告组件
 * 
 * 显示规则：
 * - rate > 5%: 显示警告
 * - rate > 10%: 显示中等警告
 * - rate > 30%: 显示严重警告
 */
export const DuplicateRateWarning: React.FC<DuplicateRateWarningProps> = ({
    rate,
    count,
    total,
    show = true,
    onDismiss,
}) => {
    // 不显示或重复率低于 5%
    if (!show || rate < 0.05 || count === 0) {
        return null;
    }

    const isHigh = rate > 0.1;
    const isCritical = rate > 0.3;

    const statusConfig = isCritical
        ? {
            icon: AlertTriangle,
            color: "text-red-400",
            bgColor: "bg-red-500/10 border-red-500/20",
            label: "严重",
            description: "重复率过高，可能影响性能",
        }
        : isHigh
            ? {
                icon: AlertTriangle,
                color: "text-yellow-400",
                bgColor: "bg-yellow-500/10 border-yellow-500/20",
                label: "警告",
                description: "重复率偏高，建议检查消息流",
            }
            : {
                icon: TrendingUp,
                color: "text-blue-400",
                bgColor: "bg-blue-500/10 border-blue-500/20",
                label: "提示",
                description: "检测到少量重复消息",
            };

    const Icon = statusConfig.icon;

    return (
        <div
            className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg border text-sm",
                "animate-in slide-in-from-top-2 duration-300",
                statusConfig.bgColor
            )}
        >
            <Icon className={cn("h-4 w-4 flex-shrink-0", statusConfig.color)} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn("font-medium", statusConfig.color)}>
                        {statusConfig.label}: 重复率 {(rate * 100).toFixed(1)}%
                    </span>
                    <span className="text-white/50 text-xs">
                        ({count}/{total} 条消息)
                    </span>
                </div>
                <p className="text-white/60 text-xs mt-0.5">
                    {statusConfig.description}
                    {!isCritical && (
                        <span className="text-green-400 ml-1">
                            · 不影响 Token 消耗
                        </span>
                    )}
                </p>
            </div>

            {/* 说明：为什么不影响 Token */}
            <div className="hidden sm:flex items-center gap-1 text-xs text-white/40">
                <CheckCircle className="h-3 w-3 text-green-400" />
                <span>API 端管理历史</span>
            </div>

            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    <X className="h-3 w-3 text-white/40" />
                </button>
            )}
        </div>
    );
};

/**
 * 重复率分析说明
 * 
 * ## 为什么会有重复消息？
 * 
 * 1. **流式消息更新**：Claude API 返回的流式响应会多次触发事件，
 *    每次 delta 更新都可能被记录为新消息。
 * 
 * 2. **历史加载竞态**：加载历史记录时，如果同时有流式消息到达，
 *    可能导致同一消息被添加多次。
 * 
 * 3. **事件监听器重复**：组件重新渲染时，事件监听器可能被多次注册。
 * 
 * ## 为什么不影响 Token 消耗？
 * 
 * Fangyu Code 的架构设计：
 * - `api.executeClaudeCode()` 只发送 prompt 文本
 * - 消息历史由后端（Rust）管理
 * - 前端的重复消息不会被发送到 API
 * 
 * ## 影响范围
 * 
 * - ✅ Token 消耗：不受影响
 * - ⚠️ 前端性能：需要去重处理
 * - ⚠️ 内存占用：存储重复消息
 * - ✅ 显示效果：去重后正常显示
 */

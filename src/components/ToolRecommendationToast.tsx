/**
 * ToolRecommendationToast - 工具推荐提示组件
 *
 * 功能：
 * - 在界面右下角显示推荐的工具
 * - 支持一键启用
 * - 支持忽略/关闭
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Network,
  Zap,
  Webhook,
  X,
  Check,
  Loader2,
  Sparkles,
  ThumbsDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { notify } from '@/components/notifications';
import type { ToolRecommendation } from '@/hooks/useToolRecommendation';

interface ToolRecommendationToastProps {
  recommendations: ToolRecommendation[];
  onDismiss: (toolId: string) => void;
  onRemove: (toolId: string) => void;
  onClearAll: () => void;
}

const TYPE_ICONS = {
  mcp: Network,
  skill: Zap,
  hook: Webhook,
};

const TYPE_COLORS = {
  mcp: 'text-blue-500',
  skill: 'text-yellow-500',
  hook: 'text-green-500',
};

const TYPE_BG = {
  mcp: 'bg-blue-500/10 border-blue-500/30',
  skill: 'bg-yellow-500/10 border-yellow-500/30',
  hook: 'bg-green-500/10 border-green-500/30',
};

export function ToolRecommendationToast({
  recommendations,
  onDismiss,
  onRemove,
  onClearAll,
}: ToolRecommendationToastProps) {
  const [enabling, setEnabling] = useState<Set<string>>(new Set());

  const handleEnable = async (rec: ToolRecommendation) => {
    if (enabling.has(rec.toolId)) return;

    setEnabling(prev => new Set(prev).add(rec.toolId));

    try {
      // 解析工具 ID
      const parts = rec.toolId.split(':');

      if (rec.toolType === 'mcp' && parts.length >= 3) {
        const engine = parts[1] as 'claude' | 'codex' | 'gemini';
        const serverId = parts.slice(2).join(':');

        // 获取服务器配置
        const servers = await api.mcpGetEngineServersWithStatus(engine);
        const server = servers.find((s: any) => s.id === serverId || s.name === serverId);

        if (server?.spec) {
          await api.mcpToggleEngineServer(engine, serverId, server.spec, true);
          notify.success(`已启用 ${rec.toolName}`, { duration: 2000 });
          onRemove(rec.toolId);
        } else {
          throw new Error(`未找到 ${rec.toolName} 的配置`);
        }
      } else {
        notify.warning(`暂不支持自动启用 ${rec.toolType.toUpperCase()} 类型工具`, { duration: 3000 });
      }
    } catch (error) {
      console.error('[ToolRecommendationToast] Failed to enable tool:', error);
      notify.error(`启用 ${rec.toolName} 失败`, {
        description: error instanceof Error ? error.message : '未知错误',
        duration: 4000,
      });
    } finally {
      setEnabling(prev => {
        const next = new Set(prev);
        next.delete(rec.toolId);
        return next;
      });
    }
  };

  if (recommendations.length === 0) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-4 right-4 w-80 max-w-[calc(100vw-2rem)]"
        style={{ zIndex: 'var(--z-toast)' }}
      >
        <div className="bg-background/95 backdrop-blur-xl border rounded-xl shadow-lg overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">智能推荐</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-6 w-6 p-0 hover:bg-white/10"
              title="关闭所有推荐"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* 推荐列表 */}
          <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
            {recommendations.map((rec) => {
              const Icon = TYPE_ICONS[rec.toolType];
              const isEnabling = enabling.has(rec.toolId);

              return (
                <motion.div
                  key={rec.toolId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "p-2.5 rounded-lg border",
                    TYPE_BG[rec.toolType]
                  )}
                >
                  {/* 工具信息 */}
                  <div className="flex items-start gap-2">
                    <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", TYPE_COLORS[rec.toolType])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rec.toolName}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {rec.toolType}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {rec.reason}
                      </p>
                      {/* 匹配关键词 */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {rec.matchedKeywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground"
                          >
                            {kw}
                          </span>
                        ))}
                        {rec.matchedKeywords.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{rec.matchedKeywords.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleEnable(rec)}
                      disabled={isEnabling}
                      className="flex-1 h-7 text-xs"
                    >
                      {isEnabling ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      启用
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(rec.toolId)}
                      className="h-7 w-7 p-0"
                      title="不再提示"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(rec.toolId)}
                      className="h-7 w-7 p-0"
                      title="稍后再说"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

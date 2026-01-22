/**
 * 格式化通知提供者
 *
 * 在聊天输入框上方显示可点击的格式化通知
 */

import { AnimatePresence, motion } from "framer-motion";
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import X from 'lucide-react/dist/esm/icons/x';
import { useCallback, useEffect, useState } from "react";
import { codeFormatService, type FormatChange } from "@/services/codeFormatService";
import { FormatHistoryDialog } from "./FormatHistoryDialog";

export function FormatNotificationProvider() {
  const [openHistory, setOpenHistory] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FormatChange | null>(null);
  const [pendingFormats, setPendingFormats] = useState<FormatChange[]>([]);

  // 监听格式化历史变化
  useEffect(() => {
    const checkHistory = () => {
      const history = codeFormatService.getHistory();
      // 获取最近 5 条记录
      setPendingFormats(history.slice(0, 5));
    };

    // 定期检查
    const interval = setInterval(checkHistory, 2000);
    checkHistory();

    return () => clearInterval(interval);
  }, []);

  // 监听打开历史事件
  useEffect(() => {
    const handler = () => setOpenHistory(true);
    window.addEventListener("open-format-history", handler);
    return () => window.removeEventListener("open-format-history", handler);
  }, []);

  // 监听通知点击事件
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const record = e.detail as FormatChange;
      setSelectedRecord(record);
      setOpenHistory(true);
    };
    window.addEventListener("open-format-detail", handler as EventListener);
    return () => window.removeEventListener("open-format-detail", handler as EventListener);
  }, []);

  const handleDismiss = useCallback((timestamp: number) => {
    setPendingFormats((prev) => prev.filter((r) => r.timestamp !== timestamp));
  }, []);

  // 如果没有待显示的通知，不渲染
  if (pendingFormats.length === 0) {
    return null;
  }

  return (
    <>
      {/* 通知区域 - 定位在聊天输入框上方 */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 'var(--z-toast)' }}>
        <AnimatePresence mode="popLayout">
          {pendingFormats.slice(0, 2).map((record) => (
            <motion.div
              key={record.timestamp}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto mb-2"
            >
              <div
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border cursor-pointer
                  hover:shadow-xl transition-all duration-200
                  ${
                    record.undoAvailable
                      ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                      : "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                  }
                `}
                onClick={() => {
                  setSelectedRecord(record);
                  setOpenHistory(true);
                }}
              >
                {/* 图标 */}
                <div
                  className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  ${record.undoAvailable ? "bg-amber-500/20" : "bg-green-500/20"}
                `}
                >
                  <CheckCircle
                    className={`h-4 w-4 ${record.undoAvailable ? "text-amber-500" : "text-green-500"}`}
                  />
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{record.summary}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{record.formattedAt}</div>
                </div>

                {/* 关闭按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(record.timestamp);
                  }}
                  className="p-1 hover:bg-accent rounded transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 更多提示 */}
        {pendingFormats.length > 2 && (
          <div
            className="pointer-events-auto text-center mt-2"
            onClick={() => setOpenHistory(true)}
          >
            <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              还有 {pendingFormats.length - 2} 条格式化记录，点击查看全部
            </span>
          </div>
        )}
      </div>

      {/* 历史记录弹窗 */}
      <FormatHistoryDialog
        open={openHistory}
        onClose={() => {
          setOpenHistory(false);
          setSelectedRecord(null);
        }}
        initialRecord={selectedRecord}
      />
    </>
  );
}

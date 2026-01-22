/**
 * 格式化历史弹窗
 *
 * 显示 Biome 自动格式化的所有历史记录，支持查看详情、复制、删除
 */

import { AnimatePresence, motion } from "framer-motion";
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Copy from 'lucide-react/dist/esm/icons/copy'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import X from 'lucide-react/dist/esm/icons/x';
import { useMemo, useState } from "react";
import { codeFormatService, type FormatChange } from "@/services/codeFormatService";
import { notify } from "@/services/notificationService";

interface FormatHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  initialRecord?: FormatChange | null;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  indent: "缩进",
  quote: "引号",
  semicolon: "分号",
  lineending: "换行",
  spacing: "空格",
  "trailing-comma": "逗号",
  other: "其他",
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  indent: "text-blue-500",
  quote: "text-yellow-500",
  semicolon: "text-green-500",
  lineending: "text-purple-500",
  spacing: "text-orange-500",
  "trailing-comma": "text-pink-500",
  other: "text-gray-500",
};

export function FormatHistoryDialog({ open, onClose, initialRecord }: FormatHistoryDialogProps) {
  const [selectedRecord, setSelectedRecord] = useState<FormatChange | null>(initialRecord || null);
  const [searchQuery, setSearchQuery] = useState("");

  const allHistory = useMemo(() => codeFormatService.getHistory(), []);

  // 初始记录不为空时自动选中
  useMemo(() => {
    if (initialRecord && !selectedRecord) {
      setSelectedRecord(initialRecord);
    }
  }, [initialRecord]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery) return allHistory;
    const query = searchQuery.toLowerCase();
    return allHistory.filter(
      (record) =>
        record.filePath.toLowerCase().includes(query) ||
        record.summary.toLowerCase().includes(query),
    );
  }, [allHistory, searchQuery]);

  const handleCopy = (record: FormatChange) => {
    const text = codeFormatService.exportToText(record);
    navigator.clipboard.writeText(text).then(() => {
      notify.success("已复制到剪贴板", { duration: 2000, position: "chat" });
    });
  };

  const handleCopyAll = () => {
    const text = codeFormatService.exportMultipleToText(filteredHistory);
    navigator.clipboard.writeText(text).then(() => {
      notify.success(`已复制 ${filteredHistory.length} 条记录`, {
        duration: 2000,
        position: "chat",
      });
    });
  };

  const handleDelete = (timestamp: number) => {
    codeFormatService.deleteRecord(timestamp);
    setSelectedRecord(null);
    notify.info("记录已删除", { duration: 2000, position: "chat" });
  };

  const handleClearAll = () => {
    if (confirm("确定要清空所有格式化历史记录吗？")) {
      codeFormatService.clearHistory();
      setSelectedRecord(null);
      notify.info("历史记录已清空", { duration: 2000, position: "chat" });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 'var(--z-modal-backdrop)' }}
            onClick={onClose}
          />

          {/* 弹窗 */}
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 'var(--z-modal)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-background rounded-xl shadow-2xl border border-border w-full max-w-4xl max-h-[80vh] flex overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 左侧：历史列表 */}
              <div className="w-80 border-r border-border flex flex-col">
                {/* 头部 */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      格式化历史
                    </h2>
                    <button
                      onClick={onClose}
                      className="p-1 hover:bg-accent rounded-md transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* 搜索框 */}
                  <input
                    type="text"
                    placeholder="搜索文件名..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* 列表 */}
                <div className="flex-1 overflow-y-auto">
                  {filteredHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                      <Clock className="h-8 w-8 mb-2 opacity-50" />
                      {searchQuery ? "没有匹配的记录" : "暂无格式化记录"}
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredHistory.map((record) => (
                        <button
                          key={record.timestamp}
                          onClick={() => setSelectedRecord(record)}
                          className={`
                            w-full p-3 text-left hover:bg-accent/50 transition-colors
                            ${selectedRecord?.timestamp === record.timestamp ? "bg-accent" : ""}
                          `}
                        >
                          <div className="flex items-start gap-2">
                            <CheckCircle
                              className={`
                              h-4 w-4 mt-0.5 flex-shrink-0
                              ${record.undoAvailable ? "text-amber-500" : "text-green-500"}
                            `}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {record.filePath.split(/[/\\]/).pop()}
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {record.summary}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {record.formattedAt}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 底部操作 */}
                <div className="p-3 border-t border-border flex gap-2">
                  <button
                    onClick={handleCopyAll}
                    disabled={filteredHistory.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    <Copy className="h-4 w-4" />
                    复制全部
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={allHistory.length === 0}
                    className="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 右侧：详情 */}
              <div className="flex-1 flex flex-col">
                {selectedRecord ? (
                  <>
                    {/* 详情头部 */}
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {selectedRecord.filePath}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {selectedRecord.formattedAt}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleCopy(selectedRecord)}
                            className="p-2 hover:bg-accent rounded-lg transition-colors"
                            title="复制（可发送给 AI 分析）"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(selectedRecord.timestamp)}
                            className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                            title="删除记录"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 详情内容 */}
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="space-y-4">
                        {/* 摘要 */}
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="text-sm font-medium mb-2">格式化摘要</div>
                          <div className="text-sm">{selectedRecord.summary}</div>
                        </div>

                        {/* 改动列表 */}
                        {selectedRecord.changes.length > 0 ? (
                          <div>
                            <div className="text-sm font-medium mb-3">
                              改动详情 ({selectedRecord.changes.length} 处)
                            </div>
                            <div className="space-y-2">
                              {selectedRecord.changes.map((change, index) => (
                                <div
                                  key={index}
                                  className="p-3 bg-muted/30 rounded-lg border border-border/50"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <span
                                      className={`
                                      text-xs font-medium px-2 py-0.5 rounded
                                      ${CHANGE_TYPE_COLORS[change.type] || "text-gray-500"}
                                      bg-background
                                    `}
                                    >
                                      {CHANGE_TYPE_LABELS[change.type] || change.type}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      {change.description}
                                    </span>
                                  </div>
                                  {(change.before || change.after) && (
                                    <div className="space-y-1 mt-2">
                                      {change.before && (
                                        <div className="text-xs">
                                          <span className="text-red-500">- </span>
                                          <code className="text-muted-foreground">
                                            {change.before}
                                          </code>
                                        </div>
                                      )}
                                      {change.after && (
                                        <div className="text-xs">
                                          <span className="text-green-500">+ </span>
                                          <code className="text-muted-foreground">
                                            {change.after}
                                          </code>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            无具体改动记录
                          </div>
                        )}

                        {/* 提示 */}
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-muted-foreground">
                              如果格式化后代码出现问题，可以点击上方"复制"按钮，将改动记录发送给 AI
                              分析
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>选择一条记录查看详情</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

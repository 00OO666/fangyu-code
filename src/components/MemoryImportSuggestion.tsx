import { logger } from "@/lib/logger";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryMatch } from "@/hooks/useMemoryDetection";

interface MemoryImportSuggestionProps {
  matches: MemoryMatch[];
  projectPath: string;
  onImportComplete?: () => void;
  onClose?: () => void;
  className?: string;
}

/**
 * 记忆导入建议组件
 *
 * 显示检测到的相关记忆文件，用户可选择并导入到项目 CLAUDE.md
 */
export const MemoryImportSuggestion: React.FC<MemoryImportSuggestionProps> = ({
  matches,
  projectPath,
  onImportComplete,
  onClose,
  className,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  const handleToggleSelection = (file: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === matches.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(matches.map((m) => m.file)));
    }
  };

  const handleImport = async () => {
    if (selectedFiles.size === 0) return;

    setIsImporting(true);
    setImportError(null);

    try {
      // 动态导入 Tauri API
      const tauriModule = await import("@tauri-apps/api/core").catch(() => null);
      if (!tauriModule) {
        throw new Error("Tauri API not available");
      }

      const result = await (
        tauriModule as { invoke: <T>(cmd: string, args: Record<string, unknown>) => Promise<T> }
      ).invoke<string>("import_memories", {
        project_path: projectPath,
        memory_files: Array.from(selectedFiles),
      });

      logger.debug("MemoryImportSuggestion", "[MemoryImportSuggestion] Import result:", result);
      onImportComplete?.();
      onClose?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("MemoryImportSuggestion", "[MemoryImportSuggestion] Import failed:", errorMsg);
      setImportError(errorMsg);
    } finally {
      setIsImporting(false);
    }
  };

  if (matches.length === 0) return null;

  const allSelected = selectedFiles.size === matches.length;
  const someSelected = selectedFiles.size > 0 && selectedFiles.size < matches.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed top-20 right-6 z-50 w-96 max-w-[calc(100vw-2rem)]",
          "bg-background/95 backdrop-blur-lg",
          "border border-border rounded-lg shadow-2xl",
          "overflow-hidden",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500 animate-pulse" />
            <span className="font-semibold text-sm">检测到 {matches.length} 个相关记忆</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              aria-label={expanded ? "折叠" : "展开"}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              aria-label="关闭"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto bg-background/30">
                {/* Select All */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer"
                    aria-label="全选"
                  />
                  <label
                    htmlFor="select-all"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    {allSelected ? "取消全选" : someSelected ? "部分选中" : "全选"}
                  </label>
                </div>

                {/* Memory Items */}
                {matches.map((match) => (
                  <div
                    key={match.file}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md border cursor-pointer",
                      "transition-all duration-200",
                      "hover:bg-accent/50 hover:border-primary/50",
                      selectedFiles.has(match.file) && "bg-primary/10 border-primary shadow-sm"
                    )}
                    onClick={() => handleToggleSelection(match.file)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(match.file)}
                      onChange={() => handleToggleSelection(match.file)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded cursor-pointer mt-0.5"
                      aria-label={`选择 ${match.title}`}
                    />
                    <div className="flex-1 min-w-0">
                      {/* Title and Priority */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-sm truncate">{match.title}</span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap",
                            match.priority === "high" &&
                              "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
                            match.priority === "medium" &&
                              "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200",
                            match.priority === "low" &&
                              "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          )}
                        >
                          {match.priority}
                        </span>
                      </div>

                      {/* Category */}
                      <p className="text-xs text-muted-foreground mb-1.5">{match.category}</p>

                      {/* Matched Keywords */}
                      <div className="flex flex-wrap gap-1">
                        {match.matched_keywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              "bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary/90",
                              "border border-primary/30"
                            )}
                          >
                            {kw}
                          </span>
                        ))}
                        {match.matched_keywords.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{match.matched_keywords.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-xs text-muted-foreground min-w-fit">
                      {match.score} 匹配
                    </div>
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {importError && (
                <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/30 text-xs text-destructive">
                  导入失败: {importError}
                </div>
              )}

              {/* Footer */}
              <div className="p-4 border-t flex items-center justify-between bg-background/50">
                <span className="text-xs text-muted-foreground">
                  已选择 {selectedFiles.size} / {matches.length} 个记忆
                </span>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={selectedFiles.size === 0 || isImporting}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium",
                    "transition-all duration-200",
                    selectedFiles.size === 0 || isImporting
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md"
                  )}
                >
                  {isImporting ? (
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="animate-spin h-3 w-3"
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
                      导入中
                    </span>
                  ) : (
                    "导入到 CLAUDE.md"
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default MemoryImportSuggestion;

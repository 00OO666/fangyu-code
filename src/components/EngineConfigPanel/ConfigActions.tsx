/**
 * 配置操作组件 - 导入/导出/刷新
 */

import React, { useState, useCallback, useRef } from "react";
import { Download, Upload, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import type { ExportedConfig } from "../../types/provider";
import type { ExportOptions, ImportResult } from "../../services/engineConfigService";
import { cn } from "../../lib/utils";

interface ConfigActionsProps {
  onExport: (options: ExportOptions) => Promise<ExportedConfig>;
  onImport: (data: ExportedConfig, mode: "merge" | "replace") => Promise<ImportResult>;
  onRefresh: () => Promise<void>;
}

type DialogType = "export" | "import" | null;

export function ConfigActions({ onExport, onImport, onRefresh }: ConfigActionsProps) {
  const [dialog, setDialog] = useState<DialogType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [exportIncludeSensitive, setExportIncludeSensitive] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importData, setImportData] = useState<ExportedConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出配置
  const handleExport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const config = await onExport({
        includeSensitive: exportIncludeSensitive,
        sensitiveDataMode: exportIncludeSensitive ? "encrypted" : "excluded",
      });

      // 下载文件
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fangyu-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    } finally {
      setIsLoading(false);
    }
  }, [onExport, exportIncludeSensitive]);

  // 选择文件
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setImportData(data);
        setDialog("import");
        setError(null);
      } catch {
        setError("无效的配置文件格式");
      }
    };
    reader.readAsText(file);

    // 重置 input
    e.target.value = "";
  }, []);

  // 导入配置
  const handleImport = useCallback(async () => {
    if (!importData) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await onImport(importData, importMode);
      if (result.success) {
        setDialog(null);
        setImportData(null);
      } else {
        setError(result.errors?.join(", ") || "导入失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setIsLoading(false);
    }
  }, [importData, importMode, onImport]);

  // 刷新
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await onRefresh();
    } finally {
      setIsLoading(false);
    }
  }, [onRefresh]);

  return (
    <>
      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDialog("export")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
            "text-gray-600 dark:text-gray-400",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            "transition-colors"
          )}
        >
          <Download className="w-4 h-4" />
          导出
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
            "text-gray-600 dark:text-gray-400",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            "transition-colors"
          )}
        >
          <Upload className="w-4 h-4" />
          导入
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
            "text-gray-600 dark:text-gray-400",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            "transition-colors",
            "disabled:opacity-50"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          刷新
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 导出对话框 */}
      {dialog === "export" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              导出配置
            </h3>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <input
                  type="checkbox"
                  checked={exportIncludeSensitive}
                  onChange={(e) => setExportIncludeSensitive(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    包含敏感数据
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    导出 API Key 等敏感信息（加密存储）
                  </span>
                </div>
              </label>

              {exportIncludeSensitive && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    警告：导出的文件将包含加密的 API Key。请妥善保管导出文件，不要分享给他人。
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入对话框 */}
      {dialog === "import" && importData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              导入配置
            </h3>

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  将导入 <strong>{importData.providers?.length || 0}</strong> 个代理商配置
                </p>
                {importData.includesSensitiveData && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">包含敏感数据</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  导入模式
                </p>
                <div className="space-y-2">
                  <label
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer",
                      importMode === "merge"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="import-mode"
                      value="merge"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        合并
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        保留现有配置，添加或更新导入的配置
                      </span>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer",
                      importMode === "replace"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="import-mode"
                      value="replace"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        替换
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        清空现有配置，使用导入的配置
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setDialog(null);
                  setImportData(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ConfigActions;

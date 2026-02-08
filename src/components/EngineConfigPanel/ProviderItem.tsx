/**
 * 代理商列表项组件 - 可展开的卡片式设计
 * 参考旧的 ProviderManager.tsx 的 UI 设计
 */

import { logger } from "@/lib/logger";
import React, { useState, useCallback } from "react";
import {
  Zap,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Globe,
  Key,
  Server,
  Loader2,
  Save,
  X,
} from "lucide-react";
import type { UnifiedProviderConfig } from "../../types/provider";
import { cn } from "../../lib/utils";
import { InlineModelTester, type APIProviderType } from "./InlineModelTester";

interface ProviderItemProps {
  provider: UnifiedProviderConfig;
  isActive: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onEdit: (updates: Partial<UnifiedProviderConfig>) => Promise<void>;
  onTest: () => void;
  onDelete: () => void;
  onModelSelect?: (modelId: string) => void;
}

function formatLastUsed(timestamp?: number): string {
  if (!timestamp) return "从未使用";
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return "超过 30 天";
}

function getTestStatusIcon(result?: UnifiedProviderConfig["lastTestResult"]) {
  if (!result) return null;
  if (result.success) {
    return <CheckCircle className="w-3 h-3 text-green-500" />;
  }
  return <AlertCircle className="w-3 h-3 text-red-500" />;
}

function maskApiKey(key?: string): string {
  if (!key || key.length <= 10) return key || "";
  const start = key.substring(0, 8);
  const end = key.substring(key.length - 4);
  return `${start}${"*".repeat(Math.min(key.length - 12, 20))}${end}`;
}

export function ProviderItem({
  provider,
  isActive,
  isDragging,
  onSelect,
  onEdit,
  onTest,
  onDelete,
  onModelSelect,
}: ProviderItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showModelTest, setShowModelTest] = useState(false);
  const [editForm, setEditForm] = useState({
    name: provider.name || "",
    baseUrl: provider.baseUrl || "",
    apiKey: provider.apiKey || "",
    model: provider.model || "",
  });

  const toggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
      if (!isExpanded) {
        setIsEditing(false);
        setEditForm({
          name: provider.name || "",
          baseUrl: provider.baseUrl || "",
          apiKey: provider.apiKey || "",
          model: provider.model || "",
        });
      }
    },
    [isExpanded, provider]
  );

  const startEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(false);
      setEditForm({
        name: provider.name || "",
        baseUrl: provider.baseUrl || "",
        apiKey: provider.apiKey || "",
        model: provider.model || "",
      });
    },
    [provider]
  );

  const saveEditing = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsSaving(true);
      try {
        const updates: Partial<UnifiedProviderConfig> = {
          name: editForm.name,
          baseUrl: editForm.baseUrl,
          model: editForm.model,
          apiKey: editForm.apiKey,
        };
        await onEdit(updates);
        setIsEditing(false);
      } catch (error) {
        logger.error("ProviderItem", "保存失败:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [editForm, onEdit]
  );

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect();
    },
    [onSelect]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    },
    [onDelete]
  );

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200 overflow-hidden",
        isDragging && "opacity-80 scale-[1.02] shadow-lg",
        isActive
          ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <button type="button" onClick={toggleExpand} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {provider.name}
            </span>
            {isActive && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                当前
              </span>
            )}
            {provider.isOfficial && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                官方
              </span>
            )}
            {getTestStatusIcon(provider.lastTestResult)}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatLastUsed(provider.lastUsed)}</span>
            {provider.model && (
              <>
                <span>·</span>
                <span className="truncate">{provider.model}</span>
              </>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {!isActive && (
            <button
              type="button"
              onClick={handleSelect}
              className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              title="切换到此代理商"
            >
              切换
            </button>
          )}
          <button
            type="button"
            onClick={toggleExpand}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isExpanded ? "收起" : "展开"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/50">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  名称
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="代理商名称"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  API 端点
                </label>
                <input
                  type="url"
                  value={editForm.baseUrl}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={editForm.apiKey}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  默认模型
                </label>
                <input
                  type="text"
                  value={editForm.model}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="claude-sonnet-4-20250514"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveEditing}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  保存
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Server className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-gray-500 dark:text-gray-400">API 端点：</span>
                    <span className="font-mono text-gray-900 dark:text-gray-100 break-all">
                      {provider.baseUrl || "未设置"}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Key className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">API Key：</span>
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {provider.apiKey
                        ? showApiKey
                          ? provider.apiKey
                          : maskApiKey(provider.apiKey)
                        : "未设置"}
                    </span>
                    {provider.apiKey && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowApiKey(!showApiKey);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
                {provider.model && (
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0 text-center text-xs">
                      🤖
                    </span>
                    <div className="min-w-0">
                      <span className="text-gray-500 dark:text-gray-400">模型：</span>
                      <span className="text-gray-900 dark:text-gray-100">{provider.model}</span>
                    </div>
                  </div>
                )}
                {provider.lastTestResult && (
                  <div
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-xs",
                      provider.lastTestResult.success
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                    )}
                  >
                    {provider.lastTestResult.success ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    <span>
                      {provider.lastTestResult.success
                        ? `连接正常${provider.lastTestResult.latencyMs ? ` (${provider.lastTestResult.latencyMs}ms)` : ""}`
                        : provider.lastTestResult.errorMessage || "连接失败"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModelTest(!showModelTest);
                    }}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg transition-colors",
                      showModelTest
                        ? "text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "text-yellow-600 dark:text-yellow-400 border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                    )}
                    title="测试代理商支持的所有模型"
                  >
                    <Zap className="w-4 h-4" />
                    测试可用模型
                  </button>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 border border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    编辑
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </div>

              {/* 内嵌模型测试 */}
              {showModelTest && provider.apiKey && provider.baseUrl && (
                <InlineModelTester
                  provider={(provider.engine || "claude") as APIProviderType}
                  apiKey={provider.apiKey}
                  baseUrl={provider.baseUrl}
                  onClose={() => setShowModelTest(false)}
                  selectedModel={provider.model || null}
                  onModelSelect={onModelSelect}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProviderItem;

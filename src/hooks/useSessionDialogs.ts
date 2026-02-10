import { useState, useCallback } from "react";

/**
 * 管理所有对话框和悬浮窗的显示状态
 *
 * 包括：
 * - Canvas 预览
 * - Usage Dashboard
 * - MCP 配置
 * - Revert Picker
 * - Prompt Navigator
 * - Session Summary
 * - Webview Preview
 * - Toast 通知
 */
export function useSessionDialogs() {
  // Canvas 实时预览
  const [showCanvas, setShowCanvas] = useState(false);

  // Usage Dashboard
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);

  // 项目级 MCP 配置对话框
  const [showMCPConfig, setShowMCPConfig] = useState(false);

  // Revert Prompt Picker
  const [showRevertPicker, setShowRevertPicker] = useState(false);

  // Prompt Navigator
  const [showPromptNavigator, setShowPromptNavigator] = useState(false);

  // Session Summary Dialog
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [sessionSummary, setSessionSummary] = useState("");
  const [showSummaryHint, setShowSummaryHint] = useState(false);
  const [isGeneratingSummaryManual, setIsGeneratingSummaryManual] = useState(false);

  // Webview Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);

  // Toast 通知
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // 稳定的回调函数，避免每次渲染都创建新函数
  const handleOpenCanvas = useCallback(() => setShowCanvas(true), []);
  const handleCloseCanvas = useCallback(() => setShowCanvas(false), []);

  const handleToggleUsageDashboard = useCallback(() => setShowUsageDashboard((prev) => !prev), []);
  const handleCloseUsageDashboard = useCallback(() => setShowUsageDashboard(false), []);

  const handleToggleMCPConfig = useCallback(() => setShowMCPConfig((prev) => !prev), []);
  const handleCloseMCPConfig = useCallback(() => setShowMCPConfig(false), []);

  const handleShowRevertPicker = useCallback(() => setShowRevertPicker(true), []);
  const handleCloseRevertPicker = useCallback(() => setShowRevertPicker(false), []);

  const handleShowPromptNavigator = useCallback(() => setShowPromptNavigator(true), []);
  const handleClosePromptNavigator = useCallback(() => setShowPromptNavigator(false), []);

  const handleCloseSummaryDialog = useCallback(() => setShowSummaryDialog(false), []);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    setPreviewUrl("");
  }, []);

  const handleShowToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  }, []);

  const handleCloseToast = useCallback(() => setToast(null), []);

  return {
    // Canvas
    showCanvas,
    setShowCanvas,
    handleOpenCanvas,
    handleCloseCanvas,

    // Usage Dashboard
    showUsageDashboard,
    setShowUsageDashboard,
    handleToggleUsageDashboard,
    handleCloseUsageDashboard,

    // MCP Config
    showMCPConfig,
    setShowMCPConfig,
    handleToggleMCPConfig,
    handleCloseMCPConfig,

    // Revert Picker
    showRevertPicker,
    setShowRevertPicker,
    handleShowRevertPicker,
    handleCloseRevertPicker,

    // Prompt Navigator
    showPromptNavigator,
    setShowPromptNavigator,
    handleShowPromptNavigator,
    handleClosePromptNavigator,

    // Session Summary
    showSummaryDialog,
    setShowSummaryDialog,
    sessionSummary,
    setSessionSummary,
    showSummaryHint,
    setShowSummaryHint,
    isGeneratingSummaryManual,
    setIsGeneratingSummaryManual,
    handleCloseSummaryDialog,

    // Webview Preview
    showPreview,
    setShowPreview,
    previewUrl,
    setPreviewUrl,
    showPreviewPrompt,
    setShowPreviewPrompt,
    handleClosePreview,

    // Toast
    toast,
    setToast,
    handleShowToast,
    handleCloseToast,
  };
}

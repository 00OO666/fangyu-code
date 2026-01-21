import React, { useState, useEffect, useRef, useMemo } from "react";
// import { Plus } from "lucide-react"; // Unused in new GlobalSessionCenter
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, Transition } from "framer-motion"; // ✨ Added for transitions
import { Button } from "@/components/ui/button";
// import { ProjectList } from "@/components/ProjectList"; // Unused in new GlobalSessionCenter
// import { SessionList } from "@/components/SessionList"; // Unused in new GlobalSessionCenter
// import { RunningClaudeSessions } from "@/components/RunningClaudeSessions"; // Unused in new GlobalSessionCenter
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { CodexMarkdownEditor } from "@/components/CodexMarkdownEditor";
import { GeminiMarkdownEditor } from "@/components/GeminiMarkdownEditor";
import { ClaudeFileEditor } from "@/components/ClaudeFileEditor";
import { Settings } from "@/components/Settings";
import { ClaudeCodeSession } from "@/components/ClaudeCodeSession";
import { TabManager } from "@/components/TabManager";
import { UsageDashboard } from "@/components/UsageDashboard";
import { Diagnostics } from "@/components/Diagnostics";
import { MCPManager } from "@/components/MCPManager";
import { ClaudeBinaryDialog } from "@/components/dialogs/ClaudeBinaryDialog";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectSettings } from '@/components/ProjectSettings';
import { EnhancedHooksManager } from '@/components/EnhancedHooksManager';
import { ClaudeExtensionsManager } from '@/components/ClaudeExtensionsManager';
import { PluginManager } from '@/components/PluginManager';
import { HookToggleManager } from '@/components/HookToggleManager';
import { SuperAgentCenter } from '@/components/SuperAgentCenter';
import { DeveloperTools } from '@/components/DeveloperTools';
import { SpecGenerationPanel } from '@/components/SpecGenerationPanel';
import { V3FeaturesCenter } from '@/components/V3FeaturesCenter';
import { WorkflowManagerPanel } from '@/components/WorkflowManagerPanel';
import NewFeaturesDemo from '@/examples/NewFeaturesDemo';
// import { ProjectCardSkeleton, SessionListItemSkeleton } from '@/components/ui/skeleton'; // Unused in new GlobalSessionCenter
import { GlobalSessionCenter } from '@/components/GlobalSessionCenter';
import { useNavigation } from '@/contexts/NavigationContext';
import { useProject } from '@/contexts/ProjectContext';
import { useTabs } from '@/hooks/useTabs';
import { useGlobalKeyboardShortcuts } from '@/hooks/useGlobalKeyboardShortcuts';

type ClaudeCompletePayload = { tab_id?: string | null; payload: boolean } | boolean;

const isClaudeCompleteSuccess = (payload: ClaudeCompletePayload) => {
  if (typeof payload === 'boolean') return payload;
  return payload?.payload === true;
};

// ✨ View transition variants
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -10 }
};

const pageTransition: Transition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.3
};

export const ViewRouter: React.FC = () => {
  const { t } = useTranslation();
  const { currentView, navigateTo, viewParams, setNavigationInterceptor, goBack } = useNavigation();
  const {
    projects: _projects, selectedProject, sessions: _sessions, loading: _loading, error: _error,
    loadProjects, selectProject: _selectProject, deleteProject: _deleteProject, clearSelection: _clearSelection, refreshSessions
  } = useProject();
  const { openSessionInBackground, switchToTab } = useTabs();

  const [showClaudeBinaryDialog, setShowClaudeBinaryDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [pendingView, setPendingView] = useState<any | null>(null); // Store pending view for confirmation

  // 🔧 FIX: 记录 TabManager 是否曾经被访问过
  // 只有访问过 claude-tab-manager 视图后才渲染 TabManager，避免不必要的初始化
  const [hasVisitedTabManager, setHasVisitedTabManager] = useState(false);

  // 🔧 FIX: 保存 TabManager 的初始参数，只在第一次访问时使用
  const tabManagerParamsRef = useRef<{ initialSession?: any; initialProjectPath?: string }>({});

  useEffect(() => {
    if (currentView === "claude-tab-manager") {
      if (!hasVisitedTabManager) {
        // 第一次访问，保存初始参数
        tabManagerParamsRef.current = {
          initialSession: viewParams.initialSession,
          initialProjectPath: viewParams.initialProjectPath,
        };
        setHasVisitedTabManager(true);
      } else if (viewParams.initialSession || viewParams.initialProjectPath) {
        // 后续访问如果有新的参数，更新参数（用于从会话列表点击打开新会话）
        tabManagerParamsRef.current = {
          initialSession: viewParams.initialSession,
          initialProjectPath: viewParams.initialProjectPath,
        };
      }
    }
  }, [currentView, viewParams.initialSession, viewParams.initialProjectPath, hasVisitedTabManager]);

  // Load projects on mount if in projects view
  const hasLoadedProjectsRef = useRef(false);
  useEffect(() => {
    if (currentView === "projects" && !hasLoadedProjectsRef.current) {
      loadProjects();
      hasLoadedProjectsRef.current = true;
    }
  }, [currentView, loadProjects]);

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    onOpenSettings: () => {
      navigateTo('settings');
    },
    enabled: currentView !== 'claude-code-session',
  });

  // Listen for open-prompt-api-settings
  useEffect(() => {
    const handleOpenPromptAPISettings = () => {
      navigateTo("settings", { initialTab: "prompt-api" });
    };
    window.addEventListener('open-prompt-api-settings', handleOpenPromptAPISettings as EventListener);
    return () => window.removeEventListener('open-prompt-api-settings', handleOpenPromptAPISettings as EventListener);
  }, [currentView, navigateTo]);

  // Listen for claude-session-selected
  useEffect(() => {
    const handleSessionSelected = (event: CustomEvent) => {
      const { session } = event.detail;
      const result = openSessionInBackground(session);
      switchToTab(result.tabId);
      navigateTo("claude-tab-manager");

      if (result.isNew) {
        setToast({ message: `会话 ${session.id.slice(-8)} 已打开`, type: "success" });
      } else {
        setToast({ message: `已切换到会话 ${session.id.slice(-8)}`, type: "info" });
      }
    };

    const handleClaudeNotFound = () => {
      setShowClaudeBinaryDialog(true);
    };

    window.addEventListener('claude-session-selected', handleSessionSelected as EventListener);
    window.addEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    return () => {
      window.removeEventListener('claude-session-selected', handleSessionSelected as EventListener);
      window.removeEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    };
  }, [openSessionInBackground, switchToTab, navigateTo]);

  // Listen for claude-complete
  useEffect(() => {
    let unlistenComplete: UnlistenFn | null = null;
    const setupListener = async () => {
      unlistenComplete = await listen<ClaudeCompletePayload>('claude-complete', async (event) => {
        if (isClaudeCompleteSuccess(event.payload)) {
          loadProjects(); // Refresh projects to update counts/timestamps
          if (selectedProject) {
            refreshSessions();
          }
        }
      });
    };
    setupListener();
    return () => {
      if (unlistenComplete) unlistenComplete();
    };
  }, [loadProjects, selectedProject, refreshSessions]);

  // Handlers (removed unused handlers for new GlobalSessionCenter)
  // Render Logic
  const renderContent = () => {
    switch (currentView) {
      case "enhanced-hooks-manager":
        return (
          <EnhancedHooksManager
            onBack={goBack}
            projectPath={viewParams.projectPath}
          />
        );

      case "hook-manager":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              <HookToggleManager onBack={goBack} />
            </div>
          </div>
        );

      case "claude-extensions":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              <ClaudeExtensionsManager
                projectPath={viewParams.projectPath}
                onBack={goBack}
              />
            </div>
          </div>
        );

      case "editor":
        return (
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor onBack={goBack} />
          </div>
        );

      case "codex-editor":
        return (
          <div className="flex-1 overflow-hidden">
            <CodexMarkdownEditor onBack={goBack} />
          </div>
        );

      case "gemini-editor":
        return (
          <div className="flex-1 overflow-hidden">
            <GeminiMarkdownEditor onBack={goBack} />
          </div>
        );

      case "settings":
        return (
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            <Settings 
              onBack={goBack} 
              initialTab={viewParams.initialTab}
            />
          </div>
        );

      case "projects":
        return (
          <GlobalSessionCenter
            onSessionClick={(session) => {
              const result = openSessionInBackground(session);
              switchToTab(result.tabId);
              navigateTo("claude-tab-manager");
              if (result.isNew) {
                setToast({ message: `会话 ${session.id.slice(-8)} 已打开`, type: "success" });
              } else {
                setToast({ message: `已切换到会话 ${session.id.slice(-8)}`, type: "info" });
              }
            }}
            onNewSession={() => {
              navigateTo("claude-tab-manager", { initialProjectPath: "__SMART_SESSION__" });
            }}
          />
        );

      case "claude-file-editor":
        return viewParams.file ? (
          <ClaudeFileEditor
            file={viewParams.file}
            onBack={goBack}
          />
        ) : null;

      case "claude-code-session":
        return (
          <ClaudeCodeSession
            session={viewParams.initialSession}
            initialProjectPath={viewParams.initialProjectPath}
            onStreamingChange={(isStreaming) => {
              // Navigation protection
              if (isStreaming) {
                setNavigationInterceptor((nextView) => {
                  setPendingView(nextView);
                  setShowNavigationConfirm(true);
                  return false;
                });
              } else {
                setNavigationInterceptor(null);
              }
            }}
          />
        );

      case "claude-tab-manager":
        // 🔧 FIX: TabManager 现在在外部持久化渲染，这里返回 null
        // 这样切换到设置页面再回来时，TabManager 的状态不会丢失
        return null;

      case "usage-dashboard":
        return <UsageDashboard onBack={goBack} />;

      case "diagnostics":
        return (
          <div className="flex-1 overflow-y-auto">
            <Diagnostics />
          </div>
        );

      case "mcp":
        return <MCPManager onBack={goBack} />;

      case "plugins":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              <PluginManager
                workspacePath={viewParams.projectPath}
              />
            </div>
          </div>
        );

      case "new-features":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              <NewFeaturesDemo />
            </div>
          </div>
        );

      case "super-agent":
        return <SuperAgentCenter onBack={goBack} />;

      case "v3-features":
        return <V3FeaturesCenter onBack={goBack} />;

      case "developer-tools":
        return <DeveloperTools onBack={goBack} />;

      case "spec-generation":
        return (
          <div className="flex-1 overflow-hidden">
            <SpecGenerationPanel apiClient={viewParams.apiClient} />
          </div>
        );

      case "workflow-manager":
        return (
          <div className="flex-1 overflow-hidden">
            <WorkflowManagerPanel
              workspaceRoot={viewParams.workspaceRoot || ''}
              apiClient={viewParams.apiClient}
            />
          </div>
        );

      case "project-settings":
        if (viewParams.project) {
          return (
            <ProjectSettings
              project={viewParams.project}
              onBack={goBack}
            />
          );
        }
        break;

      default:
        return null;
    }
  };

  return (
    <>
      {/* 🔧 FIX: TabManager 持久化渲染 - 切换到其他视图时保持挂载但隐藏 */}
      {/* 这解决了切换到设置页面再回来时会话内容空白的问题 */}
      {hasVisitedTabManager && (
        <div
          className="flex-1 flex flex-col h-full overflow-hidden"
          style={{
            display: currentView === "claude-tab-manager" ? "flex" : "none",
            position: currentView === "claude-tab-manager" ? "relative" : "absolute",
            visibility: currentView === "claude-tab-manager" ? "visible" : "hidden",
          }}
        >
          <TabManager
            initialSession={tabManagerParamsRef.current.initialSession}
            initialProjectPath={tabManagerParamsRef.current.initialProjectPath}
            onBack={() => navigateTo("projects")}
          />
        </div>
      )}

      {/* ✨ AnimatePresence for smooth page transitions (非 TabManager 视图) */}
      {currentView !== "claude-tab-manager" && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentView}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      )}

      <ClaudeBinaryDialog
        open={showClaudeBinaryDialog}
        onOpenChange={setShowClaudeBinaryDialog}
        onSuccess={() => {
          setToast({ message: t('messages.saved'), type: "success" });
          window.location.reload();
        }}
        onError={(message) => setToast({ message, type: "error" })}
      />

      <Dialog open={showNavigationConfirm} onOpenChange={setShowNavigationConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认离开</DialogTitle>
            <DialogDescription>
              Claude 正在处理您的请求。确定要离开当前会话吗？这将中断正在进行的对话。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNavigationConfirm(false);
              setPendingView(null);
            }}>
              取消
            </Button>
            <Button onClick={() => {
              setNavigationInterceptor(null); // Clear interceptor to allow navigation
              setShowNavigationConfirm(false);
              if (pendingView) {
                navigateTo(pendingView);
              }
            }}>
              确定离开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </>
  );
};

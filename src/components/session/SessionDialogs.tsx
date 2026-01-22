import React, { Suspense, lazy } from 'react';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { RevertPromptPicker } from '../RevertPromptPicker';
import { PlanApprovalDialog } from '../dialogs/PlanApprovalDialog';
import { AskUserQuestionDialog } from '../dialogs/AskUserQuestionDialog';
import { PromptNavigator } from '../PromptNavigator';
import { SmartRecommendationBar } from '../SmartRecommendationBar';
import { ProjectMCPQuickConfig } from '../ProjectMCPQuickConfig';
import { SessionSummaryDialog } from '../SessionSummaryDialog';
import type { Session, ClaudeStreamMessage } from '@/types';
import type { ExecutionEngineConfig } from '../FloatingPromptInput/types';

const CanvasFloatingWindow = lazy(() => import("@/components/canvas/CanvasFloatingWindow").then(m => ({ default: m.CanvasFloatingWindow })));

interface SessionDialogsProps {
  // Revert Picker
  showRevertPicker: boolean;
  effectiveSession: Session | null;
  projectPath: string;
  executionEngineConfig: ExecutionEngineConfig;
  onRevert: (promptIndex: number, mode: 'both' | 'conversation_only' | 'git_only') => Promise<void>;
  onCloseRevertPicker: () => void;

  // Plan Approval
  showApprovalDialog: boolean;
  pendingApproval: { plan: string } | null;
  onCloseApprovalDialog: () => void;
  onApprovePlan: () => void;
  onRejectPlan: () => void;

  // User Question
  showQuestionDialog: boolean;
  pendingQuestion: { questions: any[] } | null;
  onCloseQuestionDialog: () => void;
  onSubmitAnswers: (answers: Record<string, string>) => void;

  // Prompt Navigator
  showPromptNavigator: boolean;
  messages: ClaudeStreamMessage[];
  onClosePromptNavigator: () => void;
  onPromptNavigation: (promptIndex: number) => void;

  // Canvas
  showCanvas: boolean;
  extractedCode: { code: string; language: string } | null;
  onCloseCanvas: () => void;

  // Smart Recommendations
  recommendations: any[];
  onDismissRecommendation: (id: string) => void;
  onSnoozeRecommendation: (id: string) => void;
  onClearRecommendations: () => void;
  onRefreshMCPStatus: () => void;

  // MCP Config
  showMCPConfig: boolean;
  onCloseMCPConfig: () => void;

  // Session Summary
  showSummaryDialog: boolean;
  sessionSummary: string;
  thresholdPercentage: number;
  onCloseSummaryDialog: () => void;
  onStartNewSession: () => void;
  onContinueAnyway: () => void }

export const SessionDialogs: React.FC<SessionDialogsProps> = React.memo(({
  showRevertPicker,
  effectiveSession,
  projectPath,
  executionEngineConfig,
  onRevert,
  onCloseRevertPicker,
  showApprovalDialog,
  pendingApproval,
  onCloseApprovalDialog,
  onApprovePlan,
  onRejectPlan,
  showQuestionDialog,
  pendingQuestion,
  onCloseQuestionDialog,
  onSubmitAnswers,
  showPromptNavigator,
  messages,
  onClosePromptNavigator,
  onPromptNavigation,
  showCanvas,
  extractedCode,
  onCloseCanvas,
  recommendations,
  onDismissRecommendation,
  onSnoozeRecommendation,
  onClearRecommendations,
  onRefreshMCPStatus,
  showMCPConfig,
  onCloseMCPConfig,
  showSummaryDialog,
  sessionSummary,
  thresholdPercentage,
  onCloseSummaryDialog,
  onStartNewSession,
  onContinueAnyway,
}) => {
  return (
    <>
      {/* Revert Prompt Picker */}
      {showRevertPicker && effectiveSession && (
        <RevertPromptPicker
          sessionId={effectiveSession.id}
          projectId={effectiveSession.project_id}
          projectPath={projectPath}
          engine={effectiveSession.engine || executionEngineConfig.engine || 'claude'}
          onSelect={onRevert}
          onClose={onCloseRevertPicker}
        />
      )}

      {/* Plan Approval Dialog */}
      <PlanApprovalDialog
        open={showApprovalDialog}
        plan={pendingApproval?.plan || ''}
        onClose={onCloseApprovalDialog}
        onApprove={onApprovePlan}
        onReject={onRejectPlan}
      />

      {/* User Question Dialog */}
      <AskUserQuestionDialog
        open={showQuestionDialog}
        questions={pendingQuestion?.questions || []}
        onClose={onCloseQuestionDialog}
        onSubmit={onSubmitAnswers}
      />

      {/* Prompt Navigator */}
      <PromptNavigator
        messages={messages}
        isOpen={showPromptNavigator}
        onClose={onClosePromptNavigator}
        onPromptClick={onPromptNavigation}
      />

      {/* Canvas Preview */}
      {showCanvas && (
        <Suspense fallback={<div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <CanvasFloatingWindow
            isOpen={showCanvas}
            onClose={onCloseCanvas}
            extractedCode={extractedCode?.code || ''}
            language={extractedCode?.language || 'tsx'}
          />
        </Suspense>
      )}

      {/* Smart Recommendations */}
      {recommendations.length > 0 && (
        <div className="fixed bottom-20 right-4 z-50 max-w-md">
          <SmartRecommendationBar
            recommendations={recommendations}
            onDismiss={onDismissRecommendation}
            onSnooze={onSnoozeRecommendation}
            onClearAll={onClearRecommendations}
            onRefresh={onRefreshMCPStatus}
          />
        </div>
      )}

      {/* MCP Config */}
      {projectPath && (
        <ProjectMCPQuickConfig
          open={showMCPConfig}
          onClose={onCloseMCPConfig}
          projectPath={projectPath}
          engine={executionEngineConfig.engine}
        />
      )}

      {/* Session Summary Dialog */}
      <SessionSummaryDialog
        isOpen={showSummaryDialog}
        summary={sessionSummary}
        tokenPercentage={thresholdPercentage}
        onClose={onCloseSummaryDialog}
        onStartNewSession={onStartNewSession}
        onContinueAnyway={onContinueAnyway}
      />
    </>
  ) });

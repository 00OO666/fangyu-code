import React from "react";
import { PlanApprovalDialog } from "../dialogs/PlanApprovalDialog";
import { AskUserQuestionDialog } from "../dialogs/AskUserQuestionDialog";
import { SessionSummaryDialog } from "../SessionSummaryDialog";
import type { UserAnswers } from "@/contexts/UserQuestionContext";

interface SessionDialogsProps {
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
  onSubmitAnswers: (answers: UserAnswers) => void;

  // Session Summary
  showSummaryDialog: boolean;
  sessionSummary: string;
  thresholdPercentage: number;
  onCloseSummaryDialog: () => void;
  onStartNewSession: () => void;
  onContinueAnyway: () => void;
}

export const SessionDialogs: React.FC<SessionDialogsProps> = React.memo(
  ({
    showApprovalDialog,
    pendingApproval,
    onCloseApprovalDialog,
    onApprovePlan,
    onRejectPlan,
    showQuestionDialog,
    pendingQuestion,
    onCloseQuestionDialog,
    onSubmitAnswers,
    showSummaryDialog,
    sessionSummary,
    thresholdPercentage,
    onCloseSummaryDialog,
    onStartNewSession,
    onContinueAnyway,
  }) => {
    return (
      <>
        {/* Plan Approval Dialog */}
        <PlanApprovalDialog
          open={showApprovalDialog}
          plan={pendingApproval?.plan || ""}
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
    );
  }
);

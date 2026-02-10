import React from "react";
import { RevertPromptPicker } from "../RevertPromptPicker";
import { PromptNavigator } from "../PromptNavigator";
import type { Session, RewindMode } from "@/lib/api/types";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { ExecutionEngineConfig } from "../FloatingPromptInput/types";

interface SessionNavigationProps {
  // Revert Picker
  showRevertPicker: boolean;
  effectiveSession: Session | null;
  projectPath: string;
  executionEngineConfig: ExecutionEngineConfig;
  onRevert: (promptIndex: number, mode: RewindMode) => Promise<void>;
  onCloseRevertPicker: () => void;

  // Prompt Navigator
  showPromptNavigator: boolean;
  messages: ClaudeStreamMessage[];
  promptItems?: any[];
  promptsTotalCost?: number;
  sessionTotalCost?: number;
  onClosePromptNavigator: () => void;
  onPromptNavigation: (promptIndex: number) => void;
}

export const SessionNavigation: React.FC<SessionNavigationProps> = React.memo(
  ({
    showRevertPicker,
    effectiveSession,
    projectPath,
    executionEngineConfig,
    onRevert,
    onCloseRevertPicker,
    showPromptNavigator,
    messages,
    promptItems,
    promptsTotalCost,
    sessionTotalCost,
    onClosePromptNavigator,
    onPromptNavigation,
  }) => {
    return (
      <>
        {/* Revert Prompt Picker */}
        {showRevertPicker && effectiveSession && (
          <RevertPromptPicker
            sessionId={effectiveSession.id}
            projectId={effectiveSession.project_id}
            projectPath={projectPath}
            engine={effectiveSession.engine || executionEngineConfig.engine || "claude"}
            onSelect={onRevert}
            onClose={onCloseRevertPicker}
          />
        )}

        {/* Prompt Navigator */}
        <PromptNavigator
          messages={messages}
          promptItems={promptItems}
          promptsTotalCost={promptsTotalCost}
          sessionTotalCost={sessionTotalCost}
          isOpen={showPromptNavigator}
          onClose={onClosePromptNavigator}
          onPromptClick={onPromptNavigation}
        />
      </>
    );
  }
);

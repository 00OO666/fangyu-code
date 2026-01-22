import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import X from 'lucide-react/dist/esm/icons/x'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import FileText from 'lucide-react/dist/esm/icons/file-text';
import { Button } from '@/components/ui/button';
import { FloatingPromptInput, type FloatingPromptInputRef, type ModelType } from '../FloatingPromptInput';
import { ErrorBoundary } from '../ErrorBoundary';
import { ChatNotification } from '../notifications/ChatNotification';
import { CompactStatusIndicator } from '../CompactStatusIndicator';
import type { Session, ClaudeStreamMessage } from '@/types';
import type { CodexRateLimits } from '@/types/codex';
import type { ExecutionEngineConfig } from '../FloatingPromptInput/types';

interface QueuedPrompt {
  id: string;
  prompt: string;
  model: ModelType }

interface SessionFooterProps {
  // Refs
  floatingPromptRef: React.RefObject<FloatingPromptInputRef>;

  // State
  projectPath: string;
  effectiveSession: Session | null;
  messages: ClaudeStreamMessage[];
  isLoading: boolean;
  isPlanMode: boolean;
  queuedPrompts: QueuedPrompt[];
  queuedPromptsCollapsed: boolean;
  showSummaryHint: boolean;
  isGeneratingSummaryManual: boolean;
  thresholdPercentage: number;
  codexRateLimits: CodexRateLimits | null;
  executionEngineConfig: ExecutionEngineConfig;
  showUsageDashboard: boolean;
  compactStatus: string;
  isCompacting: boolean;
  compactProgress: number;
  deltaMessagesCount: number;
  sessionContinueStatus: string;
  isGeneratingSummary: boolean;
  extractedCode: { code: string; language: string; source?: string } | null;
  costStats: any;
  onSmartSessionUpgrade?: (firstMessage: string) => Promise<{ projectPath: string; title: string } | null>;

  // Callbacks
  onSendPrompt: (prompt: string, model: ModelType, maxThinkingTokens?: number, forceImmediate?: boolean) => Promise<void>;
  onCancelExecution: (options?: { keepQueue?: boolean; processNextInQueue?: boolean }) => Promise<void>;
  onTogglePlanMode: () => void;
  onToggleUsageDashboard: () => void;
  onToggleMCPConfig: () => void;
  onOpenCanvas: () => void;
  onGenerateSummaryManual: () => void;
  onCloseSummaryHint: () => void;
  setQueuedPrompts: React.Dispatch<React.SetStateAction<QueuedPrompt[]>>;
  setQueuedPromptsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setExecutionEngineConfig: React.Dispatch<React.SetStateAction<ExecutionEngineConfig>>;
  getConversationContext: () => string[];
  formatCost: (cost: number) => string }

export const SessionFooter: React.FC<SessionFooterProps> = React.memo(({
  floatingPromptRef,
  projectPath,
  effectiveSession,
  messages,
  isLoading,
  isPlanMode,
  queuedPrompts,
  queuedPromptsCollapsed,
  showSummaryHint,
  isGeneratingSummaryManual,
  thresholdPercentage,
  codexRateLimits,
  executionEngineConfig,
  showUsageDashboard,
  compactStatus,
  isCompacting,
  compactProgress,
  deltaMessagesCount,
  sessionContinueStatus,
  isGeneratingSummary,
  extractedCode,
  costStats,
  onSmartSessionUpgrade,
  onSendPrompt,
  onCancelExecution,
  onTogglePlanMode,
  onToggleUsageDashboard,
  onToggleMCPConfig,
  onOpenCanvas,
  onGenerateSummaryManual,
  onCloseSummaryHint,
  setQueuedPrompts,
  setQueuedPromptsCollapsed,
  setExecutionEngineConfig,
  getConversationContext,
  formatCost,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Queued Prompts */}
      <AnimatePresence>
        {queuedPrompts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-shrink-0 w-full max-w-3xl mx-auto px-4 pb-2"
          >
            <div className="floating-element backdrop-enhanced rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {t('session.queuedPrompts', { count: queuedPrompts.length })}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setQueuedPromptsCollapsed(prev => !prev)}>
                  {queuedPromptsCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>
              {!queuedPromptsCollapsed && queuedPrompts.map((queuedPrompt, index) => (
                <motion.div
                  key={queuedPrompt.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-2 bg-muted/50 rounded-md p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                        {queuedPrompt.model === "opus" ? "Opus" : queuedPrompt.model === "sonnet1m" ? "Sonnet 1M" : "Sonnet"}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 break-words">{queuedPrompt.prompt}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      disabled={index === 0}
                      onClick={() => {
                        setQueuedPrompts(prev => {
                          const newQueue = [...prev];
                          [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
                          return newQueue }) }}
                      title="上移（插队）"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      disabled={index === queuedPrompts.length - 1}
                      onClick={() => {
                        setQueuedPrompts(prev => {
                          const newQueue = [...prev];
                          [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
                          return newQueue }) }}
                      title="下移"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-primary hover:text-primary hover:bg-primary/20"
                    onClick={async () => {
                      const promptToExecute = queuedPrompt;
                      setQueuedPrompts(prev => prev.filter(p => p.id !== promptToExecute.id));
                      if (isLoading) {
                        await onCancelExecution({ keepQueue: true, processNextInQueue: false });
                        await new Promise(resolve => setTimeout(resolve, 200)) }
                      onSendPrompt(promptToExecute.prompt, promptToExecute.model) }}
                    title="立即执行（插队）"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => setQueuedPrompts(prev => prev.filter(p => p.id !== queuedPrompt.id))}
                    title="移除"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <ErrorBoundary>
        {/* Summary Hint Banner */}
        {showSummaryHint && (
          <div className="mx-4 mb-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span>上下文使用率已达 {Math.round(thresholdPercentage * 100)}%，建议生成摘要以便开启新会话</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateSummaryManual}
                disabled={isGeneratingSummaryManual}
                className="h-7 text-xs border-orange-500/50 text-orange-200 hover:bg-orange-500/20"
              >
                {isGeneratingSummaryManual ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3 mr-1" />
                    生成摘要
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCloseSummaryHint}
                className="h-7 w-7 p-0 text-orange-200/50 hover:text-orange-200"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Chat Notification */}
        <ChatNotification />

        {/* Floating Prompt Input */}
        <FloatingPromptInput
          className="flex-shrink-0 transition-[left] duration-300"
          ref={floatingPromptRef}
          onSend={onSendPrompt}
          onCancel={onCancelExecution}
          isLoading={isLoading}
          disabled={!projectPath && !effectiveSession && !onSmartSessionUpgrade}
          projectPath={projectPath}
          sessionId={effectiveSession?.id}
          projectId={effectiveSession?.project_id}
          sessionModel={effectiveSession?.model}
          getConversationContext={getConversationContext}
          messages={messages}
          isPlanMode={isPlanMode}
          onTogglePlanMode={onTogglePlanMode}
          sessionCost={formatCost(costStats.totalCost)}
          sessionStats={costStats}
          hasMessages={messages.length > 0}
          session={effectiveSession || undefined}
          codexRateLimits={codexRateLimits}
          executionEngineConfig={executionEngineConfig}
          onExecutionEngineConfigChange={setExecutionEngineConfig}
          onOpenCanvas={onOpenCanvas}
          hasPreviewableCode={!!extractedCode?.code}
          codeSource={extractedCode?.source}
          onToggleUsageDashboard={onToggleUsageDashboard}
          showUsageDashboard={showUsageDashboard}
          onToggleMCPConfig={onToggleMCPConfig}
          compactStatus={compactStatus}
          isCompacting={isCompacting}
          compactProgress={compactProgress}
          deltaMessagesCount={deltaMessagesCount}
        />

        {/* Compact Status Indicator */}
        <CompactStatusIndicator
          status={compactStatus}
          progress={compactProgress}
          deltaMessagesCount={deltaMessagesCount}
          isCompacting={isCompacting}
          sessionContinueStatus={sessionContinueStatus}
          isGeneratingSummary={isGeneratingSummary}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50"
        />
      </ErrorBoundary>
    </>
  ) });

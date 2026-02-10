import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { SmartRecommendationBar } from "../SmartRecommendationBar";
import { ProjectMCPQuickConfig } from "../ProjectMCPQuickConfig";
import type { ExecutionEngineConfig } from "../FloatingPromptInput/types";

const CanvasFloatingWindow = lazy(() =>
  import("@/components/canvas/CanvasFloatingWindow").then((m) => ({
    default: m.CanvasFloatingWindow,
  }))
);

interface SessionFloatingWindowsProps {
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
  projectPath: string;
  executionEngineConfig: ExecutionEngineConfig;
  onCloseMCPConfig: () => void;
}

export const SessionFloatingWindows: React.FC<SessionFloatingWindowsProps> = React.memo(
  ({
    showCanvas,
    extractedCode,
    onCloseCanvas,
    recommendations,
    onDismissRecommendation,
    onSnoozeRecommendation,
    onClearRecommendations,
    onRefreshMCPStatus,
    showMCPConfig,
    projectPath,
    executionEngineConfig,
    onCloseMCPConfig,
  }) => {
    return (
      <>
        {/* Canvas Preview */}
        {showCanvas && (
          <Suspense
            fallback={
              <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
          >
            <CanvasFloatingWindow
              isOpen={showCanvas}
              onClose={onCloseCanvas}
              extractedCode={extractedCode?.code || ""}
              language={extractedCode?.language || "tsx"}
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
      </>
    );
  }
);

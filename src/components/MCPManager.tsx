import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import { MCPEnginePanel } from "./MCPEnginePanel";
import { ClaudeIcon } from "./icons/ClaudeIcon";
import { CodexIcon } from "./icons/CodexIcon";
import { GeminiIcon } from "./icons/GeminiIcon";

interface MCPManagerProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * 多引擎独立隔离的 MCP 管理器
 *
 * 为 Claude、Codex、Gemini 三个引擎提供完全独立的 MCP 工具管理界面
 * 每个引擎有自己的工具列表，互不干扰
 */
export const MCPManager: React.FC<MCPManagerProps> = ({
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"claude" | "codex" | "gemini">("claude");

  return (
    <div className={`flex flex-col h-full bg-background text-foreground ${className || ""}`}>
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label={t('buttons.back')}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Network className="h-5 w-5 text-blue-500" />
                {t('mcp.servers')} - 多引擎独立管理
              </h2>
              <p className="text-xs text-muted-foreground">
                为每个引擎独立配置 MCP 工具
              </p>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "claude" | "codex" | "gemini")}
            className="space-y-6"
          >
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="claude" className="gap-2">
                <ClaudeIcon className="h-4 w-4" />
                Claude
              </TabsTrigger>
              <TabsTrigger value="codex" className="gap-2">
                <CodexIcon className="h-4 w-4 text-green-600" />
                Codex
              </TabsTrigger>
              <TabsTrigger value="gemini" className="gap-2">
                <GeminiIcon className="h-4 w-4" />
                Gemini
              </TabsTrigger>
            </TabsList>

            {/* Claude Engine Panel */}
            <TabsContent value="claude" className="mt-6">
              <MCPEnginePanel
                engine="claude"
                engineLabel="Claude"
                EngineIcon={ClaudeIcon}
                engineColor="#D97706"
              />
            </TabsContent>

            {/* Codex Engine Panel */}
            <TabsContent value="codex" className="mt-6">
              <MCPEnginePanel
                engine="codex"
                engineLabel="Codex"
                EngineIcon={CodexIcon}
                engineColor="#10B981"
              />
            </TabsContent>

            {/* Gemini Engine Panel */}
            <TabsContent value="gemini" className="mt-6">
              <MCPEnginePanel
                engine="gemini"
                engineLabel="Gemini"
                EngineIcon={GeminiIcon}
                engineColor="#4285F4"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}; 
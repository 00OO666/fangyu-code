import { logger } from '@/lib/logger';
import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Wrench, RefreshCw, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DiagnosticIssue {
  id: string;
  category: string;
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  autoFixable: boolean;
  fixSuggestion?: string;
}

interface TokenCostItem {
  name: string;
  tokens: number;
  status: string;
  suggestion?: string;
}

interface DiagnosticReport {
  generatedAt: string;
  version: string;
  healthStatus: "healthy" | "warning" | "critical";
  issues: DiagnosticIssue[];
  tokenAnalysis: TokenCostItem[];
  totalTokenCost: number;
  claudeVersion?: string;
  configStatus: {
    settingsExists: boolean;
    claudeJsonExists: boolean;
    mcpSynced: boolean;
    hooksSynced: boolean;
    claudeMdLines: number;
  };
}

interface FixResult {
  success: boolean;
  fixedCount: number;
  failedCount: number;
  messages: string[];
}

export const Diagnostics: React.FC = () => {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const result = await invoke<DiagnosticReport>("run_diagnostics");
      setReport(result);
    } catch (error) {
      logger.error('Diagnostics', "诊断失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const fixAllIssues = async () => {
    setFixing(true);
    try {
      const result = await invoke<FixResult>("fix_all_issues");
      alert(`修复完成！成功: ${result.fixedCount}, 失败: ${result.failedCount}`);
      await runDiagnostics(); // 重新诊断
    } catch (error) {
      logger.error('Diagnostics', "修复失败:", error);
    } finally {
      setFixing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "critical":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };

    return (
      <Badge className={variants[severity] || variants.info}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">配置诊断</h1>
            <p className="text-sm text-muted-foreground">
              检查 Fangyu Code 配置健全性、Token消耗优化
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={runDiagnostics}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                诊断中...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                运行诊断
              </>
            )}
          </Button>
          {report && report.issues.some((i) => i.autoFixable) && (
            <Button onClick={fixAllIssues} disabled={fixing}>
              {fixing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  修复中...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  一键修复
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 诊断报告 */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* 总体健康状态 */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(report.healthStatus)}
                <div>
                  <h2 className="text-lg font-semibold">
                    总体状态:{" "}
                    {report.healthStatus === "healthy"
                      ? "健康"
                      : report.healthStatus === "warning"
                      ? "警告"
                      : "严重"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    生成时间: {report.generatedAt}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {report.totalTokenCost}
                </div>
                <div className="text-sm text-muted-foreground">
                  tokens / 对话
                </div>
              </div>
            </div>
          </Card>

          {/* Token 消耗分析 */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Token 消耗分析</h3>
            <div className="space-y-2">
              {report.tokenAnalysis.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    {item.suggestion && (
                      <div className="text-sm text-muted-foreground">
                        {item.suggestion}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      className={
                        item.status === "warning"
                          ? "bg-yellow-100 text-yellow-800"
                          : item.status === "enabled"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {item.status}
                    </Badge>
                    <div className="text-right min-w-[80px]">
                      <div className="font-mono font-semibold">
                        {item.tokens}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        tokens
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 问题列表 */}
          {report.issues.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                发现的问题 ({report.issues.length})
              </h3>
              <div className="space-y-4">
                {report.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getSeverityBadge(issue.severity)}
                          <span className="text-sm text-muted-foreground">
                            {issue.category}
                          </span>
                        </div>
                        <h4 className="font-semibold">{issue.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                          {issue.description}
                        </p>
                        {issue.fixSuggestion && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                            <strong>修复建议:</strong> {issue.fixSuggestion}
                          </div>
                        )}
                      </div>
                      {issue.autoFixable && (
                        <Badge className="bg-green-100 text-green-800">
                          可自动修复
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 配置状态 */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">配置文件状态</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span>settings.json</span>
                {report.configStatus.settingsExists ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span>.claude.json</span>
                {report.configStatus.claudeJsonExists ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span>MCP 配置同步</span>
                {report.configStatus.mcpSynced ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span>CLAUDE.md</span>
                <span className="text-sm text-muted-foreground">
                  {report.configStatus.claudeMdLines} 行
                </span>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* 空状态 */}
      {!report && !loading && (
        <Card className="p-12 text-center">
          <Activity className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">尚未运行诊断</h3>
          <p className="text-muted-foreground mb-4">
            点击"运行诊断"按钮开始检查配置
          </p>
          <Button onClick={runDiagnostics}>
            <Activity className="w-4 h-4 mr-2" />
            运行诊断
          </Button>
        </Card>
      )}
    </div>
  );
};

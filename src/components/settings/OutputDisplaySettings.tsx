/**
 * 输出显示设置组件
 *
 * 控制消息显示的各种选项，让用户能够控制看到哪些内容
 * 🔧 v2.2.6: 新增，解决用户看不到完整大模型输出的问题
 */

import React from "react";
import { Eye, Brain, Wrench, RotateCcw } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOutputDisplaySettings } from "@/hooks/useOutputDisplaySettings";

export const OutputDisplaySettings: React.FC = () => {
  const { settings, toggleSetting, resetSettings } = useOutputDisplaySettings();

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-500" />
          <h4 className="text-sm font-semibold">输出显示设置</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetSettings}
          className="h-7 text-xs gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          重置
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        控制大模型输出的显示方式，让您能看到完整的思考过程和操作细节
      </p>

      <div className="space-y-3">
        {/* 显示所有消息 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="showAllMessages" className="text-sm">显示所有消息</Label>
            <p className="text-[11px] text-muted-foreground">
              显示所有消息，包括系统消息、Warmup 等（覆盖其他过滤规则）
            </p>
          </div>
          <Switch
            id="showAllMessages"
            checked={settings.showAllMessages}
            onCheckedChange={() => toggleSetting('showAllMessages')}
          />
        </div>

        {/* 显示思考过程 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-amber-500" />
              <Label htmlFor="showThinkingProcess" className="text-sm">显示思考过程</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              显示大模型的思考过程（&lt;thinking&gt; 标签内容）
            </p>
          </div>
          <Switch
            id="showThinkingProcess"
            checked={settings.showThinkingProcess}
            onCheckedChange={() => toggleSetting('showThinkingProcess')}
          />
        </div>

        {/* 默认展开思考过程 */}
        <div className="flex items-center justify-between pl-5">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="defaultExpandThinking" className="text-sm">默认展开思考过程</Label>
            <p className="text-[11px] text-muted-foreground">
              思考过程区块默认展开显示（而非折叠）
            </p>
          </div>
          <Switch
            id="defaultExpandThinking"
            checked={settings.defaultExpandThinking}
            onCheckedChange={() => toggleSetting('defaultExpandThinking')}
            disabled={!settings.showThinkingProcess}
          />
        </div>

        {/* 显示工具执行结果 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <div className="flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-blue-500" />
              <Label htmlFor="showToolResults" className="text-sm">显示工具执行结果</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              显示所有工具执行结果，工具调用默认展开
            </p>
          </div>
          <Switch
            id="showToolResults"
            checked={settings.showToolResults}
            onCheckedChange={() => toggleSetting('showToolResults')}
          />
        </div>

        {/* 显示系统消息 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="showSystemMessages" className="text-sm">显示系统消息</Label>
            <p className="text-[11px] text-muted-foreground">
              显示启动警告、MCP 初始化等系统消息
            </p>
          </div>
          <Switch
            id="showSystemMessages"
            checked={settings.showSystemMessages}
            onCheckedChange={() => toggleSetting('showSystemMessages')}
          />
        </div>

        {/* 显示 Warmup 消息 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="showWarmupMessages" className="text-sm">显示 Warmup 消息</Label>
            <p className="text-[11px] text-muted-foreground">
              显示系统预热消息及其回复
            </p>
          </div>
          <Switch
            id="showWarmupMessages"
            checked={settings.showWarmupMessages}
            onCheckedChange={() => toggleSetting('showWarmupMessages')}
          />
        </div>

        {/* 显示自动继续消息 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="showAutoContinueMessages" className="text-sm">显示自动继续消息</Label>
            <p className="text-[11px] text-muted-foreground">
              显示系统自动发送的继续执行消息
            </p>
          </div>
          <Switch
            id="showAutoContinueMessages"
            checked={settings.showAutoContinueMessages}
            onCheckedChange={() => toggleSetting('showAutoContinueMessages')}
          />
        </div>

        {/* 显示调试信息 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="showDebugInfo" className="text-sm">显示调试信息</Label>
            <p className="text-[11px] text-muted-foreground">
              显示额外的调试信息（开发者选项）
            </p>
          </div>
          <Switch
            id="showDebugInfo"
            checked={settings.showDebugInfo}
            onCheckedChange={() => toggleSetting('showDebugInfo')}
          />
        </div>
      </div>
    </Card>
  );
};

export default OutputDisplaySettings;

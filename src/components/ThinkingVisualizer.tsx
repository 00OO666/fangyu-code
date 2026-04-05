/**
 * ThinkingVisualizer - 思考过程可视化组件
 *
 * 功能:
 * - 实时展示 AI 思考过程
 * - 高亮推理步骤
 * - 显示思维导图
 * - 可折叠/展开详细内容
 *
 * 来源: Claude Extended Thinking Visualization
 */

import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Brain from 'lucide-react/dist/esm/icons/brain'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Lightbulb from 'lucide-react/dist/esm/icons/lightbulb'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import Target from 'lucide-react/dist/esm/icons/target'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';

// ============================================================
// 类型定义
// ============================================================

export interface ThinkingStep {
  id: string;
  type: 'analysis' | 'reasoning' | 'conclusion' | 'verification';
  content: string;
  timestamp: number;
  confidence?: number;
}

export interface ThinkingNode {
  id: string;
  label: string;
  type: 'question' | 'observation' | 'hypothesis' | 'conclusion';
  children?: ThinkingNode[];
  confidence?: number;
}

// ============================================================
// 组件
// ============================================================

interface ThinkingVisualizerProps {
  /** 思考内容（Markdown 格式） */
  content: string;
  /** 是否实时流式显示 */
  streaming?: boolean;
  /** 是否显示思维导图 */
  showMindMap?: boolean;
  /** 是否默认折叠 */
  defaultCollapsed?: boolean;
}

export function ThinkingVisualizer({
  content,
  streaming = false,
  showMindMap = false,
  defaultCollapsed = false,
}: ThinkingVisualizerProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [steps, setSteps] = useState<ThinkingStep[]>([]);
  const [currentContent, setCurrentContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 解析思考内容为步骤
  useEffect(() => {
    if (!content) return;

    const lines = content.split('\n');
    const parsedSteps: ThinkingStep[] = [];

    let currentType: ThinkingStep['type'] = 'analysis';
    let stepContent = '';

    lines.forEach((line) => {
      // 检测步骤类型标记
      if (line.match(/^##?\s*(分析|Analysis)/i)) {
        if (stepContent) {
          parsedSteps.push({
            id: `step_${parsedSteps.length}`,
            type: currentType,
            content: stepContent.trim(),
            timestamp: Date.now(),
          });
        }
        currentType = 'analysis';
        stepContent = '';
      } else if (line.match(/^##?\s*(推理|Reasoning)/i)) {
        if (stepContent) {
          parsedSteps.push({
            id: `step_${parsedSteps.length}`,
            type: currentType,
            content: stepContent.trim(),
            timestamp: Date.now(),
          });
        }
        currentType = 'reasoning';
        stepContent = '';
      } else if (line.match(/^##?\s*(结论|Conclusion)/i)) {
        if (stepContent) {
          parsedSteps.push({
            id: `step_${parsedSteps.length}`,
            type: currentType,
            content: stepContent.trim(),
            timestamp: Date.now(),
          });
        }
        currentType = 'conclusion';
        stepContent = '';
      } else if (line.match(/^##?\s*(验证|Verification)/i)) {
        if (stepContent) {
          parsedSteps.push({
            id: `step_${parsedSteps.length}`,
            type: currentType,
            content: stepContent.trim(),
            timestamp: Date.now(),
          });
        }
        currentType = 'verification';
        stepContent = '';
      } else {
        stepContent += line + '\n';
      }
    });

    // 添加最后一个步骤
    if (stepContent) {
      parsedSteps.push({
        id: `step_${parsedSteps.length}`,
        type: currentType,
        content: stepContent.trim(),
        timestamp: Date.now(),
      });
    }

    setSteps(parsedSteps);
  }, [content]);

  // 流式显示效果
  useEffect(() => {
    if (!streaming) {
      setCurrentContent(content);
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      if (index < content.length) {
        setCurrentContent(content.slice(0, index + 1));
        index++;

        // 自动滚动到底部
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
      }
    }, 20); // 每20ms显示一个字符

    return () => clearInterval(interval);
  }, [content, streaming]);

  // 获取步骤图标和颜色
  const getStepIcon = (type: ThinkingStep['type']) => {
    switch (type) {
      case 'analysis':
        return { Icon: Brain, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'reasoning':
        return { Icon: Link2, color: 'text-purple-500', bg: 'bg-purple-500/10' };
      case 'conclusion':
        return { Icon: Target, color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'verification':
        return { Icon: CheckCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' };
    }
  };

  // 获取步骤标签
  const getStepLabel = (type: ThinkingStep['type']): string => {
    switch (type) {
      case 'analysis':
        return '分析';
      case 'reasoning':
        return '推理';
      case 'conclusion':
        return '结论';
      case 'verification':
        return '验证';
    }
  };

  // 高亮关键词
  const highlightContent = (text: string): string => {
    let highlighted = text;

    // 高亮推理关键词
    const reasoningKeywords = [
      '因为',
      '所以',
      '因此',
      '由于',
      '根据',
      '基于',
      '考虑到',
      '综上',
      '总结',
    ];
    reasoningKeywords.forEach((keyword) => {
      highlighted = highlighted.replace(
        new RegExp(keyword, 'g'),
        `<mark class="reasoning">${keyword}</mark>`
      );
    });

    // 高亮步骤编号
    highlighted = highlighted.replace(
      /^(\d+[.)]|[*-])\s+/gm,
      '<span class="step-number">$1</span> '
    );

    return highlighted;
  };

  if (!content) {
    return null;
  }

  return (
    <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden bg-[var(--bg-secondary)]">
      {/* 头部 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
        <Brain className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium">思考过程</span>
        {streaming && (
          <span className="ml-auto flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            实时思考中
          </span>
        )}
      </button>

      {/* 内容区 */}
      {!collapsed && (
        <div className="p-3">
          {/* 步骤视图 */}
          {steps.length > 0 && !showMindMap && (
            <div className="space-y-3 mb-4">
              {steps.map((step, index) => {
                const { Icon, color, bg } = getStepIcon(step.type);
                return (
                  <div key={step.id} className="flex gap-3">
                    {/* 左侧时间线 */}
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded-full ${bg}`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      {index < steps.length - 1 && (
                        <div className="w-px flex-1 bg-[var(--border-primary)] my-1" />
                      )}
                    </div>

                    {/* 右侧内容 */}
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${color}`}>
                          {getStepLabel(step.type)}
                        </span>
                        {step.confidence !== undefined && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            置信度: {Math.round(step.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <div
                        className="text-sm text-[var(--text-secondary)] prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: highlightContent(step.content),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 原始内容视图 */}
          {steps.length === 0 && (
            <ScrollArea className="max-h-96" ref={scrollRef}>
              <div
                className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: highlightContent(streaming ? currentContent : content),
                }}
              />
            </ScrollArea>
          )}

          {/* 关键洞察提示 */}
          {steps.some((s) => s.type === 'conclusion') && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-green-500 mb-1">
                    关键洞察
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {
                      steps.find((s) => s.type === 'conclusion')?.content.split('\n')[0]
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSS 样式 */}
      <style>{`
        .prose mark.reasoning {
          background-color: rgba(168, 85, 247, 0.2);
          color: rgb(168, 85, 247);
          padding: 0 0.25rem;
          border-radius: 0.25rem;
          font-weight: 500;
        }

        .prose .step-number {
          color: rgb(59, 130, 246);
          font-weight: 600;
          margin-right: 0.5rem;
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}

export default ThinkingVisualizer;

import React, { useState } from 'react';
import Code2 from 'lucide-react/dist/esm/icons/code-2'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import TerminalIcon from 'lucide-react/dist/esm/icons/terminal'
import FileCode from 'lucide-react/dist/esm/icons/file-code'
import TestTube from 'lucide-react/dist/esm/icons/test-tube'
import Layout from 'lucide-react/dist/esm/icons/layout'
import Gauge from 'lucide-react/dist/esm/icons/gauge'
import Puzzle from 'lucide-react/dist/esm/icons/puzzle'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { Terminal } from '@/components/Terminal/Terminal';
import { DiffPreview } from '@/components/Diff/DiffPreview';

interface V3FeaturesCenterProps {
  onBack?: () => void;
}

type FeatureView = 'home' | 'lsp' | 'diff' | 'terminal' | 'snippets' | 'git' | 'test' | 'template' | 'profiler' | 'plugin';

const features = [
  {
    id: 'lsp' as FeatureView,
    icon: Code2,
    title: 'LSP 功能可视化',
    description: '代码智能提示、跳转定义、查找引用、重命名符号',
    color: 'text-blue-500',
  },
  {
    id: 'diff' as FeatureView,
    icon: GitBranch,
    title: 'Diff 预览器',
    description: '可视化代码差异，接受/拒绝修改',
    color: 'text-green-500',
  },
  {
    id: 'terminal' as FeatureView,
    icon: TerminalIcon,
    title: '内置终端',
    description: '集成终端，支持 AI 助手命令执行',
    color: 'text-purple-500',
  },
  {
    id: 'snippets' as FeatureView,
    icon: FileCode,
    title: '代码片段库',
    description: '管理和使用代码片段，按语言分类',
    color: 'text-orange-500',
  },
  {
    id: 'git' as FeatureView,
    icon: GitBranch,
    title: 'Git 可视化',
    description: 'Git 状态、提交历史、分支管理',
    color: 'text-red-500',
  },
  {
    id: 'test' as FeatureView,
    icon: TestTube,
    title: '测试集成',
    description: '运行测试、查看覆盖率、调试支持',
    color: 'text-cyan-500',
  },
  {
    id: 'template' as FeatureView,
    icon: Layout,
    title: '项目模板市场',
    description: '项目模板管理和生成',
    color: 'text-pink-500',
  },
  {
    id: 'profiler' as FeatureView,
    icon: Gauge,
    title: '性能分析器',
    description: '性能监控、计时器、内存统计',
    color: 'text-yellow-500',
  },
  {
    id: 'plugin' as FeatureView,
    icon: Puzzle,
    title: '插件系统',
    description: '插件管理、钩子系统、配置管理',
    color: 'text-indigo-500',
  },
];

export const V3FeaturesCenter: React.FC<V3FeaturesCenterProps> = ({ onBack }) => {
  const [currentView, setCurrentView] = useState<FeatureView>('home');

  const renderFeatureContent = () => {
    switch (currentView) {
      case 'lsp':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView('home')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <h2 className="text-xl font-bold">LSP 功能可视化</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                initialValue="// 在这里编写代码，体验 LSP 功能\n// Ctrl+F12: 跳转到定义\n// Shift+F12: 查找引用\n// F2: 重命名符号\n\nfunction hello(name: string) {\n  return `Hello, ${name}!`;\n}\n\nconst result = hello('World');"
                language="typescript"
                onSave={(content) => console.log('Saved:', content)}
              />
            </div>
          </div>
        );

      case 'diff':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView('home')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <h2 className="text-xl font-bold">Diff 预览器</h2>
            </div>
            <div className="flex-1 overflow-auto">
              <DiffPreview
                diff={`--- a/example.ts
+++ b/example.ts
@@ -1,5 +1,5 @@
 function hello(name: string) {
-  return \`Hello, \${name}!\`;
+  return \`Hi, \${name}!\`;
 }

-const result = hello('World');
+const result = hello('Fangyu');`}
                onAccept={() => console.log('Accepted')}
                onReject={() => console.log('Rejected')}
              />
            </div>
          </div>
        );

      case 'terminal':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView('home')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <h2 className="text-xl font-bold">内置终端</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <Terminal />
            </div>
          </div>
        );

      case 'snippets':
      case 'git':
      case 'test':
      case 'template':
      case 'profiler':
      case 'plugin':
        {
          const featureInfo = features.find(f => f.id === currentView);
          return (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4 p-4">
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('home')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回
                </Button>
                <h2 className="text-xl font-bold">{featureInfo?.title}</h2>
              </div>
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  {featureInfo && <featureInfo.icon className={`w-24 h-24 mx-auto mb-6 ${featureInfo.color}`} />}
                  <h3 className="text-2xl font-bold mb-4">{featureInfo?.title}</h3>
                  <p className="text-muted-foreground mb-6">{featureInfo?.description}</p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      🚧 功能开发中
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      此功能正在积极开发中，敬请期待后续版本更新
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

      case 'home':
      default:
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Fangyu Code v3.0 功能中心</h1>
              <p className="text-muted-foreground">
                探索所有新功能，点击卡片查看详情和演示
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setCurrentView(feature.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Icon className={`w-8 h-8 ${feature.color}`} />
                        <CardTitle>{feature.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">📝 使用说明</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 点击任意功能卡片查看详细演示</li>
                <li>• ✅ 已实现：LSP 功能、Diff 预览器、内置终端</li>
                <li>• 🚧 开发中：代码片段库、Git 可视化、测试集成、项目模板、性能分析器、插件系统</li>
                <li>• 快捷键：Ctrl+0 快速打开此页面</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {onBack && currentView === 'home' && (
        <div className="p-4 border-b">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {renderFeatureContent()}
      </div>
    </div>
  );
};

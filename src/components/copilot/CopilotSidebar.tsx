/**
 * CopilotSidebar - AI 助手侧边栏
 *
 * 功能：
 * 1. 智能代码建议
 * 2. 上下文感知对话
 * 3. 代码解释和文档生成
 * 4. 快速操作（重构、优化、测试）
 * 5. 历史记录
 * 6. 快捷命令（斜杠命令）
 */

import { logger } from '@/lib/logger';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Send from 'lucide-react/dist/esm/icons/send'
import History from 'lucide-react/dist/esm/icons/history'
import Code from 'lucide-react/dist/esm/icons/code'
import FileCode from 'lucide-react/dist/esm/icons/file-code'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
import TestTube from 'lucide-react/dist/esm/icons/test-tube'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import X from 'lucide-react/dist/esm/icons/x'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Check from 'lucide-react/dist/esm/icons/check'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import BookOpen from 'lucide-react/dist/esm/icons/book-open'
import Bug from 'lucide-react/dist/esm/icons/bug'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import User from 'lucide-react/dist/esm/icons/user'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2'
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2'
import Pin from 'lucide-react/dist/esm/icons/pin'
import PinOff from 'lucide-react/dist/esm/icons/pin-off';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================
// 类型定义
// ============================================

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  codeBlocks?: {
    language: string;
    code: string;
  }[];
  suggestions?: QuickAction[];
}

export interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  command: string;
}

export interface CopilotContext {
  filePath?: string;
  selectedCode?: string;
  language?: string;
  cursorPosition?: { line: number; column: number };
}

export interface CopilotSidebarProps {
  /** 当前上下文 */
  context?: CopilotContext;
  /** 是否打开 */
  isOpen?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 发送消息回调 */
  onSend?: (message: string, context?: CopilotContext) => void;
  /** 应用代码回调 */
  onApplyCode?: (code: string, language: string) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 预定义的快捷命令
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'explain',
    icon: <BookOpen className="w-4 h-4" />,
    label: '解释代码',
    description: '解释选中代码的功能和逻辑',
    command: '/explain'
  },
  {
    id: 'refactor',
    icon: <Wand2 className="w-4 h-4" />,
    label: '重构优化',
    description: '优化代码结构和可读性',
    command: '/refactor'
  },
  {
    id: 'test',
    icon: <TestTube className="w-4 h-4" />,
    label: '生成测试',
    description: '为选中代码生成单元测试',
    command: '/test'
  },
  {
    id: 'fix',
    icon: <Bug className="w-4 h-4" />,
    label: '修复问题',
    description: '分析并修复代码问题',
    command: '/fix'
  },
  {
    id: 'docs',
    icon: <FileText className="w-4 h-4" />,
    label: '生成文档',
    description: '生成代码注释和文档',
    command: '/docs'
  },
  {
    id: 'optimize',
    icon: <Zap className="w-4 h-4" />,
    label: '性能优化',
    description: '分析并优化性能瓶颈',
    command: '/optimize'
  }
];

const SLASH_COMMANDS = [
  { command: '/explain', description: '解释代码' },
  { command: '/refactor', description: '重构代码' },
  { command: '/test', description: '生成测试' },
  { command: '/fix', description: '修复问题' },
  { command: '/docs', description: '生成文档' },
  { command: '/optimize', description: '性能优化' },
  { command: '/review', description: '代码审查' },
  { command: '/convert', description: '转换语言' },
  { command: '/simplify', description: '简化代码' },
  { command: '/secure', description: '安全检查' }
];

// ============================================
// 消息组件
// ============================================

interface MessageBubbleProps {
  message: CopilotMessage;
  onApplyCode?: (code: string, language: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onApplyCode }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 p-3 rounded-lg',
        isUser ? 'bg-primary/5' : 'bg-muted/30'
      )}
    >
      {/* 头像 */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* 内容 */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* 文本内容 */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* 代码块 */}
        {message.codeBlocks?.map((block, index) => (
          <div key={index} className="relative group">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted rounded-t-lg border border-b-0">
              <Badge variant="outline" className="text-[10px]">
                {block.language}
              </Badge>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => handleCopy(block.code, `${message.id}-${index}`)}
                >
                  {copiedId === `${message.id}-${index}` ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
                {onApplyCode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => onApplyCode(block.code, block.language)}
                  >
                    <FileCode className="w-3 h-3 mr-1" />
                    应用
                  </Button>
                )}
              </div>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-b-lg border overflow-x-auto text-xs font-mono">
              <code>{block.code}</code>
            </pre>
          </div>
        ))}

        {/* 建议操作 */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {message.suggestions.map(action => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
              >
                {action.icon}
                <span className="ml-1">{action.label}</span>
              </Button>
            ))}
          </div>
        )}

        {/* 时间戳 */}
        <div className="text-[10px] text-muted-foreground">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// 主组件
// ============================================

export const CopilotSidebar: React.FC<CopilotSidebarProps> = ({
  context,
  isOpen = true,
  onClose,
  onSend,
  onApplyCode,
  className
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [isPinned, setIsPinned] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 处理输入变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // 检测斜杠命令
    if (value.startsWith('/')) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  }, []);

  // 过滤匹配的命令
  const filteredCommands = useMemo(() => {
    if (!inputValue.startsWith('/')) return [];
    const query = inputValue.slice(1).toLowerCase();
    return SLASH_COMMANDS.filter(cmd =>
      cmd.command.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query)
    );
  }, [inputValue]);

  // 选择命令
  const selectCommand = useCallback((command: string) => {
    setInputValue(command + ' ');
    setShowCommands(false);
    inputRef.current?.focus();
  }, []);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // 调用外部发送回调
    onSend?.(userMessage.content, context);

    // 模拟 AI 响应
    await new Promise(resolve => setTimeout(resolve, 1500));

    const aiMessage: CopilotMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '这是一个模拟的 AI 响应。在实际实现中，这里会调用 Claude API 生成真实的回复。',
      timestamp: new Date(),
      codeBlocks: inputValue.includes('/') ? [
        {
          language: 'typescript',
          code: `// 示例代码\nfunction example() {\n  logger.debug('CopilotSidebar', 'Hello, World!');\n}`
        }
      ] : undefined,
      suggestions: [
        QUICK_ACTIONS[0],
        QUICK_ACTIONS[1]
      ]
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  }, [inputValue, isLoading, context, onSend]);

  // 快捷键处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === 'Escape') {
      setShowCommands(false);
    }
  }, [handleSend]);

  // 清空对话
  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  // 快捷操作点击
  const handleQuickAction = useCallback((action: QuickAction) => {
    setInputValue(action.command + ' ');
    inputRef.current?.focus();
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className={cn(
        'flex flex-col h-full bg-background border-l',
        isExpanded ? 'w-[500px]' : 'w-[360px]',
        className
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Copilot</h3>
            <p className="text-[10px] text-muted-foreground">智能编程助手</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsPinned(!isPinned)}
                >
                  {isPinned ? (
                    <PinOff className="w-4 h-4" />
                  ) : (
                    <Pin className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPinned ? '取消固定' : '固定'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isExpanded ? '收起' : '展开'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 h-9 mx-2 mt-2">
          <TabsTrigger value="chat" className="text-xs">
            <MessageSquare className="w-3 h-3 mr-1" />
            对话
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />
            快捷
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <History className="w-3 h-3 mr-1" />
            历史
          </TabsTrigger>
        </TabsList>

        {/* 对话标签 */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0">
          {/* 上下文信息 */}
          {context?.filePath && (
            <div className="px-3 py-2 bg-muted/30 border-b text-xs">
              <div className="flex items-center gap-2">
                <FileCode className="w-3 h-3 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {context.filePath.split(/[/\\]/).pop()}
                </span>
                {context.selectedCode && (
                  <Badge variant="outline" className="text-[10px]">
                    已选中代码
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* 消息列表 */}
          <ScrollArea className="flex-1 p-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                </div>
                <h4 className="font-medium mb-2">开始对话</h4>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  输入问题或使用 / 命令来获取代码帮助
                </p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {QUICK_ACTIONS.slice(0, 3).map(action => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleQuickAction(action)}
                    >
                      {action.icon}
                      <span className="ml-1">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(message => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onApplyCode={onApplyCode}
                  />
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 正在思考...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* 输入区域 */}
          <div className="p-3 border-t bg-muted/20">
            {/* 斜杠命令提示 */}
            <AnimatePresence>
              {showCommands && filteredCommands.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-2 p-2 bg-background border rounded-lg shadow-lg"
                >
                  {filteredCommands.map(cmd => (
                    <button
                      key={cmd.command}
                      className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded text-left"
                      onClick={() => selectCommand(cmd.command)}
                    >
                      <Code className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{cmd.command}</span>
                      <span className="text-xs text-muted-foreground">{cmd.description}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="输入问题或使用 / 命令..."
                className="min-h-[60px] max-h-[150px] resize-none text-sm"
                rows={2}
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  className="h-8 px-3"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    onClick={handleClear}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 快捷操作标签 */}
        <TabsContent value="actions" className="flex-1 m-0 p-3">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground px-1">快捷操作</h4>
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.id}
                className="flex items-center gap-3 w-full p-3 hover:bg-muted rounded-lg text-left transition-colors"
                onClick={() => handleQuickAction(action)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {action.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {action.command}
                </Badge>
              </button>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground px-1">所有命令</h4>
            <div className="grid grid-cols-2 gap-2">
              {SLASH_COMMANDS.map(cmd => (
                <button
                  key={cmd.command}
                  className="p-2 text-left hover:bg-muted rounded text-xs"
                  onClick={() => selectCommand(cmd.command)}
                >
                  <span className="font-mono text-primary">{cmd.command}</span>
                  <br />
                  <span className="text-muted-foreground">{cmd.description}</span>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 历史标签 */}
        <TabsContent value="history" className="flex-1 m-0 p-3">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <History className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h4 className="font-medium mb-2">对话历史</h4>
            <p className="text-xs text-muted-foreground">
              历史对话记录将显示在这里
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default CopilotSidebar;

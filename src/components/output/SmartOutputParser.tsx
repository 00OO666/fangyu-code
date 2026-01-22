/**
 * SmartOutputParser - 智能输出解析器
 *
 * 自动识别并美化各种命令输出格式：
 * - JSON 数据
 * - 表格数据
 * - Git 日志
 * - npm 依赖树
 * - 进程列表
 * - 测试结果
 * - ANSI 彩色输出
 */

import React, { useMemo } from 'react';
import FileJson from 'lucide-react/dist/esm/icons/file-json'
import Table from 'lucide-react/dist/esm/icons/table'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import Activity from 'lucide-react/dist/esm/icons/activity'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Terminal from 'lucide-react/dist/esm/icons/terminal';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ANSI 颜色转换
import Anser from 'anser';

// ============================================
// 类型定义
// ============================================

export type OutputType =
  | 'json'
  | 'table'
  | 'git-log'
  | 'dependency-tree'
  | 'process-list'
  | 'test-result'
  | 'ansi'
  | 'text';

export interface SmartOutputParserProps {
  /** 命令输出内容 */
  output: string;
  /** 执行的命令（用于类型推断） */
  command?: string;
  /** 强制指定类型 */
  type?: OutputType;
  /** 是否显示原始输出切换 */
  showRawToggle?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface ParsedOutput {
  type: OutputType;
  data: any;
  raw: string;
}

// ============================================
// 检测和解析函数
// ============================================

/**
 * 检测 JSON
 */
const isJSON = (str: string): boolean => {
  try {
    JSON.parse(str.trim());
    return true;
  } catch {
    return false;
  }
};

/**
 * 检测表格（空格或tab分隔）
 */
const isTable = (str: string): boolean => {
  const lines = str.trim().split('\n');
  if (lines.length < 2) return false;

  // 检查是否所有行都有相似的列数
  const firstLineCols = lines[0].split(/\s{2,}|\t/).length;
  return lines.slice(1).every(line => {
    const cols = line.split(/\s{2,}|\t/).length;
    return Math.abs(cols - firstLineCols) <= 1;
  });
};

/**
 * 检测 Git 日志
 */
const isGitLog = (str: string, command?: string): boolean => {
  if (command?.includes('git log') || command?.includes('git reflog')) {
    return true;
  }
  return /^commit\s+[0-9a-f]{7,40}/m.test(str) || /^[0-9a-f]{7,40}\s+/m.test(str);
};

/**
 * 检测 npm/yarn 依赖树
 */
const isDependencyTree = (str: string, command?: string): boolean => {
  if (command?.includes('npm list') || command?.includes('yarn list')) {
    return true;
  }
  return /[├└─│]\s+[\w@\/]/.test(str);
};

/**
 * 检测进程列表
 */
const isProcessList = (str: string, command?: string): boolean => {
  if (command?.includes('ps ') || command?.includes('tasklist')) {
    return true;
  }
  return /PID.*CMD/i.test(str) || /Image Name.*PID/i.test(str);
};

/**
 * 检测测试结果
 */
const isTestResult = (str: string, command?: string): boolean => {
  const testCommands = ['npm test', 'npm run test', 'jest', 'vitest', 'pytest', 'cargo test'];
  if (command && testCommands.some(cmd => command.includes(cmd))) {
    return true;
  }
  return /(PASS|FAIL|Test Suites|Tests:|✓|✗)/i.test(str);
};

/**
 * 检测 ANSI 颜色代码
 */
const hasANSI = (str: string): boolean => {
  return /\x1b\[[0-9;]*m/.test(str);
};

/**
 * 解析 JSON
 */
const parseJSON = (str: string): any => {
  try {
    return JSON.parse(str.trim());
  } catch {
    return null;
  }
};

/**
 * 解析表格
 */
const parseTable = (str: string): { headers: string[]; rows: string[][] } => {
  const lines = str.trim().split('\n');
  const headers = lines[0].split(/\s{2,}|\t/).map(h => h.trim());
  const rows = lines.slice(1).map(line =>
    line.split(/\s{2,}|\t/).map(cell => cell.trim())
  );
  return { headers, rows };
};

/**
 * 解析 Git 日志
 */
const parseGitLog = (str: string): Array<{
  hash: string;
  author?: string;
  date?: string;
  message: string;
}> => {
  const commits: any[] = [];
  const commitPattern = /^commit\s+([0-9a-f]{7,40})/gm;
  const matches = [...str.matchAll(commitPattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];
    const commitText = nextMatch
      ? str.slice(match.index!, nextMatch.index!)
      : str.slice(match.index!);

    const hash = match[1].slice(0, 7);
    const authorMatch = commitText.match(/Author:\s+(.+)/);
    const dateMatch = commitText.match(/Date:\s+(.+)/);
    const messageMatch = commitText.match(/\n\s+(.+)/);

    commits.push({
      hash,
      author: authorMatch?.[1],
      date: dateMatch?.[1],
      message: messageMatch?.[1] || '(no message)'
    });
  }

  return commits.length > 0 ? commits : [{ hash: 'N/A', message: str }];
};

/**
 * 解析测试结果
 */
const parseTestResult = (str: string): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  tests: Array<{ name: string; status: 'pass' | 'fail' | 'skip' }>;
} => {
  const result = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [] as any[]
  };

  // Jest/Vitest 格式
  const passMatch = str.match(/(\d+) passed/i);
  const failMatch = str.match(/(\d+) failed/i);
  const skipMatch = str.match(/(\d+) skipped/i);

  if (passMatch) result.passed = parseInt(passMatch[1]);
  if (failMatch) result.failed = parseInt(failMatch[1]);
  if (skipMatch) result.skipped = parseInt(skipMatch[1]);

  result.total = result.passed + result.failed + result.skipped;

  // 提取测试用例
  const testLines = str.split('\n').filter(line =>
    /[✓✗]/.test(line) || /PASS|FAIL/i.test(line)
  );

  result.tests = testLines.slice(0, 20).map(line => ({
    name: line.replace(/[✓✗]/g, '').trim(),
    status: (/✓|PASS/i.test(line) ? 'pass' : /✗|FAIL/i.test(line) ? 'fail' : 'skip') as any
  }));

  return result;
};

// ============================================
// 渲染组件
// ============================================

/**
 * JSON 查看器
 */
const JSONViewer: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileJson className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium">JSON 数据</span>
      </div>
      <ScrollArea className="h-[400px]">
        <pre className="text-xs font-mono bg-muted/50 p-3 rounded-lg overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
};

/**
 * 表格查看器
 */
const TableViewer: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Table className="w-4 h-4 text-green-500" />
        <span className="text-sm font-medium">表格数据</span>
        <Badge variant="outline" className="text-xs">{rows.length} 行</Badge>
      </div>
      <ScrollArea className="h-[400px]">
        <UITable>
          <TableHeader>
            <TableRow>
              {headers.map((header, i) => (
                <TableHead key={i} className="font-mono text-xs">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j} className="font-mono text-xs">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </UITable>
      </ScrollArea>
    </div>
  );
};

/**
 * Git 日志查看器
 */
const GitLogViewer: React.FC<{ commits: any[] }> = ({ commits }) => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium">Git 提交历史</span>
        <Badge variant="outline" className="text-xs">{commits.length} 个提交</Badge>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {commits.map((commit, i) => (
            <div key={i} className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-xs font-mono bg-primary/10 px-2 py-0.5 rounded">
                  {commit.hash}
                </code>
                {commit.author && (
                  <span className="text-xs text-muted-foreground">{commit.author}</span>
                )}
              </div>
              <p className="text-sm">{commit.message}</p>
              {commit.date && (
                <p className="text-xs text-muted-foreground mt-1">{commit.date}</p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * 测试结果查看器
 */
const TestResultViewer: React.FC<{ result: any }> = ({ result }) => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-medium">测试结果</span>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-2xl font-bold">{result.total}</div>
          <div className="text-xs text-muted-foreground">总计</div>
        </div>
        <div className="p-3 bg-green-500/10 rounded-lg text-center border border-green-300">
          <div className="text-2xl font-bold text-green-600">{result.passed}</div>
          <div className="text-xs text-muted-foreground">通过</div>
        </div>
        <div className="p-3 bg-red-500/10 rounded-lg text-center border border-red-300">
          <div className="text-2xl font-bold text-red-600">{result.failed}</div>
          <div className="text-xs text-muted-foreground">失败</div>
        </div>
        <div className="p-3 bg-yellow-500/10 rounded-lg text-center border border-yellow-300">
          <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
          <div className="text-xs text-muted-foreground">跳过</div>
        </div>
      </div>

      {/* 测试列表 */}
      {result.tests.length > 0 && (
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {result.tests.map((test: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                {test.status === 'pass' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                {test.status === 'fail' && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                <span className="flex-1 truncate">{test.name}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

/**
 * ANSI 输出查看器
 */
const ANSIViewer: React.FC<{ text: string }> = ({ text }) => {
  const html = useMemo(() => {
    return Anser.ansiToHtml(text, { use_classes: true });
  }, [text]);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-4 h-4 text-cyan-500" />
        <span className="text-sm font-medium">终端输出</span>
      </div>
      <ScrollArea className="h-[400px]">
        <pre
          className="text-xs font-mono bg-black text-green-400 p-3 rounded-lg overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ScrollArea>
    </div>
  );
};

/**
 * 纯文本查看器
 */
const TextViewer: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="p-4">
      <ScrollArea className="h-[400px]">
        <pre className="text-xs font-mono bg-muted/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
          {text}
        </pre>
      </ScrollArea>
    </div>
  );
};

// ============================================
// 主组件
// ============================================

export const SmartOutputParser: React.FC<SmartOutputParserProps> = ({
  output,
  command,
  type: propType,
  showRawToggle = true,
  className
}) => {
  const [showRaw, setShowRaw] = React.useState(false);

  // 解析输出
  const parsed: ParsedOutput = useMemo(() => {
    if (propType) {
      // 强制类型
      let data: any;
      switch (propType) {
        case 'json':
          data = parseJSON(output);
          break;
        case 'table':
          data = parseTable(output);
          break;
        case 'git-log':
          data = parseGitLog(output);
          break;
        case 'test-result':
          data = parseTestResult(output);
          break;
        default:
          data = output;
      }
      return { type: propType, data, raw: output };
    }

    // 自动检测
    if (isJSON(output)) {
      return { type: 'json', data: parseJSON(output), raw: output };
    }

    if (isTestResult(output, command)) {
      return { type: 'test-result', data: parseTestResult(output), raw: output };
    }

    if (isGitLog(output, command)) {
      return { type: 'git-log', data: parseGitLog(output), raw: output };
    }

    if (isDependencyTree(output, command)) {
      return { type: 'dependency-tree', data: output, raw: output };
    }

    if (isProcessList(output, command)) {
      return { type: 'process-list', data: output, raw: output };
    }

    if (isTable(output)) {
      return { type: 'table', data: parseTable(output), raw: output };
    }

    if (hasANSI(output)) {
      return { type: 'ansi', data: output, raw: output };
    }

    return { type: 'text', data: output, raw: output };
  }, [output, command, propType]);

  return (
    <div className={cn('bg-background border rounded-lg overflow-hidden', className)}>
      {/* 工具栏 */}
      {showRawToggle && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {parsed.type === 'json' && 'JSON'}
              {parsed.type === 'table' && '表格'}
              {parsed.type === 'git-log' && 'Git 日志'}
              {parsed.type === 'test-result' && '测试结果'}
              {parsed.type === 'ansi' && 'ANSI'}
              {parsed.type === 'text' && '文本'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? '智能视图' : '原始输出'}
          </Button>
        </div>
      )}

      {/* 内容 */}
      {showRaw ? (
        <TextViewer text={parsed.raw} />
      ) : (
        <>
          {parsed.type === 'json' && <JSONViewer data={parsed.data} />}
          {parsed.type === 'table' && <TableViewer {...parsed.data} />}
          {parsed.type === 'git-log' && <GitLogViewer commits={parsed.data} />}
          {parsed.type === 'test-result' && <TestResultViewer result={parsed.data} />}
          {parsed.type === 'ansi' && <ANSIViewer text={parsed.data} />}
          {(parsed.type === 'text' || parsed.type === 'dependency-tree' || parsed.type === 'process-list') && (
            <TextViewer text={parsed.data} />
          )}
        </>
      )}
    </div>
  );
};

export default SmartOutputParser;

/**
 * ✨ 版本更新公告组件
 *
 * 功能：
 * - 检测版本升级，首次打开时显示更新日志
 * - 支持多版本更新日志
 * - 用户点击"知道了"后不再显示
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const CURRENT_VERSION = '1.2.6';
const STORAGE_KEY = 'last_seen_version';

interface UpdateLog {
  version: string;
  date: string;
  title: string;
  changes: {
    type: 'new' | 'fix' | 'improve' | 'break';
    label: string;
    description: string;
  }[];
}

const UPDATE_LOGS: UpdateLog[] = [
  {
    version: '1.2.6',
    date: '2025-12-30',
    title: '修复费用统计 Bug + F12 开发者工具',
    changes: [
      {
        type: 'fix',
        label: '修复费用计算',
        description: '修复聊天界面蓝色费用显示总是显示整个会话总费用的 Bug，现在正确显示当前指令的消耗',
      },
      {
        type: 'fix',
        label: '修复每小时统计',
        description: '修复每小时消耗统计显示异常高额费用的 Bug（会重复累加整个会话费用），现在只记录真实的增量消耗',
      },
      {
        type: 'new',
        label: 'F12 开发者工具',
        description: '新增 F12 快捷键，可以打开浏览器开发者控制台，方便查看所有报错和调试信息',
      },
      {
        type: 'improve',
        label: '数据迁移',
        description: '自动清理旧版本损坏的小时统计数据，确保数据准确性',
      },
    ],
  },
];

export function UpdateAnnouncement() {
  const [open, setOpen] = useState(false);
  const [currentUpdate, setCurrentUpdate] = useState<UpdateLog | null>(null);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(STORAGE_KEY);

    // 如果从未见过版本号，或版本号不同，显示更新公告
    if (!lastSeenVersion || lastSeenVersion !== CURRENT_VERSION) {
      const latestUpdate = UPDATE_LOGS[0]; // 最新版本
      setCurrentUpdate(latestUpdate);
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    // 标记已查看当前版本
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setOpen(false);
  };

  if (!currentUpdate) return null;

  const getTypeColor = (type: UpdateLog['changes'][0]['type']) => {
    switch (type) {
      case 'new':
        return 'text-green-500';
      case 'fix':
        return 'text-blue-500';
      case 'improve':
        return 'text-purple-500';
      case 'break':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getTypeLabel = (type: UpdateLog['changes'][0]['type']) => {
    switch (type) {
      case 'new':
        return '新功能';
      case 'fix':
        return 'Bug修复';
      case 'improve':
        return '优化';
      case 'break':
        return '破坏性变更';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            🎉 Fangyu Code 已更新到 v{currentUpdate.version}
          </DialogTitle>
          <DialogDescription>
            {currentUpdate.date} · {currentUpdate.title}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {currentUpdate.changes.map((change, index) => (
              <div
                key={index}
                className="border-l-2 border-gray-700 pl-4 py-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${getTypeColor(change.type)}`}
                  >
                    {getTypeLabel(change.type)}
                  </span>
                  <span className="font-medium text-sm">{change.label}</span>
                </div>
                <p className="text-sm text-gray-400">{change.description}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

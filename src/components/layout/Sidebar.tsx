import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderOpen,
  Settings,
  BarChart2,
  Terminal,
  Layers,
  FileText,
  Package,
  FileCode,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Puzzle,
  Zap,
  GripVertical,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { View } from '@/types/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UnifiedEngineStatus } from '@/components/UnifiedEngineStatus';
import { UpdateBadge } from '@/components/common/UpdateBadge';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  className?: string;
  onAboutClick?: () => void;
  onUpdateClick?: () => void;
}

interface NavItem {
  view: View;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
}

const STORAGE_KEY_EXPANDED = 'sidebar_expanded';
const STORAGE_KEY_WIDTH = 'sidebar_width';
const MIN_WIDTH = 180; // 最小宽度 180px
const MAX_WIDTH = 320; // 最大宽度 320px
const DEFAULT_WIDTH = 220; // 默认宽度 220px

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  className,
  onAboutClick,
  onUpdateClick
}) => {
  const { t } = useTranslation();

  // 展开/收起状态，默认展开
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_EXPANDED);
    return stored !== null ? stored === 'true' : true;
  });

  // 侧边栏宽度，从 localStorage 读取
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH);
    return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
  });

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 持久化展开状态到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXPANDED, String(isExpanded));
  }, [isExpanded]);

  // 持久化宽度到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WIDTH, String(width));
  }, [width]);

  // 处理拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newWidth = e.clientX;
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setWidth(newWidth);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const mainNavItems: NavItem[] = [
    { view: 'projects', icon: FolderOpen, label: t('common.ccProjectsTitle') },
    { view: 'claude-tab-manager', icon: Terminal, label: t('sidebar.sessionManagement') },
    { view: 'editor', icon: FileText, label: t('sidebar.claudePrompts') },
    { view: 'codex-editor', icon: FileCode, label: t('sidebar.codexPrompts') },
    { view: 'gemini-editor', icon: Sparkles, label: t('sidebar.geminiPrompts') },
    { view: 'usage-dashboard', icon: BarChart2, label: t('sidebar.usageStats') },
    { view: 'diagnostics', icon: Activity, label: '配置诊断' },
    { view: 'mcp', icon: Layers, label: t('sidebar.mcpTools') },
    { view: 'claude-extensions', icon: Package, label: t('sidebar.extensions') },
    { view: 'hook-manager', icon: Zap, label: 'Hook 管理' },
    { view: 'plugins', icon: Puzzle, label: '插件系统' },
    // "新功能" 已移至 AboutDialog（版本更新页面）
  ];

  const bottomNavItems: NavItem[] = [
    { view: 'settings', icon: Settings, label: t('navigation.settings') },
  ];

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = currentView === item.view;

    const buttonContent = (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "rounded-lg mb-1 transition-all duration-200",
          isExpanded ? "w-full justify-start px-2.5 h-9" : "w-9 h-9",
          isActive
            ? "bg-primary/15 text-primary hover:bg-primary/20 shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        onClick={() => onNavigate(item.view)}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
        {isExpanded && (
          <span className="ml-2.5 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            {item.label}
          </span>
        )}
        {!isExpanded && <span className="sr-only">{item.label}</span>}
      </Button>
    );

    // 收起模式显示 Tooltip
    if (!isExpanded) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2 px-3 py-1.5">
              <span className="font-medium">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-muted-foreground bg-muted px-1 rounded border">
                  {item.shortcut}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return buttonContent;
  };

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "relative flex flex-col py-3 h-full transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
        "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border-r border-[var(--glass-border)]",
        isExpanded ? "px-2.5" : "items-center",
        className
      )}
      style={{
        width: isExpanded ? `${width}px` : '56px',
      }}
    >
      {/* Logo 区域 (Removed) */}
      
      {/* 主导航区域 */}
      <div className={cn("flex-1 flex flex-col w-full", isExpanded ? "space-y-1" : "items-center space-y-2")}>
        {mainNavItems.map((item) => (
          <NavButton key={item.view} item={item} />
        ))}
      </div>

      {/* 底部状态区域 */}
      <div className={cn(
        "flex flex-col w-full mt-auto pt-2.5 border-t border-[var(--glass-border)]",
        isExpanded ? "space-y-2" : "items-center"
      )}>
        {/* 多引擎状态指示器 */}
        <div className={cn(isExpanded ? "w-full" : "flex justify-center w-full")}>
          <UnifiedEngineStatus
            compact={!isExpanded}
          />
        </div>

        {/* 更新徽章（展开模式） */}
        {isExpanded && (
          <div className="px-1">
            <UpdateBadge onClick={onUpdateClick} />
          </div>
        )}

        {/* 操作按钮行 */}
        <div className={cn(
          "flex items-center gap-0.5",
          isExpanded ? "justify-around px-1" : "flex-col"
        )}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <ThemeToggle size="sm" className="w-7 h-7" />
                </div>
              </TooltipTrigger>
              {!isExpanded && (
                <TooltipContent side="right">
                  <p>{t('sidebar.themeToggle')}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {onAboutClick && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onAboutClick}
                    className="w-7 h-7 text-muted-foreground hover:text-foreground"
                    aria-label={t('sidebar.about')}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{t('sidebar.about')}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* 设置和展开/收起按钮 */}
        <div className={cn(
          "flex items-center gap-0.5 pt-2 border-t border-[var(--glass-border)]",
          isExpanded ? "justify-between px-1" : "flex-col"
        )}>
          {bottomNavItems.map((item) => (
            <NavButton key={item.view} item={item} />
          ))}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-7 h-7 text-muted-foreground hover:text-foreground"
                  aria-label={isExpanded ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}
                >
                  {isExpanded ? (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isExpanded ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 拖拽调整宽度的手柄（仅展开模式显示） */}
      {isExpanded && (
        <div
          className={cn(
            "absolute top-0 right-0 w-1.5 h-full cursor-ew-resize group",
            "hover:bg-primary/20 active:bg-primary/30 transition-colors",
            isDragging && "bg-primary/30"
          )}
          onMouseDown={handleMouseDown}
        >
          {/* 可视化的拖拽指示器 */}
          <div className={cn(
            "absolute top-1/2 right-0 -translate-y-1/2 w-1 h-8 rounded-full",
            "bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors",
            isDragging && "bg-primary/50"
          )} />
        </div>
      )}
    </div>
  );
};

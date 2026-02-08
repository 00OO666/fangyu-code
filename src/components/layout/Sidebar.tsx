import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FolderOpen, Settings, BarChart2, Terminal, Layers, FileText, Package, FileCode, Grid3x3, ChevronLeft, ChevronRight, HelpCircle, Sparkles, Puzzle, Zap, Activity, Search, Bot, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { View } from '@/types/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UnifiedEngineStatus } from '@/components/UnifiedEngineStatus';
import { UpdateBadge } from '@/components/common/UpdateBadge';

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
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 220;

export const Sidebar: React.FC<SidebarProps> = ({
  currentView, onNavigate, className, onAboutClick, onUpdateClick
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_EXPANDED);
    return stored !== null ? stored === 'true' : true;
  });
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH);
    return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<View | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_EXPANDED, String(isExpanded)); }, [isExpanded]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_WIDTH, String(width)); }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newWidth = e.clientX;
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setWidth(newWidth);
  }, [isDragging]);
  const handleMouseUp = useCallback(() => { setIsDragging(false); }, []);

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
    { view: 'projects', icon: FolderOpen, label: t('common.ccProjectsTitle'), shortcut: '1' },
    { view: 'claude-tab-manager', icon: Terminal, label: t('sidebar.sessionManagement'), shortcut: '2' },
    { view: 'cli-monitor', icon: Grid3x3, label: 'CLI 监控', shortcut: 'M' },
    { view: 'super-agent', icon: Bot, label: 'Super Agent', shortcut: '3' },
    { view: 'v3-features', icon: Code2, label: 'V3.0 功能', shortcut: '0' },
    { view: 'editor', icon: FileText, label: t('sidebar.claudePrompts'), shortcut: '4' },
    { view: 'codex-editor', icon: FileCode, label: t('sidebar.codexPrompts'), shortcut: '5' },
    { view: 'gemini-editor', icon: Sparkles, label: t('sidebar.geminiPrompts'), shortcut: '6' },
    { view: 'usage-dashboard', icon: BarChart2, label: t('sidebar.usageStats'), shortcut: '7' },
    { view: 'diagnostics', icon: Activity, label: '配置诊断', shortcut: '8' },
    { view: 'mcp', icon: Layers, label: t('sidebar.mcpTools'), shortcut: '9' },
    { view: 'claude-extensions', icon: Package, label: t('sidebar.extensions') },
    { view: 'hook-manager', icon: Zap, label: 'Hook 管理' },
    { view: 'plugins', icon: Puzzle, label: '插件系统' },
  ];
  const bottomNavItems: NavItem[] = [
    { view: 'settings', icon: Settings, label: t('navigation.settings') },
  ];

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = currentView === item.view;
    const isHovered = hoveredItem === item.view;
    const buttonContent = (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "relative rounded-lg mb-1 transition-all duration-300 ease-out group overflow-hidden",
          isExpanded ? "w-full justify-start px-3 h-10" : "w-10 h-10",
          isActive
            ? "medium-glass text-white shadow-lg shadow-[var(--accent-orange)]/20 glow-border-orange"
            : "light-glass text-white/70 hover:text-white hover:medium-glass"
        )}
        onClick={() => onNavigate(item.view)}
        onMouseEnter={() => setHoveredItem(item.view)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <div className={cn("absolute inset-0 bg-gradient-to-r from-[var(--accent-orange)]/10 via-[var(--accent-gold)]/5 to-transparent opacity-0 transition-opacity duration-300", (isHovered || isActive) && "opacity-100")} />
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--accent-gradient)] rounded-r-full shadow-[var(--glow-orange)]" />}
        <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-transform duration-300 relative z-10", isActive && "scale-110", isHovered && !isActive && "scale-105")} strokeWidth={isActive ? 2.5 : 2} />
        {isExpanded && <span className={cn("ml-3 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis relative z-10 transition-all duration-300", isActive && "font-semibold")}>{item.label}</span>}
        {!isExpanded && <span className="sr-only">{item.label}</span>}
      </Button>
    );
    if (!isExpanded) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2 px-3 py-2 medium-glass">
              <span className="font-medium text-white">{item.label}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return buttonContent;
  };

  return (
    <div ref={sidebarRef} className={cn("relative flex flex-col py-3 h-full transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]", "deep-glass glow-border-white", isExpanded ? "px-3" : "items-center px-2", className)} style={{ width: isExpanded ? `${width}px` : '60px' }}>
      {/* 用户头像区域 */}
      <div className={cn("flex items-center gap-3 mb-4 pb-3 border-b border-white/10", !isExpanded && "justify-center")}>
        <Avatar className={cn("transition-all duration-300 ring-2 ring-[var(--accent-orange)]/30 ring-offset-2 ring-offset-transparent", isExpanded ? "h-10 w-10" : "h-8 w-8")}>
          <AvatarImage src="/avatars/fangyu.png" alt="Fangyu" />
          <AvatarFallback className="bg-[var(--accent-gradient)] text-white font-bold">FY</AvatarFallback>
        </Avatar>
        {isExpanded && <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate text-white">Fangyu</p><p className="text-xs text-white/60 truncate">开发者</p></div>}
      </div>
      {/* 快捷搜索按钮 */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" className={cn("mb-4 transition-all duration-300 light-glass hover:medium-glass", isExpanded ? "w-full justify-start px-3 h-9" : "w-10 h-10")} onClick={() => { const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }); document.dispatchEvent(event); }}>
              <Search className="w-4 h-4 text-white/70" />
              {isExpanded && <span className="ml-2 text-sm text-white/70">搜索...</span>}
            </Button>
          </TooltipTrigger>
          {!isExpanded && <TooltipContent side="right"><p>搜索 (⌘K)</p></TooltipContent>}
        </Tooltip>
      </TooltipProvider>
      {/* 主导航区域 */}
      <div className={cn("flex-1 flex flex-col w-full min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent", isExpanded ? "space-y-0.5" : "items-center space-y-1")}>
        {mainNavItems.map((item) => <NavButton key={item.view} item={item} />)}
      </div>

      {/* 底部状态区域 */}
      <div className={cn("flex flex-col w-full mt-auto pt-3 border-t border-white/10 flex-shrink-0", isExpanded ? "space-y-2" : "items-center space-y-2")}>
        <div className={cn(isExpanded ? "w-full" : "flex justify-center w-full")}><UnifiedEngineStatus compact={!isExpanded} /></div>
        {isExpanded && <div className="px-1"><UpdateBadge onClick={onUpdateClick} /></div>}
        <div className={cn("flex items-center gap-1", isExpanded ? "justify-around px-1" : "flex-col")}>
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onAboutClick} className="w-8 h-8 text-white/70 hover:text-white" aria-label={t('sidebar.about')}><HelpCircle className="w-4 h-4" /></Button></TooltipTrigger>{!isExpanded && <TooltipContent side="right"><p>{t('sidebar.about')}</p></TooltipContent>}</Tooltip></TooltipProvider>
        </div>
        <div className={cn("flex items-center gap-1 pt-2 border-t border-white/10", isExpanded ? "justify-between px-1" : "flex-col")}>
          {bottomNavItems.map((item) => <NavButton key={item.view} item={item} />)}
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="w-8 h-8 text-white/70 hover:text-white transition-transform duration-300" aria-label={isExpanded ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}>{isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</Button></TooltipTrigger><TooltipContent side="right"><p>{isExpanded ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}</p></TooltipContent></Tooltip></TooltipProvider>
        </div>
      </div>
      {isExpanded && <div className={cn("absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize transition-colors hover:bg-[var(--accent-orange)]/30", isDragging && "bg-[var(--accent-orange)]/50")} onMouseDown={handleMouseDown} />}
    </div>
  );
};

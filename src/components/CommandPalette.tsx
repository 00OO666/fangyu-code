import React, { useEffect, useState, useCallback } from 'react'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import Settings from 'lucide-react/dist/esm/icons/settings'
import BarChart2 from 'lucide-react/dist/esm/icons/bar-chart-2'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import Layers from 'lucide-react/dist/esm/icons/layers'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Package from 'lucide-react/dist/esm/icons/package'
import FileCode from 'lucide-react/dist/esm/icons/file-code'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Puzzle from 'lucide-react/dist/esm/icons/puzzle'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Activity from 'lucide-react/dist/esm/icons/activity'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Sun from 'lucide-react/dist/esm/icons/sun'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Info from 'lucide-react/dist/esm/icons/info'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useNavigation } from '@/contexts/NavigationContext'
import { View } from '@/types/navigation'
import { useTranslation } from 'react-i18next'

interface CommandPaletteProps {
  onThemeToggle?: () => void
  onCheckUpdate?: () => void
  onAbout?: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onThemeToggle,
  onCheckUpdate,
  onAbout,
}) => {
  const [open, setOpen] = useState(false)
  const { navigateTo } = useNavigation()
  const { t } = useTranslation()

  // Ctrl+K 快捷键
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  const navItems: { view: View; icon: React.ElementType; label: string; shortcut?: string }[] = [
    { view: 'projects', icon: FolderOpen, label: t('common.ccProjectsTitle'), shortcut: '1' },
    { view: 'claude-tab-manager', icon: Terminal, label: t('sidebar.sessionManagement'), shortcut: '2' },
    { view: 'editor', icon: FileText, label: t('sidebar.claudePrompts'), shortcut: '3' },
    { view: 'codex-editor', icon: FileCode, label: t('sidebar.codexPrompts'), shortcut: '4' },
    { view: 'gemini-editor', icon: Sparkles, label: t('sidebar.geminiPrompts'), shortcut: '5' },
    { view: 'usage-dashboard', icon: BarChart2, label: t('sidebar.usageStats'), shortcut: '6' },
    { view: 'diagnostics', icon: Activity, label: '配置诊断', shortcut: '7' },
    { view: 'mcp', icon: Layers, label: t('sidebar.mcpTools'), shortcut: '8' },
    { view: 'claude-extensions', icon: Package, label: t('sidebar.extensions'), shortcut: '9' },
    { view: 'hook-manager', icon: Zap, label: 'Hook 管理' },
    { view: 'plugins', icon: Puzzle, label: '插件系统' },
    { view: 'settings', icon: Settings, label: t('navigation.settings') },
  ]

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="搜索功能、导航或执行命令..." />
      <CommandList>
        <CommandEmpty>未找到结果</CommandEmpty>
        
        <CommandGroup heading="导航">
          {navItems.map((item) => (
            <CommandItem
              key={item.view}
              onSelect={() => runCommand(() => navigateTo(item.view))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>⌘{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="操作">
          {onThemeToggle && (
            <CommandItem onSelect={() => runCommand(onThemeToggle)}>
              <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span>切换主题</span>
              <CommandShortcut>⌘T</CommandShortcut>
            </CommandItem>
          )}
          {onCheckUpdate && (
            <CommandItem onSelect={() => runCommand(onCheckUpdate)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>检查更新</span>
              <CommandShortcut>⌘U</CommandShortcut>
            </CommandItem>
          )}
          {onAbout && (
            <CommandItem onSelect={() => runCommand(onAbout)}>
              <Info className="mr-2 h-4 w-4" />
              <span>关于</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

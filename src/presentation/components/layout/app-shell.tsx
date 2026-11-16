import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FileText,
  FolderOpen,
  KanbanSquare,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Workspace } from '@/domain/entities/identity'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useNotifications } from '@/presentation/features/notifications/notifications-provider'
import { useSwipeHandlers, useSwipeNavigation } from '@/presentation/hooks/use-swipe-back'
import type {
  NotificationItem,
  NotificationSection,
} from '@/domain/services/notification-service'
import { BrandMark } from '@/presentation/components/brand/logo'
import { ThemeToggle } from '@/presentation/components/common/theme-toggle'
import { NotificationBadge } from './notification-badge'
import { CommandPalette } from './command-palette'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard, path: 'dashboard' },
  { key: 'chat', label: 'Chat', icon: MessageSquare, path: 'chat' },
  { key: 'boards', label: 'Tableros', icon: KanbanSquare, path: 'boards' },
  { key: 'pages', label: 'Documentos', icon: FileText, path: 'pages' },
  { key: 'files', label: 'Archivos', icon: FolderOpen, path: 'files' },
  { key: 'members', label: 'Miembros', icon: Users, path: 'members' },
] as const

function sectionKey(pathname: string): string {
  if (pathname.includes('/c/')) return 'chat'
  if (pathname.includes('/boards')) return 'boards'
  if (pathname.includes('/pages')) return 'pages'
  if (pathname.includes('/files')) return 'files'
  if (pathname.includes('/members')) return 'members'
  if (pathname.includes('/settings')) return 'settings'
  return 'dashboard'
}

function railBadge(
  bySection: Record<NotificationSection, number>,
  items: NotificationItem[],
  key: string,
): { count: number; mention: boolean } {
  if (key === 'dashboard') return { count: 0, mention: false }
  const section = key as NotificationSection
  return {
    count: bySection[section] ?? 0,
    mention: items.some(
      (notification) => notification.section === section && notification.kind === 'mention',
    ),
  }
}

function Rail({ workspace, chatChannelId }: { workspace: Workspace; chatChannelId?: string }) {
  const { pathname } = useLocation()
  const active = sectionKey(pathname)
  const { bySection, items } = useNotifications()
  return (
    <aside className="hidden w-16 shrink-0 flex-col items-center border-e border-border/60 bg-sidebar/60 py-3 lg:flex">
      <Link
        to={`/w/${workspace.id}/dashboard`}
        className="mb-4 grid size-10 place-items-center rounded-xl transition-transform hover:scale-105"
        aria-label="Inicio de openQomu"
      >
        <BrandMark className="size-9" />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const target =
            item.key === 'chat'
              ? chatChannelId
                ? `/w/${workspace.id}/c/${chatChannelId}`
                : `/w/${workspace.id}/dashboard`
              : `/w/${workspace.id}/${item.path}`
          const isActive = active === item.key
          const { count, mention } = railBadge(bySection, items, item.key)
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <Link
                  to={target}
                  className={cn(
                    'relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground',
                    isActive && 'bg-sidebar-accent text-foreground',
                  )}
                  aria-label={count > 0 ? `${item.label}, ${count} pendientes` : item.label}
                >
                  {isActive && (
                    <span className="absolute -start-3 h-5 w-0.5 rounded-full bg-primary" />
                  )}
                  <Icon className="size-[1.15rem]" strokeWidth={isActive ? 2.2 : 1.8} />
                  {count > 0 && (
                    <NotificationBadge
                      count={count}
                      mention={mention}
                      label={`${count} avisos en ${item.label}`}
                      className="absolute -end-0.5 -top-0.5 ring-background"
                    />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
      <div className="flex flex-col items-center gap-1.5">
        <ThemeToggle compact />
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={`/w/${workspace.id}/settings`}
              className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Ajustes"
            >
              <Settings className="size-[1.15rem]" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Ajustes</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}

export function AppShell({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()
  const { channels, boards, pages } = useWorkspaceData()
  const pendingG = useRef(false)
  const pendingTimer = useRef<number | null>(null)
  const workspaceId = workspace.id

  // Como Discord/Telegram Mobile: deslizar hacia la derecha desde cualquier
  // punto abre el panel lateral; deslizar hacia la izquierda dentro del panel
  // lo cierra.
  useSwipeNavigation((direction) => {
    if (direction === 'right') setMobileOpen(true)
  })
  const panelSwipe = useSwipeHandlers((direction) => {
    if (direction === 'left') setMobileOpen(false)
  })

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      if (!element) return false
      const tag = element.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        element.isContentEditable ||
        element.closest('[role="dialog"]') !== null
      )
    }

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((value) => !value)
        return
      }
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key.toLowerCase() === 'g') {
        pendingG.current = true
        if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
        pendingTimer.current = window.setTimeout(() => {
          pendingG.current = false
        }, 1000)
        return
      }
      if (!pendingG.current) return
      pendingG.current = false
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
      const key = event.key.toLowerCase()
      if (key === 'd') navigate(`/w/${workspaceId}/dashboard`)
      else if (key === 'c' && channels[0]) navigate(`/w/${workspaceId}/c/${channels[0].id}`)
      else if (key === 'b' && boards[0]) navigate(`/w/${workspaceId}/boards/${boards[0].id}`)
      else if (key === 'p') {
        if (pages[0]) navigate(`/w/${workspaceId}/pages/${pages[0].id}`)
        else navigate(`/w/${workspaceId}/pages`)
      } else if (key === 'f') navigate(`/w/${workspaceId}/files`)
      else if (key === 'm') navigate(`/w/${workspaceId}/members`)
      else if (key === 's') navigate(`/w/${workspaceId}/settings`)
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
    }
  }, [boards, channels, navigate, pages, workspaceId])

  return (
    <div className="safe-area-top safe-area-bottom flex h-svh overflow-hidden bg-background">
      <Rail workspace={workspace} chatChannelId={channels[0]?.id} />
      <aside className="hidden w-[276px] shrink-0 border-e border-border/60 lg:block">
        <Sidebar onSearch={() => setSearchOpen(true)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] gap-0 p-0" {...panelSwipe}>
          <SheetTitle className="sr-only">Navegación de {workspace.name}</SheetTitle>
          <Sidebar onSearch={() => setSearchOpen(true)} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}

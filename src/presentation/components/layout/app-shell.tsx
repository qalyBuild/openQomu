import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { Workspace } from '@/domain/entities/identity'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useSwipeHandlers, useSwipeNavigation } from '@/presentation/hooks/use-swipe-back'
import { CommandPalette } from './command-palette'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

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

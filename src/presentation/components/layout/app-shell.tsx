import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { Workspace } from '@/domain/entities/identity'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useSwipeHandlers, useSwipeNavigation } from '@/presentation/hooks/use-swipe-back'
import { CommandPalette } from './command-palette'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

const SIDEBAR_COLLAPSED_KEY = 'openqomu.sidebar.collapsed'
const COLLAPSED_SIDEBAR_WIDTH = 56
const SIDEBAR_WIDTH_KEY = 'openqomu.sidebar.width'
const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 216
const MAX_SIDEBAR_WIDTH = 360
const SIDEBAR_KEYBOARD_STEP = 16

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function readSidebarWidth() {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_KEY)
    const width = Number(stored)
    if (stored && Number.isFinite(width)) return clampSidebarWidth(Math.round(width))
  } catch {
    // El almacenamiento puede estar bloqueado por el navegador.
  }
  return DEFAULT_SIDEBAR_WIDTH
}

export function AppShell({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const sidebarDrag = useRef<{ pointerId: number; x: number; width: number } | null>(null)
  const navigate = useNavigate()
  const { channels, boards, pages } = useWorkspaceData()
  const pendingG = useRef(false)
  const pendingTimer = useRef<number | null>(null)
  const workspaceId = workspace.id

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
    } catch {
      // El ajuste sigue disponible durante la sesión.
    }
  }, [sidebarWidth])

  function toggleSidebar() {
    const collapsed = !sidebarCollapsed
    sidebarDrag.current = null
    setSidebarCollapsed(collapsed)
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
    } catch {
      // El ajuste sigue disponible durante la sesión.
    }
  }

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
      <aside
        id="desktop-sidebar"
        className="relative hidden shrink-0 border-e border-border/60 lg:block"
        style={{ width: sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth }}
      >
        <Sidebar
          onSearch={() => setSearchOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />
        <div
          hidden={sidebarCollapsed}
          role="separator"
          tabIndex={0}
          aria-label="Ancho de la barra lateral"
          aria-controls="desktop-sidebar"
          aria-orientation="vertical"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuenow={sidebarWidth}
          className="absolute inset-y-0 -end-1.5 z-10 w-3 cursor-col-resize touch-none select-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 hover:after:bg-primary/60 active:after:bg-primary focus-visible:after:bg-primary"
          onPointerDown={(event) => {
            if (event.button !== 0 || sidebarDrag.current) return
            event.currentTarget.setPointerCapture(event.pointerId)
            sidebarDrag.current = { pointerId: event.pointerId, x: event.clientX, width: sidebarWidth }
          }}
          onPointerMove={(event) => {
            const drag = sidebarDrag.current
            if (drag?.pointerId !== event.pointerId) return
            setSidebarWidth(clampSidebarWidth(drag.width + Math.round(event.clientX - drag.x)))
          }}
          onLostPointerCapture={(event) => {
            if (sidebarDrag.current?.pointerId === event.pointerId) sidebarDrag.current = null
          }}
          onKeyDown={(event) => {
            switch (event.key) {
              case 'ArrowLeft':
                setSidebarWidth((width) => clampSidebarWidth(width - SIDEBAR_KEYBOARD_STEP))
                break
              case 'ArrowRight':
                setSidebarWidth((width) => clampSidebarWidth(width + SIDEBAR_KEYBOARD_STEP))
                break
              case 'Home':
                setSidebarWidth(MIN_SIDEBAR_WIDTH)
                break
              case 'End':
                setSidebarWidth(MAX_SIDEBAR_WIDTH)
                break
              default:
                return
            }
            event.preventDefault()
          }}
        />
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

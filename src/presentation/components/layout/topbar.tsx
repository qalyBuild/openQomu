import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FlaskConical, Menu, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { UserMenu } from './user-menu'
import { InviteDialog } from '@/presentation/features/workspace/invite-dialog'
import { cn } from '@/lib/utils'

function useBreadcrumb() {
  const { workspace, channels, boards, pages } = useWorkspaceData()
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const section = segments[2] ?? 'dashboard'
  let current = ''
  if (section === 'c') {
    const channel = channels.find((item) => item.id === segments[3])
    current = channel ? `#${channel.name}` : 'Canal'
  } else if (section === 'boards') {
    const board = boards.find((item) => item.id === segments[3])
    current = board?.name ?? 'Tableros'
  } else if (section === 'pages') {
    const page = pages.find((item) => item.id === segments[3])
    current = page?.title ?? 'Páginas'
  } else if (section === 'files') current = 'Archivos'
  else if (section === 'members') current = 'Miembros'
  else if (section === 'settings') current = 'Ajustes'
  else current = 'Resumen'
  return { workspace, current, section }
}

export function Topbar({
  onOpenSearch,
  onOpenMobileNav,
}: {
  onOpenSearch: () => void
  onOpenMobileNav: () => void
}) {
  const { workspace, current, section } = useBreadcrumb()
  const { can } = useWorkspaceData()
  const container = useContainer()
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur-xl sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Abrir navegación"
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden truncate text-muted-foreground sm:inline">{workspace.name}</span>
        <span className="hidden text-muted-foreground/40 sm:inline">/</span>
        <span
          className={cn(
            'truncate font-medium tracking-tight',
            ['pages', 'members', 'files', 'settings'].includes(section) && 'hidden sm:inline',
          )}
        >
          {current}
        </span>
      </div>

      <div className="ms-auto flex items-center gap-1.5">
        {container.mode === 'demo' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="hidden gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 md:inline-flex dark:text-amber-400"
              >
                <FlaskConical className="size-3" />
                Demo local
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Datos guardados en este navegador. Configura Firebase para colaborar en tiempo real.
            </TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSearch}
          className={cn(
            'gap-2 text-muted-foreground hover:text-foreground',
            'h-8 px-2.5 text-xs',
          )}
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Buscar</span>
          <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
        </Button>
        {can('member.invite') && (
          <Button size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-3.5" />
            <span className="hidden sm:inline">Invitar</span>
          </Button>
        )}
        <UserMenu workspace={workspace} />
      </div>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </header>
  )
}

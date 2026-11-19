import { groupBoardChoices, MUTED_BOARDS_LABEL } from '@/presentation/features/kanban/board-choices'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BellOff,
  FileText,
  FolderOpen,
  Hash,
  KanbanSquare,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Palette,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Shield,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useAuth } from '@/app/auth-provider'
import { buildPageTree } from '@/domain/services/page-service'
import { isBoardMuted, type Board } from '@/domain/entities/kanban'
import { notificationKey } from '@/domain/services/notification-service'
import { isRecentlyActive } from '@/lib/presence'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/presentation/features/notifications/notifications-provider'
import { NotificationBadge } from './notification-badge'
import { ThemeLink } from '@/presentation/components/common/theme-link'
import { WorkspaceSwitcher } from './workspace-switcher'
import { PageTree } from './page-tree'
import { CreateChannelDialog } from '@/presentation/features/chat/create-channel-dialog'
import { BoardDialog } from '@/presentation/features/kanban/board-dialog'
import { BoardStatusBadge } from '@/presentation/features/kanban/board-status-badge'
import { CreatePageDialog } from '@/presentation/features/pages/create-page-dialog'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { WorkspaceIcon } from '@/presentation/components/common/workspace-icon'
import { FilesExplorer } from '@/presentation/features/files/files-explorer'

type Section = 'dashboard' | 'chat' | 'boards' | 'pages' | 'files' | 'members' | 'settings'

function sectionFor(pathname: string): Section {
  if (pathname.includes('/c/')) return 'chat'
  if (pathname.includes('/boards')) return 'boards'
  if (pathname.includes('/pages')) return 'pages'
  if (pathname.includes('/files')) return 'files'
  if (pathname.includes('/members')) return 'members'
  if (pathname.includes('/settings')) return 'settings'
  return 'dashboard'
}

function SidebarHeader({
  title,
  count,
  action,
}: {
  title: string
  count?: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-2 pb-1.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
        {count !== undefined && <span className="ms-1.5 opacity-60">{count}</span>}
      </span>
      {action}
    </div>
  )
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  active,
  badge,
  compact = false,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  compact?: boolean
  badge?: React.ReactNode
}) {
  return (
    <Link
      to={to}
      title={compact ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.84rem] transition-colors',
        compact && 'relative h-10 justify-center px-0',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={compact ? 'sr-only' : 'min-w-0 flex-1 truncate'}>{label}</span>
      {badge && <span className={compact ? 'absolute end-0 top-0' : 'contents'}>{badge}</span>}
    </Link>
  )
}

type NotificationLookup = Pick<
  ReturnType<typeof useNotifications>,
  'byTarget' | 'items'
>

function targetCount(
  notifications: NotificationLookup,
  targetSection: Parameters<typeof notificationKey>[0],
  targetId: string,
): number {
  return notifications.byTarget[notificationKey(targetSection, targetId)] ?? 0
}

function targetMention(
  notifications: NotificationLookup,
  targetSection: Parameters<typeof notificationKey>[0],
  targetId: string,
): boolean {
  return notifications.items.some(
    (notification) =>
      notification.section === targetSection &&
      notification.targetId === targetId &&
      notification.kind === 'mention',
  )
}

function NotificationSoundToggle({
  compact,
  enabled,
  onToggle,
}: {
  compact: boolean
  enabled: boolean
  onToggle: () => void
}) {
  const label = enabled ? 'Silenciar avisos' : 'Activar sonido de avisos'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
      title={compact ? label : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
        compact && 'h-9 justify-center',
      )}
    >
      {enabled ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
      <span hidden={compact} className="truncate">
        {enabled ? 'Sonido de avisos activado' : 'Avisos silenciados'}
      </span>
      <span
        className={cn(
          'ms-auto size-1.5 rounded-full',
          compact && 'hidden',
          enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        )}
      />
    </button>
  )
}

export function Sidebar({
  onSearch,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  onSearch: () => void
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const {
    workspace,
    channels,
    boards,
    pages,
    members,
    can,
    uid,
  } = useWorkspaceData()
  const { active: activeBoards, muted: mutedBoards } = groupBoardChoices(boards, (board) => board.status)
  const { session, profile } = useAuth()
  const notifications = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const section = sectionFor(location.pathname)
  const activeChannelId = location.pathname.split('/c/')[1]?.split('/')[0]
  const tree = useMemo(() => buildPageTree(pages), [pages])
  const onlineMembers = members.filter((member) => isRecentlyActive(member.lastActiveAt))
  const currentMember = members.find((member) => member.uid === uid)
  const currentName = currentMember?.displayName ?? profile?.displayName ?? session?.displayName ?? 'Yo'
  const currentPhotoURL =
    currentMember?.photoURL || profile?.photoURL || session?.photoURL || null

  const toggleButton = useRef<HTMLButtonElement>(null)
  const restoreToggleFocus = useRef(false)

  useLayoutEffect(() => {
    if (!restoreToggleFocus.current) return
    restoreToggleFocus.current = false
    toggleButton.current?.focus()
  }, [collapsed])

  function toggleCollapsed() {
    if (!onToggleCollapsed) return
    restoreToggleFocus.current = true
    onToggleCollapsed()
  }

  const renderBoardLink = (board: Board) => (
    <SidebarLink
      key={board.id}
      to={`/w/${workspace.id}/boards/${board.id}`}
      icon={KanbanSquare}
      label={board.name}
      active={location.pathname.includes(`/boards/${board.id}`)}
      badge={isBoardMuted(board.status) ? <BoardStatusBadge status={board.status} /> : (
        <NotificationBadge
          count={targetCount(notifications, 'boards', board.id)}
          mention={targetMention(notifications, 'boards', board.id)}
          label={`${targetCount(notifications, 'boards', board.id)} tareas requieren tu atención en ${board.name}`}
        />
      )}
    />
  )

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-sidebar/80"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a')) onNavigate?.()
      }}
    >
      <div className={collapsed ? 'px-2 py-3' : 'p-3 pb-2'}>
        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          {collapsed ? (
            <Button
              ref={toggleButton}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-center rounded-xl px-0 py-1 hover:bg-sidebar-accent"
              aria-label={`Expandir barra lateral de ${workspace.name}`}
              aria-controls="desktop-sidebar"
              aria-expanded={false}
              title="Expandir barra lateral"
              onClick={toggleCollapsed}
            >
              <WorkspaceIcon icon={workspace.icon} />
            </Button>
          ) : (
            <WorkspaceSwitcher workspace={workspace} />
          )}
          {!collapsed && onToggleCollapsed && (
            <Button
              ref={toggleButton}
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 border border-sidebar-border bg-sidebar-accent/70 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleCollapsed}
              aria-controls="desktop-sidebar"
              aria-expanded
              aria-label="Comprimir barra lateral"
              title="Comprimir barra lateral"
            >
              <PanelLeftClose />
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={onSearch}
          title={collapsed ? 'Buscar en openQomu' : undefined}
          aria-label={collapsed ? 'Buscar en openQomu' : undefined}
          className={cn(
            'mt-2 flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-background',
            collapsed && 'h-9 justify-center px-0',
          )}
        >
          <Search className="size-3.5" />
          {!collapsed && (
            <>
              <span className="flex-1 text-start">Buscar en openQomu…</span>
              <Kbd className="hidden text-[0.6rem] sm:inline-flex">⌘K</Kbd>
            </>
          )}
        </button>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-2 pb-3', collapsed ? 'scrollbar-none' : 'scrollbar-thin')}>
        <div className="mb-3 space-y-0.5">
          {!collapsed && <SidebarHeader title="Navegación" />}
          <SidebarLink
            to={`/w/${workspace.id}/dashboard`}
            icon={LayoutDashboard}
            label="Resumen"
            compact={collapsed}
            active={section === 'dashboard'}
          />
          <SidebarLink
            to={
              channels[0]
                ? `/w/${workspace.id}/c/${channels[0].id}`
                : `/w/${workspace.id}/dashboard`
            }
            icon={MessageSquare}
            label="Chat"
            compact={collapsed}
            active={section === 'chat'}
            badge={
              <NotificationBadge
                count={notifications.bySection.chat}
                mention={notifications.items.some(
                  (item) => item.section === 'chat' && item.kind === 'mention',
                )}
                label={`${notifications.bySection.chat} avisos en Chat`}
              />
            }
          />
          <SidebarLink
            to={`/w/${workspace.id}/boards`}
            icon={KanbanSquare}
            label="Tableros"
            compact={collapsed}
            active={section === 'boards'}
            badge={
              <NotificationBadge
                count={notifications.bySection.boards}
                mention={notifications.items.some(
                  (item) => item.section === 'boards' && item.kind === 'mention',
                )}
                label={`${notifications.bySection.boards} avisos en Tableros`}
              />
            }
          />
          <SidebarLink
            to={`/w/${workspace.id}/pages`}
            icon={FileText}
            label="Documentos"
            compact={collapsed}
            active={section === 'pages'}
            badge={
              <NotificationBadge
                count={notifications.bySection.pages}
                label={`${notifications.bySection.pages} avisos en Documentos`}
              />
            }
          />
          <SidebarLink
            to={`/w/${workspace.id}/files`}
            icon={FolderOpen}
            label="Archivos"
            compact={collapsed}
            active={section === 'files'}
            badge={
              <NotificationBadge
                count={notifications.bySection.files}
                label={`${notifications.bySection.files} avisos en Archivos`}
              />
            }
          />
          <SidebarLink
            to={`/w/${workspace.id}/members`}
            icon={Users}
            label="Miembros"
            compact={collapsed}
            active={section === 'members'}
            badge={
              <NotificationBadge
                count={notifications.bySection.members}
                label={`${notifications.bySection.members} avisos en Miembros`}
              />
            }
          />
          <SidebarLink
            to={`/w/${workspace.id}/settings`}
            icon={Settings}
            label="Ajustes"
            compact={collapsed}
            active={section === 'settings'}
          />
        </div>
        {!collapsed && section === 'chat' && (
          <div className="space-y-0.5 border-t border-sidebar-border pt-3">
            <SidebarHeader
              title="Canales"
              count={channels.length}
              action={
                can('channel.create') ? (
                  <CreateChannelDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        aria-label="Crear canal"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    }
                  />
                ) : null
              }
            />
            {channels.map((channel) => (
              <Link
                key={channel.id}
                to={`/w/${workspace.id}/c/${channel.id}`}
                className={cn(
                  'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.84rem] transition-colors',
                  activeChannelId === channel.id
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60',
                )}
              >
                {channel.type === 'private' ? (
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                <NotificationBadge
                  count={targetCount(notifications, 'chat', channel.id)}
                  mention={targetMention(notifications, 'chat', channel.id)}
                  label={`${targetCount(notifications, 'chat', channel.id)} mensajes sin leer en #${channel.name}`}
                />
              </Link>
            ))}
            {channels.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">Crea el primer canal.</p>
            )}
            <div className="pt-3">
              <SidebarLink
                to={`/w/${workspace.id}/dashboard`}
                icon={LayoutDashboard}
                label="Volver al resumen"
              />
            </div>
          </div>
        )}

        {!collapsed && section === 'boards' && (
          <div className="space-y-0.5 border-t border-sidebar-border pt-3">
            <SidebarHeader
              title="Tableros"
              count={boards.length}
              action={
                can('board.create') ? (
                  <BoardDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        aria-label="Crear tablero"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    }
                  />
                ) : null
              }
            />
            {activeBoards.map(renderBoardLink)}
            {mutedBoards.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t border-sidebar-border pt-2">
                <SidebarHeader title={MUTED_BOARDS_LABEL} count={mutedBoards.length} />
                {mutedBoards.map(renderBoardLink)}
              </div>
            )}
          </div>
        )}

        {!collapsed && section === 'pages' && (
          <div className="border-t border-sidebar-border pt-3">
            <SidebarHeader
              title="Páginas"
              count={pages.length}
              action={
                can('page.create') ? (
                  <CreatePageDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        aria-label="Crear página"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    }
                  />
                ) : null
              }
            />
            <PageTree pages={tree} workspaceId={workspace.id} />
          </div>
        )}

        {!collapsed && section === 'files' && <FilesExplorer onNavigate={onNavigate} />}

        {!collapsed && section === 'dashboard' && (
          <div className="space-y-4 border-t border-sidebar-border pt-3">
            <div>
              <SidebarHeader title="Canales" />
              {channels.slice(0, 5).map((channel) => (
                <Link
                  key={channel.id}
                  to={`/w/${workspace.id}/c/${channel.id}`}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.84rem] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60"
                >
                  {channel.type === 'private' ? (
                    <Lock className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Hash className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                  <NotificationBadge
                    count={targetCount(notifications, 'chat', channel.id)}
                    mention={targetMention(notifications, 'chat', channel.id)}
                    label={`${targetCount(notifications, 'chat', channel.id)} mensajes sin leer en #${channel.name}`}
                  />
                </Link>
              ))}
            </div>
            <div>
              <SidebarHeader title="Tableros" />
              {activeBoards.slice(0, 3).map(renderBoardLink)}
              {mutedBoards.length > 0 && activeBoards.length < 3 && (
                <div className="mt-2">
                  <SidebarHeader title={MUTED_BOARDS_LABEL} />
                  {mutedBoards.slice(0, 3 - activeBoards.length).map(renderBoardLink)}
                </div>
              )}
            </div>
            <div>
              <SidebarHeader title="Páginas" />
              {pages.slice(0, 4).map((page) => (
                <SidebarLink
                  key={page.id}
                  to={`/w/${workspace.id}/pages/${page.id}`}
                  icon={FileText}
                  label={`${page.icon} ${page.title}`}
                />
              ))}
            </div>
          </div>
        )}

        {!collapsed && section === 'members' && (
          <div className="space-y-4 border-t border-sidebar-border pt-3">
            <div>
              <SidebarHeader title="Equipo" count={members.length} />
              {members.slice(0, 8).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.84rem]"
                >
                  <UserAvatar
                    name={member.displayName}
                    photoURL={member.photoURL}
                    size="xs"
                    online={isRecentlyActive(member.lastActiveAt)}
                  />
                  <span className="min-w-0 flex-1 truncate">{member.displayName}</span>
                  {member.role !== 'member' && (
                    <Shield className="size-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!collapsed && section === 'settings' && (
          <div className="space-y-0.5 border-t border-sidebar-border pt-3">
            <SidebarHeader title="Ajustes" />
            <SidebarLink
              to={`/w/${workspace.id}/settings`}
              icon={Settings}
              label="General"
              active={!location.search || location.search.includes('tab=general')}
            />
            <SidebarLink
              to={`/w/${workspace.id}/settings?tab=profile`}
              icon={Users}
              label="Tu perfil"
              active={location.search.includes('tab=profile')}
            />
            <SidebarLink
              to={`/w/${workspace.id}/themes`}
              icon={Palette}
              label="Temas"
              active={location.pathname.endsWith('/themes')}
            />
          </div>
        )}
      </div>

      <div className={cn('space-y-1 border-t border-sidebar-border', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed && onlineMembers.length > 0 && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[0.7rem] text-muted-foreground">
              {onlineMembers.length} en línea
            </span>
            <div className="ms-auto flex -space-x-1.5">
              {onlineMembers.slice(0, 4).map((member) => (
                <UserAvatar
                  key={member.id}
                  name={member.displayName}
                  photoURL={member.photoURL}
                  size="xs"
                  className="ring-2 ring-sidebar"
                />
              ))}
            </div>
          </div>
        )}
        <ThemeLink compact={collapsed} />
        <NotificationSoundToggle
          compact={collapsed}
          enabled={notifications.soundEnabled}
          onToggle={notifications.toggleSound}
        />
        <button
          type="button"
          onClick={() => navigate(`/w/${workspace.id}/settings?tab=profile`)}
          aria-label={collapsed ? 'Cuenta y preferencias' : undefined}
          title={collapsed ? 'Cuenta y preferencias' : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
            collapsed && 'h-9 justify-center',
          )}
        >
          <UserAvatar name={currentName} photoURL={currentPhotoURL} size="xs" />
          {!collapsed && <span className="truncate">Cuenta y preferencias</span>}
        </button>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
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
import { isBoardMuted } from '@/domain/entities/kanban'
import { notificationKey } from '@/domain/services/notification-service'
import { isRecentlyActive } from '@/lib/presence'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/presentation/features/notifications/notifications-provider'
import { NotificationBadge } from './notification-badge'
import { ThemeToggle } from '@/presentation/components/common/theme-toggle'
import { WorkspaceSwitcher } from './workspace-switcher'
import { PageTree } from './page-tree'
import { CreateChannelDialog } from '@/presentation/features/chat/create-channel-dialog'
import { BoardDialog } from '@/presentation/features/kanban/board-dialog'
import { BoardStatusBadge } from '@/presentation/features/kanban/board-status-badge'
import { CreatePageDialog } from '@/presentation/features/pages/create-page-dialog'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
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
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  badge?: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.84rem] transition-colors',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
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
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Silenciar avisos' : 'Activar sonido de avisos'}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
    >
      {enabled ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
      <span className="truncate">
        {enabled ? 'Sonido de avisos activado' : 'Avisos silenciados'}
      </span>
      <span
        className={cn(
          'ms-auto size-1.5 rounded-full',
          enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        )}
      />
    </button>
  )
}

export function Sidebar({ onSearch, onNavigate }: { onSearch: () => void; onNavigate?: () => void }) {
  const {
    workspace,
    channels,
    boards,
    pages,
    members,
    can,
    uid,
  } = useWorkspaceData()
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

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-sidebar/80"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a')) onNavigate?.()
      }}
    >
      <div className="p-3 pb-2">
        <WorkspaceSwitcher workspace={workspace} />
        <button
          type="button"
          onClick={onSearch}
          className="mt-2 flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-background"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-start">Buscar en openQomu…</span>
          <Kbd className="hidden text-[0.6rem] sm:inline-flex">⌘K</Kbd>
        </button>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-3 space-y-0.5">
          <SidebarHeader title="Navegación" />
          <SidebarLink
            to={`/w/${workspace.id}/dashboard`}
            icon={LayoutDashboard}
            label="Resumen"
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
            active={section === 'settings'}
          />
        </div>
        {section === 'chat' && (
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

        {section === 'boards' && (
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
            {boards.map((board) => (
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
            ))}
          </div>
        )}

        {section === 'pages' && (
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

        {section === 'files' && <FilesExplorer onNavigate={onNavigate} />}

        {section === 'dashboard' && (
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
              {boards.slice(0, 3).map((board) => (
                <SidebarLink
                  key={board.id}
                  to={`/w/${workspace.id}/boards/${board.id}`}
                  icon={KanbanSquare}
                  label={board.name}
                  badge={isBoardMuted(board.status) ? <BoardStatusBadge status={board.status} /> : (
                    <NotificationBadge
                      count={targetCount(notifications, 'boards', board.id)}
                      mention={targetMention(notifications, 'boards', board.id)}
                      label={`${targetCount(notifications, 'boards', board.id)} tareas requieren tu atención`}
                    />
                  )}
                />
              ))}
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

        {section === 'members' && (
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

        {section === 'settings' && (
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
              to={`/w/${workspace.id}/settings?tab=appearance`}
              icon={FileText}
              label="Apariencia"
              active={location.search.includes('tab=appearance')}
            />
          </div>
        )}
      </div>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        {onlineMembers.length > 0 && (
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
        <ThemeToggle />
        <NotificationSoundToggle
          enabled={notifications.soundEnabled}
          onToggle={notifications.toggleSound}
        />
        <button
          type="button"
          onClick={() => navigate(`/w/${workspace.id}/settings?tab=profile`)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <UserAvatar name={currentName} photoURL={currentPhotoURL} size="xs" />
          <span className="truncate">Cuenta y preferencias</span>
        </button>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Clock3,
  Crown,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Member, Role } from '@/domain/entities/identity'
import { ROLE_META } from '@/domain/entities/identity'
import {
  canChangeRole,
  canRemoveMember,
} from '@/domain/services/permission-service'
import { formatRelative } from '@/lib/date'
import { isRecentlyActive } from '@/lib/presence'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { InviteDialog } from '@/presentation/features/workspace/invite-dialog'
import { cn } from '@/lib/utils'

function roleIcon(role: Role) {
  if (role === 'owner') return Crown
  if (role === 'admin') return ShieldCheck
  return Shield
}

function lastActiveLabel(iso: string): string {
  const relative = formatRelative(iso)
  if (relative === 'ahora') return 'Ahora'
  if (relative === 'ayer') return 'Ayer'
  return `Hace ${relative.replace('hace ', '')}`
}

export function MembersPage() {
  const { workspace, members, role, uid, can, loading } = useWorkspaceData()
  const container = useContainer()
  const [params] = useSearchParams()
  const highlighted = params.get('member')
  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<Member | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return members
    return members.filter(
      (member) =>
        member.displayName.toLowerCase().includes(normalized) ||
        member.email.toLowerCase().includes(normalized),
    )
  }, [members, query])

  const online = members.filter((member) => isRecentlyActive(member.lastActiveAt))
  const admins = members.filter((member) => member.role !== 'member')

  const changeRole = async (member: Member, nextRole: Role) => {
    try {
      await container.workspaces.updateMemberRole(workspace.id, member.uid, nextRole)
      toast.success(
        nextRole === 'owner'
          ? `${member.displayName} es ahora propietario.`
          : `Rol de ${member.displayName} actualizado.`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el rol.')
    }
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-5 pb-12 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Equipo</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Miembros</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {members.length} personas en {workspace.name}. Gestiona roles e invitaciones.
            </p>
          </div>
          {can('member.invite') && (
            <Button className="gap-1.5" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" /> Invitar personas
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Miembros', value: members.length, icon: Users, accent: 'text-violet-500' },
            { label: 'En línea', value: online.length, icon: Clock3, accent: 'text-emerald-500' },
            { label: 'Administradores', value: admins.length, icon: ShieldCheck, accent: 'text-amber-500' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="min-w-0 rounded-2xl border bg-card/70 p-2.5 sm:p-4"
              >
                <div className="flex items-center gap-1.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-muted/70 sm:size-9 sm:rounded-xl">
                    <Icon className={cn('size-3 sm:size-4', stat.accent)} />
                  </span>
                  <p className="text-lg font-semibold tracking-tight sm:text-xl">{stat.value}</p>
                </div>
                <p className="mt-1 text-[0.6rem] leading-tight text-muted-foreground sm:text-[0.7rem]">
                  {stat.label}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o email…"
              className="h-9 ps-8 text-xs"
            />
          </div>
          <Badge variant="outline" className="h-7 text-[0.65rem] text-muted-foreground">
            {filtered.length} de {members.length}
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl border bg-muted/30" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin resultados"
            description="No encontramos a nadie con esa búsqueda."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card/60">
            <div className="hidden grid-cols-[1fr_140px_120px_80px] gap-3 border-b bg-muted/30 px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Persona</span>
              <span>Rol</span>
              <span>Última actividad</span>
              <span className="text-end">Acciones</span>
            </div>
            <div className="divide-y">
              {filtered.map((member) => {
                const Icon = roleIcon(member.role)
                const canManageRole =
                  can('member.manage') &&
                  member.role !== 'owner' &&
                  member.uid !== uid
                const canRemove =
                  canRemoveMember(role, member.role) && member.uid !== uid
                const isHighlighted = highlighted === member.uid
                return (
                  <div
                    key={member.id}
                    className={cn(
                      'grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[1fr_140px_120px_80px] sm:items-center',
                      isHighlighted && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={member.displayName}
                        photoURL={member.photoURL}
                        online={isRecentlyActive(member.lastActiveAt)}
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {member.displayName}
                          {member.uid === uid && (
                            <span className="rounded bg-primary/10 px-1 py-0.5 text-[0.55rem] font-medium text-primary">
                              tú
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 truncate text-[0.7rem] text-muted-foreground">
                          <Mail className="size-2.5" /> {member.email}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Badge
                        variant={member.role === 'owner' ? 'default' : 'secondary'}
                        className="h-6 gap-1 text-[0.62rem]"
                      >
                        <Icon className="size-3" /> {ROLE_META[member.role].label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          isRecentlyActive(member.lastActiveAt) ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                        )}
                      />
                      {member.lastActiveAt
                        ? isRecentlyActive(member.lastActiveAt)
                          ? 'En línea'
                          : lastActiveLabel(member.lastActiveAt)
                        : 'Sin actividad'}
                    </div>

                    <div className="flex justify-end">
                      {(canManageRole || canRemove) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              Gestionar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManageRole && (
                              <>
                                <DropdownMenuLabel>Cambiar rol</DropdownMenuLabel>
                                {(['admin', 'member', 'owner'] as Role[])
                                  .filter(
                                    (nextRole) =>
                                      nextRole !== member.role &&
                                      canChangeRole(role, member.role, nextRole),
                                  )
                                  .map((nextRole) => (
                                    <DropdownMenuItem
                                      key={nextRole}
                                      onClick={() => {
                                        if (nextRole === 'owner') setPromoteTarget(member)
                                        else void changeRole(member, nextRole)
                                      }}
                                    >
                                      {nextRole === 'owner' ? (
                                        <Crown className="size-4" />
                                      ) : nextRole === 'admin' ? (
                                        <ShieldCheck className="size-4" />
                                      ) : (
                                        <Shield className="size-4" />
                                      )}
                                      Hacer {ROLE_META[nextRole].label.toLowerCase()}
                                    </DropdownMenuItem>
                                  ))}
                                {canRemove && <DropdownMenuSeparator />}
                              </>
                            )}
                            {canRemove && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setRemoveTarget(member)}
                              >
                                <UserMinus className="size-4" /> Quitar del espacio
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Roles:</strong> el propietario tiene control total; los
          administradores gestionan miembros y contenido; los miembros crean canales, tableros y
          páginas.
        </div>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={Boolean(promoteTarget)}
        onOpenChange={(open) => !open && setPromoteTarget(null)}
        title={`¿Transferir la propiedad a ${promoteTarget?.displayName ?? 'esta persona'}?`}
        description="Pasarás a ser administrador. Solo el nuevo propietario podrá eliminar el espacio o transferirlo de nuevo."
        confirmLabel="Transferir propiedad"
        destructive={false}
        onConfirm={async () => {
          if (!promoteTarget) return
          await changeRole(promoteTarget, 'owner')
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`¿Quitar a ${removeTarget?.displayName ?? 'esta persona'}?`}
        description="Perderá acceso al espacio y a todo su contenido. Podrá volver con una nueva invitación."
        confirmLabel="Quitar del espacio"
        onConfirm={async () => {
          if (!removeTarget) return
          try {
            await container.workspaces.removeMember(workspace.id, removeTarget.uid)
            toast.success('Miembro eliminado del espacio.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo quitar al miembro.')
          }
        }}
      />
    </div>
  )
}

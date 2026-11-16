import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bot,
  Check,
  Cloud,
  Database,
  HardDrive,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Save,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useTheme, type ThemeMode } from '@/app/theme-provider'
import { ROLE_META } from '@/domain/entities/identity'
import { pickWorkspaceIcon } from '@/domain/services/workspace-service'
import { formatDate, formatRelative } from '@/lib/date'
import {
  FREE_FILE_SIZE_LIMIT,
  FREE_STORAGE_QUOTA,
  MAX_FILE_SIZE,
  estimateStoredBytes,
  formatBytes,
} from '@/domain/services/file-service'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { EmojiPicker } from '@/presentation/components/common/emoji-picker'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { InviteDialog } from '@/presentation/features/workspace/invite-dialog'
import { McpTokensPanel } from '@/presentation/features/settings/mcp-tokens-panel'
import { NotificationPreferences } from '@/presentation/features/settings/notification-preferences'
import { PushPreferences } from '@/presentation/features/settings/push-preferences'
import { AppDownload } from '@/presentation/features/settings/app-download'
import { cn } from '@/lib/utils'

const WORKSPACE_ICONS = ['🪐', '🚀', '✨', '🧩', '🌊', '🔭', '🎯', '🛠️', '🌱', '⚡', '🎨', '📚']

export function SettingsPage() {
  const { workspace, members, role, uid, can, files, trashedFiles } = useWorkspaceData()
  const { session, profile, signOut, refreshProfile } = useAuth()
  const { mode, setMode } = useTheme()
  const container = useContainer()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'general'
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)
  const [icon, setIcon] = useState(workspace.icon)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? session?.displayName ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    setName(workspace.name)
    setDescription(workspace.description)
    setIcon(workspace.icon)
  }, [workspace.id, workspace.name, workspace.description, workspace.icon])

  useEffect(() => {
    setDisplayName(profile?.displayName ?? session?.displayName ?? '')
  }, [profile?.displayName, session?.displayName])

  const owner = members.find((member) => member.role === 'owner')
  const member = members.find((item) => item.uid === uid)
  const canManage = can('workspace.manage')
  const storageBackend =
    import.meta.env.VITE_FILE_STORAGE === 'storage'
      ? 'storage'
      : import.meta.env.VITE_FILE_STORAGE === 's3'
        ? 's3'
        : 'firestore'
  const freeStorage = storageBackend === 'firestore'
  const allFiles = [...files, ...trashedFiles]
  const usedBytes = allFiles.reduce(
    (sum, file) => sum + (file.backend === 'firestore' ? estimateStoredBytes(file.size) : file.size),
    0,
  )
  const usedPercent = freeStorage
    ? Math.min(100, Math.round((usedBytes / FREE_STORAGE_QUOTA) * 1000) / 10)
    : 0
  const dirty =
    name !== workspace.name || description !== workspace.description || icon !== workspace.icon

  const setTab = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'general') next.delete('tab')
    else next.set('tab', value)
    setParams(next, { replace: true })
  }

  const saveWorkspace = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canManage) return
    setSavingWorkspace(true)
    try {
      await container.workspaces.update(workspace.id, { name, description, icon })
      toast.success('Espacio actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el espacio.')
    } finally {
      setSavingWorkspace(false)
    }
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!displayName.trim()) return
    setSavingProfile(true)
    try {
      await container.users.updateProfile(uid, { displayName })
      await refreshProfile()
      toast.success('Perfil actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-5 pb-12 sm:p-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Configuración</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Ajustes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personaliza tu espacio, tu perfil y la apariencia de openQomu.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid h-auto! w-full grid-cols-3 gap-1 sm:flex sm:w-fit sm:flex-wrap">
            <TabsTrigger value="general" className="flex-none gap-1.5 text-xs">
              <Settings className="size-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex-none gap-1.5 text-xs">
              <UserRound className="size-3.5" /> Perfil
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex-none gap-1.5 text-xs">
              <Palette className="size-3.5" /> Apariencia
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex-none gap-1.5 text-xs">
              <Bot className="size-3.5" /> IA
            </TabsTrigger>
            <TabsTrigger value="app" className="flex-none gap-1.5 text-xs">
              <Smartphone className="size-3.5" /> App
            </TabsTrigger>
            <TabsTrigger value="danger" className="flex-none gap-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3.5" /> Peligro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-5 space-y-4">
            <form onSubmit={saveWorkspace} className="rounded-2xl border bg-card/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Identidad del espacio</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Nombre, icono y descripción visibles para todo el equipo.
                  </p>
                </div>
                <Badge variant="outline" className="text-[0.62rem]">
                  {ROLE_META[role].label}
                </Badge>
              </div>
              <div className="mt-5 flex flex-col gap-5 sm:flex-row">
                <div className="space-y-2">
                  <Label>Icono</Label>
                  <EmojiPicker
                    onPick={setIcon}
                    align="start"
                    trigger={
                      <button
                        type="button"
                        className="grid size-16 place-items-center rounded-2xl border bg-background text-3xl shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed"
                        disabled={!canManage}
                        aria-label="Cambiar icono del espacio"
                      >
                        {icon}
                      </button>
                    }
                  />
                  <div className="grid max-w-40 grid-cols-4 gap-1">
                    {WORKSPACE_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        disabled={!canManage}
                        onClick={() => setIcon(emoji)}
                        className={cn(
                          'grid size-7 place-items-center rounded-md text-sm transition-colors',
                          icon === emoji ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted',
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="settings-name">Nombre</Label>
                    <Input
                      id="settings-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={!canManage}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-description">Descripción</Label>
                    <Textarea
                      id="settings-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      disabled={!canManage}
                      rows={3}
                      maxLength={300}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => setIcon(pickWorkspaceIcon(name))}
                      disabled={!canManage}
                    >
                      Sugerir icono
                    </Button>
                    <Button type="submit" size="sm" disabled={!canManage || !dirty || savingWorkspace}>
                      <Save className="size-4" /> Guardar cambios
                    </Button>
                  </div>
                </div>
              </div>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card/60 p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4 text-muted-foreground" /> Equipo
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {members.length} miembros · {members.filter((item) => item.role !== 'member').length}{' '}
                  administradores
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Propietario:{' '}
                  <strong className="font-medium text-foreground">
                    {owner?.displayName ?? '—'}
                  </strong>
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/w/${workspace.id}/members`)}>
                    Ver miembros
                  </Button>
                  {can('member.invite') && (
                    <Button size="sm" className="text-xs" onClick={() => setInviteOpen(true)}>
                      Invitar
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-card/60 p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-muted-foreground" /> Acceso
                </h2>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p>
                    Tu rol: <strong className="font-medium text-foreground">{ROLE_META[role].label}</strong>
                  </p>
                  <p>Creado el {formatDate(workspace.createdAt)}</p>
                  <p>Miembro desde {member ? formatRelative(member.joinedAt) : 'hoy'}</p>
                </div>
                <p className="mt-4 rounded-lg bg-muted/50 p-2 text-[0.65rem] leading-relaxed text-muted-foreground">
                  Las invitaciones caducan a los 7 días. Puedes generar un enlace nuevo cuando
                  quieras.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/60 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <HardDrive className="size-4 text-muted-foreground" /> Almacenamiento de archivos
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    El backend se elige al compilar para no mezclar archivos entre sistemas.
                  </p>
                </div>
                <Badge variant="outline" className="text-[0.62rem]">
                  {storageBackend === 'firestore'
                    ? 'Firestore · Spark'
                    : storageBackend === 's3'
                      ? 'S3 compatible'
                      : 'Firebase Storage · Blaze'}
                </Badge>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  className={cn(
                    'rounded-xl border p-3',
                    freeStorage ? 'border-primary/40 bg-primary/5' : 'opacity-60',
                  )}
                >
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <Database className="size-3.5 text-primary" /> Firestore (gratuito)
                    {freeStorage && <Check className="ms-auto size-3.5 text-primary" />}
                  </p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-muted-foreground">
                    Máx. {formatBytes(FREE_FILE_SIZE_LIMIT)} por archivo. Cuota de 1 GiB compartida
                    con el resto del proyecto. Sin facturación.
                  </p>
                </div>
                <div
                  className={cn(
                    'rounded-xl border p-3',
                    storageBackend === 's3' ? 'border-primary/40 bg-primary/5' : 'opacity-60',
                  )}
                >
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <Cloud className="size-3.5 text-primary" /> S3 compatible
                    {storageBackend === 's3' && <Check className="ms-auto size-3.5 text-primary" />}
                  </p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-muted-foreground">
                    Máx. {formatBytes(MAX_FILE_SIZE)} por archivo, servido por un Worker propio
                    sobre B2, R2, MinIO o cualquier almacenamiento compatible con S3.
                  </p>
                </div>
                <div
                  className={cn(
                    'rounded-xl border p-3',
                    storageBackend === 'storage' ? 'border-primary/40 bg-primary/5' : 'opacity-60',
                  )}
                >
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <Cloud className="size-3.5 text-primary" /> Firebase Storage
                    {storageBackend === 'storage' && (
                      <Check className="ms-auto size-3.5 text-primary" />
                    )}
                  </p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-muted-foreground">
                    Máx. {formatBytes(MAX_FILE_SIZE)} por archivo. Requiere plan Blaze y no tiene
                    tope duro de gasto.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border bg-background/50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Uso actual</span>
                  <span className="text-muted-foreground">
                    {formatBytes(usedBytes)}
                    {freeStorage ? ` de ${formatBytes(FREE_STORAGE_QUOTA)}` : ''}
                  </span>
                </div>
                {freeStorage && <Progress value={usedPercent} className="mt-2 h-1.5" />}
                <p className="mt-2 text-[0.65rem] text-muted-foreground">
                  {allFiles.length} {allFiles.length === 1 ? 'archivo' : 'archivos'} (
                  {trashedFiles.length} en papelera).{' '}
                  {freeStorage
                    ? 'El contenido se carga bajo demanda.'
                    : 'Incluye archivos en papelera hasta purgarlos.'}
                </p>
              </div>

              <p className="mt-3 rounded-lg bg-muted/40 p-2.5 font-mono text-[0.65rem] text-muted-foreground">
                VITE_FILE_STORAGE={storageBackend}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-5">
            <form onSubmit={saveProfile} className="rounded-2xl border bg-card/60 p-5">
              <h2 className="text-sm font-semibold">Tu perfil</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Así te verá el equipo en mensajes, tareas y documentos.
              </p>
              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
                <UserAvatar
                  name={displayName || 'Usuario'}
                  photoURL={profile?.photoURL ?? session?.photoURL}
                  size="xl"
                  className="self-start"
                />
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Nombre visible</Label>
                    <Input
                      id="profile-name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input
                      id="profile-email"
                      value={profile?.email ?? session?.email ?? ''}
                      readOnly
                      disabled
                    />
                    <p className="text-[0.65rem] text-muted-foreground">
                      Gestionado por tu cuenta de Google.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-none gap-1.5 text-xs"
                      onClick={() => void signOut()}
                    >
                      <LogOut className="size-3.5" /> Cerrar sesión
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        savingProfile ||
                        !displayName.trim() ||
                        displayName.trim() === (profile?.displayName ?? session?.displayName)
                      }
                    >
                      <Save className="size-4" /> Guardar perfil
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="appearance" className="mt-5">
            <div className="rounded-2xl border bg-card/60 p-5">
              <h2 className="text-sm font-semibold">Apariencia</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Elige cómo se ve openQomu en este dispositivo.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { value: 'light', label: 'Claro', icon: Sun, preview: 'bg-[#fbfaff]' },
                    { value: 'dark', label: 'Oscuro', icon: Moon, preview: 'bg-[#0c0b12]' },
                    { value: 'system', label: 'Sistema', icon: Monitor, preview: 'bg-gradient-to-r from-[#fbfaff] to-[#0c0b12]' },
                  ] as Array<{ value: ThemeMode; label: string; icon: typeof Sun; preview: string }>
                ).map((option) => {
                  const Icon = option.icon
                  const active = mode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={cn(
                        'overflow-hidden rounded-xl border text-start transition-all',
                        active ? 'border-primary/50 ring-1 ring-primary/30' : 'hover:border-border',
                      )}
                    >
                      <div className={cn('h-20 border-b', option.preview)} />
                      <div className="flex items-center gap-2 p-3">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="text-xs font-medium">{option.label}</span>
                        {active && <Check className="ms-auto size-3.5 text-primary" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-5 rounded-xl bg-muted/40 p-3 text-[0.68rem] leading-relaxed text-muted-foreground">
                La preferencia se guarda en este navegador. El tema oscuro es el predeterminado de
                openQomu.
              </div>
            </div>
            <div className="mt-4">
              <NotificationPreferences />
            </div>
            <PushPreferences />
          </TabsContent>

          <TabsContent value="ai" className="mt-5">
            <McpTokensPanel uid={uid} workspaceId={workspace.id} />
          </TabsContent>

          <TabsContent value="app" className="mt-5">
            <AppDownload />
          </TabsContent>

          <TabsContent value="danger" className="mt-5 space-y-4">
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" /> Zona de peligro
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Estas acciones son permanentes. Asegúrate de que todo el equipo lo sabe.
              </p>

              <div className="mt-4 space-y-3">
                {container.mode === 'demo' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/60 p-3">
                    <div>
                      <p className="text-xs font-medium">Reiniciar datos de demostración</p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Vuelve a los datos originales de Espacio demo.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                      Reiniciar demo
                    </Button>
                  </div>
                )}

                {role !== 'owner' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/60 p-3">
                    <div>
                      <p className="text-xs font-medium">Abandonar el espacio</p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Perderás acceso hasta que te inviten de nuevo.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
                      <LogOut className="size-3.5" /> Salir
                    </Button>
                  </div>
                )}

                {role === 'owner' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-background/60 p-3">
                    <div>
                      <p className="text-xs font-medium">Eliminar el espacio</p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Borra canales, tareas, páginas, archivos y miembros.
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="size-3.5" /> Eliminar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="¿Abandonar este espacio?"
        description="Dejarás de tener acceso a sus canales, tareas y documentos."
        confirmLabel="Abandonar espacio"
        onConfirm={async () => {
          try {
            await container.workspaces.removeMember(workspace.id, uid)
            toast.success('Has abandonado el espacio.')
            window.location.assign('/app')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo abandonar el espacio.')
          }
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar el espacio para siempre?"
        description={`Se eliminará “${workspace.name}” con todos sus canales, tableros, páginas y archivos.`}
        confirmLabel="Eliminar definitivamente"
        onConfirm={async () => {
          try {
            await container.workspaces.remove(workspace.id)
            toast.success('Espacio eliminado.')
            window.location.assign('/app')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el espacio.')
          }
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="¿Reiniciar los datos demo?"
        description="Se restaurarán los datos semilla de Espacio demo. Los cambios locales se perderán."
        confirmLabel="Reiniciar demo"
        onConfirm={async () => {
          await container.resetDemo?.()
          toast.success('Datos demo restaurados.')
          navigate('/app')
        }}
      />
    </div>
  )
}

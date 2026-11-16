import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Hash,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Logo, BrandMark } from '@/presentation/components/brand/logo'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaces } from '@/app/workspaces-provider'
import { createWorkspaceWithDefaults } from '@/app/create-workspace-with-defaults'
import { cn } from '@/lib/utils'

const ICONS = ['🪐', '🚀', '✨', '🧩', '🌊', '🔭', '🎯', '🛠️', '🌱', '⚡']

export function OnboardingPage() {
  const { session, profile, signOut } = useAuth()
  const { workspaces, rememberWorkspace, registerWorkspace } = useWorkspaces()
  const container = useContainer()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const forceNew = searchParams.get('new') === '1'

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🪐')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!session) return <Navigate to="/" replace />
  if (workspaces.length > 0 && !forceNew) return <Navigate to="/app" replace />

  const displayName = profile?.displayName ?? session.displayName

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setPending('create')
    setError(null)
    try {
      const workspaceUser = {
        ...session,
        displayName: profile?.displayName ?? session.displayName,
        photoURL: profile?.photoURL ?? session.photoURL,
      }
      const { workspace } = await createWorkspaceWithDefaults(container, workspaceUser, {
        name,
        icon,
        description,
      })
      registerWorkspace(workspace)
      rememberWorkspace(workspace.id)
      toast.success(`“${workspace.name}” está listo.`)
      navigate(`/w/${workspace.id}/dashboard`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el espacio.')
    } finally {
      setPending(null)
    }
  }

  const join = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!code.trim()) return
    setPending('join')
    setError(null)
    try {
      const workspace = await container.workspaces.acceptInvite(code.trim().toUpperCase(), session)
      registerWorkspace(workspace)
      rememberWorkspace(workspace.id)
      toast.success(`Te has unido a ${workspace.name}.`)
      navigate(`/w/${workspace.id}/dashboard`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo unir al espacio.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-e bg-sidebar p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0 hero-grid opacity-50" />
        <div className="pointer-events-none absolute -start-20 top-1/3 size-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <Logo subtitle="Un espacio en sintonía" />
          <h1 className="mt-14 max-w-md text-4xl font-semibold leading-[1.08] tracking-[-0.045em]">
            Empieza donde termina el ruido.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Crea tu espacio, invita al equipo y ten conversaciones, tareas y documentos en un mismo
            lugar.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              'Canales en tiempo real',
              'Kanban con responsables y fechas',
              'Documentos que se guardan solos',
              'Invitaciones seguras con caducidad',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-muted-foreground">
                <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <Check className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-3 rounded-2xl border bg-card/50 p-4 backdrop-blur">
          <BrandMark className="size-10" />
          <div>
            <p className="text-sm font-medium">Todo en un mismo flujo</p>
            <p className="text-xs text-muted-foreground">
              La conversación se convierte en tarea. La tarea, en decisión documentada.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-5">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ms-auto flex items-center gap-2">
            {workspaces.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <button type="button" onClick={() => navigate('/app')}>
                  <ArrowLeft className="size-4" /> Volver
                </button>
              </Button>
            )}
            <div className="flex items-center gap-2 rounded-full border bg-card/60 py-1 ps-1 pe-2">
              <UserAvatar name={displayName} photoURL={profile?.photoURL} size="xs" />
              <span className="max-w-28 truncate text-xs">{displayName}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={() => {
                void signOut()
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Configura tu espacio
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                {workspaces.length > 0 ? 'Crea otro espacio de trabajo' : 'Bienvenido a openQomu'}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Crea un espacio nuevo o únete al de tu equipo con un código.
              </p>
            </div>

            <Tabs defaultValue="create">
              <TabsList className="w-full">
                <TabsTrigger value="create" className="flex-1">
                  <Plus className="size-3.5" /> Crear espacio
                </TabsTrigger>
                <TabsTrigger value="join" className="flex-1">
                  <KeyRound className="size-3.5" /> Unirme con código
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-5">
                <form onSubmit={create} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Nombre del espacio</Label>
                    <Input
                      id="workspace-name"
                      autoFocus
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Studio Norte"
                      maxLength={60}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Icono</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setIcon(emoji)}
                          className={cn(
                            'grid size-9 place-items-center rounded-lg border text-lg transition-all',
                            icon === emoji
                              ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/30'
                              : 'hover:bg-muted',
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-description">Descripción</Label>
                    <Textarea
                      id="workspace-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="¿Qué hace este equipo?"
                      rows={3}
                      maxLength={300}
                    />
                  </div>
                  {error && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full gap-2" disabled={pending !== null || !name.trim()}>
                    {pending === 'create' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Crear espacio de trabajo
                  </Button>
                  <p className="text-center text-[0.7rem] text-muted-foreground">
                    Incluye canales, un tablero y una página de bienvenida.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="join" className="mt-5">
                <form onSubmit={join} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-code">Código de invitación</Label>
                    <Input
                      id="invite-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                      placeholder="QOMU123ABC"
                      className="font-mono tracking-widest"
                      maxLength={10}
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Te lo habrá compartido un administrador. También puedes abrir el enlace de
                      invitación directamente.
                    </p>
                  </div>
                  {error && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full gap-2" disabled={pending !== null || code.length < 6}>
                    {pending === 'join' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    Unirme al espacio
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-8 flex items-center gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Hash className="size-4 shrink-0 text-primary" />
              <span>
                Después podrás personalizar el icono, el nombre y los miembros desde Ajustes.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

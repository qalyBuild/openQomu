import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CalendarClock, Loader2, LogIn, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Logo, BrandMark } from '@/presentation/components/brand/logo'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaces } from '@/app/workspaces-provider'
import type { Invite } from '@/domain/entities/identity'
import { isInviteExpired } from '@/domain/services/workspace-service'
import { formatDate } from '@/lib/date'

export function JoinPage() {
  const { code = '' } = useParams()
  const container = useContainer()
  const { status, session, profile, pending, error, signInWithGoogle } = useAuth()
  const { rememberWorkspace, registerWorkspace } = useWorkspaces()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    container.workspaces
      .getInvite(code)
      .then((result) => {
        if (!cancelled) setInvite(result)
      })
      .catch(() => {
        if (!cancelled) setInvite(null)
      })
    return () => {
      cancelled = true
    }
  }, [code, container])

  const join = async () => {
    if (!session) return
    setJoining(true)
    setJoinError(null)
    try {
      const workspace = await container.workspaces.acceptInvite(code, {
        ...session,
        displayName: profile?.displayName ?? session.displayName,
        photoURL: profile?.photoURL ?? session.photoURL,
      })
      registerWorkspace(workspace)
      rememberWorkspace(workspace.id)
      toast.success(`Te has unido a ${workspace.name}.`)
      navigate(`/w/${workspace.id}/dashboard`, { replace: true })
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : 'No se pudo aceptar la invitación.')
    } finally {
      setJoining(false)
    }
  }

  const invalid = invite === null
  const expired = invite ? isInviteExpired(invite) : false

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-5 py-10">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-0 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="surface-glow rounded-2xl border bg-card/80 p-6 backdrop-blur sm:p-8">
          {invite === undefined || status === 'loading' ? (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Comprobando invitación…
            </div>
          ) : invalid || expired ? (
            <div className="text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldCheck className="size-6" />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">
                {expired ? 'La invitación ha caducado' : 'Invitación no válida'}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Pide a un administrador del espacio que genere un enlace nuevo.
              </p>
              <Button className="mt-5 w-full" onClick={() => navigate('/app', { replace: true })}>
                Ir a openQomu
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <BrandMark className="mx-auto size-12" />
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Invitación a openQomu
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  Te han invitado a un espacio
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Únete para conversar, organizar tareas y documentar el trabajo con el equipo.
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  Caduca el {formatDate(invite.expiresAt)}
                </span>
                <span className="font-mono font-medium text-foreground">{invite.code}</span>
              </div>

              {(joinError || error) && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {joinError ?? error}
                </p>
              )}

              <div className="mt-5 space-y-2">
                {session ? (
                  <Button className="w-full gap-2" onClick={() => void join()} disabled={joining}>
                    {joining ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    Unirme al espacio
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => void signInWithGoogle()}
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : container.mode === 'demo' ? (
                      <Sparkles className="size-4" />
                    ) : (
                      <LogIn className="size-4" />
                    )}
                    {container.mode === 'demo'
                      ? 'Entrar a la demo y unirme'
                      : 'Iniciar sesión con Google'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => navigate('/app', { replace: true })}
                >
                  Ahora no
                </Button>
              </div>
              {!session && (
                <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
                  Después de iniciar sesión volverás a esta invitación automáticamente.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Copy, Link2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { buildInviteLink } from '@/domain/services/workspace-service'
import { formatDate } from '@/lib/date'
import { publicAppOrigin } from '@/lib/app-url'
import type { Invite } from '@/domain/entities/identity'

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { mode, workspaces } = useContainer()
  const { workspace, uid, can } = useWorkspaceData()
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const allowed = can('member.invite')

  useEffect(() => {
    if (!open || !allowed) return
    let cancelled = false
    setInvites(null)
    setLoadError(false)
    void workspaces.listInvites(workspace.id).then(
      (items) => { if (!cancelled) setInvites(items) },
      () => { if (!cancelled) setLoadError(true) },
    )
    return () => { cancelled = true }
  }, [allowed, open, workspace.id, workspaces])

  const createInvite = async () => {
    setBusy(true)
    try {
      const invite = await workspaces.createInvite(workspace.id, uid)
      setInvites((items) => [invite, ...(items ?? [])])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la invitación.')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (code: string) => {
    setBusy(true)
    try {
      await workspaces.revokeInvite(code)
      setInvites((items) => items?.filter((invite) => invite.code !== code) ?? null)
      toast.success('Enlace revocado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo revocar la invitación.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (code: string) => {
    const link = buildInviteLink(code, publicAppOrigin())
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = link
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied) {
        toast.error('No se pudo copiar el enlace.')
        return
      }
    }
    toast.success('Enlace copiado al portapapeles.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Link2 className="size-4" />
            </span>
            Invita a tu equipo
          </DialogTitle>
          <DialogDescription>
            Los enlaces permiten unirse a {workspace.name} como miembro y caducan en 7 días.
          </DialogDescription>
        </DialogHeader>

        {!allowed ? (
          <p className="text-sm text-muted-foreground">
            Solo propietarios y administradores pueden gestionar invitaciones.
          </p>
        ) : (
          <>
            <div className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
              {loadError && <p className="text-sm text-destructive">No se pudieron cargar las invitaciones.</p>}
              {invites === null && !loadError && <p className="text-sm text-muted-foreground">Cargando enlaces…</p>}
              {invites?.length === 0 && <p className="text-sm text-muted-foreground">No hay enlaces activos.</p>}
              {invites?.map(({ code, expiresAt }) => (
                <div key={code} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm">{code}</p>
                    <p className="text-xs text-muted-foreground">Caduca el {formatDate(expiresAt)}</p>
                  </div>
                  <Button variant="outline" size="icon" disabled={busy} aria-label={`Copiar enlace ${code}`} onClick={() => void copy(code)}>
                    <Copy />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={`Revocar enlace ${code}`} onClick={() => void revoke(code)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            {mode === 'demo' && <p className="text-xs text-muted-foreground">En la demo, los enlaces solo funcionan en este navegador.</p>}
            <DialogFooter>
              <Button disabled={invites === null || busy || !uid} onClick={() => void createInvite()}>
                <Plus />
                Crear enlace
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

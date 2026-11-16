import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, Copy, Link2, RefreshCw } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
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
  const container = useContainer()
  const { workspace, uid, can } = useWorkspaceData()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const allowed = can('member.invite')

  const generate = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    try {
      const created = await container.workspaces.createInvite(workspace.id, uid)
      setInvite(created)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la invitación.')
    } finally {
      setLoading(false)
    }
  }, [container, uid, workspace.id])

  useEffect(() => {
    if (open && allowed && !invite) void generate()
  }, [allowed, generate, invite, open])

  const link = invite ? buildInviteLink(invite.code, publicAppOrigin()) : ''

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = link
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    toast.success('Enlace copiado al portapapeles.')
    window.setTimeout(() => setCopied(false), 2000)
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
            Comparte este enlace con quien quieras que se una a{' '}
            <strong className="font-medium text-foreground">{workspace.name}</strong>. Caduca en 7
            días.
          </DialogDescription>
        </DialogHeader>

        {!allowed ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            Solo propietarios y administradores pueden crear invitaciones.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={invite ? link : 'Generando enlace…'}
                className="font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => void copy()}
                disabled={!invite}
                aria-label="Copiar enlace"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {invite ? `Caduca el ${formatDate(invite.expiresAt)}` : 'Generando…'}
              </span>
              <span>
                Código: <strong className="font-mono text-foreground">{invite?.code ?? '—'}</strong>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Al abrir el enlace, la persona inicia sesión con Google y se une automáticamente como
              miembro.
              {container.mode === 'demo' && (
                <span className="mt-1 block text-amber-600 dark:text-amber-400">
                  En modo demo los datos son locales a este navegador, así que el enlace sirve como
                  demostración del flujo.
                </span>
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => void generate()} disabled={!allowed || loading}>
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            Generar otro
          </Button>
          <Button onClick={() => void copy()} disabled={!invite}>
            <Copy className="size-4" />
            Copiar enlace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

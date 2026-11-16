import { useEffect, useState } from 'react'
import { BellRing, Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth, useContainer } from '@/app/auth-provider'
import type { PushDevice } from '@/domain/entities/push'

/** Ajustes de push nativo; solo se muestra en la app Android. */
export function PushPreferences() {
  const container = useContainer()
  const { session } = useAuth()
  const gateway = container.pushGateway
  const supported = gateway.isSupported()
  const [device, setDevice] = useState<PushDevice | null>(null)
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>(
    'unsupported',
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    void (async () => {
      const state = await gateway.permission().catch(() => ({ status: 'prompt' as const }))
      if (!cancelled) setPermission(state.status)
      if (!session) return
      const current = await container.devices.get(session.id, gateway.deviceId()).catch(() => null)
      if (!cancelled) setDevice(current)
    })()
    return () => {
      cancelled = true
    }
  }, [container, gateway, session, supported])

  if (!supported) return null

  const enabled = device?.enabled ?? false

  const toggle = async () => {
    if (!session || busy) return
    setBusy(true)
    try {
      if (enabled) {
        await container.devices.setEnabled(session.id, gateway.deviceId(), false)
        setDevice((current) => (current ? { ...current, enabled: false } : current))
        toast.success('Notificaciones push desactivadas en este dispositivo.')
        return
      }

      const requested = await gateway.requestPermission()
      setPermission(requested.status)
      if (requested.status !== 'granted') {
        toast.error('Android ha bloqueado las notificaciones. Actívalas en los ajustes del sistema.')
        return
      }
      const current = await container.devices.get(session.id, gateway.deviceId())
      if (current) {
        await container.devices.setEnabled(session.id, gateway.deviceId(), true)
        setDevice({ ...current, enabled: true })
      }
      await gateway.register()
      toast.success('Notificaciones push activadas.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el push.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border bg-card/60 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Smartphone className="size-4" /> Notificaciones push
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Recibe avisos de mensajes, menciones, tareas y comentarios aunque la app esté cerrada.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => void toggle()}
          disabled={busy}
          className="gap-1.5"
          aria-pressed={enabled}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <BellRing className="size-3.5" />}
          {enabled ? 'Push activado' : 'Activar push'}
        </Button>
        <span className="text-[0.68rem] text-muted-foreground">
          {permission === 'denied'
            ? 'Permiso bloqueado en Android: actívalo en Ajustes → Apps → openQomu → Notificaciones.'
            : permission === 'granted'
              ? 'Permiso concedido en Android.'
              : 'Android pedirá permiso la primera vez.'}
        </span>
      </div>
    </div>
  )
}

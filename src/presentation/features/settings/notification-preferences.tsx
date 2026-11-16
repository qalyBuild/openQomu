import { Bell, BellOff, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NOTIFICATION_SOUNDS } from '@/lib/notification-sound'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/presentation/features/notifications/notifications-provider'

/** Ajustes de sonido de los avisos, dentro de Ajustes → Apariencia. */
export function NotificationPreferences() {
  const {
    soundEnabled,
    volume,
    soundId,
    toggleSound,
    setVolume,
    setSoundId,
    previewSound,
  } = useNotifications()
  const percent = Math.round(volume * 100)
  const canPreview = soundEnabled && volume > 0

  return (
    <div className="rounded-2xl border bg-card/60 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="size-4" /> Notificaciones
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Elige cómo suenan los avisos de la sidebar en este dispositivo.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
          aria-label="Volumen del sonido de notificaciones"
          className="h-1.5 flex-1 cursor-pointer accent-primary"
        />
        <span className="w-10 text-end text-xs tabular-nums text-muted-foreground">
          {percent}%
        </span>
      </div>

      <fieldset className="mt-5">
        <legend className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sonido
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NOTIFICATION_SOUNDS.map((sound) => {
            const active = sound.id === soundId
            return (
              <button
                key={sound.id}
                type="button"
                aria-pressed={active}
                title={sound.description}
                onClick={() => {
                  setSoundId(sound.id)
                  previewSound(sound.id)
                }}
                className={cn(
                  'rounded-xl border px-3 py-2 text-start transition-colors',
                  active
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                    : 'hover:border-border hover:bg-muted/40',
                )}
              >
                <span className="block text-xs font-medium">{sound.name}</span>
                <span className="mt-0.5 block truncate text-[0.62rem] text-muted-foreground">
                  {sound.description}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => previewSound()} disabled={!canPreview}>
          Probar sonido
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          className="gap-1.5"
        >
          {soundEnabled ? (
            <>
              <Bell className="size-3.5" /> Sonido activado
            </>
          ) : (
            <>
              <BellOff className="size-3.5" /> Sonido silenciado
            </>
          )}
        </Button>
        <span className="text-[0.68rem] text-muted-foreground">
          El sonido se guarda en este navegador.
        </span>
      </div>
    </div>
  )
}

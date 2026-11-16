import { cn } from '@/lib/utils'

/**
 * Burbuja flotante con el número de avisos pendientes de un lugar concreto.
 * Cambia de tamaño con el contador y hace «pop» al aparecer, para que se note
 * sin interrumpir. Las menciones usan el tono rosa y el resto el primario.
 */
export function NotificationBadge({
  count,
  mention = false,
  label,
  className,
}: {
  count: number
  mention?: boolean
  label: string
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      key={count}
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        'animate-notification-pop pointer-events-none inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[0.6rem] font-semibold leading-none tabular-nums text-white shadow-sm ring-2 ring-sidebar',
        mention ? 'bg-rose-500' : 'bg-primary',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

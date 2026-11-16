import { cn } from '@/lib/utils'

export function WorkspaceIcon({
  icon,
  name,
  className,
}: {
  icon: string
  name?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-base shadow-sm',
        className,
      )}
      title={name}
    >
      {icon || '🪐'}
    </span>
  )
}

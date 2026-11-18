import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/app/theme-provider'
import { cn } from '@/lib/utils'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const Icon = resolvedTheme === 'dark' ? Moon : Sun
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar tema"
      title={compact ? 'Cambiar tema' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
        compact && 'h-9 justify-center',
      )}
    >
      {!compact && <span className="truncate">Apariencia</span>}
      <Icon className={cn('size-3.5', !compact && 'ms-auto')} />
    </button>
  )
}

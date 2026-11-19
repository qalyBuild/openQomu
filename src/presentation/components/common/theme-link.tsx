import { Link } from 'react-router-dom'
import { Palette } from 'lucide-react'
import { useTheme } from '@/app/theme-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { cn } from '@/lib/utils'

export function ThemeLink({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme()
  const { workspace } = useWorkspaceData()
  return (
    <Link
      to={`/w/${workspace.id}/themes`}
      aria-label={compact ? 'Temas' : undefined}
      title={compact ? 'Temas' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
        compact && 'h-9 justify-center',
      )}
    >
      {!compact && <span className="truncate">{theme.name}</span>}
      <Palette className={cn('size-3.5', !compact && 'ms-auto')} />
    </Link>
  )
}

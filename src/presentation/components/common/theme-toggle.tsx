import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/app/theme-provider'

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar tema"
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
    >
      <span className="truncate">Apariencia</span>
      {resolvedTheme === 'dark' ? (
        <Moon className="ms-auto size-3.5" />
      ) : (
        <Sun className="ms-auto size-3.5" />
      )}
    </button>
  )
}

import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useTheme, type ThemeMode } from '@/app/theme-provider'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import type { Workspace } from '@/domain/entities/identity'
import { cn } from '@/lib/utils'

export function UserMenu({ workspace }: { workspace: Workspace }) {
  const { profile, session, signOut } = useAuth()
  const { mode, setMode } = useTheme()
  const container = useContainer()
  const navigate = useNavigate()
  const name = profile?.displayName ?? session?.displayName ?? 'Mi cuenta'
  const email = profile?.email ?? session?.email ?? ''

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  const resetDemo = async () => {
    if (!container.resetDemo) return
    await container.resetDemo()
    toast.success('Datos de demostración restaurados.')
    navigate('/app')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 rounded-full ps-1 pe-2 hover:bg-muted">
          <UserAvatar
            name={name}
            photoURL={profile?.photoURL ?? session?.photoURL}
            size="sm"
          />
          <span className="hidden max-w-28 truncate text-xs font-medium sm:inline">{name}</span>
          <ChevronsUpDown className="hidden size-3 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5 py-1">
            <UserAvatar
              name={name}
              photoURL={profile?.photoURL ?? session?.photoURL}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(`/w/${workspace.id}/settings?tab=profile`)}>
          <UserRound className="size-4" /> Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/w/${workspace.id}/settings`)}>
          <Settings className="size-4" /> Ajustes del espacio
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="size-4" /> Apariencia
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {themeOptions.map((option) => {
              const Icon = option.icon
              return (
                <DropdownMenuItem key={option.value} onClick={() => setMode(option.value)}>
                  <Icon className="size-4" /> {option.label}
                  <Check className={cn('ms-auto size-3.5', mode !== option.value && 'opacity-0')} />
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {container.mode === 'demo' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void resetDemo()}>
              <RotateCcw className="size-4" /> Reiniciar datos demo
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void signOut().then(() => navigate('/'))
          }}
        >
          <LogOut className="size-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

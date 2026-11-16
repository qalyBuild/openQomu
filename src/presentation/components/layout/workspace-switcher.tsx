import { useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus, Settings, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Workspace } from '@/domain/entities/identity'
import { useWorkspaces } from '@/app/workspaces-provider'
import { WorkspaceIcon } from '@/presentation/components/common/workspace-icon'

export function WorkspaceSwitcher({ workspace }: { workspace: Workspace }) {
  const { workspaces } = useWorkspaces()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2.5 rounded-xl px-2 py-2 text-start hover:bg-sidebar-accent"
        >
          <WorkspaceIcon icon={workspace.icon} name={workspace.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold tracking-tight">
              {workspace.name}
            </span>
            <span className="block truncate text-[0.7rem] text-muted-foreground">
              {workspaces.length} {workspaces.length === 1 ? 'espacio' : 'espacios'}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Tus espacios
        </DropdownMenuLabel>
        {workspaces.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onClick={() => navigate(`/w/${item.id}/dashboard`)}
            className="gap-2.5 py-2"
          >
            <WorkspaceIcon icon={item.icon} className="size-6 rounded-lg text-xs" />
            <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
            {item.id === workspace.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/onboarding?new=1')} className="gap-2">
          <span className="grid size-5 place-items-center rounded-md border border-dashed border-border">
            <Plus className="size-3" />
          </span>
          Crear espacio
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/w/${workspace.id}/settings`)} className="gap-2">
          <Settings className="size-4 text-muted-foreground" />
          Ajustes del espacio
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 px-2 py-1.5 text-[0.7rem] text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          openQomu · conversaciones, tareas y notas
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

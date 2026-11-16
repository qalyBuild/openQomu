import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  FolderOpen,
  Hash,
  KanbanSquare,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Search,
  Settings,
  UserRound,
  Users,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import type { Task } from '@/domain/entities/kanban'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { fileKindLabel } from '@/domain/services/file-service'

interface TaskWithBoard extends Task {
  boardName: string
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const container = useContainer()
  const { workspace, channels, boards, pages, members, files } = useWorkspaceData()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskWithBoard[]>([])

  useEffect(() => {
    if (!open || boards.length === 0) return
    let cancelled = false
    void Promise.all(
      boards.map(async (board) => {
        const items = await container.tasks.list(workspace.id, board.id)
        return items.map((task) => ({ ...task, boardName: board.name }))
      }),
    )
      .then((groups) => {
        if (!cancelled) setTasks(groups.flat())
      })
      .catch(() => {
        if (!cancelled) setTasks([])
      })
    return () => {
      cancelled = true
    }
  }, [boards, container, open, workspace.id])

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40),
    [tasks],
  )

  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar en openQomu"
      description="Busca canales, tableros, páginas, tareas y personas"
      className="sm:max-w-xl"
    >
      <CommandInput placeholder="Busca canales, tareas, páginas o personas…" />
      <CommandList className="max-h-[430px]">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <Search className="size-5 opacity-50" />
            No encontramos nada con esa búsqueda.
          </div>
        </CommandEmpty>

        <CommandGroup heading="Ir a">
          <CommandItem
            value="panel resumen inicio dashboard"
            onSelect={() => run(() => navigate(`/w/${workspace.id}/dashboard`))}
          >
            <LayoutDashboard className="size-4" /> Resumen
          </CommandItem>
          <CommandItem
            value="chat canales conversaciones mensajes"
            onSelect={() =>
              run(() =>
                navigate(
                  channels[0]
                    ? `/w/${workspace.id}/c/${channels[0].id}`
                    : `/w/${workspace.id}/dashboard`,
                ),
              )
            }
          >
            <MessageSquare className="size-4" /> Chat
          </CommandItem>
          <CommandItem
            value="tableros kanban tareas"
            onSelect={() =>
              run(() =>
                navigate(
                  boards[0]
                    ? `/w/${workspace.id}/boards/${boards[0].id}`
                    : `/w/${workspace.id}/boards`,
                ),
              )
            }
          >
            <KanbanSquare className="size-4" /> Tableros
          </CommandItem>
          <CommandItem
            value="paginas documentos notas"
            onSelect={() => run(() => navigate(`/w/${workspace.id}/pages`))}
          >
            <FileText className="size-4" /> Documentos
          </CommandItem>
          <CommandItem
            value="archivos biblioteca files"
            onSelect={() => run(() => navigate(`/w/${workspace.id}/files`))}
          >
            <FolderOpen className="size-4" /> Archivos
          </CommandItem>
          <CommandItem
            value="miembros equipo personas"
            onSelect={() => run(() => navigate(`/w/${workspace.id}/members`))}
          >
            <Users className="size-4" /> Miembros
          </CommandItem>
          <CommandItem
            value="ajustes configuracion settings"
            onSelect={() => run(() => navigate(`/w/${workspace.id}/settings`))}
          >
            <Settings className="size-4" /> Ajustes
          </CommandItem>
        </CommandGroup>

        {channels.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Canales">
              {channels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={`canal ${channel.name} ${channel.description}`}
                  onSelect={() => run(() => navigate(`/w/${workspace.id}/c/${channel.id}`))}
                >
                  {channel.type === 'private' ? (
                    <Lock className="size-4" />
                  ) : (
                    <Hash className="size-4" />
                  )}
                  <span className="truncate">{channel.name}</span>
                  <span className="ms-auto max-w-[45%] truncate text-xs text-muted-foreground">
                    {channel.description}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {boards.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tableros">
              {boards.map((board) => (
                <CommandItem
                  key={board.id}
                  value={`tablero ${board.name} ${board.description}`}
                  onSelect={() =>
                    run(() => navigate(`/w/${workspace.id}/boards/${board.id}`))
                  }
                >
                  <KanbanSquare className="size-4" />
                  <span>{board.name}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {board.columns.length} columnas
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {pages.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Páginas">
              {pages.map((page) => (
                <CommandItem
                  key={page.id}
                  value={`pagina ${page.title} ${page.content.slice(0, 200)}`}
                  onSelect={() =>
                    run(() => navigate(`/w/${workspace.id}/pages/${page.id}`))
                  }
                >
                  <span className="text-base leading-none">{page.icon}</span>
                  <span className="truncate">{page.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {sortedTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tareas">
              {sortedTasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`tarea ${task.title} ${task.description} ${task.labels.join(' ')} ${task.boardName}`}
                  onSelect={() =>
                    run(() =>
                      navigate(
                        `/w/${workspace.id}/boards/${task.boardId}?task=${task.id}`,
                      ),
                    )
                  }
                >
                  <span
                    className="size-1.5 rounded-full"
                    data-priority={task.priority}
                    style={{
                      background:
                        task.priority === 'urgent'
                          ? '#fb7185'
                          : task.priority === 'high'
                            ? '#fbbf24'
                            : task.priority === 'low'
                              ? '#38bdf8'
                              : task.priority === 'paused'
                                ? '#94a3b8'
                                : '#a78bfa',
                    }}
                  />
                  <span className="truncate">{task.title}</span>
                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                    {task.boardName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {members.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Personas">
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`persona ${member.displayName} ${member.email}`}
                  onSelect={() =>
                    run(() =>
                      navigate(`/w/${workspace.id}/members?member=${member.uid}`),
                    )
                  }
                >
                  <UserAvatar
                    name={member.displayName}
                    photoURL={member.photoURL}
                    size="xs"
                  />
                  <span>{member.displayName}</span>
                  <span className="ms-auto text-xs text-muted-foreground">{member.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {files.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Archivos">
              {files.slice(0, 12).map((file) => (
                <CommandItem
                  key={file.id}
                  value={`archivo ${file.name} ${fileKindLabel(file)}`}
                  onSelect={() =>
                    run(() => navigate(`/w/${workspace.id}/files?file=${file.id}`))
                  }
                >
                  <FolderOpen className="size-4" />
                  <span className="truncate">{file.name}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {fileKindLabel(file)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Cuenta">
          <CommandItem
            value="perfil cuenta usuario"
            onSelect={() => run(() => navigate(`/w/${workspace.id}/settings?tab=profile`))}
          >
            <UserRound className="size-4" /> Mi perfil
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

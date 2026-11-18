import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Clock3, KanbanSquare, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Board, Task } from '@/domain/entities/kanban'
import { summarizeBoard } from '@/domain/services/task-service'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { BoardDialog } from '@/presentation/features/kanban/board-dialog'
import { BoardStatusBadge } from '@/presentation/features/kanban/board-status-badge'
import { UserAvatar } from '@/presentation/components/common/user-avatar'

interface BoardStats {
  board: Board
  tasks: Task[]
}

export function BoardsPage() {
  const { workspace, boards, members, can, loading } = useWorkspaceData()
  const container = useContainer()
  const [stats, setStats] = useState<BoardStats[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setStats(null)
    void Promise.all(
      boards.map(async (board) => ({
        board,
        tasks: await container.tasks.list(workspace.id, board.id),
      })),
    )
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch(() => {
        if (!cancelled) setStats(boards.map((board) => ({ board, tasks: [] })))
      })
    return () => {
      cancelled = true
    }
  }, [boards, container, workspace.id])

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-5 pb-12 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Kanban</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Tableros</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Organiza el trabajo en columnas, asigna responsables y sigue el avance.
            </p>
          </div>
          {can('board.create') && (
            <BoardDialog
              trigger={
                <Button className="gap-1.5">
                  <Plus className="size-4" /> Nuevo tablero
                </Button>
              }
            />
          )}
        </div>

        {loading || stats === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <EmptyState
            icon={KanbanSquare}
            title="Aún no hay tableros"
            description="Crea un tablero para planificar el sprint, el lanzamiento o lo que necesite el equipo."
            action={
              <BoardDialog
                trigger={
                  <Button>
                    <Plus className="size-4" /> Crear tablero
                  </Button>
                }
              />
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map(({ board, tasks }) => {
              const summary = summarizeBoard(tasks, board.columns)
              const activeMembers = members
                .filter((member) => tasks.some((task) => task.assigneeIds.includes(member.uid)))
                .slice(0, 4)
              return (
                <Link key={board.id} to={`/w/${workspace.id}/boards/${board.id}`} className="group">
                  <Card className="h-full border-border/70 bg-card/70 py-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-lg group-hover:shadow-primary/5">
                    <CardContent className="space-y-4 px-4">
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl border bg-primary/5 text-primary">
                          <KanbanSquare className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-sm font-semibold tracking-tight">{board.name}</h2>
                            <BoardStatusBadge status={board.status} />
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {board.description || 'Sin descripción'}
                          </p>
                        </div>
                        <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
                          <span>{summary.completionRate}% completado</span>
                          <span>
                            {summary.completed}/{summary.total}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                            style={{ width: `${summary.completionRate}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[0.65rem] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3" /> {summary.open} abiertas
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-500" /> {summary.completed}
                        </span>
                        {summary.overdue > 0 && (
                          <span className="text-rose-500">{summary.overdue} vencidas</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-border/60 pt-3">
                        <div className="flex -space-x-1.5">
                          {activeMembers.map((member) => (
                            <UserAvatar
                              key={member.id}
                              name={member.displayName}
                              photoURL={member.photoURL}
                              size="xs"
                              className="ring-2 ring-card"
                            />
                          ))}
                          {activeMembers.length === 0 && (
                            <span className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                              <Users className="size-3" /> Sin asignar
                            </span>
                          )}
                        </div>
                        <span className="text-[0.65rem] text-muted-foreground">
                          {board.columns.length} columnas
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        <div className="rounded-2xl border bg-muted/30 p-4">
          <p className="text-xs font-medium">Consejo</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Arrastra las tarjetas entre columnas y usa el panel de detalle para asignar responsables,
            fechas y adjuntos. También puedes abrir una tarea desde la búsqueda global con ⌘K.
          </p>
        </div>
      </div>
    </div>
  )
}

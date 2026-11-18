import { BoardSelectOptions } from '@/presentation/features/kanban/board-choices'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  Flame,
  KanbanSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useWorkspaceTasks } from '@/presentation/hooks/use-data'
import { buildDashboard } from '@/domain/services/analytics-service'
import { isTaskCompleted } from '@/domain/services/task-service'
import { mergeBoardColumns } from '@/domain/entities/kanban'
import { PRIORITY_META } from '@/domain/entities/identity'
import { formatRelative } from '@/lib/date'
import { isRecentlyActive } from '@/lib/presence'
import { UserAvatar, AvatarStack } from '@/presentation/components/common/user-avatar'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { DueDateBadge, PriorityBadge } from '@/presentation/components/common/badges'
import { BoardDialog } from '@/presentation/features/kanban/board-dialog'
import { EvilAreaChart } from '@/components/evilcharts/charts/recharts-area-chart'
import { EvilBarChart } from '@/components/evilcharts/charts/recharts-bar-chart'
import { EvilPieChart } from '@/components/evilcharts/charts/recharts-pie-chart'
import type { ChartConfig } from '@/components/evilcharts/ui/recharts-chart'

const trendConfig = {
  created: { label: 'Creadas', colors: { light: ['#8b5cf6'], dark: ['#a78bfa'] } },
  completed: { label: 'Completadas', colors: { light: ['#10b981'], dark: ['#34d399'] } },
} satisfies ChartConfig

const workloadConfig = {
  open: { label: 'Abiertas', colors: { light: ['#8b5cf6'], dark: ['#a78bfa'] } },
  completed: { label: 'Completadas', colors: { light: ['#14b8a6'], dark: ['#2dd4bf'] } },
} satisfies ChartConfig

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  loading,
}: {
  label: string
  value: string | number
  hint: string
  icon: typeof CheckCircle2
  accent: string
  loading?: boolean
}) {
  return (
    <Card className="relative overflow-hidden border-border/70 bg-card/70 py-4">
      <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full opacity-10 blur-xl" style={{ background: accent }} />
      <CardContent className="flex items-start justify-between px-4">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1.5 text-3xl font-semibold tracking-[-0.05em]">{value}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl border bg-background/80"
          style={{ color: accent }}
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { workspace, members, boards, pages } = useWorkspaceData()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [boardId, setBoardId] = useState('all')
  const board = boards.find((item) => item.id === boardId)
  const boardIds = useMemo(() => boards.map((item) => item.id), [boards])
  const { tasks: workspaceTasks, tasksByBoard, loading } = useWorkspaceTasks(
    workspace.id,
    boardIds,
  )
  const tasks = boardId === 'all' ? workspaceTasks : (tasksByBoard[boardId] ?? [])
  const activeColumns = useMemo(
    () => (boardId === 'all' ? mergeBoardColumns(boards) : (board?.columns ?? [])),
    [board, boardId, boards],
  )

  useEffect(() => {
    if (boardId !== 'all' && !boards.some((item) => item.id === boardId)) {
      setBoardId('all')
    }
  }, [boardId, boards])

  const metrics = useMemo(
    () => buildDashboard(tasks, activeColumns, members),
    [activeColumns, members, tasks],
  )

  const workloadData = metrics.workload
    .filter((item) => item.total > 0)
    .slice(0, 7)
    .map((item) => ({
      name: item.name.split(' ')[0],
      open: item.open,
      completed: item.completed,
    }))

  const pieData = metrics.byStatus.filter((status) => status.count > 0).map((status) => ({
    name: status.columnId,
    value: status.count,
  }))
  const pieConfig = Object.fromEntries(
    metrics.byStatus.map((status) => [
      status.columnId,
      { label: status.label, colors: { light: [status.color], dark: [status.color] } },
    ]),
  ) satisfies ChartConfig
  const today = new Date()
  const firstName = (profile?.displayName ?? 'equipo').split(' ')[0]
  const recentTasks = [...tasks]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
  const recentPages = [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)

  if (boards.length === 0) {
    return (
      <div className="scrollbar-thin h-full overflow-y-auto p-5 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">Tu espacio está listo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea el primer tablero para ver métricas y empezar a organizar el trabajo.
          </p>
          <EmptyState
            className="mt-8"
            icon={KanbanSquare}
            title="Crea tu primer tablero"
            description="Las tareas, responsables y fechas aparecerán aquí en un dashboard vivo."
            action={
              <BoardDialog
                trigger={
                  <Button>
                    <Sparkles className="size-4" /> Crear tablero
                  </Button>
                }
              />
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-5 pb-12 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              {today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {greeting(today)}, {firstName} <span className="inline-block">👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Esto es lo que está pasando en <strong className="font-medium text-foreground">{workspace.name}</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={boardId} onValueChange={setBoardId}>
              <SelectTrigger className="h-9 w-[240px] bg-card/70 text-xs">
                <KanbanSquare className="me-1.5 size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Elegir tablero" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">General · todos los tableros</SelectItem>
                <BoardSelectOptions boards={boards} />
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() =>
                navigate(board ? `/w/${workspace.id}/boards/${board.id}` : `/w/${workspace.id}/boards`)
              }
            >
              {board ? 'Abrir tablero' : 'Ver tableros'} <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="Abiertas"
            value={metrics.open}
            hint={`${metrics.total} en total · pausa excluida`}
            icon={Clock3}
            accent="#8b5cf6"
            loading={loading}
          />
          <StatCard
            label="Completadas"
            value={metrics.completed}
            hint={`${metrics.completionRate}% de finalización`}
            icon={CheckCircle2}
            accent="#10b981"
            loading={loading}
          />
          <StatCard
            label="Esperando revisión"
            value={metrics.waitingReview}
            hint={metrics.waitingReview === 0 ? 'Nada pendiente' : 'Tareas pendientes de revisión'}
            icon={Eye}
            accent="#f59e0b"
            loading={loading}
          />
          <StatCard
            label="Tareas urgentes abiertas"
            value={metrics.urgentOpen}
            hint={metrics.urgentOpen === 0 ? 'Sin urgencias' : 'Prioridad urgente sin completar'}
            icon={Flame}
            accent="#fb7185"
            loading={loading}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="flex-row items-center justify-between px-4 pb-0">
              <div>
                <CardTitle className="text-sm font-semibold">Ritmo del equipo</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Creadas vs. completadas · últimos 14 días</p>
              </div>
              <Badge variant="outline" className="gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-3" /> {metrics.completionRate}%
              </Badge>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-2">
              <EvilAreaChart
                data={metrics.trend.map((point) => ({
                  label: point.label,
                  created: point.created,
                  completed: point.completed,
                }))}
                config={trendConfig}
                xDataKey="label"
                className="h-[230px] w-full"
                curveType="monotone"
                stackType="default"
              >
                <EvilAreaChart.Grid />
                <EvilAreaChart.XAxis
                  dataKey="label"
                  tickFormatter={(value) =>
                    String(value).split(' ')[0]?.replace(',', '') ?? String(value)
                  }
                />
                <EvilAreaChart.YAxis width={26} allowDecimals={false} />
                <EvilAreaChart.Tooltip />
                <EvilAreaChart.Legend isClickable />
                <EvilAreaChart.Area dataKey="created" variant="gradient" strokeVariant="solid" strokeWidth={1.8}>
                  <EvilAreaChart.Dot variant="border" />
                  <EvilAreaChart.ActiveDot variant="colored-border" />
                </EvilAreaChart.Area>
                <EvilAreaChart.Area dataKey="completed" variant="gradient" strokeVariant="solid" strokeWidth={1.8}>
                  <EvilAreaChart.Dot variant="border" />
                  <EvilAreaChart.ActiveDot variant="colored-border" />
                </EvilAreaChart.Area>
              </EvilAreaChart>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm font-semibold">Estado del tablero</CardTitle>
              <p className="text-xs text-muted-foreground">
                {board?.name ?? 'Todos los tableros'}
              </p>
            </CardHeader>
            <CardContent className="relative px-3 pb-3 pt-0">
              {pieData.length === 0 ? (
                <div className="flex h-[230px] items-center justify-center text-sm text-muted-foreground">
                  Sin tareas todavía.
                </div>
              ) : (
                <>
                  <EvilPieChart
                    data={pieData}
                    config={pieConfig}
                    dataKey="value"
                    nameKey="name"
                    className="h-[220px] w-full"
                  >
                    <EvilPieChart.Pie innerRadius={56} outerRadius="86%" cornerRadius={5} paddingAngle={3} variant="gradient" pieProps={{ isAnimationActive: false }} />
                    <EvilPieChart.Tooltip />
                    <EvilPieChart.Legend />
                  </EvilPieChart>
                  <div className="pointer-events-none absolute inset-x-0 top-[64px] z-10 text-center">
                    <p className="text-2xl font-semibold tracking-tight">{metrics.total}</p>
                    <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">tareas</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm font-semibold">Carga por persona</CardTitle>
              <p className="text-xs text-muted-foreground">Tareas asignadas · abiertas vs. completadas</p>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-2">
              {workloadData.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                  Asigna tareas al equipo para ver la carga.
                </div>
              ) : (
                <EvilBarChart data={workloadData} config={workloadConfig} className="h-[230px] w-full" barRadius={4}>
                  <EvilBarChart.Grid />
                  <EvilBarChart.XAxis dataKey="name" />
                  <EvilBarChart.YAxis width={26} allowDecimals={false} />
                  <EvilBarChart.Tooltip />
                  <EvilBarChart.Legend />
                  <EvilBarChart.Bar dataKey="open" variant="gradient" />
                  <EvilBarChart.Bar dataKey="completed" variant="gradient" />
                </EvilBarChart>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="flex-row items-center justify-between px-4 pb-2">
              <div>
                <CardTitle className="text-sm font-semibold">Próximos vencimientos</CardTitle>
                <p className="text-xs text-muted-foreground">Los siguientes 7 días</p>
              </div>
              <CalendarClock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {metrics.dueSoon.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                  Nada urgente. Respira.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {metrics.dueSoon.slice(0, 5).map((task) => (
                    <Link
                      key={task.id}
                      to={`/w/${workspace.id}/boards/${task.boardId}?task=${task.id}`}
                      className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: PRIORITY_META[task.priority].color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{task.title}</span>
                        <DueDateBadge dueDate={task.dueDate} className="mt-0.5" />
                      </span>
                      <AvatarStack
                        people={members
                          .filter((member) => task.assigneeIds.includes(member.uid))
                          .map((member) => ({
                            id: member.uid,
                            displayName: member.displayName,
                            photoURL: member.photoURL,
                          }))}
                        size="xs"
                        max={2}
                      />
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-8 w-full justify-between text-xs text-muted-foreground"
                    onClick={() =>
                      navigate(
                        board
                          ? `/w/${workspace.id}/boards/${board.id}`
                          : `/w/${workspace.id}/boards`,
                      )
                    }
                  >
                    Ver todas las tareas <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="flex-row items-center justify-between px-4 pb-2">
              <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link to={board ? `/w/${workspace.id}/boards/${board.id}` : `/w/${workspace.id}/boards`}>
                  {board ? 'Ver tablero' : 'Ver tableros'}
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 px-2 pb-3">
              {recentTasks.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">Sin actividad todavía.</p>
              ) : (
                recentTasks.map((task) => {
                  const completed = isTaskCompleted(task, activeColumns)
                  return (
                    <Link
                      key={task.id}
                      to={`/w/${workspace.id}/boards/${task.boardId}?task=${task.id}`}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
                    >
                      {completed ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs">{task.title}</span>
                      <PriorityBadge priority={task.priority} compact />
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="flex-row items-center justify-between px-4 pb-2">
              <CardTitle className="text-sm font-semibold">Documentos recientes</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link to={`/w/${workspace.id}/pages`}>Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 px-2 pb-3">
              {recentPages.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">Crea tu primera página.</p>
              ) : (
                recentPages.map((page) => (
                  <Link
                    key={page.id}
                    to={`/w/${workspace.id}/pages/${page.id}`}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                  >
                    <span className="text-base leading-none">{page.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{page.title}</span>
                      <span className="text-[0.65rem] text-muted-foreground">
                        Editado {formatRelative(page.updatedAt)}
                      </span>
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border bg-gradient-to-r from-primary/10 via-card to-fuchsia-500/10 p-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <UserAvatar name={profile?.displayName ?? 'openQomu'} photoURL={profile?.photoURL} size="lg" />
            <div>
              <p className="text-sm font-medium">Tu equipo está en sintonía</p>
              <p className="text-xs text-muted-foreground">
                {members.filter((member) => isRecentlyActive(member.lastActiveAt)).length} personas activas ahora mismo en {workspace.name}.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/w/${workspace.id}/members`}>
              Ver equipo <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

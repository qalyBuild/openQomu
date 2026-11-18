import { BoardSelectOptions, groupBoardChoices } from '@/presentation/features/kanban/board-choices'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { defaultTaskColumnId, type Board, type Task } from '@/domain/entities/kanban'
import type { Workspace } from '@/domain/entities/identity'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useWorkspaces } from '@/app/workspaces-provider'

type BoardGroup = { workspace: Workspace; boards: Board[] }

export function TaskTransferDialog({
  open,
  onOpenChange,
  task,
  sourceBoard,
  onTransferred,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  sourceBoard: Board
  onTransferred: (task: Task, target: { workspaceId: string; boardId: string }) => void
}) {
  const container = useContainer()
  const { workspace: sourceWorkspace, uid } = useWorkspaceData()
  const { workspaces } = useWorkspaces()
  const [groups, setGroups] = useState<BoardGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [moving, setMoving] = useState(false)
  const [targetWorkspaceId, setTargetWorkspaceId] = useState('')
  const [targetBoardId, setTargetBoardId] = useState('')
  const [targetColumnId, setTargetColumnId] = useState('')

  const isSource = (workspaceId: string, boardId: string) =>
    workspaceId === sourceWorkspace.id && boardId === sourceBoard.id

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void Promise.all(
      workspaces.map(async (workspace) => {
        const boards = await container.boards.list(workspace.id)
        const { active, muted } = groupBoardChoices(boards, (board) => board.status)
        return { workspace, boards: [...active, ...muted] }
      }),
    )
      .then((next) => {
        if (cancelled) return
        setGroups(next)
        const preferred =
          next.find((group) =>
            group.boards.some((board) => !isSource(group.workspace.id, board.id)),
          ) ?? next[0]
        const firstBoard = preferred?.boards.find(
          (board) => !isSource(preferred.workspace.id, board.id),
        )
        setTargetWorkspaceId(preferred?.workspace.id ?? '')
        setTargetBoardId(firstBoard?.id ?? '')
        setTargetColumnId(defaultTaskColumnId(firstBoard?.columns ?? []))
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los tableros.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, open, sourceBoard.id, sourceWorkspace.id, workspaces])

  const availableBoards = useMemo(() => {
    const group = groups.find((item) => item.workspace.id === targetWorkspaceId)
    return (group?.boards ?? []).filter((board) => !isSource(targetWorkspaceId, board.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, targetWorkspaceId, sourceBoard.id, sourceWorkspace.id])

  const targetBoard = availableBoards.find((board) => board.id === targetBoardId) ?? null
  const sameBoard =
    targetWorkspaceId === sourceWorkspace.id && targetBoardId === sourceBoard.id
  const targetColumn = targetBoard?.columns.find((column) => column.id === targetColumnId)
  const noChange = sameBoard && targetColumnId === task.columnId
  const canMove = Boolean(targetBoard && targetColumn && !noChange && !loading && !moving)

  const selectWorkspace = (workspaceId: string) => {
    setTargetWorkspaceId(workspaceId)
    const group = groups.find((item) => item.workspace.id === workspaceId)
    const firstBoard = group?.boards.find((board) => !isSource(workspaceId, board.id))
    setTargetBoardId(firstBoard?.id ?? '')
    setTargetColumnId(defaultTaskColumnId(firstBoard?.columns ?? []))
  }

  const selectBoard = (boardId: string) => {
    setTargetBoardId(boardId)
    const board = availableBoards.find((item) => item.id === boardId)
    setTargetColumnId(defaultTaskColumnId(board?.columns ?? []))
  }

  const copyAttachments = async (createdIds: string[]): Promise<string[] | undefined> => {
    if (sourceWorkspace.id === targetWorkspaceId || task.attachmentIds.length === 0) {
      return undefined
    }
    const files = await container.files.list(sourceWorkspace.id)
    const ids: string[] = []
    for (const attachmentId of task.attachmentIds) {
      const file = files.find((item) => item.id === attachmentId)
      if (!file) continue
      const blob = await container.files.downloadBlob(sourceWorkspace.id, file)
      const copy = await container.files.upload(
        targetWorkspaceId,
        {
          name: file.name,
          size: blob.size,
          contentType: file.contentType,
          data: blob,
        },
        uid,
      )
      ids.push(copy.id)
      createdIds.push(copy.id)
    }
    return ids
  }

  const submit = async () => {
    if (!targetBoard || !targetColumn) return
    setMoving(true)
    const createdFileIds: string[] = []
    try {
      if (sameBoard) {
        const current = await container.tasks.list(sourceWorkspace.id, sourceBoard.id)
        const index = current.filter(
          (item) => item.columnId === targetColumnId && item.id !== task.id,
        ).length
        await container.tasks.move(
          sourceWorkspace.id,
          sourceBoard.id,
          task.id,
          targetColumnId,
          index,
          sourceBoard.columns,
        )
        toast.success(`Tarea movida a “${targetColumn.name}”.`)
        onOpenChange(false)
        onTransferred(
          { ...task, columnId: targetColumnId },
          { workspaceId: targetWorkspaceId, boardId: targetBoardId },
        )
        return
      }

      const moved = await container.tasks.transfer(
        sourceWorkspace.id,
        sourceBoard.id,
        task.id,
        {
          workspaceId: targetWorkspaceId,
          boardId: targetBoardId,
          columnId: targetColumnId,
          attachmentIds: await copyAttachments(createdFileIds),
        },
        uid,
      )
      toast.success(`Tarea movida a “${targetBoard.name}”.`)
      onOpenChange(false)
      onTransferred(moved, { workspaceId: targetWorkspaceId, boardId: targetBoardId })
    } catch (error) {
      await Promise.allSettled(
        createdFileIds.map((fileId) => container.files.remove(targetWorkspaceId, fileId)),
      )
      toast.error(error instanceof Error ? error.message : 'No se pudo mover la tarea.')
    } finally {
      setMoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <ArrowRightLeft className="size-4" />
            </span>
            Mover tarea
          </DialogTitle>
          <DialogDescription>
            Elige el espacio, el tablero y la columna de destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="truncate text-xs font-medium">{task.title}</p>
            <p className="truncate text-[0.68rem] text-muted-foreground">
              Ahora en {sourceWorkspace.name} · {sourceBoard.name}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[0.7rem] text-muted-foreground">Espacio</Label>
            <Select
              value={targetWorkspaceId}
              onValueChange={selectWorkspace}
              disabled={loading || moving}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Elige un espacio" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.workspace.id} value={group.workspace.id}>
                    {group.workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[0.7rem] text-muted-foreground">Tablero</Label>
            <Select
              value={targetBoardId}
              onValueChange={selectBoard}
              disabled={loading || moving || availableBoards.length === 0}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Elige un tablero" />
              </SelectTrigger>
              <SelectContent>
                <BoardSelectOptions boards={availableBoards} />
              </SelectContent>
            </Select>
            {!loading && availableBoards.length === 0 && (
              <p className="text-[0.68rem] text-muted-foreground">
                Este espacio no tiene otro tablero disponible.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[0.7rem] text-muted-foreground">Columna</Label>
            <Select
              value={targetColumnId}
              onValueChange={setTargetColumnId}
              disabled={loading || moving || !targetBoard}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Elige una columna" />
              </SelectTrigger>
              <SelectContent>
                {(targetBoard?.columns ?? []).map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: column.color }}
                      />
                      {column.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="rounded-md bg-primary/5 px-3 py-2 text-[0.68rem] leading-relaxed text-muted-foreground">
            Se migrarán también los comentarios y los adjuntos de la tarea.
          </p>

          {loading && (
            <p className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Cargando tableros…
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={moving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canMove}>
            {moving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="size-4" />
            )}
            Mover tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

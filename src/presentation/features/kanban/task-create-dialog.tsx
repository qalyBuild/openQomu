import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Flag,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Board, Task } from '@/domain/entities/kanban'
import type { FileMeta } from '@/domain/entities/chat'
import type { Priority } from '@/domain/entities/identity'
import type { Member } from '@/domain/entities/identity'
import { PRIORITY_META, PRIORITY_VALUES } from '@/domain/entities/identity'
import { defaultTaskColumnId, isDependentsColumn } from '@/domain/entities/kanban'
import { MAX_TASK_LABELS, validateTaskDependencies } from '@/domain/services/task-service'
import { formatBytes } from '@/domain/services/file-service'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { FileIcon } from '@/presentation/components/common/file-icon'
import { LabelPicker } from './label-picker'
import { TaskDependencyPicker } from './task-dependency-picker'
import { missingBoardLabels } from './label-persistence'
import { cn } from '@/lib/utils'
import {
  clearTaskDraft,
  createEmptyTaskDraft,
  getTaskDraft,
  hasTaskDraftContent,
  saveTaskDraft,
  type TaskDraft,
} from './task-draft'

export function TaskCreateDialog({
  open,
  onOpenChange,
  board,
  members,
  tasks,
  defaultColumnId,
  suggestedLabels = [],
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  board: Board
  members: Member[]
  tasks: Task[]
  defaultColumnId?: string
  suggestedLabels?: string[]
  onCreated?: (task: Task) => void
}) {
  const container = useContainer()
  const { workspace, uid, files } = useWorkspaceData()
  const [draft, setDraft] = useState<TaskDraft>(
    () =>
      getTaskDraft(board.id) ??
      createEmptyTaskDraft(defaultColumnId ?? defaultTaskColumnId(board.columns), uid),
  )
  const [restored, setRestored] = useState(false)
  const [pending, setPending] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, FileMeta>>({})
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fileMap = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])
  const attachments = draft.attachmentIds
    .map((id) => uploadedFiles[id] ?? fileMap.get(id))
    .filter((file): file is FileMeta => Boolean(file))

  useEffect(() => {
    if (!open) return
    const saved = getTaskDraft(board.id)
    if (saved) {
      setDraft(saved)
      setRestored(hasTaskDraftContent(saved, uid))
      return
    }
    setDraft(createEmptyTaskDraft(defaultColumnId ?? defaultTaskColumnId(board.columns), uid))
    setRestored(false)
  }, [board.columns, board.id, defaultColumnId, open, uid])

  const update = (patch: Partial<TaskDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const selectedColumn = board.columns.find((column) => column.id === draft.columnId)
  const isDependent = selectedColumn ? isDependentsColumn(selectedColumn) : false

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (hasTaskDraftContent(draft, uid)) saveTaskDraft(board.id, draft)
      else clearTaskDraft(board.id)
    }
    onOpenChange(next)
  }

  const toggleLabel = (label: string) => {
    update({
      labels: draft.labels.includes(label)
        ? draft.labels.filter((item) => item !== label)
        : [...draft.labels, label],
    })
  }

  const uploadAttachments = async (list: FileList | null) => {
    if (!list || list.length === 0 || !uid) return
    setUploading(true)
    setProgress(0)
    try {
      const nextIds = [...draft.attachmentIds]
      for (const file of Array.from(list)) {
        const meta = await container.files.upload(
          workspace.id,
          { name: file.name, size: file.size, contentType: file.type, data: file },
          uid,
          { onProgress: setProgress },
        )
        setUploadedFiles((current) => ({ ...current, [meta.id]: meta }))
        nextIds.push(meta.id)
      }
      update({ attachmentIds: nextIds })
      toast.success(list.length === 1 ? 'Archivo adjuntado.' : 'Archivos adjuntados.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo adjuntar el archivo.')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (fileId: string) => {
    update({ attachmentIds: draft.attachmentIds.filter((id) => id !== fileId) })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) return
    setPending(true)
    try {
      const dependsOnTaskIds = isDependent
        ? validateTaskDependencies(draft.dependsOnTaskIds, tasks, board.columns)
        : []
      const newBoardLabels = missingBoardLabels(board, draft.labels)
      if (newBoardLabels.length > 0) {
        await container.boards.update(workspace.id, board.id, {
          customLabels: [...(board.customLabels ?? []), ...newBoardLabels],
        })
      }
      const task = await container.tasks.create({
        workspaceId: workspace.id,
        boardId: board.id,
        title: draft.title,
        description: draft.description,
        columnId: draft.columnId,
        priority: draft.priority,
        dueDate: draft.dueDate || null,
        assigneeIds: draft.assignees,
        dependsOnTaskIds,
        labels: draft.labels,
        attachmentIds: draft.attachmentIds,
        createdBy: uid,
      })
      clearTaskDraft(board.id)
      setDraft(createEmptyTaskDraft(defaultColumnId ?? defaultTaskColumnId(board.columns), uid))
      setRestored(false)
      setUploadedFiles({})
      toast.success('Tarea creada.')
      onOpenChange(false)
      onCreated?.(task)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nueva tarea
            {restored && (
              <Badge variant="outline" className="h-5 text-[0.6rem] text-muted-foreground">
                Borrador guardado
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Añade el contexto mínimo. Podrás completar lo que falte después.
            {restored
              ? ' Hemos recuperado el borrador de tu última tarea sin crear.'
              : ' Si sales sin crearla, guardaremos el borrador para la próxima vez.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="space-y-4"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.requestSubmit()
            }
          }}
          onPaste={(event) => {
            const files = event.clipboardData?.files
            if (files && files.length > 0) {
              event.preventDefault()
              void uploadAttachments(files)
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              autoFocus
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="¿Qué hay que hacer?"
              maxLength={160}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Descripción</Label>
            <Textarea
              id="task-description"
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Contexto, criterios de aceptación, enlaces…"
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Columna</Label>
              <Select value={draft.columnId} onValueChange={(columnId) => update({ columnId })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {board.columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: column.color }} />
                        {column.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={draft.priority}
                onValueChange={(priority) => update({ priority: priority as Priority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: PRIORITY_META[value].color }}
                        />
                        {PRIORITY_META[value].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isDependent && (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <Label className="flex items-center gap-1.5">
                <Link2 className="size-3.5" /> Tareas relacionadas
              </Label>
              <TaskDependencyPicker
                tasks={tasks}
                columns={board.columns}
                value={draft.dependsOnTaskIds}
                onChange={(dependsOnTaskIds) => update({ dependsOnTaskIds })}
              />
              <p className="text-[0.65rem] text-muted-foreground">
                La tarea pasará a «Por hacer» cuando todas las relacionadas estén hechas. No admite
                tareas completadas.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="task-due">Fecha límite</Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="task-due"
                type="date"
                value={draft.dueDate}
                onChange={(event) => update({ dueDate: event.target.value })}
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <UserRound className="size-3.5" /> Responsables
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((member) => {
                const selected = draft.assignees.includes(member.uid)
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      update({
                        assignees: selected
                          ? draft.assignees.filter((id) => id !== member.uid)
                          : [...draft.assignees, member.uid],
                      })
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border py-1 pe-2.5 ps-1 text-xs transition-colors',
                      selected
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <UserAvatar name={member.displayName} photoURL={member.photoURL} size="xs" />
                    {member.displayName.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Flag className="size-3.5" /> Etiquetas
              <span className="ms-auto text-[0.6rem] font-normal text-muted-foreground">
                {draft.labels.length}/{MAX_TASK_LABELS}
              </span>
            </Label>
            <LabelPicker
              value={draft.labels}
              suggested={suggestedLabels}
              onToggle={toggleLabel}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="size-3.5" /> Adjuntos
              <span className="ms-auto text-[0.6rem] font-normal text-muted-foreground">
                {draft.attachmentIds.length}
              </span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void uploadAttachments(event.target.files)}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex max-w-full items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 text-xs"
                  >
                    <FileIcon file={file} className="size-3.5" />
                    <span className="max-w-40 truncate">{file.name}</span>
                    <span className="shrink-0 text-[0.6rem] text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Quitar ${file.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
                {uploading ? `Subiendo… ${progress}%` : 'Adjuntar archivo'}
              </Button>
              {uploading && <Progress value={progress} className="h-1 flex-1" />}
            </div>
            <p className="text-[0.65rem] text-muted-foreground">
              Imágenes, PDFs o documentos. Se adjuntarán a la tarea al crearla.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !draft.title.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Crear tarea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

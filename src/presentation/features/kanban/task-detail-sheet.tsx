import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRightLeft,
  CalendarDays,
  Check,
  Flag,
  Link2,
  Loader2,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Undo2,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { Board, Task, TaskComment } from '@/domain/entities/kanban'
import type { FileMeta } from '@/domain/entities/chat'
import type { Member, Priority, Role } from '@/domain/entities/identity'
import { PRIORITY_META, PRIORITY_VALUES } from '@/domain/entities/identity'
import { isDependentsColumn, isReviewColumn } from '@/domain/entities/kanban'
import { MAX_TASK_LABELS, validateTaskDependencies } from '@/domain/services/task-service'
import { canDeleteTask } from '@/domain/services/permission-service'
import { formatBytes, isImageFile } from '@/domain/services/file-service'
import { formatRelative } from '@/lib/date'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useTaskComments } from '@/presentation/hooks/use-data'
import { UserAvatar, AvatarStack } from '@/presentation/components/common/user-avatar'
import { FileIcon } from '@/presentation/components/common/file-icon'
import { FileImage, FileOpenLink } from '@/presentation/components/common/file-preview'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { DueDateBadge } from '@/presentation/components/common/badges'
import { TaskTransferDialog } from '@/presentation/features/kanban/task-transfer-dialog'
import { RejectReviewDialog } from '@/presentation/features/kanban/reject-review-dialog'
import { LabelPicker } from './label-picker'
import { TaskDependencyPicker } from './task-dependency-picker'
import { missingBoardLabels } from './label-persistence'

export function TaskDetailSheet({
  task,
  board,
  boardTasks,
  members,
  files,
  role,
  suggestedLabels = [],
  onClose,
  onCloseAutoFocus,
  onTransferred,
}: {
  task: Task | null
  board: Board
  boardTasks: Task[]
  members: Member[]
  files: FileMeta[]
  role: Role
  suggestedLabels?: string[]
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
  onTransferred: (task: Task, target: { workspaceId: string; boardId: string }) => void
}) {
  const container = useContainer()
  const { workspace, uid } = useWorkspaceData()
  const { session, profile } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [titleFocused, setTitleFocused] = useState(false)
  const [descFocused, setDescFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [editingComment, setEditingComment] = useState<TaskComment | null>(null)
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null)
  const commentComposerRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { comments } = useTaskComments(workspace.id, board.id, task?.id)
  const lastOwnComment = useMemo(() => {
    if (!uid) return null
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      if (comments[index].authorId === uid) return comments[index]
    }
    return null
  }, [comments, uid])

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description)
  }, [task?.id])

  useEffect(() => {
    setComment('')
    setEditingComment(null)
  }, [task?.id])

  useEffect(() => {
    if (!task?.title || titleFocused || saving) return
    setTitle(task.title)
  }, [saving, task?.title, titleFocused])

  useEffect(() => {
    if (task?.description === undefined || descFocused || saving) return
    setDescription(task.description)
  }, [descFocused, saving, task?.description])

  const fileMap = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])
  const attachments = (task?.attachmentIds ?? [])
    .map((id) => fileMap.get(id))
    .filter((file): file is FileMeta => Boolean(file))
  const assignees = members.filter((member) => task?.assigneeIds.includes(member.uid))
  const reviewer = members.find((member) => member.uid === task?.reviewerId)
  const creator = members.find((member) => member.uid === task?.createdBy)
  const canDelete = task ? canDeleteTask(role, task, uid) : false
  const canTransfer = canDelete || board.createdBy === uid
  const column = board.columns.find((item) => item.id === task?.columnId)
  const isDone = Boolean(task?.completedAt) || Boolean(column?.isDone)
  const canRejectReview = Boolean(
    task &&
      column &&
      !isDone &&
      isReviewColumn(column) &&
      (task.reviewerId === uid || role === 'owner' || role === 'admin'),
  )
  const showDependency = Boolean(column && isDependentsColumn(column))

  if (!task) return null

  const saveField = async (patch: Parameters<typeof container.tasks.update>[3]) => {
    setSaving(true)
    try {
      const nextPatch =
        patch.dependsOnTaskIds === undefined
          ? patch
          : {
              ...patch,
              dependsOnTaskIds: validateTaskDependencies(
                patch.dependsOnTaskIds,
                boardTasks,
                board.columns,
                task.id,
              ),
            }
      await container.tasks.update(workspace.id, board.id, task.id, nextPatch)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la tarea.')
    } finally {
      setSaving(false)
    }
  }

  const saveTitle = () => {
    setTitleFocused(false)
    if (title.trim() && title.trim() !== task.title) void saveField({ title })
    else setTitle(task.title)
  }

  const saveDescription = () => {
    setDescFocused(false)
    if (description !== task.description) void saveField({ description })
  }

  const changeColumn = async (columnId: string) => {
    const targetTasks = boardTasks.filter((item) => item.columnId === columnId)
    try {
      await container.tasks.move(
        workspace.id,
        board.id,
        task.id,
        columnId,
        targetTasks.length,
        board.columns,
      )
      toast.success('Tarea movida.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo mover la tarea.')
    }
  }

  const toggleAssignee = (memberUid: string) => {
    const next = task.assigneeIds.includes(memberUid)
      ? task.assigneeIds.filter((id) => id !== memberUid)
      : [...task.assigneeIds, memberUid]
    void saveField({ assigneeIds: next })
  }

  const toggleLabel = (label: string) => {
    const adding = !task.labels.includes(label)
    const next = adding
      ? [...task.labels, label]
      : task.labels.filter((item) => item !== label)
    void saveField({ labels: next })
    if (adding) {
      const missing = missingBoardLabels(board, [label])
      if (missing.length > 0) {
        void container.boards
          .update(workspace.id, board.id, {
            customLabels: [...(board.customLabels ?? []), ...missing],
          })
          .catch(() => {})
      }
    }
  }

  const uploadAttachment = async (fileList: FileList) => {
    if (!session) return
    setUploading(true)
    setProgress(0)
    try {
      const nextIds = [...task.attachmentIds]
      for (const file of Array.from(fileList)) {
        const meta = await container.files.upload(
          workspace.id,
          { name: file.name, size: file.size, contentType: file.type, data: file },
          session.id,
          { onProgress: setProgress },
        )
        nextIds.push(meta.id)
      }
      await container.tasks.update(workspace.id, board.id, task.id, {
        attachmentIds: nextIds,
      })
      toast.success('Archivo adjuntado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo adjuntar el archivo.')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (fileId: string) => {
    void saveField({ attachmentIds: task.attachmentIds.filter((id) => id !== fileId) })
  }

  const addComment = async () => {
    if (!session || !comment.trim()) return
    setSendingComment(true)
    try {
      await container.tasks.addComment(workspace.id, board.id, task.id, {
        authorId: session.id,
        authorName: profile?.displayName ?? session.displayName,
        authorPhotoURL: profile?.photoURL ?? session.photoURL,
        body: comment,
      })
      setComment('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar el comentario.')
    } finally {
      setSendingComment(false)
    }
  }

  const startEditingComment = (item: TaskComment) => {
    if (sendingComment) return
    setEditingComment(item)
    setComment(item.body)
    requestAnimationFrame(() => {
      const textarea = commentInputRef.current
      textarea?.focus()
      textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
      // El compositor está al final del panel: hay que traerlo a la vista.
      commentComposerRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    })
    // En móvil el teclado aparece después: repetimos el scroll con el layout final.
    window.setTimeout(() => {
      commentComposerRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }, 220)
  }

  const cancelEditingComment = () => {
    setEditingComment(null)
    setComment('')
  }

  const submitComment = async () => {
    if (!session) return
    if (editingComment) {
      if (!comment.trim() || comment.trim() === editingComment.body) {
        cancelEditingComment()
        return
      }
      setSendingComment(true)
      try {
        await container.tasks.updateComment(
          workspace.id,
          board.id,
          task.id,
          editingComment.id,
          comment,
        )
        cancelEditingComment()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo editar el comentario.')
      } finally {
        setSendingComment(false)
      }
      return
    }
    await addComment()
  }

  const startEditingLast = () => {
    if (!lastOwnComment || editingComment || comment.trim()) return
    startEditingComment(lastOwnComment)
  }

  return (
    <Sheet
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) {
          setComment('')
          setEditingComment(null)
          onClose()
        }
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          closeButtonRef.current?.focus()
        }}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (editingComment) {
            event.preventDefault()
            cancelEditingComment()
          }
        }}
        onPaste={(event) => {
          const files = event.clipboardData?.files
          if (files && files.length > 0) {
            event.preventDefault()
            void uploadAttachment(files)
          }
        }}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ background: column?.color ?? '#94a3b8' }}
            />
            {board.name}
          </span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs text-muted-foreground">{column?.name}</span>
          <SheetTitle className="sr-only">Detalle de la tarea</SheetTitle>
          <SheetDescription className="sr-only">
            Edita propiedades, adjuntos y comentarios de la tarea.
          </SheetDescription>
          <div className="ms-auto flex items-center gap-1">
            {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            {canRejectReview && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-amber-600"
                onClick={() => setRejectOpen(true)}
                aria-label="Rechazar revisión"
                title="Rechazar revisión"
              >
                <Undo2 className="size-3.5" />
              </Button>
            )}
            {canTransfer && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={() => setTransferOpen(true)}
                aria-label="Mover tarea a otro tablero"
                title="Mover a otro tablero"
              >
                <ArrowRightLeft className="size-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Eliminar tarea"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-5">
            <div className="flex items-start gap-3">
              <span
                className="mt-2 size-2.5 shrink-0 rounded-full"
                style={{ background: PRIORITY_META[task.priority].color }}
              />
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onFocus={() => setTitleFocused(true)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
                className="task-title-input"
                maxLength={160}
              />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[0.7rem] text-muted-foreground">Estado</Label>
                <Select value={task.columnId} onValueChange={(value) => void changeColumn(value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {board.columns.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: item.color }} />
                          {item.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.7rem] text-muted-foreground">Prioridad</Label>
                <Select
                  value={task.priority}
                  onValueChange={(value) => void saveField({ priority: value as Priority })}
                >
                  <SelectTrigger className="h-8 text-xs">
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
              <div className="space-y-1.5">
                <Label className="text-[0.7rem] text-muted-foreground">Fecha límite</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={task.dueDate ?? ''}
                    onChange={(event) => void saveField({ dueDate: event.target.value || null })}
                    className="h-8 ps-8 text-xs"
                  />
                </div>
                {task.dueDate && (
                  <DueDateBadge dueDate={task.dueDate} className="ps-1" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.7rem] text-muted-foreground">Responsables</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 w-full justify-start gap-2 px-2 text-xs font-normal"
                    >
                      <UserRound className="size-3.5 text-muted-foreground" />
                      {assignees.length === 0 ? (
                        <span className="text-muted-foreground">Sin asignar</span>
                      ) : (
                        <>
                          <AvatarStack
                            people={assignees.map((member) => ({
                              id: member.uid,
                              displayName: member.displayName,
                              photoURL: member.photoURL,
                            }))}
                            size="xs"
                            max={3}
                          />
                          <span className="truncate">
                            {assignees.length === 1
                              ? assignees[0].displayName
                              : `${assignees.length} personas`}
                          </span>
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-1">
                    {members.map((member) => {
                      const selected = task.assigneeIds.includes(member.uid)
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleAssignee(member.uid)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                        >
                          <UserAvatar
                            name={member.displayName}
                            photoURL={member.photoURL}
                            size="xs"
                          />
                          <span className="min-w-0 flex-1 truncate text-start">
                            {member.displayName}
                          </span>
                          {selected && <Check className="size-3.5 text-primary" />}
                        </button>
                      )
                    })}
                  </PopoverContent>
                </Popover>
              </div>
              {!isDone && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                    <UserCheck className="size-3" /> Responsable de revisión
                  </Label>
                  <Select
                    value={task.reviewerId && reviewer ? task.reviewerId : 'none'}
                    onValueChange={(value) =>
                      void saveField({ reviewerId: value === 'none' ? null : value })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.uid}>
                          {member.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[0.7rem] text-muted-foreground">Creada por</Label>
                <div className="flex h-8 items-center gap-2 rounded-md border border-dashed bg-muted/30 px-2 text-xs">
                  <UserAvatar
                    name={creator?.displayName ?? 'Usuario desconocido'}
                    photoURL={creator?.photoURL}
                    size="xs"
                  />
                  <span className="truncate">
                    {creator?.displayName ?? 'Usuario desconocido'}
                  </span>
                </div>
              </div>
            </div>

            {showDependency && (
              <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <Label className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                  <Link2 className="size-3" /> Tareas relacionadas
                </Label>
                <TaskDependencyPicker
                  tasks={boardTasks}
                  columns={board.columns}
                  value={task.dependsOnTaskIds}
                  excludeTaskId={task.id}
                  disabled={saving}
                  onChange={(dependsOnTaskIds) => void saveField({ dependsOnTaskIds })}
                />
                <p className="text-[0.65rem] text-muted-foreground">
                  Pasa a «Por hacer» cuando todas las relacionadas estén hechas. No admite tareas
                  completadas.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                <Flag className="size-3" /> Etiquetas
                <span className="ms-auto text-[0.6rem] font-normal">
                  {task.labels.length}/{MAX_TASK_LABELS}
                </span>
              </Label>
              <LabelPicker
                value={task.labels}
                suggested={suggestedLabels}
                onToggle={toggleLabel}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[0.7rem] text-muted-foreground">Descripción</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onFocus={() => setDescFocused(true)}
                onBlur={saveDescription}
                placeholder="Añade contexto, criterios de aceptación o enlaces…"
                rows={5}
                className="resize-y text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                  <Paperclip className="size-3" /> Adjuntos ({attachments.length})
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) void uploadAttachment(event.target.files)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Paperclip className="size-3" />
                  )}
                  Adjuntar
                </Button>
              </div>
              {uploading && <Progress value={progress} className="h-1" />}
              {attachments.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                  Arrastra archivos o usa “Adjuntar”.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2"
                    >
                      {isImageFile(file) ? (
                        <FileImage
                          file={file}
                          alt=""
                          auto={false}
                          className="size-8 rounded object-cover"
                        />
                      ) : (
                        <span className="grid size-8 place-items-center rounded bg-muted">
                          <FileIcon file={file} className="size-3.5" />
                        </span>
                      )}
                      <FileOpenLink
                        file={file}
                        className="min-w-0 flex-1 text-xs hover:underline"
                      >
                        <span className="block truncate font-medium">{file.name}</span>
                        <span className="text-[0.62rem] text-muted-foreground">
                          {formatBytes(file.size)}
                        </span>
                      </FileOpenLink>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground"
                        onClick={() => removeAttachment(file.id)}
                        aria-label="Quitar adjunto"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Comentarios ({comments.length})
                </h3>
              </div>
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aún no hay comentarios. Comparte una actualización o bloqueo.
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((item) => (
                    <div key={item.id} className="group/comment flex gap-2.5">
                      <UserAvatar
                        name={item.authorName}
                        photoURL={item.authorPhotoURL}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold">{item.authorName}</span>
                          <span className="text-[0.6rem] text-muted-foreground">
                            {formatRelative(item.createdAt)}
                          </span>
                          {item.editedAt && (
                            <span className="text-[0.55rem] text-muted-foreground">(editado)</span>
                          )}
                          <div className="ms-auto flex items-center gap-2">
                            {item.authorId === uid && editingComment?.id !== item.id && (
                              <button
                                type="button"
                                className="text-[0.6rem] text-muted-foreground opacity-100 transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover/comment:opacity-100"
                                onClick={() => startEditingComment(item)}
                              >
                                Editar
                              </button>
                            )}
                            {(item.authorId === uid ||
                              task.createdBy === uid ||
                              role === 'owner' ||
                              role === 'admin') && (
                              <button
                                type="button"
                                className="text-[0.6rem] text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover/comment:opacity-100"
                                onClick={() => {
                                  void container.tasks
                                    .removeComment(workspace.id, board.id, task.id, item.id)
                                    .catch((error) =>
                                      toast.error(
                                        error instanceof Error
                                          ? error.message
                                          : 'No se pudo borrar el comentario.',
                                      ),
                                    )
                                }}
                              >
                                Borrar
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingComment && (
                <div className="flex items-center gap-2 rounded-lg border-s-2 border-amber-500 bg-amber-500/10 px-3 py-1.5 text-xs">
                  <Pencil className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="min-w-0 flex-1 truncate">
                    Editando tu comentario
                    <span className="text-muted-foreground"> · Enter guarda, Esc cancela</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={cancelEditingComment}
                    aria-label="Cancelar edición"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}

              <div ref={commentComposerRef} className="flex gap-2">
                <Textarea
                  ref={commentInputRef}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={
                    editingComment
                      ? 'Edita tu comentario…'
                      : lastOwnComment
                        ? 'Escribe un comentario… (↑ edita el último)'
                        : 'Escribe un comentario…'
                  }
                  rows={2}
                  className="min-h-0 resize-none text-xs"
                  onKeyDown={(event) => {
                    if (
                      event.key === 'ArrowUp' &&
                      !editingComment &&
                      !comment.trim() &&
                      lastOwnComment
                    ) {
                      event.preventDefault()
                      startEditingLast()
                      return
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void submitComment()
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => void submitComment()}
                  disabled={sendingComment || !comment.trim()}
                  aria-label={editingComment ? 'Guardar cambios' : 'Enviar comentario'}
                >
                  {sendingComment ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : editingComment ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-[0.65rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="outline" className="h-4 px-1.5 text-[0.55rem]">
                  ID
                </Badge>
                <span className="font-mono">{task.id.slice(0, 8)}</span>
              </span>
              <span>
                Creada {formatRelative(task.createdAt)} · Actualizada {formatRelative(task.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </SheetContent>

      <TaskTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        task={task}
        sourceBoard={board}
        onTransferred={onTransferred}
      />

      <RejectReviewDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        task={task}
        board={board}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar esta tarea?"
        description="Se eliminarán la tarea y sus comentarios. Esta acción no se puede deshacer."
        confirmLabel="Eliminar tarea"
        onConfirm={async () => {
          try {
            await container.tasks.remove(workspace.id, board.id, task.id)
            toast.success('Tarea eliminada.')
            onClose()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la tarea.')
          }
        }}
      />
    </Sheet>
  )
}

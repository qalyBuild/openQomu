import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  CheckCheck,
  Copy,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Reply,
  SmilePlus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { FileMeta, Message, MessageReadState } from '@/domain/entities/chat'
import type { Member, Role } from '@/domain/entities/identity'
import { excerpt, isDeletedMessageExpired, readReceipt } from '@/domain/services/message-service'
import { formatDate, formatRelative, formatTime, dayKey } from '@/lib/date'
import { canDeleteMessage } from '@/domain/services/permission-service'
import { useContainer } from '@/app/auth-provider'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { FileIcon } from '@/presentation/components/common/file-icon'
import { FileImage, FileOpenLink } from '@/presentation/components/common/file-preview'
import { ReactionPicker } from '@/presentation/components/common/emoji-picker'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { formatBytes, isImageFile } from '@/domain/services/file-service'
import { cn } from '@/lib/utils'

function renderBody(body: string) {
  const tokens = body.split(/(@[\p{L}\p{N}._-]+)/gu)
  return tokens.map((token, index) => {
    if (/^@[\p{L}\p{N}._-]+$/u.test(token)) {
      return (
        <span
          key={`${token}-${index}`}
          className="rounded bg-primary/10 px-1 py-0.5 font-medium text-primary"
        >
          {token}
        </span>
      )
    }
    const urlParts = token.split(/(https?:\/\/[^\s]+)/g)
    return urlParts.map((part, urlIndex) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={`${part}-${urlIndex}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {part}
          </a>
        )
      }
      return <span key={`${index}-${urlIndex}`}>{part}</span>
    })
  })
}

function AttachmentGrid({ files }: { files: FileMeta[] }) {
  if (files.length === 0) return null
  const images = files.filter((file) => isImageFile(file) && file.url)
  const others = files.filter((file) => !isImageFile(file) || !file.url)
  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className={cn('grid gap-2', images.length > 1 ? 'grid-cols-2' : 'max-w-sm grid-cols-1')}>
          {images.map((file) => (
            <FileOpenLink
              key={file.id}
              file={file}
              className="group overflow-hidden rounded-xl border bg-muted/40"
            >
              <FileImage
                file={file}
                alt={file.name}
                className={cn(
                  'w-full transition-transform duration-300 group-hover:scale-[1.02]',
                  images.length > 1 ? 'max-h-44' : 'max-h-72',
                )}
              />
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.68rem] text-muted-foreground">
                <FileIcon file={file} className="size-3" /> {file.name}
              </span>
            </FileOpenLink>
          ))}
        </div>
      )}
      {others.map((file) => (
        <FileOpenLink
          key={file.id}
          file={file}
          className="flex max-w-sm items-center gap-3 rounded-xl border bg-card p-2.5 transition-colors hover:bg-muted/40"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-muted">
            <FileIcon file={file} className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{file.name}</span>
            <span className="text-[0.65rem] text-muted-foreground">{formatBytes(file.size)}</span>
          </span>
        </FileOpenLink>
      ))}
    </div>
  )
}

function ReadStatus({
  state,
  readers,
  members,
  className,
}: {
  state: MessageReadState
  readers: string[]
  members: Member[]
  className?: string
}) {
  const names = readers
    .map((id) => members.find((member) => member.uid === id)?.displayName.split(/\s+/)[0])
    .filter((name): name is string => Boolean(name))
  const label =
    state === 'read-all'
      ? 'Visto por todo el canal'
      : state === 'read'
        ? `Visto por ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' y más' : ''}`
        : 'Enviado'
  const Icon = state === 'sent' ? Check : CheckCheck

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center align-middle',
            state === 'read-all' ? 'text-primary' : 'text-muted-foreground/70',
            className,
          )}
          aria-label={label}
        >
          <Icon className="size-3.5" strokeWidth={2.4} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function MessageItem({
  message,
  grouped,
  messages,
  files,
  members,
  role,
  uid,
  reads = {},
  recipientIds = [],
  onReply,
  onOpenThread,
  hideThread = false,
}: {
  message: Message
  grouped: boolean
  messages: Message[]
  files: FileMeta[]
  members: Member[]
  role: Role
  uid: string
  reads?: Record<string, string>
  recipientIds?: string[]
  onReply: (message: Message) => void
  onOpenThread?: (message: Message) => void
  hideThread?: boolean
}) {
  const container = useContainer()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mobileActions, setMobileActions] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const messageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mobileActions) return
    const close = (event: PointerEvent) => {
      if (!messageRef.current?.contains(event.target as Node)) setMobileActions(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [mobileActions])
  const [saving, setSaving] = useState(false)

  const fileMap = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])
  const attachments = message.attachmentIds
    .map((id) => fileMap.get(id))
    .filter((file): file is FileMeta => Boolean(file))
  const parent = message.replyToId ? messages.find((item) => item.id === message.replyToId) : null
  const replies = messages.filter((item) => item.replyToId === message.id && !item.deletedAt)
  const reactions = Object.entries(message.reactions ?? {}).filter(([, uids]) => uids.length > 0)
  const canDelete = canDeleteMessage(role, message, uid)
  const receipt = readReceipt(message, uid, reads, recipientIds)
  const mine = message.authorId === uid

  const author = members.find((member) => member.uid === message.authorId)
  const online = author?.lastActiveAt
    ? Date.now() - new Date(author.lastActiveAt).getTime() < 5 * 60_000
    : false

  const toggleReaction = async (emoji: string) => {
    try {
      await container.messages.toggleReaction(
        message.workspaceId,
        message.channelId,
        message.id,
        emoji,
        uid,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo reaccionar.')
    }
  }

  const copyMessage = async () => {
    setMobileActions(false)
    if (!message.body.trim()) return
    try {
      await navigator.clipboard.writeText(message.body)
      toast.success('Mensaje copiado.')
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = message.body
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
        toast.success('Mensaje copiado.')
      } catch {
        toast.error('No se pudo copiar el mensaje.')
      }
    }
  }

  const saveEdit = async () => {
    if (!draft.trim() || draft === message.body) {
      setEditOpen(false)
      return
    }
    setSaving(true)
    try {
      await container.messages.updateBody(
        message.workspaceId,
        message.channelId,
        message.id,
        draft,
      )
      setEditOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo editar el mensaje.')
    } finally {
      setSaving(false)
    }
  }

  if (message.deletedAt) {
    if (isDeletedMessageExpired(message)) return null
    return (
      <div className="px-2 py-1 ps-12 text-xs italic text-muted-foreground">
        Se eliminó este mensaje: {message.body}
      </div>
    )
  }

  return (
    <div
      ref={messageRef}
      className={cn(
        'chat-message group/message relative -mx-2 rounded-lg px-2 transition-colors hover:bg-muted/40',
        grouped ? 'py-0.5' : 'py-2',
      )}
    >
      <div className={cn('flex gap-3', mine && 'flex-row-reverse')}>
        <div className="w-9 shrink-0">
          {!grouped ? (
            <UserAvatar
              name={message.authorName}
              photoURL={message.authorPhotoURL}
              size="default"
              online={online}
            />
          ) : (
            !mine && (
              <span className="mt-1 flex flex-col items-end gap-0.5 pe-1 text-[0.6rem] text-muted-foreground/60">
                <span>{formatTime(message.createdAt)}</span>
              </span>
            )
          )}
        </div>
        <div
          className={cn(
            'flex min-w-0 max-w-[85%] flex-col gap-1',
            mine ? 'items-end' : 'items-start',
          )}
        >
          {!grouped && (
            <div className={cn('flex items-baseline gap-2', mine && 'flex-row-reverse')}>
              <span className="text-sm font-semibold tracking-tight">{message.authorName}</span>
              {!mine && (
                <>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {formatTime(message.createdAt)}
                  </span>
                  {message.editedAt && (
                    <span className="text-[0.6rem] text-muted-foreground/70">(editado)</span>
                  )}
                </>
              )}
            </div>
          )}

          {parent && (
            <div className="flex max-w-full items-center gap-1.5 text-[0.68rem] text-muted-foreground">
              <Reply className="size-3 shrink-0" />
              <span className="truncate">
                <strong className="font-medium text-foreground/80">{parent.authorName}</strong> ·{' '}
                {excerpt(parent.body, 70)}
              </span>
            </div>
          )}

          {message.body && (
            <p
              className={cn(
                'whitespace-pre-wrap wrap-anywhere rounded-2xl px-3 py-2 text-[0.875rem] leading-relaxed',
                mine ? 'bg-primary/10 text-foreground' : 'bg-muted/50 text-foreground/90',
              )}
            >
              {renderBody(message.body)}
            </p>
          )}

          <AttachmentGrid files={attachments} />

          {mine && (
            <div className="flex items-center gap-1 px-1 text-[0.6rem] text-muted-foreground">
              <span>{formatTime(message.createdAt)}</span>
              {message.editedAt && (
                <span className="text-muted-foreground/70">· editado</span>
              )}
              {receipt && (
                <ReadStatus
                  state={receipt.state}
                  readers={receipt.readers}
                  members={members}
                />
              )}
            </div>
          )}

          {reactions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {reactions.map(([emoji, uids]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void toggleReaction(emoji)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.7rem] transition-colors',
                    uids.includes(uid)
                      ? 'border-primary/35 bg-primary/10 text-primary'
                      : 'bg-card hover:border-primary/20 hover:bg-muted',
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-[0.62rem] font-medium">{uids.length}</span>
                </button>
              ))}
              <ReactionPicker onPick={(emoji) => void toggleReaction(emoji)}>
                <button
                  type="button"
                  className="grid size-6 place-items-center rounded-full border border-dashed text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover/message:opacity-100"
                  aria-label="Añadir reacción"
                >
                  <SmilePlus className="size-3" />
                </button>
              </ReactionPicker>
            </div>
          )}

          {!hideThread && replies.length > 0 && (
            <button
              type="button"
              onClick={() => {
                  setMobileActions(false)
                  onOpenThread?.(message)
                }}
              className="flex items-center gap-1 text-[0.68rem] font-medium text-primary hover:underline"
            >
              <MessageSquare className="size-3" />
              {replies.length} {replies.length === 1 ? 'respuesta' : 'respuestas'}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobileActions((value) => !value)}
        aria-label="Acciones del mensaje"
        aria-expanded={mobileActions}
        className={cn(
          'absolute top-0 z-10 grid size-6 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground md:hidden',
          mine ? 'start-0' : 'end-0',
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>

      <div
        className={cn(
          'chat-message-actions absolute top-7 z-10 flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-md md:-top-3',
          mine ? 'start-0 md:start-2' : 'end-0 md:end-2',
          mobileActions && 'is-open',
        )}
      >
        <ReactionPicker onPick={(emoji) => void toggleReaction(emoji)}>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" aria-label="Reaccionar">
            <SmilePlus className="size-3.5" />
          </Button>
        </ReactionPicker>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={() => {
                setMobileActions(false)
                onReply(message)
              }}
              aria-label="Responder"
            >
              <Reply className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Responder</TooltipContent>
        </Tooltip>
        {message.body.trim() && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={() => void copyMessage()}
                aria-label="Copiar mensaje"
              >
                <Copy className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar</TooltipContent>
          </Tooltip>
        )}
        {!hideThread && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={() => onOpenThread?.(message)}
                aria-label="Abrir hilo"
              >
                <MessageSquare className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver hilo</TooltipContent>
          </Tooltip>
        )}
        {message.authorId === uid && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={() => {
                  setMobileActions(false)
                  setDraft(message.body)
                  setEditOpen(true)
                }}
                aria-label="Editar mensaje"
              >
                <Pencil className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setMobileActions(false)
                  setDeleteOpen(true)
                }}
                aria-label="Eliminar mensaje"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar mensaje</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void saveEdit()
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving || !draft.trim()}>
              <Check className="size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar este mensaje?"
        description="Se mostrará como eliminado una hora y después desaparecerá para todos."
        confirmLabel="Eliminar mensaje"
        onConfirm={async () => {
          try {
            await container.messages.remove(message.workspaceId, message.channelId, message.id)
            toast.success('Mensaje eliminado.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar.')
          }
        }}
      />
    </div>
  )
}

export function NewMessagesDivider() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-primary/40" />
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-primary">
        Nuevo
      </span>
      <div className="h-px flex-1 bg-primary/40" />
    </div>
  )
}

export function DaySeparator({ iso }: { iso: string }) {  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86_400_000))
  const key = dayKey(iso)
  const label =
    key === today ? 'Hoy' : key === yesterday ? 'Ayer' : formatDate(iso)
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="h-px flex-1 bg-border/70" />
      <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/70" />
      <span className="sr-only">{formatRelative(iso)}</span>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Loader2,
  Paperclip,
  Pencil,
  Send,
  SmilePlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import type { Message } from '@/domain/entities/chat'
import type { Member } from '@/domain/entities/identity'
import { excerpt, normalizeSearchText } from '@/domain/services/message-service'
import { formatBytes, isImageFile, validateUpload } from '@/domain/services/file-service'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { EmojiPicker } from '@/presentation/components/common/emoji-picker'
import { FileIcon } from '@/presentation/components/common/file-icon'
import { isNativeApp } from '@/lib/app-url'
import { cn } from '@/lib/utils'

type PendingAttachment = {
  key: string
  file: File
  previewUrl: string | null
}

export function MessageComposer({
  channelId,
  replyTo = null,
  lastOwnMessage = null,
  onCancelReply,
  onSent,
  onDraftChange,
  placeholder = 'Escribe un mensaje…',
  compact = false,
}: {
  channelId: string
  replyTo?: Message | null
  lastOwnMessage?: Message | null
  onCancelReply?: () => void
  onSent?: () => void
  onDraftChange?: (hasDraft: boolean) => void
  placeholder?: string
  compact?: boolean
}) {
  const container = useContainer()
  const { workspace, members } = useWorkspaceData()
  const { session, profile } = useAuth()
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState<Message | null>(null)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentsRef = useRef<PendingAttachment[]>([])
  attachmentsRef.current = attachments

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }, [body])

  useEffect(() => {
    onDraftChange?.(body.trim().length > 0)
  }, [body, onDraftChange])

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [])

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus()
  }, [replyTo])

  // En PC, al entrar en un chat el cursor ya está listo para escribir.
  // En la app móvil y en pantallas táctiles no se abre el teclado solo.
  useEffect(() => {
    if (compact || isNativeApp()) return
    if (!window.matchMedia('(pointer: fine)').matches || window.innerWidth < 768) return
    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
    })
    return () => cancelAnimationFrame(frame)
  }, [channelId, compact])

  const mentionMatch = /(?:^|\s)@([\p{L}\p{N}._-]*)$/u.exec(body)
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? null
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const query = normalizeSearchText(mentionQuery)
    return members
      .filter((member) => {
        if (member.uid === session?.id) return false
        const name = normalizeSearchText(member.displayName)
        const email = normalizeSearchText(member.email)
        return name.includes(query) || email.includes(query)
      })
      .slice(0, 6)
  }, [members, mentionQuery, session?.id])

  // Indicador «escribiendo…»: se refresca como mucho cada 2 s y se retira al enviar o salir.
  const typingRef = useRef(false)
  const lastTypingRef = useRef(0)
  const typingPayload = useRef<{ id: string; displayName: string } | null>(null)
  typingPayload.current = session
    ? { id: session.id, displayName: profile?.displayName ?? session.displayName }
    : null

  const announceTyping = (active: boolean) => {
    if (compact) return
    const payload = typingPayload.current
    if (!payload) return
    if (active) {
      const now = Date.now()
      if (typingRef.current && now - lastTypingRef.current < 2000) return
      lastTypingRef.current = now
      typingRef.current = true
      void container.messages.setTyping(workspace.id, channelId, payload, true).catch(() => {})
      return
    }
    if (!typingRef.current) return
    typingRef.current = false
    void container.messages.setTyping(workspace.id, channelId, payload, false).catch(() => {})
  }

  useEffect(() => {
    return () => {
      const payload = typingPayload.current
      if (!typingRef.current || !payload) return
      typingRef.current = false
      void container.messages.setTyping(workspace.id, channelId, payload, false).catch(() => {})
    }
  }, [channelId, container, workspace.id])

  useEffect(() => setMentionIndex(0), [mentionQuery])

  const insertMention = (member: Member) => {
    const firstName = member.displayName.split(' ')[0]
    setBody((value) => value.replace(/@([\p{L}\p{N}._-]*)$/u, `@${firstName} `))
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? body.length
    const next = `${body.slice(0, start)}${emoji}${body.slice(start)}`
    setBody(next)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const attachFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    const next: PendingAttachment[] = []
    for (const file of list) {
      try {
        validateUpload({ name: file.name, size: file.size, contentType: file.type })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo adjuntar el archivo.')
        continue
      }
      next.push({
        key: crypto.randomUUID(),
        file,
        previewUrl: isImageFile({ name: file.name, contentType: file.type })
          ? URL.createObjectURL(file)
          : null,
      })
    }
    setAttachments((current) => [...current, ...next])
  }

  const removeAttachment = (key: string) => {
    setAttachments((current) => {
      const target = current.find((item) => item.key === key)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.key !== key)
    })
  }

  const clearAttachments = () => {
    attachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    })
    setAttachments([])
  }

  const startEditingLast = () => {
    if (!lastOwnMessage || editing || body.trim() || attachments.length > 0) return
    setEditing(lastOwnMessage)
    setBody(lastOwnMessage.body)
    onCancelReply?.()
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      textarea?.focus()
      textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
    })
  }

  const cancelEditing = () => {
    setEditing(null)
    setBody('')
    announceTyping(false)
  }

  const send = async () => {
    if (!session || sending) return
    if (editing) {
      if (!body.trim() || body.trim() === editing.body) {
        cancelEditing()
        return
      }
      setSending(true)
      try {
        await container.messages.updateBody(workspace.id, channelId, editing.id, body)
        setBody('')
        setEditing(null)
        announceTyping(false)
        onSent?.()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo editar el mensaje.')
      } finally {
        setSending(false)
      }
      return
    }
    if (!body.trim() && attachments.length === 0) return
    setSending(true)
    try {
      const attachmentIds: string[] = []
      if (attachments.length > 0) {
        // Los adjuntos se suben solo al enviar: adjuntar no crea archivos sueltos.
        setUploading(true)
        setProgress(0)
        try {
          for (const item of attachments) {
            const meta = await container.files.upload(
              workspace.id,
              {
                name: item.file.name,
                size: item.file.size,
                contentType: item.file.type,
                data: item.file,
              },
              session.id,
              { onProgress: setProgress },
            )
            attachmentIds.push(meta.id)
          }
        } finally {
          setUploading(false)
          setProgress(0)
        }
      }
      await container.messages.send({
        workspaceId: workspace.id,
        channelId,
        author: {
          id: session.id,
          displayName: profile?.displayName ?? session.displayName,
          photoURL: profile?.photoURL ?? session.photoURL,
        },
        body,
        attachmentIds,
        replyToId: replyTo?.id ?? null,
      })
      setBody('')
      clearAttachments()
      onCancelReply?.()
      announceTyping(false)
      onSent?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn('relative', compact ? 'p-3' : 'p-3 sm:px-5 sm:pb-4')}>
      {suggestions.length > 0 && mentionQuery !== null && (
        <div className="animate-pop absolute bottom-full start-3 z-30 mb-1 w-64 overflow-hidden rounded-xl border bg-popover p-1 shadow-xl">
          <p className="px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Mencionar a
          </p>
          {suggestions.map((member, index) => (
            <button
              key={member.uid}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition-colors',
                index === mentionIndex ? 'bg-accent' : 'hover:bg-accent/60',
              )}
              onMouseDown={(event) => {
                event.preventDefault()
                insertMention(member)
              }}
            >
              <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[0.55rem] font-semibold text-primary">
                {member.displayName.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate">{member.displayName}</span>
              <span className="text-[0.6rem] text-muted-foreground">@{member.displayName.split(' ')[0].toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-s-2 border-amber-500 bg-amber-500/10 px-3 py-1.5 text-xs">
          <Pencil className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="min-w-0 flex-1 truncate">
            Editando tu último mensaje
            <span className="text-muted-foreground"> · Enter guarda, Esc cancela</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={cancelEditing}
            aria-label="Cancelar edición"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-s-2 border-primary bg-muted/50 px-3 py-1.5 text-xs">
          <span className="min-w-0 flex-1 truncate">
            Respondiendo a <strong className="font-medium">{replyTo.authorName}</strong>
            <span className="text-muted-foreground"> · {excerpt(replyTo.body, 60)}</span>
          </span>
          <Button variant="ghost" size="icon" className="size-6" onClick={onCancelReply} aria-label="Cancelar respuesta">
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((item) => (
            <div
              key={item.key}
              className="group flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 text-xs"
            >
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="" className="size-7 rounded object-cover" />
              ) : (
                <FileIcon
                  file={{ name: item.file.name, contentType: item.file.type }}
                  className="size-3.5"
                />
              )}
              <span className="max-w-32 truncate">{item.file.name}</span>
              <span className="text-[0.6rem] text-muted-foreground">
                {formatBytes(item.file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(item.key)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Quitar ${item.file.name}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Progress value={progress} className="h-1 flex-1" />
          <span>Subiendo… {progress}%</span>
        </div>
      )}

      <div className="rounded-xl border bg-card/80 shadow-sm transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => {
            const value = event.target.value
            setBody(value)
            announceTyping(value.trim().length > 0)
          }}
          onBlur={() => announceTyping(false)}
          onPaste={(event) => {
            const files = event.clipboardData?.files
            if (files && files.length > 0) {
              event.preventDefault()
              attachFiles(files)
            }
          }}
          onKeyDown={(event) => {
            if (suggestions.length > 0 && mentionQuery !== null) {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setMentionIndex((index) => (index + 1) % suggestions.length)
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setMentionIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
                return
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault()
                insertMention(suggestions[mentionIndex])
                return
              }
            }
            if (event.key === 'Escape' && editing) {
              event.preventDefault()
              cancelEditing()
              return
            }
            if (event.key === 'ArrowUp' && !editing && !body.trim() && lastOwnMessage) {
              event.preventDefault()
              startEditingLast()
              return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          placeholder={editing ? 'Edita tu mensaje…' : placeholder}
          rows={1}
          className="min-h-[42px] resize-none overflow-y-auto field-sizing-fixed scrollbar-thin border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-0.5 px-2 pb-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) attachFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Adjuntar archivo"
          >
            <Paperclip className="size-3.5" />
          </Button>
          <EmojiPicker
            onPick={insertEmoji}
            align="start"
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                aria-label="Insertar emoji"
              >
                <SmilePlus className="size-3.5" />
              </Button>
            }
          />
          <span className="ms-1 hidden text-[0.6rem] text-muted-foreground sm:inline">
            {editing ? (
              <>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[0.55rem]">Enter</kbd> guarda ·{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[0.55rem]">Esc</kbd> cancela
              </>
            ) : (
              <>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[0.55rem]">Enter</kbd> envía ·{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[0.55rem]">Shift</kbd> +{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[0.55rem]">Enter</kbd> salto
              </>
            )}
          </span>
          <Button
            type="button"
            size="icon"
            className="ms-auto size-7"
            onClick={() => void send()}
            disabled={
              sending ||
              uploading ||
              (editing ? !body.trim() : !body.trim() && attachments.length === 0)
            }
            aria-label={editing ? 'Guardar cambios' : 'Enviar mensaje'}
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : editing ? (
              <Check className="size-3.5" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

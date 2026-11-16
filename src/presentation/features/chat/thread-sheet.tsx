import { useEffect, useRef } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { FileMeta, Message } from '@/domain/entities/chat'
import type { Member, Role } from '@/domain/entities/identity'
import { MessageItem } from './message-item'
import { MessageComposer } from './message-composer'
import { UserAvatar } from '@/presentation/components/common/user-avatar'

export function ThreadSheet({
  parent,
  messages,
  files,
  members,
  role,
  uid,
  reads = {},
  recipientIds = [],
  onClose,
}: {
  parent: Message | null
  messages: Message[]
  files: FileMeta[]
  members: Member[]
  role: Role
  uid: string
  reads?: Record<string, string>
  recipientIds?: string[]
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const replies = parent
    ? messages.filter((message) => message.replyToId === parent.id && !message.deletedAt)
    : []

  const jumpToBottom = () => {
    const element = scrollRef.current
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }

  useEffect(() => {
    if (parent) jumpToBottom()
  }, [parent, replies.length])

  return (
    <Sheet open={Boolean(parent)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <MessageSquare className="size-4 text-primary" />
          <SheetTitle className="text-sm font-semibold">Hilo</SheetTitle>
          <div className="ms-auto flex items-center gap-2">
            {parent && (
              <span className="text-xs text-muted-foreground">{replies.length} respuestas</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {parent && (
          <>
            <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <UserAvatar
                  name={parent.authorName}
                  photoURL={parent.authorPhotoURL}
                  size="sm"
                />
                <span className="font-medium text-foreground">{parent.authorName}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6rem]">mensaje original</span>
              </div>
              <MessageItem
                message={parent}
                grouped={false}
                messages={messages}
                files={files}
                members={members}
                role={role}
                uid={uid}
                reads={reads}
                recipientIds={recipientIds}
                onReply={() => {}}
                hideThread
              />
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[0.65rem] font-medium text-muted-foreground">
                  {replies.length === 0 ? 'Sin respuestas' : `${replies.length} respuestas`}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {replies.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Inicia el hilo con una respuesta.
                </p>
              ) : (
                <div className="space-y-1">
                  {replies.map((reply) => (
                    <MessageItem
                      key={reply.id}
                      message={reply}
                      grouped={false}
                      messages={messages}
                      files={files}
                      members={members}
                      role={role}
                      uid={uid}
                      reads={reads}
                      recipientIds={recipientIds}
                      onReply={() => {}}
                      hideThread
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="border-t bg-background">
              <MessageComposer
                channelId={parent.channelId}
                replyTo={parent}
                compact
                placeholder="Responde en el hilo…"
                onSent={() => {
                  requestAnimationFrame(jumpToBottom)
                }}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ArrowDown, Hash, Lock, MessageSquare, Settings2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Message } from '@/domain/entities/chat'
import { groupMessages } from '@/domain/services/message-service'
import { dayKey, formatDate } from '@/lib/date'
import { isRecentlyActive } from '@/lib/presence'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { useContainer } from '@/app/auth-provider'
import { useChannelReads, useMessages, useTypingUsers } from '@/presentation/hooks/use-data'
import { AvatarStack } from '@/presentation/components/common/user-avatar'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { CreateChannelDialog } from '@/presentation/features/chat/create-channel-dialog'
import { MessageComposer } from '@/presentation/features/chat/message-composer'
import { MessageItem, DaySeparator } from '@/presentation/features/chat/message-item'
import { ThreadSheet } from '@/presentation/features/chat/thread-sheet'
import { TypingIndicator } from '@/presentation/features/chat/typing-indicator'
import { ChannelSettingsDialog } from '@/presentation/features/chat/channel-settings-dialog'

export function ChatPage() {
  const { channelId } = useParams()
  const { workspace, channels } = useWorkspaceData()
  const channel = channels.find((item) => item.id === channelId)

  if (!channelId && channels[0]) {
    return <Navigate to={`/w/${workspace.id}/c/${channels[0].id}`} replace />
  }

  if (!channel) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon={MessageSquare}
          title="Este canal no está disponible"
          description="Puede que sea privado o se haya archivado. Elige otro canal o crea uno nuevo."
          action={
            <CreateChannelDialog
              trigger={
                <Button>
                  <Hash className="size-4" /> Crear canal
                </Button>
              }
            />
          }
        />
      </div>
    )
  }

  return <ChannelChat key={channel.id} channelId={channel.id} />
}

function ChannelChat({ channelId }: { channelId: string }) {
  const { workspace, channels, members, files, role, uid, can } = useWorkspaceData()
  const container = useContainer()
  const channel = channels.find((item) => item.id === channelId)!
  const { messages, loading } = useMessages(workspace.id, channelId)
  const reads = useChannelReads(workspace.id, channelId)
  const typingUsers = useTypingUsers(workspace.id, channelId, uid)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [threadParent, setThreadParent] = useState<Message | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const groups = useMemo(() => groupMessages(messages), [messages])
  const lastOwnMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.authorId === uid && !message.deletedAt && message.body.trim()) return message
    }
    return null
  }, [messages, uid])
  const onlineMembers = members.filter((member) => isRecentlyActive(member.lastActiveAt))
  const visibleMembers =
    channel.type === 'private'
      ? members.filter((member) => channel.memberIds.includes(member.uid))
      : onlineMembers
  const canManageChannel = can('channel.manage') || channel.createdBy === uid
  const recipientIds =
    channel.type === 'private' ? channel.memberIds : members.map((member) => member.uid)

  // Marca el canal como leído: así el resto ve el check de «visto».
  useEffect(() => {
    if (!uid) return
    let lastMarked = 0
    const mark = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastMarked < 4000) return
      lastMarked = now
      void container.messages
        .markRead(workspace.id, channelId, uid, new Date(now).toISOString())
        .catch(() => {})
    }
    const timer = window.setTimeout(mark, 600)
    document.addEventListener('visibilitychange', mark)
    window.addEventListener('focus', mark)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', mark)
      window.removeEventListener('focus', mark)
    }
  }, [channelId, container, messages.length, uid, workspace.id])

  const jumpToBottom = (behavior: ScrollBehavior) => {
    const element = scrollRef.current
    if (!element) return
    // No uses scrollIntoView: también desplaza `main` y rompe el layout del chat.
    element.scrollTo({ top: element.scrollHeight, behavior })
  }

  useEffect(() => {
    stickToBottom.current = true
    requestAnimationFrame(() => {
      jumpToBottom('auto')
    })
  }, [channelId])

  useEffect(() => {
    if (stickToBottom.current) {
      jumpToBottom('smooth')
    }
  }, [messages.length])

  useEffect(() => {
    if (stickToBottom.current && typingUsers.length > 0) jumpToBottom('smooth')
  }, [typingUsers.length])

  const onScroll = () => {
    const element = scrollRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    stickToBottom.current = distance < 120
    setShowScrollButton(distance > 300)
  }

  const scrollToBottom = () => {
    stickToBottom.current = true
    jumpToBottom('smooth')
  }

  const groupsWithDates = groups.map((group, index) => ({
    group,
    showSeparator:
      index === 0 || dayKey(group.createdAt) !== dayKey(groups[index - 1].createdAt),
  }))

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border/70 px-4 sm:h-14 sm:px-5">
        <span className="hidden size-8 shrink-0 place-items-center rounded-lg border bg-muted/50 sm:grid">
          {channel.type === 'private' ? (
            <Lock className="size-4 text-muted-foreground" />
          ) : (
            <Hash className="size-4 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="hidden truncate text-sm font-semibold tracking-tight sm:block">
              {channel.name}
            </h1>
            {channel.type === 'private' && (
              <span className="hidden rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.55rem] font-medium uppercase tracking-wide text-amber-600 sm:inline-block dark:text-amber-400">
                Privado
              </span>
            )}
          </div>
          <p className="truncate text-[0.68rem] text-muted-foreground">
            {channel.description || 'Canal del equipo'}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden items-center gap-2 rounded-full border bg-card/60 px-2 py-1 sm:flex">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              <Users className="size-3 text-muted-foreground" />
              <span className="text-[0.65rem] text-muted-foreground">{members.length}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{onlineMembers.length} en línea de {members.length}</TooltipContent>
        </Tooltip>
        <AvatarStack
          people={visibleMembers.map((member) => ({
            id: member.uid,
            displayName: member.displayName,
            photoURL: member.photoURL,
          }))}
          max={3}
          size="sm"
          className="hidden sm:flex"
        />
        {canManageChannel && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            onClick={() => setSettingsOpen(true)}
            aria-label="Ajustes del canal"
          >
            <Settings2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="scrollbar-thin h-full overflow-y-auto px-3 pb-4 sm:px-5"
        >
          <div className="mx-auto max-w-4xl">
            <div className="py-8 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl border bg-gradient-to-br from-primary/15 to-fuchsia-500/10 shadow-sm">
                {channel.type === 'private' ? (
                  <Lock className="size-6 text-primary" />
                ) : (
                  <Hash className="size-6 text-primary" />
                )}
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">
                {channel.type === 'private' ? '🔒 ' : '# '}
                {channel.name}
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                {channel.description || 'Este es el comienzo del canal.'}
              </p>
              <p className="mt-2 text-[0.65rem] text-muted-foreground/70">
                Creado el {formatDate(channel.createdAt)}
              </p>
            </div>

            {loading && messages.length === 0 ? (
              <div className="space-y-4 py-4">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="flex gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/40 p-8 text-center">
                <p className="text-sm font-medium">Sé el primero en escribir</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Comparte una idea, una pregunta o un enlace. Todo el equipo lo verá al instante.
                </p>
              </div>
            ) : (
              groupsWithDates.map(({ group, showSeparator }) => {
                return (
                  <div key={group.id}>
                    {showSeparator && <DaySeparator iso={group.createdAt} />}
                    <div className="space-y-0.5">
                      {group.messages.map((message, index) => (
                        <MessageItem
                          key={message.id}
                          message={message}
                          grouped={index > 0}
                          messages={messages}
                          files={files}
                          members={members}
                          role={role}
                          uid={uid}
                          reads={reads}
                          recipientIds={recipientIds}
                          onReply={(messageToReply) => {
                            setReplyTo(messageToReply)
                            stickToBottom.current = true
                            requestAnimationFrame(() => scrollToBottom())
                          }}
                          onOpenThread={(messageToOpen) => setThreadParent(messageToOpen)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
            <TypingIndicator users={typingUsers} members={members} />
            <div ref={bottomRef} className="h-2" />
          </div>
        </div>

        {showScrollButton && (
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-3 left-1/2 z-20 h-8 -translate-x-1/2 gap-1.5 rounded-full border shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDown className="size-3.5" /> Ir al final
          </Button>
        )}
      </div>

      <div className="shrink-0 border-t border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-4xl">
          <MessageComposer
            channelId={channel.id}
            replyTo={replyTo}
            lastOwnMessage={lastOwnMessage}
            onCancelReply={() => setReplyTo(null)}
            onSent={scrollToBottom}
          />
        </div>
      </div>

      <ChannelSettingsDialog
        channel={channel}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <ThreadSheet
        parent={threadParent ? messages.find((message) => message.id === threadParent.id) ?? threadParent : null}
        messages={messages}
        files={files}
        members={members}
        role={role}
        uid={uid}
        reads={reads}
        recipientIds={recipientIds}
        onClose={() => setThreadParent(null)}
      />
    </div>
  )
}

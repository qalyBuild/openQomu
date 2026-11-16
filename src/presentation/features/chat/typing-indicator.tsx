import type { TypingUser } from '@/domain/entities/chat'
import type { Member } from '@/domain/entities/identity'
import { typingLabel } from '@/domain/services/message-service'
import { UserAvatar } from '@/presentation/components/common/user-avatar'

/** Burbuja animada con los puntos de «escribiendo…». */
export function TypingIndicator({
  users,
  members,
}: {
  users: TypingUser[]
  members: Member[]
}) {
  if (users.length === 0) return null
  const leadUid = users[0].uid
  const lead = members.find((member) => member.uid === leadUid)

  return (
    <div className="animate-fade-in flex items-end gap-3 py-1.5" aria-live="polite">
      <div className="w-9 shrink-0">
        {lead && <UserAvatar name={lead.displayName} photoURL={lead.photoURL} size="default" />}
      </div>
      <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border bg-card px-3 py-2 shadow-sm">
        <span className="flex items-end gap-0.5" aria-hidden>
          {[0, 140, 280].map((delay) => (
            <span
              key={delay}
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
              style={{ animationDelay: `${delay}ms`, animationDuration: '900ms' }}
            />
          ))}
        </span>
        <span className="text-[0.7rem] text-muted-foreground">{typingLabel(users)}</span>
      </div>
    </div>
  )
}

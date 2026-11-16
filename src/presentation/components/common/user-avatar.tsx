import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/domain/services/workspace-service'
import { cn } from '@/lib/utils'

const GRADIENTS = [
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #14b8a6, #22d3ee)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #6366f1, #22d3ee)',
  'linear-gradient(135deg, #ec4899, #f97316)',
  'linear-gradient(135deg, #84cc16, #14b8a6)',
  'linear-gradient(135deg, #a855f7, #6366f1)',
]

function gradientFor(seed: string): string {
  const sum = [...seed].reduce((acc, character) => acc + character.charCodeAt(0), 0)
  return GRADIENTS[sum % GRADIENTS.length]
}

export function UserAvatar({
  name,
  photoURL,
  className,
  size = 'default',
  online,
}: {
  name: string
  photoURL?: string | null
  className?: string
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl'
  online?: boolean
}) {
  const sizeClass = {
    xs: 'size-6 text-[0.6rem]',
    sm: 'size-7 text-[0.65rem]',
    default: 'size-9 text-xs',
    lg: 'size-11 text-sm',
    xl: 'size-16 text-lg',
  }[size]

  return (
    <span className={cn('relative inline-flex shrink-0 rounded-full', className)}>
      <Avatar className={cn(sizeClass, 'border border-white/10 shadow-sm')}>
        {photoURL ? <AvatarImage src={photoURL} alt={name} referrerPolicy="no-referrer" /> : null}
        <AvatarFallback
          className="font-semibold text-white"
          style={{ background: gradientFor(name) }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          className={cn(
            'absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background',
            online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
          )}
          aria-label={online ? 'En línea' : 'Ausente'}
        />
      )}
    </span>
  )
}

export function AvatarStack({
  people,
  max = 4,
  size = 'sm',
  className,
}: {
  people: Array<{ id: string; displayName: string; photoURL?: string | null }>
  max?: number
  size?: 'xs' | 'sm' | 'default'
  className?: string
}) {
  const visible = people.slice(0, max)
  const rest = people.length - visible.length
  const overlap = visible.length > 1 || rest > 0
  const sizeClass = { xs: 'size-5 text-[0.55rem]', sm: 'size-7 text-[0.6rem]', default: 'size-8' }[size]
  return (
    <span className={cn('flex -space-x-1.5', className)}>
      {visible.map((person) => (
        <UserAvatar
          key={person.id}
          name={person.displayName}
          photoURL={person.photoURL}
          size={size}
          className={overlap ? 'ring-2 ring-background' : undefined}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'relative inline-flex items-center justify-center rounded-full border border-border bg-muted font-semibold text-muted-foreground ring-2 ring-background',
            sizeClass,
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}

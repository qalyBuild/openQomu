import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const QUICK_REACTIONS = ['👍', '🔥', '🎉', '💜', '🚀', '👀']
export const EMOJI_SET = [
  ...QUICK_REACTIONS,
  '😀', '😄', '😅', '😂', '🙂', '😉', '😍', '🤔', '😮', '😢', '😡',
  '✅', '❌', '⚠️', '💡', '✨', '⭐', '🎨', '📌', '📎', '📝', '📚',
  '🏆', '🎯', '☕', '🍕', '🌱', '🌊', '☀️', '🌙', '⚡', '💪', '👏',
  '🙌', '🤝', '🫶', '❤️', '🧡', '💚', '💙', '🖤', '🤍', '💯', '🪐',
]

export function EmojiPicker({
  onPick,
  trigger,
  align = 'start',
  columns = 8,
}: {
  onPick: (emoji: string) => void
  trigger: React.ReactNode
  align?: 'start' | 'center' | 'end'
  columns?: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-2">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="grid size-8 place-items-center rounded-md text-lg transition-colors hover:bg-accent"
              onClick={() => {
                onPick(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ReactionPicker({
  onPick,
  children,
  align = 'end',
}: {
  onPick: (emoji: string) => void
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-1.5">
        <div className="flex items-center gap-0.5">
          {QUICK_REACTIONS.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="icon"
              className="size-8 text-base"
              onClick={() => onPick(emoji)}
            >
              {emoji}
            </Button>
          ))}
          <EmojiPicker
            onPick={onPick}
            trigger={
              <Button variant="ghost" size="icon" className="size-8 text-xs text-muted-foreground">
                +
              </Button>
            }
            align="end"
            columns={6}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function EmojiIcon({ emoji, className }: { emoji: string; className?: string }) {
  return (
    <span className={cn('inline-grid place-items-center leading-none', className)}>{emoji}</span>
  )
}

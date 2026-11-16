import * as React from 'react'
import { cn } from 'cn'

function Divider({
  className,
  variant = 'middle',
  children,
  ...props
}: React.ComponentProps<'div'> & {
  variant?: 'middle' | 'start'
}) {
  return (
    <div
      data-slot="divider"
      data-variant={variant}
      className={cn(
        'flex w-full items-center gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80',
        className,
      )}
      {...props}
    >
      {variant === 'middle' && <span className="h-px flex-1 bg-border" />}
      {children ? <span className="shrink-0 whitespace-nowrap px-1">{children}</span> : null}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export { Divider }

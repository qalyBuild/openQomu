import { useId } from 'react'
import { cn } from '@/lib/utils'
import { PRODUCT_NAME } from '@/config/product'

/**
 * Monograma openQomu: un anillo fino con un punto de tinta y una cola corta.
 * Sin fondo ni brillos: la marca respira en cualquier superficie.
 */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = `openqomu-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn('size-8', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="24" y1="24" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <circle cx="21.5" cy="21.5" r="13.2" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M25.4 25.4 41.2 41.2"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({
  className,
  showWordmark = true,
  subtitle,
}: {
  className?: string
  showWordmark?: boolean
  subtitle?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className="size-8" />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[1.32rem] font-medium tracking-[-0.055em]">{PRODUCT_NAME}</span>
          {subtitle && (
            <span className="mt-1 text-[0.58rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

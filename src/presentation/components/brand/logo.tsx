import { cn } from '@/lib/utils'
import { PRODUCT_NAME } from '@/config/product'

/**
 * Isotipo openQomu: cuatro módulos que forman una sola pieza. El primero y el
 * último usan el color del texto para funcionar en claro y oscuro.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      className={cn('size-8', className)}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M 18 126 L 18 81 C 18 56 37 38 62 38 L 132 38 L 132 83 L 115 100 C 103 112 96 130 80 144 L 58 165 L 37 165 C 26 165 18 156 18 145 Z"
      />
      <path
        fill="#6038FA"
        d="M 112 12 L 166 12 C 195 12 216 33 216 61 L 216 128 L 176 128 L 149 106 C 137 96 129 89 113 89 L 112 89 Z"
      />
      <path
        fill="#A89CF2"
        d="M 238 128 L 238 181 C 238 208 219 229 192 229 L 125 229 L 125 188 C 125 171 132 158 146 146 C 161 132 175 128 191 128 Z"
      />
      <path
        fill="currentColor"
        className="opacity-[0.55]"
        d="M 33 150 L 55 150 L 79 171 C 92 184 103 191 120 191 L 125 191 L 125 247 L 89 247 C 57 247 33 225 33 194 Z"
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

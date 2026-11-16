import { Loader2 } from 'lucide-react'
import { BrandMark } from '@/presentation/components/brand/logo'
import { PRODUCT_NAME } from '@/config/product'

export function LoadingScreen({ label = `Cargando ${PRODUCT_NAME}…` }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background">
      <BrandMark className="size-14 animate-pulse" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  )
}

export function InlineLoader({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label ?? 'Cargando…'}
    </div>
  )
}

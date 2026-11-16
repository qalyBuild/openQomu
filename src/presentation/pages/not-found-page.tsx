import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/presentation/components/brand/logo'

export function NotFoundPage() {
  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-5 text-center">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-40" />
      <div className="relative">
        <Logo className="justify-center" />
        <p className="mt-10 text-7xl font-semibold tracking-[-0.06em] text-gradient">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Esta página se perdió</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Puede que el enlace haya cambiado o que no tengas acceso. Vuelve al inicio y sigue donde
          estabas.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link to="/app">
              <Compass className="size-4" /> Ir a openQomu
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" /> Inicio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[openqomu] error de interfaz', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="grid min-h-svh place-items-center bg-background p-6 text-center">
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-2xl border bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Algo se ha roto</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {this.state.message}. Recarga la página para continuar; tus datos están a salvo.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            <RotateCcw className="size-4" /> Recargar openQomu
          </Button>
        </div>
      </div>
    )
  }
}

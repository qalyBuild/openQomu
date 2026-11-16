import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/app'
import { createContainer } from './app/container'
import { ErrorBoundary } from './app/error-boundary'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró #root')
const root = createRoot(rootElement)

createContainer()
  .then((container) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App container={container} />
        </ErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    console.error('[openqomu] no se pudo iniciar', error)
    root.render(
      <div className="grid min-h-svh place-items-center bg-background p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl border bg-destructive/10 text-xl">
            ⚠️
          </div>
          <h1 className="mt-4 text-lg font-semibold">No se pudo iniciar openQomu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Revisa la configuración de Firebase y las variables de entorno.
          </p>
          <pre className="mt-4 overflow-auto rounded-lg border bg-muted/50 p-3 text-start text-xs text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <a
            href="/"
            className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reintentar
          </a>
        </div>
      </div>,
    )
  })

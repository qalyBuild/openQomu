import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useContainer } from '@/app/auth-provider'
import { Button } from '@/components/ui/button'
import { LoadingScreen } from '@/presentation/components/common/loading-screen'
import { publicAppUrl, publicLandingUrl } from '@/lib/app-url'

/**
 * Entrada de la app: redirige a la landing pública, entra en la demo o firma.
 * No renderiza marketing para que nunca aparezca una landing intermedia.
 */
export function EntryPage() {
  const { status, pending, error, signInWithGoogle } = useAuth()
  const container = useContainer()
  const navigate = useNavigate()
  const location = useLocation()
  const isDemo = container.mode === 'demo'
  const from = (location.state as { from?: string } | null)?.from
  const params = new URLSearchParams(location.search)
  const autoDemoRequested = params.get('demo') === '1'
  const enterRequested = params.get('entrar') === '1'
  const demoAuto = import.meta.env.VITE_DEMO_AUTO === 'true' && isDemo
  const [retry, setRetry] = useState(false)

  const returnTo = (() => {
    try {
      return sessionStorage.getItem('openqomu:return-to')
    } catch {
      return null
    }
  })()

  useEffect(() => {
    if (status !== 'authenticated') return
    const target = from ?? returnTo ?? '/app'
    try {
      sessionStorage.removeItem('openqomu:return-to')
      sessionStorage.removeItem('openqomu:signin-pending')
    } catch {
      /* sin almacenamiento */
    }
    navigate(target, { replace: true })
  }, [from, navigate, returnTo, status])

  const signInStarted = useRef(false)
  useEffect(() => {
    if (status !== 'anonymous' || pending) return
    if (!enterRequested && !autoDemoRequested && !demoAuto) return
    if (signInStarted.current) return
    // Si volvemos de Google, no repetir el login: Firebase hidrata la sesión.
    let attempt = 0
    try {
      attempt = Number(sessionStorage.getItem('openqomu:signin-pending') || 0)
    } catch {
      /* sin almacenamiento */
    }
    if (attempt && Date.now() - attempt < 10 * 60 * 1000) {
      setRetry(true)
      return
    }
    signInStarted.current = true
    try {
      sessionStorage.setItem('openqomu:signin-pending', String(Date.now()))
    } catch {
      /* sin almacenamiento */
    }
    void signInWithGoogle()
  }, [autoDemoRequested, demoAuto, enterRequested, pending, signInWithGoogle, status])

  const landingSent = useRef(false)
  useEffect(() => {
    if (enterRequested || autoDemoRequested || demoAuto) return
    if (status !== 'anonymous' || pending || landingSent.current) return
    landingSent.current = true
    const url = new URL(publicLandingUrl())
    url.searchParams.set('app', publicAppUrl())
    window.location.replace(url.href)
  }, [autoDemoRequested, demoAuto, enterRequested, pending, status])

  if (retry && status === 'anonymous') {
    return (
      <div className="grid min-h-svh place-items-center bg-background p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-lg font-semibold tracking-tight">Entrar en openQomu</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Completa el acceso con la cuenta de Google de esta instancia.
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setRetry(false)
              try {
                sessionStorage.setItem('openqomu:signin-pending', String(Date.now()))
              } catch {
                /* sin almacenamiento */
              }
              void signInWithGoogle()
            }}
          >
            Continuar con Google
          </Button>
        </div>
      </div>
    )
  }

  if (error && !pending) {
    return (
      <div className="grid min-h-svh place-items-center bg-background p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-lg font-semibold tracking-tight">No se pudo iniciar sesión</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <Button className="mt-5" onClick={() => void signInWithGoogle()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (demoAuto || autoDemoRequested) {
    return <LoadingScreen label="Preparando la demo…" />
  }

  return <div className="min-h-svh bg-background" aria-hidden="true" />
}

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useContainer } from '@/app/auth-provider'
import { Button } from '@/components/ui/button'
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
    signInStarted.current = true
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

  return <div className="min-h-svh bg-background" aria-hidden="true" />
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppContainer, SessionUser } from '@/domain/ports'
import type { User } from '@/domain/entities/identity'

const ContainerContext = createContext<AppContainer | null>(null)

export function ContainerProvider({
  container,
  children,
}: {
  container: AppContainer
  children: ReactNode
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
}

export function useContainer(): AppContainer {
  const container = useContext(ContainerContext)
  if (!container) throw new Error('useContainer debe usarse dentro de <ContainerProvider>.')
  return container
}

interface AuthContextValue {
  status: 'loading' | 'anonymous' | 'authenticated'
  session: SessionUser | null
  profile: User | null
  pending: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  if (code.includes('popup-closed-by-user')) return 'Has cerrado la ventana de Google antes de terminar.'
  if (code.includes('popup-blocked')) {
    return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.'
  }
  if (code.includes('unauthorized-domain')) {
    return 'Este dominio no está autorizado en Firebase Authentication.'
  }
  if (code.includes('operation-not-allowed')) {
    return 'El inicio de sesión con Google no está activado en Firebase.'
  }
  if (error instanceof Error) return error.message
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const container = useContainer()
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const [session, setSession] = useState<SessionUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hydrateProfile = useCallback(
    async (nextSession: SessionUser) => {
      try {
        const nextProfile = await container.users.ensureProfile(nextSession)
        setProfile(nextProfile)
      } catch (cause) {
        console.error('[openqomu] profile', cause)
        setProfile({
          id: nextSession.id,
          displayName: nextSession.displayName,
          email: nextSession.email,
          photoURL: nextSession.photoURL,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        })
      }
      setStatus('authenticated')
    },
    [container],
  )

  useEffect(() => {
    let cancelled = false
    const unsubscribe = container.auth.onAuthStateChanged((next) => {
      if (cancelled) return
      setPending(false)
      setSession(next)
      if (!next) {
        setProfile(null)
        setStatus('anonymous')
        return
      }
      setStatus('loading')
      void hydrateProfile(next)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [container, hydrateProfile])

  // Presencia: actualiza el perfil y los miembros periódicamente.
  useEffect(() => {
    if (status !== 'authenticated' || !session) return
    const ping = () => {
      void container.users.touch(session.id).catch(() => {})
    }
    ping()
    const interval = window.setInterval(ping, 4 * 60 * 1000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [container, session, status])

  const signInWithGoogle = useCallback(async () => {
    setPending(true)
    setError(null)
    try {
      await container.auth.signInWithGoogle()
      setPending(false)
    } catch (cause) {
      setError(authErrorMessage(cause))
      setPending(false)
    }
  }, [container])

  const signOut = useCallback(async () => {
    setPending(true)
    try {
      if (session && container.pushGateway.isSupported()) {
        await container.devices
          .remove(session.id, container.pushGateway.deviceId())
          .catch(() => {})
      }
      await container.auth.signOut()
      setProfile(null)
      setSession(null)
      setStatus('anonymous')
    } finally {
      setPending(false)
    }
  }, [container, session])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    await hydrateProfile(session)
  }, [hydrateProfile, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      pending,
      error,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [error, pending, profile, refreshProfile, session, signInWithGoogle, signOut, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return context
}

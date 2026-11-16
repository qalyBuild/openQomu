import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Workspace } from '@/domain/entities/identity'
import { useAuth } from './auth-provider'
import { useContainer } from './auth-provider'

interface WorkspacesContextValue {
  workspaces: Workspace[]
  loading: boolean
  error: string | null
  activeWorkspaceId: string | null
  rememberWorkspace: (workspaceId: string) => void
  registerWorkspace: (workspace: Workspace) => void
  refresh: () => void
}

const WorkspacesContext = createContext<WorkspacesContextValue | null>(null)

function storageKey(uid: string): string {
  return `openqomu.activeWorkspace.${uid}`
}

export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const container = useContainer()
  const { status, session } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      setWorkspaces([])
      setLoading(status === 'loading')
      setError(null)
      setActiveWorkspaceId(null)
      return
    }
    setLoading(true)
    setError(null)
    const unsubscribe = container.workspaces.subscribeForUser(
      session.id,
      (next) => {
        setWorkspaces(next)
        setLoading(false)
      },
      (cause) => {
        setError(
          cause.message ||
            'No se pudieron cargar tus espacios. Revisa tu conexión e inténtalo de nuevo.',
        )
        setLoading(false)
      },
    )
    return unsubscribe
  }, [container, session, status, version])

  useEffect(() => {
    if (!session) return
    try {
      setActiveWorkspaceId(localStorage.getItem(storageKey(session.id)))
    } catch {
      setActiveWorkspaceId(null)
    }
  }, [session])

  const rememberWorkspace = useCallback(
    (workspaceId: string) => {
      setActiveWorkspaceId(workspaceId)
      if (!session) return
      try {
        localStorage.setItem(storageKey(session.id), workspaceId)
      } catch {
        // almacenamiento bloqueado
      }
    },
    [session],
  )

  const registerWorkspace = useCallback((workspace: Workspace) => {
    setWorkspaces((current) => {
      const exists = current.some((item) => item.id === workspace.id)
      const next = exists
        ? current.map((item) => (item.id === workspace.id ? workspace : item))
        : [...current, workspace]
      return next.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    })
    setLoading(false)
    setError(null)
  }, [])

  const refresh = useCallback(() => setVersion((value) => value + 1), [])

  const value = useMemo<WorkspacesContextValue>(
    () => ({
      workspaces,
      loading,
      error,
      activeWorkspaceId,
      rememberWorkspace,
      registerWorkspace,
      refresh,
    }),
    [
      activeWorkspaceId,
      error,
      loading,
      registerWorkspace,
      rememberWorkspace,
      refresh,
      workspaces,
    ],
  )

  return <WorkspacesContext.Provider value={value}>{children}</WorkspacesContext.Provider>
}

export function useWorkspaces(): WorkspacesContextValue {
  const context = useContext(WorkspacesContext)
  if (!context) throw new Error('useWorkspaces debe usarse dentro de <WorkspacesProvider>.')
  return context
}

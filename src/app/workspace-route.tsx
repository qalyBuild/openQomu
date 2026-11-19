import { useEffect } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useWorkspaces } from './workspaces-provider'
import { WorkspaceDataProvider } from './workspace-data-provider'
import { NotificationsProvider } from '@/presentation/features/notifications/notifications-provider'
import { AppShell } from '@/presentation/components/layout/app-shell'
import { LoadingScreen } from '@/presentation/components/common/loading-screen'

export function WorkspaceRoute() {
  const { workspaceId } = useParams()
  const { workspaces, loading, rememberWorkspace } = useWorkspaces()
  const workspace = workspaces.find((item) => item.id === workspaceId)

  const currentWorkspaceId = workspace?.id
  useEffect(() => {
    if (currentWorkspaceId) rememberWorkspace(currentWorkspaceId)
  }, [currentWorkspaceId, rememberWorkspace])

  const workspaceName = workspace?.name
  useEffect(() => {
    if (!workspaceName) return
    document.title = `openQomu · ${workspaceName}`
    return () => {
      document.title = 'openQomu — Tu equipo, en sintonía'
    }
  }, [workspaceName])

  if (loading) return <LoadingScreen label="Abriendo el espacio…" />
  if (!workspace) return <Navigate to="/app" replace />

  return (
    <WorkspaceDataProvider key={workspace.id} workspace={workspace}>
      <NotificationsProvider>
        <AppShell workspace={workspace}>
          <Outlet />
        </AppShell>
      </NotificationsProvider>
    </WorkspaceDataProvider>
  )
}

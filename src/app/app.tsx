import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { RotateCcw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AppContainer } from '@/domain/ports'
import { ContainerProvider, AuthProvider, useAuth } from './auth-provider'
import { ThemeProvider, useTheme } from './theme-provider'
import { WorkspacesProvider, useWorkspaces } from './workspaces-provider'
import { MobileRuntime } from './mobile-runtime'
import { ErrorBoundary } from './error-boundary'
import { LoadingScreen } from '@/presentation/components/common/loading-screen'
import { LandingPage } from '@/presentation/pages/landing-page'
import { NotFoundPage } from '@/presentation/pages/not-found-page'

const WorkspaceRoute = lazy(() =>
  import('./workspace-route').then((module) => ({ default: module.WorkspaceRoute })),
)
const OnboardingPage = lazy(() =>
  import('@/presentation/pages/onboarding-page').then((module) => ({
    default: module.OnboardingPage,
  })),
)
const JoinPage = lazy(() =>
  import('@/presentation/pages/join-page').then((module) => ({ default: module.JoinPage })),
)
const DashboardPage = lazy(() =>
  import('@/presentation/pages/dashboard-page').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ChatPage = lazy(() =>
  import('@/presentation/pages/chat-page').then((module) => ({ default: module.ChatPage })),
)
const BoardsPage = lazy(() =>
  import('@/presentation/pages/boards-page').then((module) => ({
    default: module.BoardsPage,
  })),
)
const BoardPage = lazy(() =>
  import('@/presentation/pages/board-page').then((module) => ({ default: module.BoardPage })),
)
const PagesPage = lazy(() =>
  import('@/presentation/pages/pages-page').then((module) => ({ default: module.PagesPage })),
)
const PageEditorPage = lazy(() =>
  import('@/presentation/pages/page-editor-page').then((module) => ({
    default: module.PageEditorPage,
  })),
)
const FilesPage = lazy(() =>
  import('@/presentation/pages/files-page').then((module) => ({ default: module.FilesPage })),
)
const MembersPage = lazy(() =>
  import('@/presentation/pages/members-page').then((module) => ({
    default: module.MembersPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/presentation/pages/settings-page').then((module) => ({
    default: module.SettingsPage,
  })),
)

function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <LoadingScreen />
  if (status === 'anonymous') {
    return <Navigate to="/" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <Outlet />
}

function AppGate() {
  const { workspaces, loading, error, activeWorkspaceId, refresh } = useWorkspaces()
  const { signOut } = useAuth()
  if (error) {
    return (
      <div className="grid min-h-svh place-items-center bg-background p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-destructive/25 bg-destructive/10 text-xl">
            ⚠️
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            No se pudieron cargar tus espacios
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={refresh}>
              <RotateCcw className="size-4" /> Reintentar
            </Button>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut className="size-4" /> Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    )
  }
  if (loading) return <LoadingScreen label="Cargando tus espacios…" />
  if (workspaces.length === 0) return <Navigate to="/onboarding" replace />
  const target =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0]
  return <Navigate to={`/w/${target.id}/dashboard`} replace />
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{ className: 'font-sans' }}
    />
  )
}

export function App({ container }: { container: AppContainer }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ContainerProvider container={container}>
          <AuthProvider>
            <WorkspacesProvider>
              <TooltipProvider delayDuration={200}>
                <BrowserRouter>
                  <MobileRuntime />
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/join/:code" element={<JoinPage />} />
                      <Route element={<RequireAuth />}>
                        <Route path="/app" element={<AppGate />} />
                        <Route path="/onboarding" element={<OnboardingPage />} />
                        <Route path="/w/:workspaceId" element={<WorkspaceRoute />}>
                          <Route index element={<Navigate to="dashboard" replace />} />
                          <Route path="dashboard" element={<DashboardPage />} />
                          <Route path="c/:channelId" element={<ChatPage />} />
                          <Route path="boards" element={<BoardsPage />} />
                          <Route path="boards/:boardId" element={<BoardPage />} />
                          <Route path="pages" element={<PagesPage />} />
                          <Route path="pages/:pageId" element={<PageEditorPage />} />
                          <Route path="files" element={<FilesPage />} />
                          <Route path="members" element={<MembersPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                          <Route path="*" element={<Navigate to="dashboard" replace />} />
                        </Route>
                      </Route>
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
                <ThemedToaster />
              </TooltipProvider>
            </WorkspacesProvider>
          </AuthProvider>
        </ContainerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

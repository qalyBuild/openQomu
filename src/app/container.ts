import type { AppContainer } from '@/domain/ports'
import { shouldUseDemoMode } from '@/infrastructure/firebase/config'

/**
 * Composición perezosa: el bundle demo no descarga Firebase y viceversa.
 */
export async function createContainer(): Promise<AppContainer> {
  if (shouldUseDemoMode()) {
    const { createDemoContainer } = await import('@/infrastructure/demo')
    return createDemoContainer()
  }
  const { createFirebaseContainer } = await import('@/infrastructure/firebase')
  return createFirebaseContainer()
}

export function appModeLabel(container: AppContainer): string {
  return container.mode === 'demo' ? 'Modo demo' : 'Firebase'
}

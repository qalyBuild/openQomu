import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/theme-provider'
import { deleteThemePackage } from '@/app/theme/package-store'
import { serializeThemePackage, singleThemePackage } from '@/app/theme/theme-package'
import { downloadBlobFile } from '@/lib/zip'
import { ThemesPage } from './themes-page'

vi.mock('@/app/auth-provider', () => ({
  useAuth: () => ({ session: null }),
  useContainer: () => ({}),
}))
vi.mock('@/app/workspace-data-provider', () => ({
  useWorkspaceData: () => ({ uid: 'demo' }),
}))
vi.mock('@/lib/zip', () => ({ downloadBlobFile: vi.fn() }))

const item = singleThemePackage({
  id: 'playa-prueba', name: 'Playa de prueba', scheme: 'light', version: 1,
  author: 'Ana', license: 'CC0-1.0', tokens: { background: '#fff', foreground: '#111' },
})

function packageFile() {
  const bytes = new Uint8Array(serializeThemePackage(item.files))
  const file = new File([bytes], 'playa-prueba.qomutheme')
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer })
  return file
}

function renderThemes() {
  return render(<ThemeProvider><ThemesPage /></ThemeProvider>)
}

beforeEach(async () => {
  localStorage.clear()
  vi.clearAllMocks()
  await deleteThemePackage(item.manifest.id)
})
afterEach(cleanup)

describe('galería de paquetes', () => {
  it('previsualiza y prepara un aporte para el fork de GitHub', async () => {
    renderThemes()
    fireEvent.click(screen.getByRole('button', { name: 'Contribuir con un tema' }))
    const chooser = screen.getByRole('dialog').querySelector('input[type=file]')!
    fireEvent.change(chooser, { target: { files: [packageFile()] } })

    const handoff = await screen.findByRole('link', { name: 'Descargar y abrir GitHub' })
    expect(handoff.getAttribute('href')).toBe('https://github.com/qalyBuild/openQomu/fork')
    expect(within(screen.getByRole('dialog')).getByText('Playa de prueba')).toBeTruthy()
    handoff.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(handoff)
    expect(downloadBlobFile).toHaveBeenCalledWith(expect.any(Blob), 'playa-prueba-contribucion.zip')
    expect(document.documentElement.dataset.theme).toBe('qomu-dark')
  })

  it('instala el paquete, aplica su variante y la recupera al recargar', async () => {
    const first = renderThemes()
    const chooser = first.container.querySelector('input[type=file]')!
    fireEvent.change(chooser, { target: { files: [packageFile()] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar y aplicar' }))
    await screen.findByRole('heading', { name: 'Playa de prueba' })
    expect(document.documentElement.dataset.theme).toBe('playa-prueba')
    expect(localStorage.getItem('openqomu.theme.id')).toBe('playa-prueba')

    first.unmount()
    renderThemes()
    await screen.findByRole('heading', { name: 'Playa de prueba' })
    expect(document.documentElement.dataset.theme).toBe('playa-prueba')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar paquete' }))
    await screen.findByText('Tema activo ·', { exact: false })
    await screen.findByText('openQomu Oscuro', { selector: 'strong' })
    expect(document.documentElement.dataset.theme).toBe('qomu-dark')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
  findTheme,
  installTheme,
  isBuiltinTheme,
  listThemes,
  loadInstalledThemes,
  parseCatalog,
  removeTheme,
  THEMES_STORAGE_KEY,
} from './registry'
import type { ThemeInput } from './tokens'

const community: ThemeInput = {
  id: 'dracula',
  name: 'Dracula',
  scheme: 'dark',
  version: 1,
  author: 'Comunidad',
  license: 'CC0-1.0',
  tokens: { background: '#282a36', foreground: '#f8f8f2' },
}

beforeEach(() => {
  localStorage.clear()
})

describe('registro de temas', () => {
  it('incluye los seis temas iniciales y el default', () => {
    expect(BUILTIN_THEMES.map((theme) => theme.id)).toEqual([
      'qomu-light',
      'qomu-dark',
      'liquid-glass-light',
      'liquid-glass-dark',
      'monokai',
      'solarized-dark',
    ])
    expect(findTheme(DEFAULT_THEME_ID)?.name).toBe('openQomu Oscuro')
    for (const id of ['liquid-glass-light', 'liquid-glass-dark']) {
      expect(findTheme(id)?.options.glass).toMatchObject({
        material: 'clear', renderer: 'auto', svg: true, lensing: 1.15, opacity: 0.44,
      })
    }
  })

  it('instala, lista y elimina temas validados', () => {
    expect(installTheme(community).id).toBe('dracula')
    expect(loadInstalledThemes().map((theme) => theme.id)).toEqual(['dracula'])
    expect(listThemes().map((theme) => theme.id)).toContain('dracula')
    expect(removeTheme('dracula')).toBe(true)
    expect(listThemes().map((theme) => theme.id)).not.toContain('dracula')
  })

  it('no permite sobrescribir un tema incluido ni eliminar built-ins', () => {
    expect(() => installTheme({ ...community, id: 'monokai' })).toThrow()
    expect(removeTheme('monokai')).toBe(false)
    expect(isBuiltinTheme('monokai')).toBe(true)
  })

  it('rechaza temas inválidos al instalar', () => {
    expect(() => installTheme({ ...community, tokens: { background: 'url(x)' } })).toThrow()
    expect(loadInstalledThemes()).toEqual([])
  })

  it('ignora almacenamiento corrupto o entradas inválidas', () => {
    localStorage.setItem(THEMES_STORAGE_KEY, '{')
    expect(loadInstalledThemes()).toEqual([])
    localStorage.setItem(
      THEMES_STORAGE_KEY,
      JSON.stringify([community, { id: 'malo', tokens: { background: 'red;}' } }]),
    )
    expect(loadInstalledThemes().map((theme) => theme.id)).toEqual(['dracula'])
  })

  it('parsea un catálogo y descarta entradas inválidas', () => {
    expect(parseCatalog([community, { id: 'roto' }]).map((theme) => theme.id)).toEqual(['dracula'])
    expect(parseCatalog({})).toEqual([])
    expect(parseCatalog('x')).toEqual([])
  })
})

describe('catálogo remoto', () => {
  it('usa el fetch inyectado y propaga errores de red', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([community]), { status: 200 }),
    )
    const { fetchCatalog } = await import('./registry')
    await expect(fetchCatalog(fetcher as unknown as typeof fetch)).resolves.toEqual([community])
    const failing = vi.fn().mockRejectedValue(new Error('sin red'))
    await expect(fetchCatalog(failing as unknown as typeof fetch)).resolves.toEqual([])
  })
})

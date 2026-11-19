import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, clearTheme, readThemeCache, THEME_CACHE_KEY, writeThemeCache } from './apply'
import { resolveTheme } from './tokens'

const darkTheme = resolveTheme({
  id: 'monokai',
  name: 'Monokai',
  scheme: 'dark',
  version: 1,
  author: 'Qomu',
  license: 'CC0-1.0',
  tokens: { background: 'oklch(0.22 0.01 106)', primary: '#e6db74' },
  options: { effects: ['glass'], font: 'geist-mono' },
})

const lightTheme = resolveTheme({
  id: 'qomu-light',
  name: 'Qomu Claro',
  scheme: 'light',
  version: 1,
  author: 'Qomu',
  license: 'CC0-1.0',
  tokens: {},
})

beforeEach(() => {
  clearTheme()
  localStorage.clear()
  document.querySelector('meta[name="theme-color"]')?.remove()
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="">')
})

describe('applyTheme', () => {
  it('escribe tokens, esquema, fuente y efectos', () => {
    applyTheme(darkTheme)
    const root = document.documentElement
    expect(root.style.getPropertyValue('--background')).toBe('oklch(0.22 0.01 106)')
    expect(root.style.getPropertyValue('--primary')).toBe('#e6db74')
    expect(root.dataset.theme).toBe('monokai')
    expect(root.dataset.font).toBe('geist-mono')
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.style.colorScheme).toBe('dark')
    expect(document.body.classList.contains('theme-glass')).toBe(true)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      'oklch(0.22 0.01 106)',
    )
  })

  it('al cambiar a un tema claro retira .dark y los efectos anteriores', () => {
    applyTheme(darkTheme)
    applyTheme(lightTheme)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.classList.contains('theme-glass')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('qomu-light')
  })

  it('guarda una caché mínima para el boot y la puede leer', () => {
    applyTheme(darkTheme)
    const cache = readThemeCache()
    expect(cache).toEqual({
      id: 'monokai',
      scheme: 'dark',
      background: 'oklch(0.22 0.01 106)',
      foreground: darkTheme.tokens.foreground,
      radius: darkTheme.tokens.radius,
    })
    localStorage.setItem(THEME_CACHE_KEY, '{')
    expect(readThemeCache()).toBeNull()
  })

  it('clearTheme retira todo lo aplicado', () => {
    applyTheme(darkTheme)
    clearTheme()
    const root = document.documentElement
    expect(root.style.getPropertyValue('--background')).toBe('')
    expect(root.dataset.theme).toBeUndefined()
    expect(root.classList.contains('dark')).toBe(false)
    expect(document.body.className).toBe('')
  })

  it('writeThemeCache tolera almacenamiento no disponible', () => {
    expect(() => writeThemeCache(null)).not.toThrow()
  })
})

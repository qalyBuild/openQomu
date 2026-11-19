import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../theme-provider'
import { clearTheme } from './apply'
import { DEFAULT_THEME_ID } from './registry'
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

function Probe() {
  const { theme, themes, scheme, setTheme, install, remove } = useTheme()
  return (
    <div>
      <span data-testid="id">{theme.id}</span>
      <span data-testid="scheme">{scheme}</span>
      <span data-testid="count">{themes.length}</span>
      <button onClick={() => setTheme('liquid-glass-light')}>claro</button>
      <button onClick={() => setTheme('no-existe')}>roto</button>
      <button onClick={() => install(community)}>instalar</button>
      <button onClick={() => remove('dracula')}>eliminar</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  clearTheme()
})

afterEach(() => {
  cleanup()
})

describe('ThemeProvider', () => {
  it('usa Qomu Oscuro por defecto', () => {
    renderProvider()
    expect(screen.getByTestId('id').textContent).toBe(DEFAULT_THEME_ID)
    expect(screen.getByTestId('scheme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('migra la preferencia antigua y descarta la clave vieja', () => {
    localStorage.setItem('openqomu.theme', 'light')
    renderProvider()
    expect(screen.getByTestId('id').textContent).toBe('qomu-light')
    expect(localStorage.getItem('openqomu.theme')).toBeNull()
    expect(localStorage.getItem('openqomu.theme.id')).toBe('qomu-light')
  })

  it('cae en el tema por defecto si el id guardado no existe', () => {
    localStorage.setItem('openqomu.theme.id', 'no-existe')
    renderProvider()
    expect(screen.getByTestId('id').textContent).toBe(DEFAULT_THEME_ID)
  })

  it('cambia de tema y lo guarda en el dispositivo', () => {
    renderProvider()
    act(() => screen.getByText('claro').click())
    expect(screen.getByTestId('id').textContent).toBe('liquid-glass-light')
    expect(screen.getByTestId('scheme').textContent).toBe('light')
    expect(localStorage.getItem('openqomu.theme.id')).toBe('liquid-glass-light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('ignora un id desconocido al aplicar', () => {
    renderProvider()
    act(() => screen.getByText('roto').click())
    expect(screen.getByTestId('id').textContent).toBe(DEFAULT_THEME_ID)
  })

  it('instala y elimina temas de comunidad desde el contexto', () => {
    renderProvider()
    expect(screen.getByTestId('count').textContent).toBe('6')
    act(() => screen.getByText('instalar').click())
    expect(screen.getByTestId('count').textContent).toBe('7')
    act(() => screen.getByText('eliminar').click())
    expect(screen.getByTestId('count').textContent).toBe('6')
  })
})

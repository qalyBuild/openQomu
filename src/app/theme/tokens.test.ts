/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASE_TOKENS, resolveTheme, THEME_TOKENS, type ThemeInput } from './tokens'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function cssBlock(selector: string) {
  const match = css.match(new RegExp(`\\n${selector} \\{([\\s\\S]*?)\\n\\}`))
  if (!match) throw new Error(`No se encontró el bloque ${selector} en index.css`)
  return match[1]
}

function cssTokens(selector: string) {
  return Object.fromEntries(
    [...cssBlock(selector).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  )
}

describe('tokens de tema', () => {
  it('la lista blanca cubre exactamente las variables de :root', () => {
    expect(Object.keys(cssTokens(':root')).sort()).toEqual([...THEME_TOKENS].sort())
  })

  it('los tokens base coinciden con index.css', () => {
    expect(BASE_TOKENS.light).toEqual(cssTokens(':root'))
    expect(BASE_TOKENS.dark).toEqual(cssTokens('.dark'))
  })

  it('resuelve un tema parcial sobre los valores base', () => {
    const input: ThemeInput = {
      id: 'prueba',
      name: 'Prueba',
      scheme: 'dark',
      version: 1,
      author: 'Qomu',
      license: 'CC0-1.0',
      tokens: { background: 'oklch(0.2 0 0)', primary: 'oklch(0.7 0.1 200)' },
    }
    const theme = resolveTheme(input)
    expect(theme.tokens.background).toBe('oklch(0.2 0 0)')
    expect(theme.tokens.primary).toBe('oklch(0.7 0.1 200)')
    expect(theme.tokens.foreground).toBe(BASE_TOKENS.dark.foreground)
    expect(theme.options).toEqual({ font: 'geist', effects: [] })
  })
})

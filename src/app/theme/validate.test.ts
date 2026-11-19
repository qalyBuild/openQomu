import { describe, expect, it } from 'vitest'
import { parseThemeFile, serializeTheme, validateThemeInput } from './validate'
import type { ThemeInput } from './tokens'

function validTheme(overrides: Partial<ThemeInput> = {}): Record<string, unknown> {
  return {
    id: 'monokai',
    name: 'Monokai',
    scheme: 'dark',
    version: 1,
    author: 'Qomu',
    license: 'CC0-1.0',
    tokens: {
      background: 'oklch(0.22 0.01 106)',
      foreground: '#f8f8f2',
    },
    ...overrides,
  }
}

describe('validateThemeInput', () => {
  it('acepta un tema válido con formato de color permitido', () => {
    const result = validateThemeInput(validTheme(), { requireCore: true })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.id).toBe('monokai')
  })

  it('rechaza claves desconocidas en el tema y en los tokens', () => {
    expect(validateThemeInput({ ...validTheme(), extra: true }).ok).toBe(false)
    expect(
      validateThemeInput(
        validTheme({
          tokens: { background: '#fff', foreground: '#000', hacker: '#fff' } as ThemeInput['tokens'],
        }),
      ).ok,
    ).toBe(false)
  })

  it('rechaza valores que intentan inyectar CSS', () => {
    for (const value of [
      'url(https://ejemplo.com/x.png)',
      'red; } body { display: none',
      '@import "x.css"',
      'expression(alert(1))',
      'oklch(0.5 0.1 200) !important',
    ]) {
      expect(
        validateThemeInput(validTheme({ tokens: { background: value, foreground: '#000' } })).ok,
      ).toBe(false)
    }
  })

  it('acepta hex, rgb, hsl, oklch y radios en rem o px', () => {
    for (const value of ['#fff', '#ffffff80', 'rgb(10 10 10 / 50%)', 'hsl(200 50% 40%)', 'oklch(0.7 0.1 200)']) {
      expect(
        validateThemeInput(validTheme({ tokens: { background: value, foreground: '#000' } })).ok,
      ).toBe(true)
    }
    expect(validateThemeInput(validTheme({ tokens: { background: '#fff', foreground: '#000', radius: '0.5rem' } })).ok).toBe(true)
    expect(validateThemeInput(validTheme({ tokens: { background: '#fff', foreground: '#000', radius: '8px' } })).ok).toBe(true)
    expect(validateThemeInput(validTheme({ tokens: { background: '#fff', foreground: '#000', radius: 'bold' } })).ok).toBe(false)
  })

  it('exige background y foreground en temas importados', () => {
    const result = validateThemeInput(validTheme({ tokens: { primary: '#fff' } }), {
      requireCore: true,
    })
    expect(result.ok).toBe(false)
    expect(validateThemeInput(validTheme({ tokens: { primary: '#fff' } })).ok).toBe(true)
  })

  it('valida metadatos y opciones', () => {
    expect(validateThemeInput(validTheme({ id: 'Mal Id' })).ok).toBe(false)
    expect(validateThemeInput(validTheme({ scheme: 'sepia' as ThemeInput['scheme'] })).ok).toBe(false)
    expect(validateThemeInput(validTheme({ version: 0 })).ok).toBe(false)
    expect(validateThemeInput(validTheme({ name: '' })).ok).toBe(false)
    expect(validateThemeInput(validTheme({ license: '' })).ok).toBe(false)
    expect(validateThemeInput(validTheme({ options: { font: 'comic' as 'geist' } })).ok).toBe(false)
    expect(
      validateThemeInput(validTheme({ options: { effects: ['blur' as 'glass'] } })).ok,
    ).toBe(false)
    expect(
      validateThemeInput(validTheme({ options: { effects: ['glass', 'glass'] } })).ok,
    ).toBe(false)
  })

  it('rechaza archivos grandes o JSON inválido', () => {
    expect(parseThemeFile('{').ok).toBe(false)
    expect(parseThemeFile('[]').ok).toBe(false)
    expect(parseThemeFile('x'.repeat(33 * 1024)).ok).toBe(false)
  })

  it('serializa y vuelve a leer un tema', () => {
    const result = validateThemeInput(validTheme(), { requireCore: true })
    if (!result.ok) throw new Error('tema inválido')
    const parsed = parseThemeFile(serializeTheme(result.value))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value).toEqual(result.value)
  })
})

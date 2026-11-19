import { describe, expect, it } from 'vitest'
import { glassCssVars, resolveGlass } from './glass'

describe('resolveGlass', () => {
  it('usa valores por material y esquema', () => {
    const dark = resolveGlass(undefined, 'dark')
    const light = resolveGlass(undefined, 'light')
    expect(dark.material).toBe('regular')
    expect(dark.blur).toBe(22)
    expect(dark.opacity).toBe(0.42)
    expect(dark.brightness).toBe(0.76)
    expect(light.brightness).toBe(1.04)
    expect(resolveGlass({ material: 'clear' }, 'dark').blur).toBe(12)
    expect(resolveGlass({ material: 'frosted' }, 'dark').blur).toBe(34)
  })

  it('respeta overrides y completa el resto', () => {
    const glass = resolveGlass(
      {
        material: 'frosted',
        tint: '#101418',
        blur: 30,
        opacity: 0.6,
        lightAngle: 210,
        grid: 0.5,
      },
      'dark',
    )
    expect(glass.blur).toBe(30)
    expect(glass.opacity).toBe(0.6)
    expect(glass.tint).toBe('#101418')
    expect(glass.lightAngle).toBe(210)
    expect(glass.grid).toBe(0.5)
    expect(glass.saturation).toBe(1.35)
  })

  it('genera variables CSS completas', () => {
    const vars = glassCssVars(resolveGlass(undefined, 'dark'))
    expect(vars['--glass-blur']).toBe('22px')
    expect(vars['--glass-light-angle']).toBe('340deg')
    expect(vars['--glass-light-spread']).toBe('110deg')
    expect(vars['--glass-grid']).toBe('0.22')
    expect(vars['--glass-caustics']).toBe('0.15')
    expect(vars['--glass-surface-alpha']).toBe('0.42')
  })
})

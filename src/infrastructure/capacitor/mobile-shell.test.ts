import { describe, expect, it } from 'vitest'
import { pathFromDeepLink } from './mobile-shell'

const HOSTS = new Set(['openqomu.example.com'])

describe('pathFromDeepLink', () => {
  it('extrae rutas de App Links', () => {
    expect(
      pathFromDeepLink('https://openqomu.example.com/w/demo-space/c/ch-general', HOSTS),
    ).toBe('/w/demo-space/c/ch-general')
    expect(
      pathFromDeepLink('https://openqomu.example.com/w/demo-space/boards/b1?task=t1', HOSTS),
    ).toBe('/w/demo-space/boards/b1?task=t1')
  })

  it('extrae rutas del esquema propio', () => {
    expect(pathFromDeepLink('openqomu://w/demo-space/c/ch-general')).toBe('/w/demo-space/c/ch-general')
    expect(pathFromDeepLink('openqomu://w/demo-space/boards/b1?task=t1')).toBe(
      '/w/demo-space/boards/b1?task=t1',
    )
  })

  it('acepta enlaces de invitación', () => {
    expect(pathFromDeepLink('https://openqomu.example.com/join/P7EAH36VGX', HOSTS)).toBe(
      '/join/P7EAH36VGX',
    )
    expect(pathFromDeepLink('openqomu://join/P7EAH36VGX')).toBe('/join/P7EAH36VGX')
  })

  it('ignora enlaces de hosts no configurados y rutas desconocidas', () => {
    expect(pathFromDeepLink('https://example.com/w/x', HOSTS)).toBeNull()
    expect(pathFromDeepLink('openqomu://settings')).toBeNull()
    expect(pathFromDeepLink('no-es-una-url')).toBeNull()
  })
})

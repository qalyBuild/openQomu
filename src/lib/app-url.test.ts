import { describe, expect, it } from 'vitest'
import { publicAppUrl, publicLandingUrl } from './app-url'

describe('app-url', () => {
  it('compone la URL de la app sin barra final', () => {
    expect(publicAppUrl()).not.toMatch(/\/$/)
  })

  it('no impone landing externa por defecto', () => {
    expect(publicLandingUrl()).toBe('')
  })
})

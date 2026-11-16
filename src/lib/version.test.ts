import { describe, expect, it } from 'vitest'
import { isVersionNewer, parseVersion } from './version'

describe('version', () => {
  it('compara versiones semánticas', () => {
    expect(isVersionNewer('1.0.1', '1.0.0')).toBe(true)
    expect(isVersionNewer('1.1.0', '1.0.9')).toBe(true)
    expect(isVersionNewer('2.0', '1.9.9')).toBe(true)
    expect(isVersionNewer('1.0.0', '1.0.1')).toBe(false)
    expect(isVersionNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isVersionNewer('v1.0.2', '1.0.1')).toBe(true)
  })

  it('tolera sufijos y valores incompletos', () => {
    expect(parseVersion('1.2.3-beta.1')).toEqual([1, 2, 3])
    expect(parseVersion('2')).toEqual([2])
    expect(isVersionNewer('1.2', '1.1.9')).toBe(true)
  })
})

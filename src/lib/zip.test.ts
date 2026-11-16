import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync } from 'fflate'
import { createZipBlob } from './zip'

describe('zip', () => {
  it('empaqueta archivos y carpetas anidadas', async () => {
    const blob = await createZipBlob([
      { path: 'nota.txt', data: strToU8('hola') },
      { path: 'Diseños/logo.txt', data: strToU8('logo') },
    ])

    expect(blob.type).toBe('application/zip')
    const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(archive).sort()).toEqual(['Diseños/logo.txt', 'nota.txt'])
    expect(strFromU8(archive['nota.txt'])).toBe('hola')
    expect(strFromU8(archive['Diseños/logo.txt'])).toBe('logo')
  })

  it('produce un zip válido aunque esté vacío', async () => {
    const blob = await createZipBlob([])
    const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(archive)).toEqual([])
  })
})

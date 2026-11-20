import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { deleteThemePackage, loadThemePackages, storeThemePackage } from './package-store'
import { singleThemePackage, validateThemePackageFiles } from './theme-package'

describe('almacenamiento local de paquetes', () => {
  const input = {
    id: 'test-store', name: 'Guardado', scheme: 'light' as const, version: 1, author: 'Ana',
    license: 'CC0-1.0', tokens: { background: '#fff', foreground: '#000' },
  }
  const theme = singleThemePackage(input)

  it('guarda, protege las variantes y elimina el paquete de IndexedDB', async () => {
    await storeThemePackage(theme)
    expect((await loadThemePackages())[0].themes).toEqual(theme.themes)
    const otherPackage = validateThemePackageFiles({
      ...theme.files,
      'manifest.json': new TextEncoder().encode(JSON.stringify({ ...theme.manifest, id: 'duplicate' })),
    })
    await expect(storeThemePackage(otherPackage)).rejects.toThrow('otro paquete')
    await storeThemePackage(singleThemePackage({ ...input, version: 2 }))
    await expect(storeThemePackage(theme)).rejects.toThrow('más reciente')
    await deleteThemePackage(theme.manifest.id)
    expect(await loadThemePackages()).toEqual([])
  })
})

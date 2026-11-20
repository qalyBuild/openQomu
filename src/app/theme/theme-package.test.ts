import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { parseThemePackage, serializeThemePackage, singleThemePackage, validateThemePackageFiles, type ThemePackage } from './theme-package'
import { fetchCatalogPackage, fetchPackageCatalog, parsePackageCatalog } from './package-catalog'
import type { ThemeInput } from './tokens'

const light: ThemeInput = {
  id: 'marea-light', name: 'Marea Clara', scheme: 'light', version: 1, author: 'Ana',
  license: 'CC0-1.0', tokens: { background: '#eef', foreground: '#101' },
}
const dark: ThemeInput = {
  ...light, id: 'marea-dark', name: 'Marea Oscura', scheme: 'dark',
  tokens: { background: '#112', foreground: '#eef' },
}

function fixture() {
  const day = singleThemePackage(light)
  const night = singleThemePackage(dark)
  const manifest = { ...day.manifest, id: 'marea', variants: [
    { ...day.manifest.variants[0], wallpaper: 'assets/ripple.png' },
    night.manifest.variants[0],
  ] }
  return {
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'variants/marea-light.json': day.files['variants/marea-light.json'],
    'variants/marea-dark.json': night.files['variants/marea-dark.json'],
    'assets/ripple.png': Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2uoAAAAASUVORK5CYII=', 'base64',
    )),
  }
}

describe('paquetes de temas', () => {
  it('conserva IDs, variantes y fondo al exportar y volver a importar', () => {
    const files = fixture()
    const first = serializeThemePackage(files)
    expect(serializeThemePackage(files)).toEqual(first)
    const pack = parseThemePackage(first)
    expect(pack.manifest.id).toBe('marea')
    expect(pack.themes).toEqual([light, dark])
    expect(pack.files['assets/ripple.png']).toEqual(files['assets/ripple.png'])
  })

  it('puede convertir un tema JSON suelto sin cambiar su identificador', () => {
    const item = singleThemePackage(light)
    expect(parseThemePackage(serializeThemePackage(item.files)).themes).toEqual([light])
  })

  it('prepara un ZIP con la ruta de contribución en el repositorio', () => {
    const files = fixture()
    const archive = serializeThemePackage(files, 'themes/community/marea/')
    expect(Object.keys(unzipSync(archive)).sort()).toEqual(
      Object.keys(files).map((path) => `themes/community/marea/${path}`).sort(),
    )
  })

  it.each(['otra-carpeta/tema.json', 'assets/recurso.svg', '../algo.json'])('rechaza la ruta %s', (path) => {
    expect(() => parseThemePackage(zipSync({ ...fixture(), [path]: strToU8('no permitido') }))).toThrow('entrada no permitida')
  })

  it('rechaza fondos faltantes, con tipo distinto o fuera del límite de dimensiones', () => {
    const files = fixture()
    const large = new Uint8Array(files['assets/ripple.png'])
    new DataView(large.buffer).setUint32(16, 5000)
    expect(() => validateThemePackageFiles({ ...files, 'assets/ripple.png': large })).toThrow('Fondo inválido')
    expect(() => validateThemePackageFiles({ ...files, 'assets/ripple.png': strToU8('imagen inválida') })).toThrow('Fondo inválido')
    const { 'assets/ripple.png': _image, ...missing } = files
    expect(() => validateThemePackageFiles(missing)).toThrow('Fondo inválido')
  })

  it('rechaza JSON excesivo antes de extraerlo y variantes incoherentes', () => {
    expect(() => parseThemePackage(zipSync({
      ...fixture(), 'variants/marea-light.json': new Uint8Array(32 * 1024 + 1),
    }))).toThrow('entrada no permitida')
    expect(() => validateThemePackageFiles({
      ...fixture(), 'variants/marea-light.json': strToU8(JSON.stringify({ ...light, scheme: 'dark' })),
    })).toThrow('no coincide')
  })

  it('rechaza IDs duplicados en un manifiesto', () => {
    const item = singleThemePackage(light)
    const manifest = { ...item.manifest, variants: [item.manifest.variants[0], item.manifest.variants[0]] }
    expect(() => validateThemePackageFiles({
      ...item.files, 'manifest.json': strToU8(JSON.stringify(manifest)),
    })).toThrow('duplicados')
  })
})

describe('catálogo de paquetes', () => {
  const item: ThemePackage = validateThemePackageFiles(fixture())
  const entry = { category: 'community', manifest: item.manifest, themes: item.themes }
  const catalog = { formatVersion: 1, packages: [entry] }

  it('lee el catálogo y descarga exclusivamente el paquete publicado esperado', async () => {
    const parsed = await fetchPackageCatalog(async () => Response.json(catalog))
    const result = await fetchCatalogPackage(parsed[0], async (url) => {
      expect(url).toBe('https://demo.openqomu.qaly.dev/themes/packages/marea-v1.qomutheme')
      return new Response(new Uint8Array(serializeThemePackage(item.files)))
    })
    expect(result.manifest).toEqual(item.manifest)
  })

  it('rechaza colisiones, licencias comunitarias inválidas y descargas de otra versión', async () => {
    expect(() => parsePackageCatalog({ ...catalog, packages: [entry, entry] })).toThrow('duplicado')
    expect(() => parsePackageCatalog({
      ...catalog, packages: [{ ...entry, manifest: { ...entry.manifest, license: 'AGPL-3.0' } }],
    })).toThrow('inválido')
    const [parsed] = parsePackageCatalog(catalog)
    await expect(fetchCatalogPackage({
      ...parsed, manifest: { ...parsed.manifest, version: 2 },
    }, async () => new Response(new Uint8Array(serializeThemePackage(item.files))))).rejects.toThrow('no coincide')
  })
})

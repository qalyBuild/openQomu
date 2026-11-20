import { MAX_PACKAGE_BYTES, parseThemePackage, parseThemePackageManifest, themePackageFilename, type ThemePackage, type ThemePackageManifest } from './theme-package'
import { validateThemeInput } from './validate'
import type { ThemeInput } from './tokens'

const THEME_CATALOG_ORIGIN = 'https://demo.openqomu.qaly.dev'
const CATALOG_URL = `${THEME_CATALOG_ORIGIN}/themes/catalog.json`
export const MAX_CATALOG_BYTES = 2 * 1024 * 1024

export interface CatalogThemePackage {
  category: 'official' | 'community'
  manifest: ThemePackageManifest
  themes: ThemeInput[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parsePackageCatalog(raw: unknown): CatalogThemePackage[] {
  if (!isRecord(raw) || raw.formatVersion !== 1 || !Array.isArray(raw.packages)) {
    throw new Error('El catálogo tiene un formato desconocido.')
  }
  const packageIds = new Set<string>()
  const ids = new Set<string>()
  return raw.packages.map((entry: unknown) => {
    if (!isRecord(entry) || (entry.category !== 'official' && entry.category !== 'community')) {
      throw new Error('El catálogo contiene un paquete sin categoría válida.')
    }
    const manifest = parseThemePackageManifest(entry.manifest)
    if (packageIds.has(manifest.id) || manifest.variants.some(({ id }) => ids.has(id))
      || !Array.isArray(entry.themes) || entry.themes.length !== manifest.variants.length
      || (entry.category === 'community' && manifest.license !== 'CC0-1.0')) {
      throw new Error('El catálogo contiene un paquete inválido o duplicado.')
    }
    const themes = entry.themes.map((theme: unknown, index: number) => {
      const result = validateThemeInput(theme, { requireCore: true })
      const variant = manifest.variants[index]
      if (!result.ok || result.value.id !== variant.id || result.value.scheme !== variant.scheme
        || result.value.author !== manifest.author || result.value.license !== manifest.license) {
        throw new Error('El catálogo contiene una variante inválida.')
      }
      ids.add(variant.id)
      return result.value
    })
    packageIds.add(manifest.id)
    return { category: entry.category, manifest, themes }
  })
}

async function readBoundedResponse(response: Response, maximum: number): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new Error('No se pudo descargar el catálogo o el paquete.')
  if (Number(response.headers.get('content-length')) > maximum) throw new Error('La descarga supera el tamaño permitido.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.length
      if (total > maximum) {
        await reader.cancel()
        throw new Error('La descarga supera el tamaño permitido.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const buffer = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.length
  }
  return buffer
}

export async function fetchPackageCatalog(fetcher = fetch): Promise<CatalogThemePackage[]> {
  const bytes = await readBoundedResponse(await fetcher(CATALOG_URL, { credentials: 'omit' }), MAX_CATALOG_BYTES)
  return parsePackageCatalog(JSON.parse(new TextDecoder().decode(bytes)))
}

export async function fetchCatalogPackage(entry: CatalogThemePackage, fetcher = fetch): Promise<ThemePackage> {
  const url = `${THEME_CATALOG_ORIGIN}/themes/packages/${themePackageFilename(entry.manifest)}`
  const bytes = await readBoundedResponse(await fetcher(url, { credentials: 'omit' }), MAX_PACKAGE_BYTES)
  const item = parseThemePackage(bytes)
  const expected = entry.manifest
  if (item.manifest.id !== expected.id || item.manifest.version !== expected.version
    || item.manifest.license !== expected.license || item.manifest.author !== expected.author
    || item.manifest.variants.length !== expected.variants.length
    || expected.variants.some(({ id, scheme, wallpaper }, index) => {
      const variant = item.manifest.variants[index]
      return variant.id !== id || variant.scheme !== scheme || variant.wallpaper !== wallpaper
    })) {
    throw new Error('El paquete no coincide con el catálogo. Actualiza la lista y vuelve a intentarlo.')
  }
  return item
}

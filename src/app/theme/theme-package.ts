import { strToU8, unzipSync, zipSync } from 'fflate'
import { THEME_SCHEMES, resolveTheme, type Theme, type ThemeInput, type ThemeScheme } from './tokens'
import { MAX_THEME_BYTES, validateThemeInput } from './validate'

export const THEME_PACKAGE_FORMAT = 1
export const MAX_PACKAGE_BYTES = 8 * 1024 * 1024
const MAX_CONTENT_BYTES = MAX_PACKAGE_BYTES - 4096
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_VARIANTS = 8
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/
const WALLPAPER_PATTERN = /^assets\/[a-z0-9][a-z0-9-]{0,63}\.(?:png|jpe?g|webp)$/
const THEME_FILE_PATTERN = /^variants\/[a-z0-9][a-z0-9-]{1,39}\.json$/

export interface PackageVariant {
  id: string
  scheme: ThemeScheme
  file: string
  wallpaper?: string
}

export interface ThemePackageManifest {
  formatVersion: typeof THEME_PACKAGE_FORMAT
  id: string
  version: number
  name: string
  author: string
  license: string
  description?: string
  variants: PackageVariant[]
}

export interface ThemePackage {
  manifest: ThemePackageManifest
  themes: ThemeInput[]
  files: Record<string, Uint8Array>
}

export interface ThemePackageGroup {
  manifest: ThemePackageManifest
  themes: Theme[]
}

export function resolvePackageThemes(item: ThemePackage): Theme[] {
  return item.themes.map((input, index) => {
    const path = item.manifest.variants[index].wallpaper
    const wallpaper = path ? new Blob([new Uint8Array(item.files[path])], { type: wallpaperMime(path) }) : undefined
    return resolveTheme(input, wallpaper)
  })
}

export function themePackageFilename({ id, version }: Pick<ThemePackageManifest, 'id' | 'version'>) {
  return `${id}-v${version}.qomutheme`
}

export function wallpaperMime(path: string) {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

export function parseThemePackageManifest(value: unknown): ThemePackageManifest {
  if (!record(value)) throw new Error('El manifiesto debe ser un objeto JSON.')
  const known = ['formatVersion', 'id', 'version', 'name', 'author', 'license', 'description', 'variants']
  if (Object.keys(value).some((key) => !known.includes(key))) {
    throw new Error('El manifiesto contiene campos desconocidos.')
  }
  if (value.formatVersion !== THEME_PACKAGE_FORMAT) {
    throw new Error('La versión del formato del paquete no es compatible.')
  }
  if (!text(value.id, 40) || !ID_PATTERN.test(value.id) || !Number.isSafeInteger(value.version)
    || Number(value.version) < 1 || Number(value.version) > 1000
    || !text(value.name, 60) || !text(value.author, 80) || !text(value.license, 60)
    || (value.description !== undefined && !text(value.description, 300))) {
    throw new Error('Revisa el ID, la versión, el nombre, la autoría y la licencia del paquete.')
  }
  if (!Array.isArray(value.variants) || value.variants.length < 1 || value.variants.length > MAX_VARIANTS) {
    throw new Error(`El paquete debe contener entre 1 y ${MAX_VARIANTS} variantes.`)
  }
  const ids = new Set<string>()
  for (const variant of value.variants) {
    if (!record(variant) || Object.keys(variant).some((key) => !['id', 'scheme', 'file', 'wallpaper'].includes(key))
      || typeof variant.id !== 'string' || !ID_PATTERN.test(variant.id) || ids.has(variant.id)
      || !THEME_SCHEMES.includes(variant.scheme as ThemeScheme)
      || variant.file !== `variants/${variant.id}.json`
      || (variant.wallpaper !== undefined && (typeof variant.wallpaper !== 'string' || !WALLPAPER_PATTERN.test(variant.wallpaper)))) {
      throw new Error('Hay una variante con un ID, esquema o ruta inválidos o duplicados.')
    }
    ids.add(variant.id)
  }
  return value as unknown as ThemePackageManifest
}

function readJson(bytes: Uint8Array | undefined, path: string): unknown {
  if (!bytes || !bytes.length || bytes.length > MAX_THEME_BYTES) {
    throw new Error(`Falta ${path} o supera 32 KiB.`)
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new Error(`${path} no es JSON válido.`)
  }
}

function jpegSize(bytes: Uint8Array, view: DataView): [number, number] | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return
  let offset = 2
  while (offset + 4 <= bytes.length && bytes[offset++] === 0xff) {
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if (marker === 0xd9 || marker === 0xda || offset + 2 > bytes.length) return
    const length = view.getUint16(offset)
    if (length < 2 || offset + length > bytes.length) return
    if ((marker === 0xc0 || marker === 0xc1 || marker === 0xc2) && length >= 8) {
      return [view.getUint16(offset + 5), view.getUint16(offset + 3)]
    }
    offset += length
  }
}

function imageSize(path: string, bytes: Uint8Array): [number, number] | undefined {
  if (bytes.length < 24) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (path.endsWith('.png')) {
    if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a
      && view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452) {
      return [view.getUint32(16), view.getUint32(20)]
    }
    return
  }
  if (!path.endsWith('.webp')) return jpegSize(bytes, view)
  if (bytes.length < 30 || view.getUint32(0) !== 0x52494646 || view.getUint32(8) !== 0x57454250) return
  const tag = view.getUint32(12)
  if (tag === 0x56503858 && !(bytes[20] & 2)) {
    return [1 + bytes[24] + 256 * bytes[25] + 65536 * bytes[26], 1 + bytes[27] + 256 * bytes[28] + 65536 * bytes[29]]
  }
  if (tag === 0x5650384c && bytes[20] === 0x2f) {
    const packed = view.getUint32(21, true)
    return [1 + (packed & 0x3fff), 1 + ((packed >>> 14) & 0x3fff)]
  }
  if (tag === 0x56503820 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff]
  }
}

export function validateThemePackageFiles(files: Record<string, Uint8Array>): ThemePackage {
  const entries = Object.entries(files)
  if (entries.length > 1 + MAX_VARIANTS * 2 || entries.reduce((size, [, bytes]) => size + bytes.length, 0) > MAX_CONTENT_BYTES) {
    throw new Error('El contenido del paquete supera los límites de tamaño o cantidad.')
  }
  const manifest = parseThemePackageManifest(readJson(files['manifest.json'], 'manifest.json'))
  const expected = new Set(['manifest.json'])
  const themes = manifest.variants.map((variant) => {
    expected.add(variant.file)
    const result = validateThemeInput(readJson(files[variant.file], variant.file), { requireCore: true })
    if (!result.ok) throw new Error(`${variant.file}: ${result.errors.join(' ')}`)
    const theme = result.value
    if (theme.id !== variant.id || theme.scheme !== variant.scheme || theme.author !== manifest.author || theme.license !== manifest.license) {
      throw new Error(`${variant.file} no coincide con el manifiesto.`)
    }
    if (variant.wallpaper && !expected.has(variant.wallpaper)) {
      expected.add(variant.wallpaper)
      const image = files[variant.wallpaper]
      const dimensions = image && image.length <= MAX_IMAGE_BYTES && imageSize(variant.wallpaper, image)
      if (!dimensions || dimensions.some((side) => side < 1 || side > 4096) || dimensions[0] * dimensions[1] > 8_000_000) {
        throw new Error(`Fondo inválido o demasiado grande: ${variant.wallpaper}.`)
      }
    }
    return theme
  })
  if (entries.some(([path]) => !expected.has(path))) throw new Error('Hay archivos ajenos al manifiesto.')
  return { manifest, themes, files }
}

export function parseThemePackage(bytes: Uint8Array): ThemePackage {
  if (bytes.length < 22 || bytes.length > MAX_PACKAGE_BYTES) {
    throw new Error('El ZIP no es válido o supera 8 MiB.')
  }
  const paths = new Set<string>()
  let total = 0
  const files = unzipSync(bytes, {
    filter({ name, compression, originalSize, size }) {
      const directory = name === 'variants/' || name === 'assets/'
      const json = name === 'manifest.json' || THEME_FILE_PATTERN.test(name)
      if ((!directory && !json && !WALLPAPER_PATTERN.test(name)) || paths.has(name)
        || paths.size >= 3 + MAX_VARIANTS * 2 || ![0, 8].includes(compression)
        || (compression === 0 && size !== originalSize)
        || originalSize > (directory ? 0 : json ? MAX_THEME_BYTES : MAX_IMAGE_BYTES)) {
        throw new Error(`El ZIP contiene una entrada no permitida: ${name.slice(0, 100)}.`)
      }
      paths.add(name)
      total += originalSize
      if (total > MAX_CONTENT_BYTES) throw new Error('El ZIP supera 8 MiB al descomprimirse.')
      return !directory
    },
  })
  return validateThemePackageFiles(files)
}

export function serializeThemePackage(files: ThemePackage['files'], prefix = '') {
  return zipSync(Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
    .map(([path, bytes]) => [prefix + path, bytes.constructor === Uint8Array ? bytes : new Uint8Array(bytes)])), { level: 0, mtime: new Date(1980, 0, 1) })
}

export function singleThemePackage(input: ThemeInput): ThemePackage {
  const file = `variants/${input.id}.json`
  const manifest: ThemePackageManifest = {
    formatVersion: THEME_PACKAGE_FORMAT,
    id: input.id,
    version: input.version,
    name: input.name,
    author: input.author,
    license: input.license,
    ...(input.description ? { description: input.description } : {}),
    variants: [{ id: input.id, scheme: input.scheme, file }],
  }
  return validateThemePackageFiles({
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2) + '\n'),
    [file]: strToU8(JSON.stringify(input, null, 2) + '\n'),
  })
}

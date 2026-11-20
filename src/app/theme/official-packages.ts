import { resolveTheme, type ThemeInput } from './tokens'
import { type ThemePackage, type ThemePackageGroup, type ThemePackageManifest, validateThemePackageFiles } from './theme-package'

const manifests = import.meta.glob<ThemePackageManifest>('/themes/official/*/manifest.json', { eager: true, import: 'default' })
const inputs = import.meta.glob<ThemeInput>('/themes/official/*/variants/*.json', { eager: true, import: 'default' })
const images = import.meta.glob<string>('/themes/official/*/assets/*', { eager: true, import: 'default', query: '?url' })
const firstPackages = ['qomu', 'liquid-glass']

export function officialThemePackages(product = 'Qomu'): ThemePackageGroup[] {
  const groups = Object.entries(manifests).map(([path, manifest]) => {
    const dir = path.slice(0, -'/manifest.json'.length)
    return {
      manifest: manifest.id === 'qomu' ? { ...manifest, name: product } : manifest,
      themes: manifest.variants.map((variant) => {
        const input = inputs[`${dir}/${variant.file}`]
        const branded = manifest.id === 'qomu' && product !== 'Qomu'
          ? { ...input, name: input.name.replace('Qomu', product), description: input.description?.replace('Qomu', product) }
          : input
        return resolveTheme(branded, variant.wallpaper ? images[`${dir}/${variant.wallpaper}`] : undefined)
      }),
    }
  })
  const order = (id: string) => firstPackages.includes(id) ? firstPackages.indexOf(id) : firstPackages.length
  return groups.sort((a, b) => order(a.manifest.id) - order(b.manifest.id) || a.manifest.id.localeCompare(b.manifest.id))
}

export async function getOfficialThemePackage(id: string): Promise<ThemePackage> {
  const dir = `/themes/official/${id}`
  const manifest = manifests[`${dir}/manifest.json`]
  if (!manifest) throw new Error('El paquete oficial no existe.')
  const encode = (data: unknown) => new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n')
  const files: ThemePackage['files'] = { 'manifest.json': encode(manifest) }
  for (const variant of manifest.variants) files[variant.file] = encode(inputs[`${dir}/${variant.file}`])
  const wallpapers = new Set(manifest.variants.flatMap((variant) => variant.wallpaper ? [variant.wallpaper] : []))
  await Promise.all([...wallpapers].map(async (path) => {
    const result = await fetch(images[`${dir}/${path}`])
    if (!result.ok) throw new Error('No se pudo cargar el fondo del paquete oficial.')
    files[path] = new Uint8Array(await result.arrayBuffer())
  }))
  return validateThemePackageFiles(files)
}

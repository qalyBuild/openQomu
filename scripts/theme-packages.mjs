import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const [command, source, output] = process.argv.slice(2)
if (!['build', 'check', 'pack'].includes(command) || (command === 'pack' && !source)) {
  throw new Error('Uso: theme-packages.mjs build | check | pack <carpeta> [paquete.qomutheme]')
}

const vite = await createServer({ root, configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, watch: null } })
try {
  const {
    validateThemePackageFiles, serializeThemePackage, themePackageFilename, MAX_PACKAGE_BYTES,
  } = await vite.ssrLoadModule('/src/app/theme/theme-package.ts')
  const { parsePackageCatalog, MAX_CATALOG_BYTES } = await vite.ssrLoadModule('/src/app/theme/package-catalog.ts')

  async function readPackage(directory) {
    const files = Object.create(null)
    let size = 0
    let count = 0
    async function readDirectory(relative = '') {
      const entries = await readdir(join(directory, relative), { withFileTypes: true })
      for (const entry of entries) {
        const path = relative ? `${relative}/${entry.name}` : entry.name
        const full = join(directory, path)
        if (!relative && ['assets', 'variants'].includes(path) && entry.isDirectory()) {
          await readDirectory(path)
        } else if (entry.isFile()) {
          size += (await lstat(full)).size
          if (++count > 17 || size > MAX_PACKAGE_BYTES) throw new Error('El paquete supera los límites de archivos.')
          files[path] = await readFile(full)
        } else {
          throw new Error(`${path} no es un archivo admitido.`)
        }
      }
    }
    try {
      await readDirectory()
      return validateThemePackageFiles(files)
    } catch (error) {
      throw new Error(`${directory}: ${error.message}`, { cause: error })
    }
  }

  async function writePackage(item, destination) {
    const bytes = serializeThemePackage(item.files)
    if (bytes.length > MAX_PACKAGE_BYTES) throw new Error(`${destination} supera 8 MiB.`)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, bytes)
  }

  if (command === 'pack') {
    const item = await readPackage(resolve(source))
    const path = resolve(output ?? themePackageFilename(item.manifest))
    await writePackage(item, path)
    console.log(path)
  } else {
    const items = []
    for (const category of ['official', 'community']) {
      const directory = join(root, 'themes', category)
      const entries = await readdir(directory, { withFileTypes: true })
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory()) throw new Error(`Se esperaba una carpeta de paquete en themes/${category}/${entry.name}.`)
        const item = await readPackage(join(directory, entry.name))
        if (entry.name !== item.manifest.id) throw new Error(`La carpeta ${entry.name} debe coincidir con el ID del paquete.`)
        items.push({ category, ...item })
      }
    }
    const catalog = {
      formatVersion: 1,
      packages: items.map(({ category, manifest, themes }) => ({ category, manifest, themes })),
    }
    parsePackageCatalog(catalog)
    const json = JSON.stringify(catalog, null, 2) + '\n'
    if (Buffer.byteLength(json) > MAX_CATALOG_BYTES) throw new Error('El catálogo supera 2 MiB.')
    if (command === 'build') {
      const target = join(root, 'dist', 'themes')
      await Promise.all(items.map((item) => writePackage(item, join(target, 'packages', themePackageFilename(item.manifest)))))
      await writeFile(join(target, 'catalog.json'), json)
    }
    console.log(`${items.length} paquetes válidos.`)
  }
} finally {
  await vite.close()
}

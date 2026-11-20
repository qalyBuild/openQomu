import { type ThemePackage, validateThemePackageFiles } from './theme-package'

const DB_NAME = 'qomu-theme-packages'
const STORE_NAME = 'packages'
let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('El almacenamiento de paquetes no está disponible.'))
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'manifest.id' })
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
        database = undefined
      }
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
  }).catch((error: unknown) => {
    database = undefined
    throw error
  })
  return database
}

export async function loadThemePackages(): Promise<ThemePackage[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as ThemePackage[]).flatMap((entry) => {
      try {
        return [validateThemePackageFiles(entry.files)]
      } catch {
        return []
      }
    }))
    request.onerror = () => reject(request.error)
  })
}

export async function storeThemePackage(item: ThemePackage): Promise<void> {
  const validated = validateThemePackageFiles(item.files)
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('No se pudo guardar el paquete.'))
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const installed = request.result as ThemePackage[]
      const previous = installed.find((pkg) => pkg.manifest.id === validated.manifest.id)
      const incoming = new Set(validated.themes.map(({ id }) => id))
      if (previous && previous.manifest.version > validated.manifest.version) {
        reject(new Error('Ya tienes instalada una versión más reciente del paquete.'))
        transaction.abort()
        return
      }
      if (installed.some((pkg) => pkg.manifest.id !== validated.manifest.id && pkg.themes.some(({ id }) => incoming.has(id)))) {
        reject(new Error('Una variante ya pertenece a otro paquete instalado.'))
        transaction.abort()
        return
      }
      store.put(validated)
    }
  })
}

export async function deleteThemePackage(id: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('No se pudo eliminar el paquete.'))
    transaction.objectStore(STORE_NAME).delete(id)
  })
}

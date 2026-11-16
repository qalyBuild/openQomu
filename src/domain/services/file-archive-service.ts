import type { FileFolder, FileMeta } from '@/domain/entities/chat'
import { sanitizeFileName } from './file-service'

/** Límite prudente para comprimir en memoria en el navegador. */
export const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024

export interface FolderArchiveEntry {
  /** Ruta relativa dentro del ZIP, siempre con `/`. */
  path: string
  file: FileMeta
}

function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path)
    return path
  }
  const dot = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  const hasExtension = dot > slash + 1
  const base = hasExtension ? path.slice(0, dot) : path
  const extension = hasExtension ? path.slice(dot) : ''
  let index = 2
  let candidate = `${base} (${index})${extension}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${base} (${index})${extension}`
  }
  used.add(candidate)
  return candidate
}

/**
 * Reúne los archivos de una carpeta y todas sus subcarpetas con rutas
 * relativas a la carpeta elegida. Ignora los archivos en la papelera.
 */
export function collectFolderArchive(
  folders: FileFolder[],
  files: FileMeta[],
  folderId: string,
): FolderArchiveEntry[] {
  const activeFiles = files.filter((file) => !file.trashedAt)
  const usedPaths = new Set<string>()
  const visitedFolders = new Set<string>([folderId])
  const entries: FolderArchiveEntry[] = []

  const walk = (currentId: string, prefix: string) => {
    const directFiles = activeFiles
      .filter((file) => file.folderId === currentId)
      .sort((a, b) => sanitizeFileName(a.name).localeCompare(sanitizeFileName(b.name), 'es'))

    for (const file of directFiles) {
      entries.push({ path: uniquePath(`${prefix}${sanitizeFileName(file.name)}`, usedPaths), file })
    }

    const children = folders
      .filter((folder) => folder.parentId === currentId && !visitedFolders.has(folder.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))

    for (const child of children) {
      visitedFolders.add(child.id)
      walk(child.id, `${prefix}${sanitizeFileName(child.name)}/`)
    }
  }

  walk(folderId, '')
  return entries
}

/** Nombre del archivo ZIP a partir del nombre de la carpeta. */
export function folderArchiveName(folderName: string): string {
  const cleaned = folderName
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"|?*\\/]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return `${(cleaned || 'carpeta').slice(0, 100)}.zip`
}

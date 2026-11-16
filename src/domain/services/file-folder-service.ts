import type { FileFolder } from '@/domain/entities/chat'
import { ConflictError, ValidationError } from '@/domain/errors'

export interface FolderNode extends FileFolder {
  children: FolderNode[]
}

export function validateFolderName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim()
  if (trimmed.length < 1) throw new ValidationError('La carpeta necesita un nombre.')
  if (trimmed.length > 60) throw new ValidationError('El nombre de la carpeta es demasiado largo.')
  if (/[/\\]/.test(trimmed)) {
    throw new ValidationError('El nombre de la carpeta no puede contener “/” ni “\\”.')
  }
  if (/^\.+$/.test(trimmed)) throw new ValidationError('Ese nombre de carpeta no es válido.')
  return trimmed
}

/** Clave para comparar nombres sin distinguir mayúsculas ni tildes. */
export function folderNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Evita dos carpetas con el mismo nombre en el mismo nivel. */
export function assertFolderNameAvailable(
  folders: FileFolder[],
  name: string,
  parentId: string | null,
  excludeId?: string,
): void {
  const key = folderNameKey(name)
  const duplicated = folders.some(
    (folder) =>
      folder.id !== excludeId &&
      folder.parentId === parentId &&
      folderNameKey(folder.name) === key,
  )
  if (duplicated) {
    throw new ConflictError(`Ya existe una carpeta “${name}” en esta ubicación.`)
  }
}

export function buildFolderTree(folders: FileFolder[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>()
  for (const folder of folders) nodes.set(folder.id, { ...folder, children: [] })
  const roots: FolderNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: FolderNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    for (const node of list) sort(node.children)
  }
  sort(roots)
  return roots
}

export function descendantFolderIds(folders: FileFolder[], folderId: string): string[] {
  const children = folders.filter((folder) => folder.parentId === folderId && folder.id !== folderId)
  return children.flatMap((child) => [child.id, ...descendantFolderIds(folders, child.id)])
}

export function assertCanMoveFolder(
  folders: FileFolder[],
  folderId: string,
  nextParentId: string | null,
): void {
  if (nextParentId === null) return
  if (nextParentId === folderId) {
    throw new ConflictError('Una carpeta no puede moverse dentro de sí misma.')
  }
  if (!folders.some((folder) => folder.id === nextParentId)) {
    throw new ValidationError('La carpeta de destino no existe.')
  }
  if (descendantFolderIds(folders, folderId).includes(nextParentId)) {
    throw new ConflictError('No puedes mover una carpeta dentro de una subcarpeta.')
  }
}

export function folderBreadcrumb(folders: FileFolder[], folderId: string | null): FileFolder[] {
  if (!folderId) return []
  const trail: FileFolder[] = []
  const seen = new Set<string>()
  let current = folders.find((folder) => folder.id === folderId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    trail.unshift(current)
    current = current.parentId
      ? folders.find((folder) => folder.id === current?.parentId)
      : undefined
  }
  return trail
}

export function isFolderEmpty(
  folderId: string,
  folders: FileFolder[],
  fileFolderIds: Array<string | null>,
): boolean {
  return (
    !folders.some((folder) => folder.parentId === folderId) &&
    !fileFolderIds.some((id) => id === folderId)
  )
}

/**
 * Divide una ruta relativa de subida en sus carpetas y el nombre del archivo.
 * Las rutas que terminan en “/” representan una carpeta sin archivo.
 */
export function splitUploadPath(path: string): { folders: string[]; fileName: string } {
  const parts = path
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.')
  if (path.endsWith('/')) return { folders: parts, fileName: '' }
  const fileName = parts.pop() ?? ''
  return { folders: parts, fileName }
}

import { ValidationError } from '@/domain/errors'

export const MAX_FILE_SIZE = 25 * 1024 * 1024
/** Límite del modo gratuito (documento de Firestore < 1 MiB). */
export const FREE_FILE_SIZE_LIMIT = 700 * 1024
export const FREE_STORAGE_QUOTA = 1024 * 1024 * 1024
export const BLOCKED_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'ps1',
  'vbs',
  'dll',
  'jar',
] as const

export interface UploadCandidate {
  name: string
  size: number
  contentType?: string
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'archivo'
  const cleaned = base
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return (cleaned || 'archivo').slice(0, 120)
}

export function extensionOf(name: string): string {
  const clean = sanitizeFileName(name)
  const dot = clean.lastIndexOf('.')
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase()
}

export function validateUpload(file: UploadCandidate): void {
  if (!file.name.trim()) throw new ValidationError('El archivo necesita un nombre.')
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new ValidationError('El archivo está vacío.')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError('El archivo supera el límite de 25 MB.')
  }
  if ((BLOCKED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    throw new ValidationError('Por seguridad no se permiten archivos ejecutables.')
  }
}

export function buildStoragePath(workspaceId: string, fileId: string, name: string): string {
  return `workspaces/${workspaceId}/${fileId}-${sanitizeFileName(name)}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1)
  return `${formatted} ${units[exponent]}`
}

export function isImageFile(file: Pick<UploadCandidate, 'name' | 'contentType'>): boolean {
  if (file.contentType?.startsWith('image/')) return true
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(extensionOf(file.name))
}

export function isPdfFile(file: Pick<UploadCandidate, 'name' | 'contentType'>): boolean {
  return file.contentType === 'application/pdf' || extensionOf(file.name) === 'pdf'
}

export function isMarkdownFile(file: Pick<UploadCandidate, 'name' | 'contentType'>): boolean {
  const extension = extensionOf(file.name)
  return extension === 'md' || extension === 'markdown' || file.contentType === 'text/markdown'
}

export const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss',
  'html', 'xml', 'yml', 'yaml', 'csv', 'log', 'py', 'go', 'rs', 'java', 'sql',
  'sh', 'env', 'toml', 'ini', 'conf', 'graphql', 'gql', 'svg',
] as const

export function isTextFile(file: Pick<UploadCandidate, 'name' | 'contentType'>): boolean {
  if (file.contentType?.startsWith('text/')) return true
  if (file.contentType === 'application/json' || file.contentType === 'application/xml') return true
  return (TEXT_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))
}

/** Estimación del espacio que ocupa el archivo en Firestore (base64 + metadatos). */
export function estimateStoredBytes(size: number): number {
  return Math.ceil(size / 3) * 4 + 512
}

export function fileKindLabel(file: Pick<UploadCandidate, 'name' | 'contentType'>): string {
  if (isImageFile(file)) return 'Imagen'
  if (isPdfFile(file)) return 'PDF'
  const extension = extensionOf(file.name)
  return extension ? extension.toUpperCase() : 'Archivo'
}

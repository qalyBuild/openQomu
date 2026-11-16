import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type {
  FileRepository,
  FileUpdate,
  Subscriber,
  Unsubscribe,
  UploadFile,
  UploadOptions,
} from '@/domain/ports'
import type { FileMeta } from '@/domain/entities/chat'
import { NotFoundError, ValidationError } from '@/domain/errors'
import {
  FREE_FILE_SIZE_LIMIT,
  formatBytes,
  validateUpload,
} from '@/domain/services/file-service'
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'
import { mapFile } from './mappers'

function db() {
  return getFirebaseDb()
}

function filesCol(workspaceId: string) {
  return collection(db(), 'workspaces', workspaceId, 'files')
}

function fileRef(workspaceId: string, fileId: string) {
  return doc(db(), 'workspaces', workspaceId, 'files', fileId)
}

function contentRef(workspaceId: string, fileId: string) {
  return doc(db(), 'workspaces', workspaceId, 'files', fileId, 'data', 'main')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(blob)
  })
}

function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('El nombre no puede estar vacío.')
  if (trimmed.length > 120) throw new ValidationError('El nombre es demasiado largo.')
  return trimmed
}

/** Caché de contenido resuelto para no releer el mismo archivo en cada render. */
const urlCache = new Map<string, string>()

/**
 * Almacenamiento de archivos 100 % gratuito dentro de Firestore.
 *
 * Los metadatos viven en el documento del archivo y el contenido en
 * `files/{id}/data/main`, por lo que listar la biblioteca no descarga los blobs.
 * El límite de 700 KB mantiene el documento de contenido por debajo de 1 MiB.
 */
export class FirestoreFreeFileRepository implements FileRepository {
  async list(workspaceId: string): Promise<FileMeta[]> {
    const snapshot = await getDocs(
      query(filesCol(workspaceId), orderBy('createdAt', 'desc')),
    )
    return snapshot.docs.map((document) =>
      mapFile(document.id, workspaceId, document.data()),
    )
  }

  subscribe(workspaceId: string, callback: Subscriber<FileMeta[]>): Unsubscribe {
    return onSnapshot(
      query(filesCol(workspaceId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        callback(
          snapshot.docs.map((document) =>
            mapFile(document.id, workspaceId, document.data()),
          ),
        )
      },
      (error) => console.error('[openqomu] files snapshot', error),
    )
  }

  async upload(
    workspaceId: string,
    file: UploadFile,
    uploadedBy: string,
    options: UploadOptions = {},
  ): Promise<FileMeta> {
    validateUpload({ name: file.name, size: file.size, contentType: file.contentType })
    if (file.size > FREE_FILE_SIZE_LIMIT) {
      throw new ValidationError(
        `El modo gratuito admite archivos de hasta ${formatBytes(FREE_FILE_SIZE_LIMIT)}. ` +
          'Activa Firebase Storage (plan Blaze) para subir archivos más grandes.',
      )
    }
    options.onProgress?.(10)
    const dataUrl = await blobToDataUrl(file.data)
    options.onProgress?.(65)
    const reference = doc(filesCol(workspaceId))
    const now = nowIso()
    const meta: FileMeta = {
      id: reference.id,
      workspaceId,
      name: file.name,
      path: `firestore://${reference.id}`,
      url: '',
      size: file.size,
      contentType: file.contentType || 'application/octet-stream',
      uploadedBy,
      createdAt: now,
      updatedAt: now,
      folderId: options.folderId ?? null,
      trashedAt: null,
      backend: 'firestore',
    }
    const batch = writeBatch(db())
    batch.set(reference, {
      name: meta.name,
      path: meta.path,
      url: '',
      size: meta.size,
      contentType: meta.contentType,
      uploadedBy: meta.uploadedBy,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      folderId: meta.folderId,
      trashedAt: null,
      backend: 'firestore',
    })
    batch.set(contentRef(workspaceId, meta.id), { data: dataUrl, size: file.size })
    await batch.commit()
    urlCache.set(`${workspaceId}:${meta.id}`, dataUrl)
    options.onProgress?.(100)
    return { ...meta, url: dataUrl }
  }

  async update(workspaceId: string, fileId: string, patch: FileUpdate): Promise<void> {
    const snapshot = await getDoc(fileRef(workspaceId, fileId))
    if (!snapshot.exists()) throw new NotFoundError('El archivo no existe.')
    const data: Record<string, unknown> = { updatedAt: nowIso() }
    if (patch.name !== undefined) data.name = validateName(patch.name)
    if (patch.folderId !== undefined) data.folderId = patch.folderId
    if (patch.trashedAt !== undefined) data.trashedAt = patch.trashedAt
    await setDoc(fileRef(workspaceId, fileId), data, { merge: true })
  }

  async getDownloadUrl(workspaceId: string, file: FileMeta): Promise<string> {
    if (file.url) return file.url
    const cacheKey = `${workspaceId}:${file.id}`
    const cached = urlCache.get(cacheKey)
    if (cached) return cached
    const snapshot = await getDoc(contentRef(workspaceId, file.id))
    if (!snapshot.exists()) return ''
    const data = snapshot.data().data
    if (typeof data !== 'string') return ''
    urlCache.set(cacheKey, data)
    return data
  }

  async downloadBlob(workspaceId: string, file: FileMeta): Promise<Blob> {
    const url = await this.getDownloadUrl(workspaceId, file)
    if (!url) throw new NotFoundError('El archivo no existe.')
    const response = await fetch(url)
    if (!response.ok) throw new ValidationError('No se pudo leer el archivo.')
    return response.blob()
  }

  async readText(workspaceId: string, file: FileMeta): Promise<string> {
    const url = await this.getDownloadUrl(workspaceId, file)
    if (!url) return ''
    const response = await fetch(url)
    return response.text()
  }

  async updateText(workspaceId: string, file: FileMeta, text: string): Promise<void> {
    const size = new Blob([text]).size
    if (size > FREE_FILE_SIZE_LIMIT) {
      throw new ValidationError(
        `El texto supera el límite de ${formatBytes(FREE_FILE_SIZE_LIMIT)} del modo gratuito.`,
      )
    }
    const snapshot = await getDoc(fileRef(workspaceId, file.id))
    if (!snapshot.exists()) throw new NotFoundError('El archivo no existe.')
    const dataUrl = await blobToDataUrl(
      new Blob([text], { type: file.contentType || 'text/plain' }),
    )
    const now = nowIso()
    const batch = writeBatch(db())
    batch.set(contentRef(workspaceId, file.id), { data: dataUrl, size })
    batch.set(
      fileRef(workspaceId, file.id),
      { size, updatedAt: now, url: '' },
      { merge: true },
    )
    await batch.commit()
    urlCache.set(`${workspaceId}:${file.id}`, dataUrl)
  }

  async remove(workspaceId: string, fileId: string): Promise<void> {
    const snapshot = await getDoc(fileRef(workspaceId, fileId))
    if (!snapshot.exists()) throw new NotFoundError('El archivo no existe.')
    const batch = writeBatch(db())
    batch.delete(contentRef(workspaceId, fileId))
    batch.delete(fileRef(workspaceId, fileId))
    await batch.commit()
    urlCache.delete(`${workspaceId}:${fileId}`)
  }
}

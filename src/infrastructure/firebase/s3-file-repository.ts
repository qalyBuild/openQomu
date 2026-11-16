import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
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
import { NotFoundError, PermissionError, ValidationError } from '@/domain/errors'
import { validateUpload } from '@/domain/services/file-service'
import { getFirebaseAuth, getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'
import { mapFile } from './mappers'
import { FirebaseFileRepository } from './firebase-file-repository'

const FILES_URL = (import.meta.env.VITE_FILES_URL ?? '').replace(/\/+$/, '')
/** Renueva la URL firmada cinco minutos antes de que caduque. */
const URL_TTL_MARGIN_MS = 5 * 60_000

function db() {
  return getFirebaseDb()
}

function filesCol(workspaceId: string) {
  return collection(db(), 'workspaces', workspaceId, 'files')
}

function fileRef(workspaceId: string, fileId: string) {
  return doc(db(), 'workspaces', workspaceId, 'files', fileId)
}

function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('El nombre no puede estar vacío.')
  if (trimmed.length > 120) throw new ValidationError('El nombre es demasiado largo.')
  return trimmed
}

function workerUrl(): string {
  if (!FILES_URL) {
    throw new ValidationError(
      'Falta VITE_FILES_URL. Configura el Worker de archivos para usar almacenamiento S3.',
    )
  }
  return FILES_URL
}

async function authHeader(): Promise<string> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new PermissionError('Inicia sesión para acceder a los archivos.')
  return `Bearer ${await user.getIdToken()}`
}

function objectPath(workspaceId: string, fileId: string): string {
  return `s3://${workspaceId}/${fileId}`
}

function objectUrl(workspaceId: string, fileId: string): string {
  return `${workerUrl()}/files/${encodeURIComponent(workspaceId)}/${encodeURIComponent(fileId)}`
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const detail = await response.text().catch(() => '')
  return detail.trim() || fallback
}

function uploadObject(
  workspaceId: string,
  fileId: string,
  file: UploadFile,
  token: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', objectUrl(workspaceId, fileId))
    request.setRequestHeader('authorization', token)
    request.setRequestHeader(
      'content-type',
      file.contentType || 'application/octet-stream',
    )
    request.setRequestHeader('x-file-name', encodeURIComponent(file.name))
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }
      reject(
        new ValidationError(
          request.responseText.trim() || 'No se pudo subir el archivo a almacenamiento S3.',
        ),
      )
    }
    request.onerror = () =>
      reject(new ValidationError('No se pudo conectar con el almacenamiento de archivos.'))
    request.onabort = () => reject(new ValidationError('La subida se canceló.'))
    request.send(file.data)
  })
}

async function deleteRemote(workspaceId: string, fileId: string): Promise<void> {
  const response = await fetch(objectUrl(workspaceId, fileId), {
    method: 'DELETE',
    headers: { authorization: await authHeader() },
  })
  if (!response.ok && response.status !== 404) {
    throw new ValidationError(
      await errorMessage(response, 'No se pudo borrar el archivo de almacenamiento S3.'),
    )
  }
}

const urlCache = new Map<string, { url: string; expiresAt: number }>()

/**
 * Almacenamiento de archivos en almacenamiento S3 (10 GB gratis, sin tarjeta).
 *
 * Los metadatos viven en Firestore y el binario en el almacenamiento S3. Las descargas usan URLs
 * firmadas por el Worker; los archivos antiguos de Firestore/Storage se siguen
 * leyendo a través de sus adaptadores originales.
 */
export class S3FileRepository implements FileRepository {
  private readonly legacy = new FirebaseFileRepository()

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
    const reference = doc(filesCol(workspaceId))
    const token = await authHeader()
    options.onProgress?.(1)
    await uploadObject(workspaceId, reference.id, file, token, options.onProgress)
    const now = nowIso()
    const meta: FileMeta = {
      id: reference.id,
      workspaceId,
      name: file.name,
      path: objectPath(workspaceId, reference.id),
      url: '',
      size: file.size,
      contentType: file.contentType || 'application/octet-stream',
      uploadedBy,
      createdAt: now,
      updatedAt: now,
      folderId: options.folderId ?? null,
      trashedAt: null,
      backend: 's3',
    }
    try {
      await setDoc(reference, {
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
        backend: 's3',
      })
    } catch (error) {
      // Sin metadatos el objeto quedaría huérfano: se intenta limpiar.
      await fetch(objectUrl(workspaceId, reference.id), {
        method: 'DELETE',
        headers: { authorization: token },
      }).catch(() => undefined)
      throw error
    }
    return meta
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
    if (file.backend !== 's3') return this.legacy.getDownloadUrl(workspaceId, file)
    const key = `${workspaceId}:${file.id}`
    const cached = urlCache.get(key)
    if (cached && cached.expiresAt - URL_TTL_MARGIN_MS > Date.now()) return cached.url
    const response = await fetch(`${objectUrl(workspaceId, file.id)}/url`, {
      headers: { authorization: await authHeader() },
    })
    if (!response.ok) {
      throw new ValidationError(
        await errorMessage(response, 'No se pudo preparar la descarga del archivo.'),
      )
    }
    const payload = (await response.json()) as { url?: string; expiresAt?: number }
    if (!payload.url) {
      throw new ValidationError('El almacenamiento no devolvió una URL válida.')
    }
    urlCache.set(key, {
      url: payload.url,
      expiresAt:
        typeof payload.expiresAt === 'number'
          ? payload.expiresAt
          : Date.now() + 60 * 60_000,
    })
    return payload.url
  }

  async downloadBlob(workspaceId: string, file: FileMeta): Promise<Blob> {
    if (file.backend !== 's3') return this.legacy.downloadBlob(workspaceId, file)
    const url = await this.getDownloadUrl(workspaceId, file)
    const response = await fetch(url)
    if (!response.ok) throw new ValidationError('No se pudo leer el archivo.')
    return response.blob()
  }

  async readText(workspaceId: string, file: FileMeta): Promise<string> {
    if (file.backend !== 's3') return this.legacy.readText(workspaceId, file)
    const url = await this.getDownloadUrl(workspaceId, file)
    const response = await fetch(url)
    if (!response.ok) return ''
    return response.text()
  }

  async updateText(workspaceId: string, file: FileMeta, text: string): Promise<void> {
    if (file.backend !== 's3') {
      return this.legacy.updateText(workspaceId, file, text)
    }
    const blob = new Blob([text], { type: file.contentType || 'text/plain' })
    const upload: UploadFile = {
      name: file.name,
      size: blob.size,
      contentType: file.contentType || 'text/plain',
      data: blob,
    }
    validateUpload({ name: upload.name, size: upload.size, contentType: upload.contentType })
    await uploadObject(workspaceId, file.id, upload, await authHeader())
    await setDoc(
      fileRef(workspaceId, file.id),
      { size: blob.size, updatedAt: nowIso(), url: '' },
      { merge: true },
    )
    urlCache.delete(`${workspaceId}:${file.id}`)
  }

  async remove(workspaceId: string, fileId: string): Promise<void> {
    const snapshot = await getDoc(fileRef(workspaceId, fileId))
    if (!snapshot.exists()) throw new NotFoundError('El archivo no existe.')
    const data = snapshot.data()
    const isS3 =
      data.backend === 's3' || String(data.path ?? '').startsWith('s3://')
    if (!isS3) return this.legacy.remove(workspaceId, fileId)
    await deleteRemote(workspaceId, fileId)
    await deleteDoc(fileRef(workspaceId, fileId))
    urlCache.delete(`${workspaceId}:${fileId}`)
  }
}

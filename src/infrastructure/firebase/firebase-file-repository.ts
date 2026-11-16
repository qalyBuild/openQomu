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
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage'
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
import { buildStoragePath, validateUpload } from '@/domain/services/file-service'
import { getFirebaseDb, getFirebaseStorage } from './client'
import { nowIso } from './firestore-utils'
import { mapFile } from './mappers'
import { FirestoreFreeFileRepository } from './firestore-free-file-repository'

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

export class FirebaseFileRepository implements FileRepository {
  private readonly free = new FirestoreFreeFileRepository()

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
    const path = buildStoragePath(workspaceId, reference.id, file.name)
    const task = uploadBytesResumable(
      storageRef(getFirebaseStorage(), path),
      file.data,
      { contentType: file.contentType || 'application/octet-stream' },
    )
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            options.onProgress?.(
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            )
          }
        },
        reject,
        resolve,
      )
    })
    const url = await getDownloadURL(task.snapshot.ref)
    const now = nowIso()
    const meta: FileMeta = {
      id: reference.id,
      workspaceId,
      name: file.name,
      path,
      url,
      size: file.size,
      contentType: file.contentType || 'application/octet-stream',
      uploadedBy,
      createdAt: now,
      updatedAt: now,
      folderId: options.folderId ?? null,
      trashedAt: null,
      backend: 'storage',
    }
    await setDoc(reference, {
      name: meta.name,
      path: meta.path,
      url: meta.url,
      size: meta.size,
      contentType: meta.contentType,
      uploadedBy: meta.uploadedBy,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      folderId: meta.folderId,
      trashedAt: null,
      backend: 'storage',
    })
    options.onProgress?.(100)
    return meta
  }

  async update(workspaceId: string, fileId: string, patch: FileUpdate): Promise<void> {
    const target = await getDoc(fileRef(workspaceId, fileId))
    if (!target.exists()) throw new NotFoundError('El archivo no existe.')
    const data: Record<string, unknown> = { updatedAt: nowIso() }
    if (patch.name !== undefined) data.name = validateName(patch.name)
    if (patch.folderId !== undefined) data.folderId = patch.folderId
    if (patch.trashedAt !== undefined) data.trashedAt = patch.trashedAt
    await setDoc(fileRef(workspaceId, fileId), data, { merge: true })
  }

  async getDownloadUrl(workspaceId: string, file: FileMeta): Promise<string> {
    if (file.backend === 'firestore') return this.free.getDownloadUrl(workspaceId, file)
    if (file.url) return file.url
    if (!file.path) return ''
    return getDownloadURL(storageRef(getFirebaseStorage(), file.path))
  }

  async readText(workspaceId: string, file: FileMeta): Promise<string> {
    const url = await this.getDownloadUrl(workspaceId, file)
    if (!url) return ''
    const response = await fetch(url)
    return response.text()
  }

  async downloadBlob(workspaceId: string, file: FileMeta): Promise<Blob> {
    const url = await this.getDownloadUrl(workspaceId, file)
    if (!url) throw new NotFoundError('El archivo no existe.')
    const response = await fetch(url)
    if (!response.ok) throw new ValidationError('No se pudo leer el archivo.')
    return response.blob()
  }

  async updateText(workspaceId: string, file: FileMeta, text: string): Promise<void> {
    if (file.backend === 'firestore') {
      return this.free.updateText(workspaceId, file, text)
    }
    if (!file.path) throw new NotFoundError('El archivo no existe.')
    const blob = new Blob([text], { type: file.contentType || 'text/plain' })
    validateUpload({ name: file.name, size: blob.size, contentType: file.contentType })
    const reference = storageRef(getFirebaseStorage(), file.path)
    await uploadBytes(reference, blob, { contentType: file.contentType || 'text/plain' })
    const url = await getDownloadURL(reference)
    await setDoc(
      fileRef(workspaceId, file.id),
      { size: blob.size, updatedAt: nowIso(), url },
      { merge: true },
    )
  }

  async remove(workspaceId: string, fileId: string): Promise<void> {
    const target = await getDoc(fileRef(workspaceId, fileId))
    if (!target.exists()) throw new NotFoundError('El archivo no existe.')
    if (
      target.data().backend === 'firestore' ||
      String(target.data().path ?? '').startsWith('firestore://')
    ) {
      return this.free.remove(workspaceId, fileId)
    }
    const path = typeof target.data().path === 'string' ? (target.data().path as string) : ''
    if (path) {
      try {
        await deleteObject(storageRef(getFirebaseStorage(), path))
      } catch {
        // El blob ya no existe; se limpia igualmente el metadato.
      }
    }
    await deleteDoc(fileRef(workspaceId, fileId))
  }
}

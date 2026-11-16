import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import type {
  FileFolderRepository,
  FolderInput,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { FileFolder } from '@/domain/entities/chat'
import { ConflictError, NotFoundError } from '@/domain/errors'
import {
  assertCanMoveFolder,
  assertFolderNameAvailable,
  isFolderEmpty,
  validateFolderName,
} from '@/domain/services/file-folder-service'
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'
import { mapFolder } from './mappers'

function db() {
  return getFirebaseDb()
}

function foldersCol(workspaceId: string) {
  return collection(db(), 'workspaces', workspaceId, 'folders')
}

function folderRef(workspaceId: string, folderId: string) {
  return doc(db(), 'workspaces', workspaceId, 'folders', folderId)
}

function sorted(folders: FileFolder[]): FileFolder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export class FirebaseFileFolderRepository implements FileFolderRepository {
  async list(workspaceId: string): Promise<FileFolder[]> {
    const snapshot = await getDocs(foldersCol(workspaceId))
    return sorted(
      snapshot.docs.map((document) =>
        mapFolder(document.id, workspaceId, document.data()),
      ),
    )
  }

  subscribe(workspaceId: string, callback: Subscriber<FileFolder[]>): Unsubscribe {
    return onSnapshot(
      foldersCol(workspaceId),
      (snapshot) => {
        callback(
          sorted(
            snapshot.docs.map((document) =>
              mapFolder(document.id, workspaceId, document.data()),
            ),
          ),
        )
      },
      (error) => console.error('[openqomu] folders snapshot', error),
    )
  }

  async create(input: FolderInput): Promise<FileFolder> {
    const name = validateFolderName(input.name)
    const now = nowIso()
    const parentId = input.parentId ?? null
    const folders = await this.list(input.workspaceId)
    if (parentId && !folders.some((folder) => folder.id === parentId)) {
      throw new NotFoundError('La carpeta de destino no existe.')
    }
    assertFolderNameAvailable(folders, name, parentId)
    const reference = await addDoc(foldersCol(input.workspaceId), {
      name,
      parentId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    return {
      id: reference.id,
      workspaceId: input.workspaceId,
      name,
      parentId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(
    workspaceId: string,
    folderId: string,
    patch: Pick<FileFolder, 'name'> & { parentId?: string | null },
  ): Promise<void> {
    const folders = await this.list(workspaceId)
    if (!folders.some((folder) => folder.id === folderId)) {
      throw new NotFoundError('La carpeta no existe.')
    }
    const name = validateFolderName(patch.name)
    const current = folders.find((folder) => folder.id === folderId)!
    const nextParentId = patch.parentId !== undefined ? patch.parentId : current.parentId
    assertFolderNameAvailable(folders, name, nextParentId, folderId)
    if (patch.parentId !== undefined) {
      assertCanMoveFolder(folders, folderId, patch.parentId)
    }
    await updateDoc(folderRef(workspaceId, folderId), {
      name,
      ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
      updatedAt: nowIso(),
    })
  }

  async remove(workspaceId: string, folderId: string): Promise<void> {
    const [folders, files] = await Promise.all([
      this.list(workspaceId),
      getDocs(collection(db(), 'workspaces', workspaceId, 'files')),
    ])
    if (!folders.some((folder) => folder.id === folderId)) {
      throw new NotFoundError('La carpeta no existe.')
    }
    const fileFolderIds = files.docs
      .filter((file) => !file.data().trashedAt)
      .map((file) => {
        const value = file.data().folderId
        return typeof value === 'string' ? value : null
      })
    if (!isFolderEmpty(folderId, folders, fileFolderIds)) {
      throw new ConflictError('Mueve o elimina el contenido antes de borrar la carpeta.')
    }
    await deleteDoc(folderRef(workspaceId, folderId))
  }
}

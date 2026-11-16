import type {
  FileFolderRepository,
  FolderInput,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { FileFolder } from '@/domain/entities/chat'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'
import {
  assertCanMoveFolder,
  assertFolderNameAvailable,
  isFolderEmpty,
  validateFolderName,
} from '@/domain/services/file-folder-service'
import type { DemoStore } from './store'
import { createId } from './store'
import { listFiles, listFolders } from './selectors'

export class DemoFileFolderRepository implements FileFolderRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async list(workspaceId: string): Promise<FileFolder[]> {
    return listFolders(this.store.getState(), workspaceId)
  }

  subscribe(workspaceId: string, callback: Subscriber<FileFolder[]>): Unsubscribe {
    const emit = () => callback(listFolders(this.store.getState(), workspaceId))
    emit()
    return this.store.subscribe(emit)
  }

  async create(input: FolderInput): Promise<FileFolder> {
    const name = validateFolderName(input.name)
    const parentId = input.parentId ?? null
    const folders = listFolders(this.store.getState(), input.workspaceId)
    if (parentId && !folders.some((f) => f.id === parentId)) {
      throw new ValidationError('La carpeta de destino no existe.')
    }
    assertFolderNameAvailable(folders, name, parentId)
    const now = new Date().toISOString()
    const folder: FileFolder = {
      id: createId('folder'),
      workspaceId: input.workspaceId,
      name,
      parentId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    }
    this.store.commit((draft) => {
      draft.folders[folder.id] = folder
    })
    return folder
  }

  async update(
    workspaceId: string,
    folderId: string,
    patch: Pick<FileFolder, 'name'> & { parentId?: string | null },
  ): Promise<void> {
    const folders = listFolders(this.store.getState(), workspaceId)
    const folder = folders.find((item) => item.id === folderId)
    if (!folder) throw new NotFoundError('La carpeta no existe.')
    const name = validateFolderName(patch.name)
    const nextParentId = patch.parentId !== undefined ? patch.parentId : folder.parentId
    assertFolderNameAvailable(folders, name, nextParentId, folderId)
    if (patch.parentId !== undefined) {
      assertCanMoveFolder(folders, folderId, patch.parentId)
    }
    this.store.commit((draft) => {
      const target = draft.folders[folderId]
      if (!target) return
      target.name = name
      if (patch.parentId !== undefined) target.parentId = patch.parentId
      target.updatedAt = new Date().toISOString()
    })
  }

  async remove(workspaceId: string, folderId: string): Promise<void> {
    const state = this.store.getState()
    const folders = listFolders(state, workspaceId)
    if (!folders.some((folder) => folder.id === folderId)) {
      throw new NotFoundError('La carpeta no existe.')
    }
    const files = listFiles(state, workspaceId)
    const activeFolderIds = files
      .filter((file) => !file.trashedAt)
      .map((file) => file.folderId)
    if (!isFolderEmpty(folderId, folders, activeFolderIds)) {
      throw new ConflictError('Mueve o elimina el contenido antes de borrar la carpeta.')
    }
    this.store.commit((draft) => {
      delete draft.folders[folderId]
    })
  }
}

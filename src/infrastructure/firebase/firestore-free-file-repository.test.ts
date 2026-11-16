import { beforeEach, describe, expect, it, vi } from 'vitest'

const { batchSet, batchDelete, batchCommit } = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async () => {}),
}))

vi.mock('./client', () => ({
  getFirebaseDb: () => ({}),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'workspaces/ws/files' })),
  doc: vi.fn(() => ({ id: 'file-test', path: 'workspaces/ws/files/file-test' })),
  setDoc: vi.fn(async () => {}),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: batchSet,
    delete: batchDelete,
    commit: batchCommit,
  })),
}))

import { getDoc } from 'firebase/firestore'
import { FirestoreFreeFileRepository } from './firestore-free-file-repository'
import { FREE_FILE_SIZE_LIMIT } from '@/domain/services/file-service'

const repository = new FirestoreFreeFileRepository()

describe('FirestoreFreeFileRepository', () => {
  beforeEach(() => {
    batchSet.mockClear()
    batchDelete.mockClear()
    batchCommit.mockClear()
  })

  it('separa metadatos y contenido, y devuelve un data URL temporal', async () => {
    const progress: number[] = []
    const file = await repository.upload(
      'ws',
      {
        name: 'nota.txt',
        size: 11,
        contentType: 'text/plain',
        data: new Blob(['hola mundo!'], { type: 'text/plain' }),
      },
      'alice',
      { folderId: 'folder-1', onProgress: (value) => progress.push(value) },
    )
    expect(file.id).toBe('file-test')
    expect(file.url).toMatch(/^data:text\/plain;base64,/)
    expect(file.path).toBe('firestore://file-test')
    expect(file.folderId).toBe('folder-1')
    expect(file.backend).toBe('firestore')
    expect(progress.at(-1)).toBe(100)
    expect(batchSet).toHaveBeenCalledTimes(2)
    expect(batchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'nota.txt',
        uploadedBy: 'alice',
        size: 11,
        folderId: 'folder-1',
        backend: 'firestore',
      }),
    )
    expect(batchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: expect.stringMatching(/^data:/) }),
    )
    expect(batchCommit).toHaveBeenCalled()
  })

  it('resuelve el contenido bajo demanda y lee texto', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ data: 'data:text/plain;base64,aG9sYQ==' }),
    } as never)
    const file = {
      id: 'file-read',
      workspaceId: 'ws',
      name: 'nota.txt',
      path: 'firestore://file-read',
      url: '',
      size: 4,
      contentType: 'text/plain',
      uploadedBy: 'alice',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      folderId: null,
      trashedAt: null,
      backend: 'firestore' as const,
    }
    const url = await repository.getDownloadUrl('ws', file)
    expect(url).toBe('data:text/plain;base64,aG9sYQ==')
    vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => 'hola' })))
    await expect(repository.readText('ws', file)).resolves.toBe('hola')
    vi.unstubAllGlobals()
  })

  it('rechaza archivos que superan el límite gratuito y ejecutables', async () => {
    await expect(
      repository.upload(
        'ws',
        {
          name: 'grande.zip',
          size: FREE_FILE_SIZE_LIMIT + 1,
          contentType: 'application/zip',
          data: new Blob(['x']),
        },
        'alice',
      ),
    ).rejects.toThrow('modo gratuito')

    await expect(
      repository.upload(
        'ws',
        {
          name: 'virus.exe',
          size: 10,
          contentType: 'application/octet-stream',
          data: new Blob(['x']),
        },
        'alice',
      ),
    ).rejects.toThrow('ejecutables')
  })
})

import { describe, expect, it } from 'vitest'
import type { FileFolder, FileMeta } from '@/domain/entities/chat'
import { collectFolderArchive, folderArchiveName } from './file-archive-service'

function folder(overrides: Partial<FileFolder> & Pick<FileFolder, 'id' | 'name'>): FileFolder {
  return {
    workspaceId: 'ws',
    parentId: null,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function file(
  overrides: Partial<FileMeta> & Pick<FileMeta, 'id' | 'name' | 'folderId'>,
): FileMeta {
  return {
    workspaceId: 'ws',
    path: 'firestore://x',
    url: '',
    size: 10,
    contentType: 'text/plain',
    uploadedBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    trashedAt: null,
    backend: 'firestore',
    ...overrides,
  }
}

describe('file-archive-service', () => {
  it('recorre subcarpetas y conserva rutas relativas', () => {
    const folders = [
      folder({ id: 'f1', name: 'Proyectos' }),
      folder({ id: 'f2', name: 'Diseños', parentId: 'f1' }),
      folder({ id: 'f3', name: 'Otra', parentId: null }),
    ]
    const files = [
      file({ id: 'a', name: 'brief.pdf', folderId: 'f1' }),
      file({ id: 'b', name: 'logo.png', folderId: 'f2' }),
      file({ id: 'c', name: 'fuera.txt', folderId: 'f3' }),
      file({ id: 'd', name: 'raíz.txt', folderId: null }),
    ]

    expect(collectFolderArchive(folders, files, 'f1').map((entry) => entry.path)).toEqual([
      'brief.pdf',
      'Diseños/logo.png',
    ])
  })

  it('ignora archivos en la papelera y evita ciclos', () => {
    const folders = [
      folder({ id: 'f1', name: 'A' }),
      folder({ id: 'f2', name: 'B', parentId: 'f1' }),
    ]
    // Ciclo defensivo: f1 apunta a f2.
    folders[0] = { ...folders[0], parentId: 'f2' }
    const files = [
      file({ id: 'a', name: 'ok.txt', folderId: 'f1' }),
      file({ id: 'b', name: 'borrado.txt', folderId: 'f2', trashedAt: '2026-01-02T00:00:00.000Z' }),
    ]

    expect(collectFolderArchive(folders, files, 'f1').map((entry) => entry.path)).toEqual([
      'ok.txt',
    ])
  })

  it('sanea nombres y desambigua duplicados', () => {
    const folders = [folder({ id: 'f1', name: 'Carpeta' })]
    const files = [
      file({ id: 'a', name: 'nota.txt', folderId: 'f1' }),
      file({ id: 'b', name: 'nota.txt', folderId: 'f1' }),
      file({ id: 'c', name: '../secreto?.txt', folderId: 'f1' }),
    ]

    expect(collectFolderArchive(folders, files, 'f1').map((entry) => entry.path)).toEqual([
      'nota.txt',
      'nota (2).txt',
      'secreto.txt',
    ])
  })

  it('genera un nombre de ZIP válido', () => {
    expect(folderArchiveName('Proyectos / 2026')).toBe('Proyectos - 2026.zip')
    expect(folderArchiveName('Diseños')).toBe('Diseños.zip')
    expect(folderArchiveName('   ')).toBe('carpeta.zip')
  })
})

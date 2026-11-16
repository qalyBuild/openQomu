import { describe, expect, it } from 'vitest'
import type { FileFolder } from '@/domain/entities/chat'
import {
  assertCanMoveFolder,
  assertFolderNameAvailable,
  buildFolderTree,
  descendantFolderIds,
  folderBreadcrumb,
  folderNameKey,
  isFolderEmpty,
  splitUploadPath,
  validateFolderName,
} from './file-folder-service'

function folder(id: string, parentId: string | null = null, name = id): FileFolder {
  return {
    id,
    workspaceId: 'ws',
    name,
    parentId,
    createdBy: 'u1',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  }
}

describe('file-folder-service', () => {
  it('valida nombres de carpeta', () => {
    expect(validateFolderName('  Diseño  ')).toBe('Diseño')
    expect(validateFolderName('  dos   palabras ')).toBe('dos palabras')
    expect(() => validateFolderName('   ')).toThrow('nombre')
    expect(() => validateFolderName('x'.repeat(61))).toThrow('largo')
    expect(() => validateFolderName('a/b')).toThrow('no puede contener')
    expect(() => validateFolderName('a\\b')).toThrow('no puede contener')
    expect(() => validateFolderName('..')).toThrow('no es válido')
    expect(folderNameKey('Diseño')).toBe('diseno')
  })

  it('evita carpetas duplicadas en el mismo nivel', () => {
    const folders = [folder('a', null, 'Diseño'), folder('b', 'a', 'Beta'), folder('c', null, 'Docs')]
    expect(() => assertFolderNameAvailable(folders, 'diseno', null)).toThrow('Ya existe')
    expect(() => assertFolderNameAvailable(folders, 'Diseño', null, 'a')).not.toThrow()
    expect(() => assertFolderNameAvailable(folders, 'Beta', 'a')).toThrow('Ya existe')
    expect(() => assertFolderNameAvailable(folders, 'Beta', null)).not.toThrow()
  })

  it('construye y ordena el árbol', () => {
    const tree = buildFolderTree([
      folder('b', 'a', 'Beta'),
      folder('a', null, 'Alfa'),
      folder('c', null, 'Carpeta'),
      folder('d', 'a', 'Diseño'),
    ])
    expect(tree.map((node) => node.id)).toEqual(['a', 'c'])
    expect(tree[0].children.map((node) => node.id)).toEqual(['b', 'd'])
  })

  it('detecta descendientes y evita ciclos', () => {
    const folders = [folder('a'), folder('b', 'a'), folder('c', 'b'), folder('d')]
    expect(descendantFolderIds(folders, 'a').sort()).toEqual(['b', 'c'])
    expect(() => assertCanMoveFolder(folders, 'a', 'a')).toThrow('sí misma')
    expect(() => assertCanMoveFolder(folders, 'a', 'c')).toThrow('subcarpeta')
    expect(() => assertCanMoveFolder(folders, 'a', 'missing')).toThrow('no existe')
    expect(() => assertCanMoveFolder(folders, 'a', 'd')).not.toThrow()
    expect(() => assertCanMoveFolder(folders, 'a', null)).not.toThrow()
  })

  it('genera breadcrumbs y detecta carpetas vacías', () => {
    const folders = [folder('a'), folder('b', 'a'), folder('c', 'b')]
    expect(folderBreadcrumb(folders, 'c').map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(isFolderEmpty('c', folders, [null])).toBe(true)
    expect(isFolderEmpty('b', folders, [null])).toBe(false)
    expect(isFolderEmpty('c', folders, [null, 'c'])).toBe(false)
  })

  it('divide rutas relativas de subida', () => {
    expect(splitUploadPath('Proyecto/src/app.ts')).toEqual({
      folders: ['Proyecto', 'src'],
      fileName: 'app.ts',
    })
    expect(splitUploadPath('foto.png')).toEqual({ folders: [], fileName: 'foto.png' })
    expect(splitUploadPath('Proyecto/assets/')).toEqual({
      folders: ['Proyecto', 'assets'],
      fileName: '',
    })
    expect(splitUploadPath('//Proyecto//.//vacía/')).toEqual({
      folders: ['Proyecto', 'vacía'],
      fileName: '',
    })
  })
})

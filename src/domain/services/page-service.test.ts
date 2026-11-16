import { describe, expect, it } from 'vitest'
import type { Page } from '@/domain/entities/pages'
import { EMPTY_PAGE_CONTENT } from '@/domain/entities/pages'
import {
  assertCanMovePage,
  buildPageTree,
  countWords,
  descendantIds,
  flattenPageTree,
  pageBreadcrumb,
  textFromContent,
  titleFromContent,
} from './page-service'

function page(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    workspaceId: 'ws',
    title: `Página ${id}`,
    icon: '📄',
    content: EMPTY_PAGE_CONTENT,
    parentId: null,
    createdBy: 'u1',
    createdAt: `2026-11-0${id.length}T10:00:00.000Z`,
    updatedAt: '2026-11-12T10:00:00.000Z',
    updatedBy: 'u1',
    archived: false,
    ...overrides,
  }
}

const doc = (text: string) =>
  JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', content: [{ type: 'text', text }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Segundo bloque con palabras' }] },
    ],
  })

describe('page-service', () => {
  it('extrae título y palabras del contenido TipTap', () => {
    expect(titleFromContent(doc('Roadmap Q4'))).toBe('Roadmap Q4')
    expect(countWords(doc('Roadmap Q4'))).toBe(6)
    expect(titleFromContent(EMPTY_PAGE_CONTENT)).toBe('Sin título')
    expect(textFromContent('<p>Hola <b>mundo</b></p>')).toBe('Hola mundo')
  })

  it('construye un árbol de páginas ordenado', () => {
    const pages = [
      page('a'),
      page('b', { parentId: 'a' }),
      page('c', { parentId: 'a' }),
      page('d'),
      page('archived', { archived: true }),
    ]
    const tree = buildPageTree(pages)
    expect(tree).toHaveLength(2)
    expect(tree[0].children.map((child) => child.id)).toEqual(['b', 'c'])
    expect(flattenPageTree(tree).map((node) => `${node.id}:${node.depth}`)).toEqual([
      'a:0',
      'b:1',
      'c:1',
      'd:0',
    ])
  })

  it('detecta descendientes y evita ciclos al mover', () => {
    const pages = [
      page('a'),
      page('b', { parentId: 'a' }),
      page('c', { parentId: 'b' }),
      page('d'),
    ]
    expect(descendantIds(pages, 'a').sort()).toEqual(['b', 'c'])
    expect(() => assertCanMovePage(pages, 'a', 'a')).toThrow('propio padre')
    expect(() => assertCanMovePage(pages, 'a', 'c')).toThrow('subpáginas')
    expect(() => assertCanMovePage(pages, 'a', 'missing')).toThrow('no existe')
    expect(() => assertCanMovePage(pages, 'd', 'a')).not.toThrow()
    expect(() => assertCanMovePage(pages, 'a', null)).not.toThrow()
  })

  it('genera breadcrumbs sin bucles infinitos', () => {
    const pages = [
      page('a'),
      page('b', { parentId: 'a' }),
      page('c', { parentId: 'b' }),
      page('loop1', { parentId: 'loop2' }),
      page('loop2', { parentId: 'loop1' }),
    ]
    expect(pageBreadcrumb(pages, 'c').map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(pageBreadcrumb(pages, 'loop1').length).toBeLessThanOrEqual(2)
  })
})

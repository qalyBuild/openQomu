import type { Page, PageNode } from '@/domain/entities/pages'
import { ValidationError } from '@/domain/errors'

interface TextNode {
  type?: string
  text?: string
  content?: TextNode[]
}

function parseContent(content: string): TextNode | null {
  try {
    return JSON.parse(content) as TextNode
  } catch {
    return null
  }
}

function collectText(node: TextNode | null, parts: string[]): void {
  if (!node) return
  if (typeof node.text === 'string' && node.text.length > 0) parts.push(node.text)
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectText(child, parts)
  }
}

/** Texto del primer bloque (heading/paragraph) no vacío. */
function firstBlockText(node: TextNode | null): string {
  if (!node) return ''
  const isBlock = node.type === 'heading' || node.type === 'paragraph' || node.type === 'listItem'
  if (isBlock && Array.isArray(node.content)) {
    const parts: string[] = []
    collectText(node, parts)
    const text = parts.join(' ').replace(/\s+/g, ' ').trim()
    if (text) return text
  }
  for (const child of node.content ?? []) {
    const text = firstBlockText(child)
    if (text) return text
  }
  return ''
}


export function textFromContent(content: string): string {
  const parsed = parseContent(content)
  if (parsed) {
    const parts: string[] = []
    collectText(parsed, parts)
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }
  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function titleFromContent(content: string, fallback = 'Sin título'): string {
  const parsed = parseContent(content)
  const text = parsed ? firstBlockText(parsed) : textFromContent(content)
  if (!text) return fallback
  return text.length > 80 ? `${text.slice(0, 79)}…` : text
}

export function countWords(content: string): number {
  const text = textFromContent(content)
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

export function buildPageTree(pages: Page[]): PageNode[] {
  const active = pages.filter((page) => !page.archived)
  const nodes = new Map<string, PageNode>()
  for (const page of active) nodes.set(page.id, { ...page, children: [] })

  const roots: PageNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }

  const sortNodes = (list: PageNode[]) => {
    list.sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title, 'es'),
    )
    for (const node of list) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}

export function flattenPageTree(nodes: PageNode[], depth = 0): Array<PageNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenPageTree(node.children, depth + 1),
  ])
}

export function descendantIds(pages: Page[], pageId: string): string[] {
  const children = pages.filter((page) => page.parentId === pageId && page.id !== pageId)
  return children.flatMap((child) => [child.id, ...descendantIds(pages, child.id)])
}

export function assertCanMovePage(
  pages: Page[],
  pageId: string,
  nextParentId: string | null,
): void {
  if (nextParentId === null) return
  if (nextParentId === pageId) {
    throw new ValidationError('Una página no puede ser su propio padre.')
  }
  const parent = pages.find((page) => page.id === nextParentId && !page.archived)
  if (!parent) throw new ValidationError('La página de destino no existe.')
  if (descendantIds(pages, pageId).includes(nextParentId)) {
    throw new ValidationError('No puedes mover una página dentro de una de sus subpáginas.')
  }
}

export function pageBreadcrumb(pages: Page[], pageId: string): Page[] {
  const trail: Page[] = []
  const seen = new Set<string>()
  let current = pages.find((page) => page.id === pageId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    trail.unshift(current)
    current = current.parentId
      ? pages.find((page) => page.id === current?.parentId)
      : undefined
  }
  return trail
}

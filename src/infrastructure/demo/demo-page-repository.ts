import type {
  PageRepository,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Page, PageDraftInput } from '@/domain/entities/pages'
import { EMPTY_PAGE_CONTENT } from '@/domain/entities/pages'
import { NotFoundError, ValidationError } from '@/domain/errors'
import { assertCanMovePage } from '@/domain/services/page-service'
import type { DemoStore } from './store'
import { createId } from './store'
import { getWorkspace, listPages } from './selectors'

function validateTitle(title: string): string {
  const trimmed = title.trim()
  if (trimmed.length > 160) throw new ValidationError('El título es demasiado largo.')
  return trimmed || 'Sin título'
}

export class DemoPageRepository implements PageRepository {
  private readonly store: DemoStore

  constructor(store: DemoStore) {
    this.store = store
  }

  async list(workspaceId: string): Promise<Page[]> {
    return listPages(this.store.getState(), workspaceId)
  }

  subscribe(workspaceId: string, callback: Subscriber<Page[]>): Unsubscribe {
    const emit = () => callback(listPages(this.store.getState(), workspaceId))
    emit()
    return this.store.subscribe(emit)
  }

  async create(input: PageDraftInput): Promise<Page> {
    if (!getWorkspace(this.store.getState(), input.workspaceId)) {
      throw new NotFoundError('El espacio de trabajo no existe.')
    }
    const pages = listPages(this.store.getState(), input.workspaceId)
    const parentId = input.parentId ?? null
    if (parentId) {
      const fake: Page = {
        id: 'new',
        workspaceId: input.workspaceId,
        title: '',
        icon: '',
        content: '',
        parentId: null,
        createdBy: input.createdBy,
        createdAt: '',
        updatedAt: '',
        updatedBy: '',
        archived: false,
      }
      assertCanMovePage([...pages, fake], 'new', parentId)
    }
    const now = new Date().toISOString()
    const page: Page = {
      id: createId('page'),
      workspaceId: input.workspaceId,
      title: validateTitle(input.title),
      icon: input.icon || '📄',
      content: input.content ?? EMPTY_PAGE_CONTENT,
      parentId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      updatedBy: input.updatedBy ?? input.createdBy,
      archived: false,
    }
    this.store.commit((draft) => {
      draft.pages[page.id] = page
    })
    return page
  }

  async update(
    workspaceId: string,
    pageId: string,
    patch: Partial<Pick<Page, 'title' | 'icon' | 'content' | 'parentId' | 'archived'>> & {
      updatedBy: string
    },
  ): Promise<void> {
    const page = this.store.getState().pages[pageId]
    if (!page || page.workspaceId !== workspaceId) {
      throw new NotFoundError('La página no existe.')
    }
    if (patch.parentId !== undefined) {
      assertCanMovePage(listPages(this.store.getState(), workspaceId), pageId, patch.parentId)
    }
    this.store.commit((draft) => {
      const target = draft.pages[pageId]
      if (!target) return
      if (patch.title !== undefined) target.title = validateTitle(patch.title)
      if (patch.icon !== undefined) target.icon = patch.icon
      if (patch.content !== undefined) target.content = patch.content
      if (patch.parentId !== undefined) target.parentId = patch.parentId
      if (patch.archived !== undefined) target.archived = patch.archived
      target.updatedBy = patch.updatedBy
      target.updatedAt = new Date().toISOString()
    })
  }

  async remove(workspaceId: string, pageId: string): Promise<void> {
    const page = this.store.getState().pages[pageId]
    if (!page || page.workspaceId !== workspaceId) {
      throw new NotFoundError('La página no existe.')
    }
    // Las subpáginas no se borran: pasan a ser páginas raíz.
    this.store.commit((draft) => {
      const target = draft.pages[pageId]
      if (target) {
        target.archived = true
        target.updatedAt = new Date().toISOString()
      }
    })
  }
}

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import type {
  PageRepository,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import type { Page, PageDraftInput } from '@/domain/entities/pages'
import { EMPTY_PAGE_CONTENT } from '@/domain/entities/pages'
import { ValidationError } from '@/domain/errors'
import { assertCanMovePage } from '@/domain/services/page-service'
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'
import { mapPage } from './mappers'

function db() {
  return getFirebaseDb()
}

function pagesCol(workspaceId: string) {
  return collection(db(), 'workspaces', workspaceId, 'pages')
}

function pageRef(workspaceId: string, pageId: string) {
  return doc(db(), 'workspaces', workspaceId, 'pages', pageId)
}

function validateTitle(title: string): string {
  const trimmed = title.trim()
  if (trimmed.length > 160) throw new ValidationError('El título es demasiado largo.')
  return trimmed || 'Sin título'
}

export class FirebasePageRepository implements PageRepository {
  async list(workspaceId: string): Promise<Page[]> {
    const snapshot = await getDocs(query(pagesCol(workspaceId), orderBy('createdAt', 'asc')))
    return snapshot.docs.map((document) =>
      mapPage(document.id, workspaceId, document.data()),
    )
  }

  subscribe(workspaceId: string, callback: Subscriber<Page[]>): Unsubscribe {
    return onSnapshot(
      query(pagesCol(workspaceId), orderBy('createdAt', 'asc')),
      (snapshot) => {
        callback(
          snapshot.docs.map((document) =>
            mapPage(document.id, workspaceId, document.data()),
          ),
        )
      },
      (error) => console.error('[openqomu] pages snapshot', error),
    )
  }

  async create(input: PageDraftInput): Promise<Page> {
    const pages = await this.list(input.workspaceId)
    const parentId = input.parentId ?? null
    if (parentId) {
      assertCanMovePage(
        [
          ...pages,
          {
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
          },
        ],
        'new',
        parentId,
      )
    }
    const now = nowIso()
    const content = input.content ?? EMPTY_PAGE_CONTENT
    const reference = await addDoc(pagesCol(input.workspaceId), {
      title: validateTitle(input.title),
      icon: input.icon || '📄',
      content,
      parentId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      updatedBy: input.updatedBy ?? input.createdBy,
      archived: false,
    })
    return {
      id: reference.id,
      workspaceId: input.workspaceId,
      title: validateTitle(input.title),
      icon: input.icon || '📄',
      content,
      parentId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      updatedBy: input.updatedBy ?? input.createdBy,
      archived: false,
    }
  }

  async update(
    workspaceId: string,
    pageId: string,
    patch: Partial<Pick<Page, 'title' | 'icon' | 'content' | 'parentId' | 'archived'>> & {
      updatedBy: string
    },
  ): Promise<void> {
    if (patch.parentId !== undefined) {
      const pages = await this.list(workspaceId)
      assertCanMovePage(pages, pageId, patch.parentId)
    }
    const data: Record<string, unknown> = {
      updatedBy: patch.updatedBy,
      updatedAt: nowIso(),
    }
    if (patch.title !== undefined) data.title = validateTitle(patch.title)
    if (patch.icon !== undefined) data.icon = patch.icon
    if (patch.content !== undefined) data.content = patch.content
    if (patch.parentId !== undefined) data.parentId = patch.parentId
    if (patch.archived !== undefined) data.archived = patch.archived
    await updateDoc(pageRef(workspaceId, pageId), data)
  }

  async remove(workspaceId: string, pageId: string): Promise<void> {
    // Las subpáginas no se archivan: al perder el padre pasan a ser raíz.
    await updateDoc(pageRef(workspaceId, pageId), {
      archived: true,
      updatedAt: nowIso(),
    })
  }
}

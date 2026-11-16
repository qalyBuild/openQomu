export interface Page {
  id: string
  workspaceId: string
  title: string
  icon: string
  content: string
  parentId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  updatedBy: string
  archived: boolean
}

export interface PageNode extends Page {
  children: PageNode[]
}

export interface PageDraftInput {
  workspaceId: string
  title: string
  icon?: string
  parentId?: string | null
  createdBy: string
  content?: string
  updatedBy?: string
}

/** Documento TipTap vacío (JSON serializado). */
export const EMPTY_PAGE_CONTENT = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph' }],
})

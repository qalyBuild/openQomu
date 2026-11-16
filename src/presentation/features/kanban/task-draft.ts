import type { Priority } from '@/domain/entities/identity'

export interface TaskDraft {
  title: string
  description: string
  columnId: string
  priority: Priority
  dueDate: string
  assignees: string[]
  dependsOnTaskIds: string[]
  labels: string[]
  attachmentIds: string[]
}

const drafts = new Map<string, TaskDraft>()

function cloneDraft(draft: TaskDraft): TaskDraft {
  return {
    ...draft,
    assignees: [...draft.assignees],
    labels: [...draft.labels],
    attachmentIds: [...(draft.attachmentIds ?? [])],
  }
}

export function getTaskDraft(boardId: string): TaskDraft | null {
  const draft = drafts.get(boardId)
  return draft ? cloneDraft(draft) : null
}

export function saveTaskDraft(boardId: string, draft: TaskDraft): void {
  drafts.set(boardId, cloneDraft(draft))
}

export function clearTaskDraft(boardId: string): void {
  drafts.delete(boardId)
}

export function createEmptyTaskDraft(columnId: string, uid: string | null): TaskDraft {
  return {
    title: '',
    description: '',
    columnId,
    priority: 'medium',
    dueDate: '',
    assignees: uid ? [uid] : [],
    dependsOnTaskIds: [],
    labels: [],
    attachmentIds: [],
  }
}

export function hasTaskDraftContent(draft: TaskDraft, uid: string | null): boolean {
  return (
    draft.title.trim() !== '' ||
    draft.description.trim() !== '' ||
    draft.priority !== 'medium' ||
    draft.dueDate !== '' ||
    draft.labels.length > 0 ||
    draft.attachmentIds.length > 0 ||
    draft.dependsOnTaskIds.length > 0 ||
    draft.assignees.length !== (uid ? 1 : 0) ||
    (uid !== null && !draft.assignees.includes(uid))
  )
}

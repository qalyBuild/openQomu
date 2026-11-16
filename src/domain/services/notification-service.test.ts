import { describe, expect, it } from 'vitest'
import type { Message } from '@/domain/entities/chat'
import type { Task, TaskComment } from '@/domain/entities/kanban'
import { DEFAULT_BOARD_COLUMNS } from '@/domain/entities/kanban'
import type { Member } from '@/domain/entities/identity'
import type { Page } from '@/domain/entities/pages'
import type { FileMeta } from '@/domain/entities/chat'
import {
  collectActivityNotifications,
  collectCommentNotifications,
  collectMessageNotifications,
  collectTaskNotifications,
  newNotificationIds,
  notificationKey,
  summarizeNotifications,
} from './notification-service'

const ME = 'uid-me'
const OTHER = 'uid-other'

function message(overrides: Partial<Message> & Pick<Message, 'id' | 'createdAt'>): Message {
  return {
    workspaceId: 'w1',
    channelId: 'c1',
    authorId: OTHER,
    authorName: 'Otra Persona',
    authorPhotoURL: null,
    body: 'Hola',
    editedAt: null,
    deletedAt: null,
    attachmentIds: [],
    reactions: {},
    replyToId: null,
    ...overrides,
  }
}

function task(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    workspaceId: 'w1',
    boardId: 'b1',
    title: `Tarea ${overrides.id}`,
    description: '',
    columnId: 'todo',
    order: 0,
    assigneeIds: [],
    reviewerId: null,
    dependsOnTaskIds: [],
    priority: 'medium',
    dueDate: null,
    labels: [],
    attachmentIds: [],
    createdBy: OTHER,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  }
}

function comment(
  overrides: Partial<TaskComment> & Pick<TaskComment, 'id' | 'createdAt'>,
): TaskComment {
  return {
    workspaceId: 'w1',
    boardId: 'b1',
    taskId: 't1',
    authorId: OTHER,
    authorName: 'Otra Persona',
    authorPhotoURL: null,
    body: 'Comentario',
    ...overrides,
  }
}

describe('collectMessageNotifications', () => {
  const channels = [
    { id: 'c1', name: 'general' },
    { id: 'c2', name: 'producto' },
  ]

  it('cuenta solo los mensajes ajenos y no borrados posteriores a la última lectura', () => {
    const messagesByChannel = {
      c1: [
        message({ id: 'm1', createdAt: '2026-01-01T09:00:00.000Z' }),
        message({ id: 'm2', createdAt: '2026-01-01T10:00:00.000Z' }),
        message({ id: 'm3', createdAt: '2026-01-01T11:00:00.000Z', authorId: ME }),
        message({ id: 'm4', createdAt: '2026-01-01T12:00:00.000Z', deletedAt: '2026-01-01T13:00:00.000Z' }),
      ],
    }

    const items = collectMessageNotifications({
      channels,
      messagesByChannel,
      lastReadByChannel: { c1: '2026-01-01T09:30:00.000Z' },
      uid: ME,
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'message:c1:m2',
      kind: 'message',
      section: 'chat',
      targetId: 'c1',
      count: 1,
      to: '/c/c1',
    })
  })

  it('marca las menciones y usa el mensaje más reciente como id', () => {
    const items = collectMessageNotifications({
      channels,
      messagesByChannel: {
        c1: [
          message({ id: 'm1', createdAt: '2026-01-01T10:00:00.000Z' }),
          message({
            id: 'm2',
            createdAt: '2026-01-01T10:05:00.000Z',
            body: 'Oye @Ana, revisa esto',
          }),
        ],
      },
      lastReadByChannel: { c1: '2026-01-01T09:00:00.000Z' },
      uid: ME,
      displayName: 'Ana',
    })

    expect(items[0]).toMatchObject({
      id: 'message:c1:m2',
      kind: 'mention',
      count: 2,
      title: '2 mensajes nuevos en #general',
    })
  })

  it('reconoce menciones sin tilde y por nombre de pila', () => {
    const items = collectMessageNotifications({
      channels,
      messagesByChannel: {
        c1: [
          message({
            id: 'm1',
            createdAt: '2026-01-01T10:05:00.000Z',
            body: 'Oye @emerito, revisa esto',
          }),
        ],
      },
      lastReadByChannel: { c1: '2026-01-01T09:00:00.000Z' },
      uid: ME,
      displayName: 'Emérito',
    })
    expect(items[0].kind).toBe('mention')

    const firstNames = collectMessageNotifications({
      channels,
      messagesByChannel: {
        c1: [
          message({
            id: 'm2',
            createdAt: '2026-01-01T10:05:00.000Z',
            body: 'Hola @ernesto',
          }),
        ],
      },
      lastReadByChannel: { c1: '2026-01-01T09:00:00.000Z' },
      uid: ME,
      displayName: 'Ernesto Rippl',
    })
    expect(firstNames[0].kind).toBe('mention')
  })

  it('omite canales sin novedades', () => {
    const items = collectMessageNotifications({
      channels,
      messagesByChannel: { c1: [], c2: [] },
      lastReadByChannel: {},
      uid: ME,
    })
    expect(items).toEqual([])
  })
})

describe('collectTaskNotifications', () => {
  it('avisa de tareas asignadas, en revisión y vencidas sin duplicarlas', () => {
    const items = collectTaskNotifications({
      tasks: [
        task({ id: 't-assigned', assigneeIds: [ME] }),
        task({ id: 't-review', reviewerId: ME, columnId: 'review' }),
        task({ id: 't-review-other', reviewerId: OTHER, assigneeIds: [ME], columnId: 'review' }),
        task({ id: 't-review-nobody', assigneeIds: [ME], columnId: 'review' }),
        task({ id: 't-reviewer-todo', reviewerId: ME }),
        task({ id: 't-overdue', assigneeIds: [ME], dueDate: '2020-01-01' }),
        task({ id: 't-done', assigneeIds: [ME], columnId: 'done' }),
        task({ id: 't-paused', assigneeIds: [ME], priority: 'paused' }),
        task({ id: 't-dependents', assigneeIds: [ME], columnId: 'dependents' }),
        task({ id: 't-other', assigneeIds: [OTHER] }),
      ],
      columnsByBoard: { b1: DEFAULT_BOARD_COLUMNS },
      uid: ME,
      now: new Date('2026-01-01T12:00:00.000Z'),
    })

    expect(items.map((item) => item.id)).toEqual([
      'task:t-assigned:assigned',
      'task:t-review:review',
      'task:t-overdue:overdue',
    ])
    expect(items[1]).toMatchObject({
      kind: 'review',
      section: 'boards',
      targetId: 'b1',
      to: '/boards/b1?task=t-review',
    })
  })

  it('tampoco avisa de tareas en una columna llamada Dependientes', () => {
    const items = collectTaskNotifications({
      tasks: [
        task({ id: 't-custom', assigneeIds: [ME], columnId: 'col-deps' }),
        task({ id: 't-review', reviewerId: ME, columnId: 'col-deps' }),
      ],
      columnsByBoard: {
        b1: [
          { id: 'col-deps', name: 'Dependientes', color: '#f59e0b', isDone: false },
          { id: 'todo', name: 'Por hacer', color: '#94a3b8', isDone: false },
        ],
      },
      uid: ME,
    })

    expect(items).toEqual([])
  })
})

describe('collectCommentNotifications', () => {
  it('cuenta comentarios nuevos en tareas asignadas a mí, sin los propios', () => {
    const items = collectCommentNotifications({
      tasks: [
        task({ id: 't1', assigneeIds: [ME] }),
        task({ id: 't2', assigneeIds: [OTHER] }),
      ],
      commentsByTask: {
        t1: [
          comment({ id: 'c1', taskId: 't1', createdAt: '2026-01-01T10:00:00.000Z' }),
          comment({ id: 'c2', taskId: 't1', createdAt: '2026-01-01T11:00:00.000Z', authorId: ME }),
          comment({ id: 'c3', taskId: 't1', createdAt: '2026-01-01T12:00:00.000Z' }),
        ],
        t2: [comment({ id: 'c4', taskId: 't2', createdAt: '2026-01-01T12:00:00.000Z' })],
      },
      lastReadAt: '2026-01-01T09:00:00.000Z',
      uid: ME,
      displayName: 'Ana',
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'comment:t1:c3',
      kind: 'comment',
      section: 'boards',
      targetId: 'b1',
      count: 2,
      to: '/boards/b1?task=t1',
    })
  })
})

describe('collectActivityNotifications', () => {
  const pages: Page[] = [
    {
      id: 'p1',
      workspaceId: 'w1',
      title: 'Nueva',
      icon: '📄',
      content: '',
      parentId: null,
      createdBy: OTHER,
      createdAt: '2026-01-01T11:00:00.000Z',
      updatedAt: '2026-01-01T11:00:00.000Z',
      updatedBy: OTHER,
      archived: false,
    },
    {
      id: 'p2',
      workspaceId: 'w1',
      title: 'Vieja',
      icon: '📄',
      content: '',
      parentId: null,
      createdBy: OTHER,
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: '2026-01-01T08:00:00.000Z',
      updatedBy: OTHER,
      archived: false,
    },
    {
      id: 'p3',
      workspaceId: 'w1',
      title: 'Mía',
      icon: '📄',
      content: '',
      parentId: null,
      createdBy: ME,
      createdAt: '2026-01-01T11:30:00.000Z',
      updatedAt: '2026-01-01T11:30:00.000Z',
      updatedBy: ME,
      archived: false,
    },
  ]
  const files: FileMeta[] = [
    {
      id: 'f1',
      workspaceId: 'w1',
      name: 'plan.pdf',
      path: 'plan.pdf',
      url: '',
      size: 10,
      contentType: 'application/pdf',
      uploadedBy: OTHER,
      createdAt: '2026-01-01T11:00:00.000Z',
      updatedAt: '2026-01-01T11:00:00.000Z',
      folderId: null,
      trashedAt: null,
      backend: 'firestore',
    },
  ]
  const members: Member[] = [
    {
      id: 'u1',
      workspaceId: 'w1',
      uid: OTHER,
      role: 'member',
      displayName: 'Otra',
      email: 'otra@example.com',
      photoURL: null,
      joinedAt: '2026-01-01T11:00:00.000Z',
      lastActiveAt: null,
    },
    {
      id: 'u2',
      workspaceId: 'w1',
      uid: ME,
      role: 'member',
      displayName: 'Ana',
      email: 'ana@example.com',
      photoURL: null,
      joinedAt: '2026-01-01T11:00:00.000Z',
      lastActiveAt: null,
    },
  ]

  it('agrupa páginas, archivos y miembros nuevos por sección', () => {
    const items = collectActivityNotifications({
      pages,
      files,
      members,
      uid: ME,
      lastReadAt: {
        pages: '2026-01-01T09:00:00.000Z',
        files: '2026-01-01T09:00:00.000Z',
        members: '2026-01-01T09:00:00.000Z',
      },
    })

    expect(items.map((item) => [item.section, item.count, item.id])).toEqual([
      ['pages', 1, 'page:p1'],
      ['files', 1, 'file:f1'],
      ['members', 1, 'member:u1'],
    ])
  })

  it('no avisa de actividad anterior a la última visita', () => {
    const items = collectActivityNotifications({
      pages,
      files,
      members,
      uid: ME,
      lastReadAt: {
        pages: '2026-01-01T12:00:00.000Z',
        files: '2026-01-01T12:00:00.000Z',
        members: '2026-01-01T12:00:00.000Z',
      },
    })
    expect(items).toEqual([])
  })
})

describe('summarizeNotifications', () => {
  it('suma por destino y por sección y deduplica ids', () => {
    const summary = summarizeNotifications([
      {
        id: 'message:c1:m1',
        kind: 'message',
        section: 'chat',
        targetId: 'c1',
        title: '1 mensaje nuevo',
        count: 3,
        createdAt: '2026-01-01T10:00:00.000Z',
        to: '/c/c1',
      },
      {
        id: 'message:c1:m1',
        kind: 'message',
        section: 'chat',
        targetId: 'c1',
        title: 'duplicado',
        count: 3,
        createdAt: '2026-01-01T10:00:00.000Z',
        to: '/c/c1',
      },
      {
        id: 'task:t1:review',
        kind: 'review',
        section: 'boards',
        targetId: 'b1',
        title: 'Revisar',
        count: 1,
        createdAt: null,
        to: '/boards/b1?task=t1',
      },
    ])

    expect(summary.total).toBe(4)
    expect(summary.byTarget[notificationKey('chat', 'c1')]).toBe(3)
    expect(summary.bySection.chat).toBe(3)
    expect(summary.bySection.boards).toBe(1)
    expect(summary.items).toHaveLength(2)
  })
})

describe('newNotificationIds', () => {
  it('devuelve solo los ids que no se habían visto', () => {
    const ids = newNotificationIds(['a', 'b'], [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ])
    expect(ids).toEqual(['c'])
  })
})

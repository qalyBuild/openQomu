import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContainer } from '@/domain/ports'
import { DemoAuthRepository } from './demo-auth-repository'
import { createDemoContainer } from './index'
import { DemoStore } from './store'
import { DEMO_WORKSPACE_ID } from './seed'

function setup() {
  const store = new DemoStore({ seed: true, persist: false })
  const container = createDemoContainer(store)
  container.auth = new DemoAuthRepository(store, { persistSession: false })
  return { store, container }
}

async function login(container: AppContainer) {
  const user = await container.auth.signInWithGoogle()
  await container.users.ensureProfile(user)
  return user
}

let context: ReturnType<typeof setup>
let container: AppContainer

beforeEach(() => {
  context = setup()
  container = context.container
})

describe('demo auth y perfiles', () => {
  it('inicia sesión, notifica y cierra sesión', async () => {
    const spy = vi.fn()
    const unsubscribe = container.auth.onAuthStateChanged(spy)
    await Promise.resolve()
    expect(spy).toHaveBeenLastCalledWith(null)
    const user = await login(container)
    expect(user.id).toBe('u-alex')
    expect(container.auth.isDemo()).toBe(true)
    expect(container.auth.getCurrentUser()?.displayName).toBe('Alex Rivera')
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'u-alex' }))
    await container.auth.signOut()
    expect(container.auth.getCurrentUser()).toBeNull()
    unsubscribe()
  })

  it('crea y actualiza el perfil', async () => {
    const user = await login(container)
    const profile = await container.users.getProfile(user.id)
    expect(profile?.email).toBe('alex@example.com')
    await container.users.updateProfile(user.id, { displayName: 'Alex R.' })
    const updated = await container.users.getProfile(user.id)
    expect(updated?.displayName).toBe('Alex R.')
    const member = (await container.workspaces.listMembers(DEMO_WORKSPACE_ID)).find(
      (candidate) => candidate.uid === user.id,
    )
    expect(member?.displayName).toBe('Alex R.')
  })

  it('guarda el tema elegido sin tocar el nombre', async () => {
    const user = await login(container)
    await container.users.updateProfile(user.id, { themeId: 'monokai' })
    const updated = await container.users.getProfile(user.id)
    expect(updated?.themeId).toBe('monokai')
    expect(updated?.displayName).toBe('Alex Rivera')
  })
})

describe('demo workspaces e invitaciones', () => {
  it('crea un workspace con owner y lista por usuario', async () => {
    const user = await login(container)
    const workspace = await container.workspaces.create({
      name: '  Studio Norte  ',
      icon: '🎨',
      description: '  Diseño y producto  ',
      owner: user,
    })
    expect(workspace.name).toBe('Studio Norte')
    expect(workspace.memberIds).toEqual([user.id])
    const members = await container.workspaces.listMembers(workspace.id)
    expect(members).toHaveLength(1)
    expect(members[0].role).toBe('owner')
    const list = await container.workspaces.listForUser(user.id)
    expect(list.map((item) => item.id)).toContain(workspace.id)
  })

  it('acepta invitaciones válidas y rechaza caducadas', async () => {
    const owner = await login(container)
    const workspace = await container.workspaces.create({
      name: 'Invita',
      icon: '✉️',
      description: '',
      owner,
    })
    const invite = await container.workspaces.createInvite(workspace.id, owner.id)
    expect(invite.code).toHaveLength(10)

    const guest = {
      id: 'u-guest',
      displayName: 'Gabi Guest',
      email: 'gabi@example.com',
      photoURL: null,
    }
    const joined = await container.workspaces.acceptInvite(invite.code, guest)
    expect(joined.id).toBe(workspace.id)
    const members = await container.workspaces.listMembers(workspace.id)
    expect(members.some((member) => member.uid === guest.id)).toBe(true)
    const updated = await container.workspaces.get(workspace.id)
    expect(updated?.memberIds).toContain(guest.id)

    // Idempotente
    await expect(container.workspaces.acceptInvite(invite.code, guest)).resolves.toBeTruthy()

    const second = await container.workspaces.createInvite(workspace.id, owner.id)
    context.store.commit((draft) => {
      draft.invites[second.code].expiresAt = '2020-01-01T00:00:00.000Z'
    })
    await expect(
      container.workspaces.acceptInvite(second.code, {
        id: 'u-late',
        displayName: 'Late',
        email: 'late@example.com',
        photoURL: null,
      }),
    ).rejects.toThrow('caducado')

    expect(await container.workspaces.listInvites(workspace.id)).toEqual([invite])
    await container.workspaces.revokeInvite(invite.code)
    expect(await container.workspaces.listInvites(workspace.id)).toEqual([])
    await expect(container.workspaces.acceptInvite(invite.code, guest)).rejects.toThrow('no existe')
  })

  it('cambia roles y protege al owner', async () => {
    const workspace = await container.workspaces.create({
      name: 'Roles',
      icon: '🎭',
      description: '',
      owner: await login(container),
    })
    await container.workspaces.addMember(workspace.id, {
      uid: 'u-x',
      role: 'member',
      displayName: 'X',
      email: 'x@example.com',
      photoURL: null,
      joinedAt: new Date().toISOString(),
      lastActiveAt: null,
    })
    await container.workspaces.updateMemberRole(workspace.id, 'u-x', 'admin')
    expect((await container.workspaces.listMembers(workspace.id)).find((m) => m.uid === 'u-x')?.role).toBe(
      'admin',
    )
    await container.workspaces.updateMemberRole(workspace.id, 'u-x', 'owner')
    const after = await container.workspaces.listMembers(workspace.id)
    expect(after.find((m) => m.uid === 'u-x')?.role).toBe('owner')
    expect(after.find((m) => m.uid === 'u-alex')?.role).toBe('admin')
    expect((await container.workspaces.get(workspace.id))?.ownerId).toBe('u-x')
    await expect(container.workspaces.removeMember(workspace.id, 'u-x')).rejects.toThrow('propietario')
  })
})

describe('demo canales y mensajería', () => {
  it('crea canales, evita duplicados y propaga la suscripción', async () => {
    const user = await login(container)
    const received: number[] = []
    const unsubscribe = container.channels.subscribe(DEMO_WORKSPACE_ID, (channels) =>
      received.push(channels.length),
    )
    const initial = received.length
    const channel = await container.channels.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: '#Soporte Técnico',
      description: 'Ayuda',
      type: 'public',
      createdBy: user.id,
    })
    expect(channel.name).toBe('soporte-técnico')
    expect(received.length).toBeGreaterThan(initial)
    await expect(
      container.channels.create({
        workspaceId: DEMO_WORKSPACE_ID,
        name: 'soporte tecnico',
        description: '',
        type: 'public',
        createdBy: user.id,
      }),
    ).rejects.toThrow('ya existe')
    await container.channels.update(DEMO_WORKSPACE_ID, channel.id, { description: 'Soporte 24/7' })
    expect((await container.channels.list(DEMO_WORKSPACE_ID)).find((c) => c.id === channel.id)?.description).toBe(
      'Soporte 24/7',
    )

    const privateChannel = await container.channels.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'privado-test',
      description: '',
      type: 'private',
      createdBy: user.id,
    })
    expect(privateChannel.memberIds).toEqual([user.id])
    await container.channels.update(DEMO_WORKSPACE_ID, privateChannel.id, {
      memberIds: ['u-ana'],
    })
    const updatedPrivate = (await container.channels.list(DEMO_WORKSPACE_ID)).find(
      (c) => c.id === privateChannel.id,
    )
    expect(updatedPrivate?.memberIds).toEqual([user.id, 'u-ana'])

    await container.channels.update(DEMO_WORKSPACE_ID, privateChannel.id, { archived: true })
    expect((await container.channels.list(DEMO_WORKSPACE_ID)).find((c) => c.id === privateChannel.id)?.archived).toBe(
      true,
    )
    unsubscribe()
  })

  it('envía, edita, reacciona y elimina mensajes en tiempo real', async () => {
    const user = await login(container)
    const snapshots: number[] = []
    const unsubscribe = container.messages.subscribe(DEMO_WORKSPACE_ID, 'ch-general', (messages) =>
      snapshots.push(messages.length),
    )
    const sent = await container.messages.send({
      workspaceId: DEMO_WORKSPACE_ID,
      channelId: 'ch-general',
      author: { id: user.id, displayName: user.displayName, photoURL: user.photoURL },
      body: '  Hola equipo  ',
    })
    expect(sent.body).toBe('Hola equipo')
    expect(snapshots.at(-1)).toBeGreaterThan(snapshots[0])

    await container.messages.updateBody(DEMO_WORKSPACE_ID, 'ch-general', sent.id, 'Hola openQomu')
    let messages = await container.messages.list(DEMO_WORKSPACE_ID, 'ch-general')
    expect(messages.find((m) => m.id === sent.id)?.body).toBe('Hola openQomu')
    expect(messages.find((m) => m.id === sent.id)?.editedAt).toBeTruthy()

    await container.messages.toggleReaction(DEMO_WORKSPACE_ID, 'ch-general', sent.id, '🚀', user.id)
    messages = await container.messages.list(DEMO_WORKSPACE_ID, 'ch-general')
    expect(messages.find((m) => m.id === sent.id)?.reactions['🚀']).toEqual([user.id])

    await container.messages.remove(DEMO_WORKSPACE_ID, 'ch-general', sent.id)
    messages = await container.messages.list(DEMO_WORKSPACE_ID, 'ch-general')
    expect(messages.find((m) => m.id === sent.id)?.deletedAt).toBeTruthy()

    const count = snapshots.length
    unsubscribe()
    await container.messages.send({
      workspaceId: DEMO_WORKSPACE_ID,
      channelId: 'ch-general',
      author: { id: user.id, displayName: user.displayName, photoURL: null },
      body: 'Después de unsubscribe',
    })
    expect(snapshots.length).toBe(count)
  })

  it('valida respuestas y mensajes vacíos', async () => {
    await login(container)
    await expect(
      container.messages.send({
        workspaceId: DEMO_WORKSPACE_ID,
        channelId: 'ch-general',
        author: { id: 'u-alex', displayName: 'Alex', photoURL: null },
        body: '   ',
      }),
    ).rejects.toThrow('adjunta')
    const channel = await container.channels.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'otro',
      description: '',
      type: 'public',
      createdBy: 'u-alex',
    })
    await expect(
      container.messages.send({
        workspaceId: DEMO_WORKSPACE_ID,
        channelId: channel.id,
        author: { id: 'u-alex', displayName: 'Alex', photoURL: null },
        body: 'hola',
        replyToId: 'msg-1',
      }),
    ).rejects.toThrow('no existe')
  })

  it('publica el indicador de escritura y la última lectura', async () => {
    await login(container)
    const typing: string[][] = []
    const reads: Array<Record<string, string>> = []
    const ownReads: Array<string | null> = []
    const stopTyping = container.messages.subscribeTyping(
      DEMO_WORKSPACE_ID,
      'ch-general',
      (users) => typing.push(users.map((user) => user.uid)),
    )
    const stopReads = container.messages.subscribeReads(
      DEMO_WORKSPACE_ID,
      'ch-general',
      (value) => reads.push(value),
    )
    const stopOwnReads = container.messages.subscribeRead(
      DEMO_WORKSPACE_ID,
      'ch-general',
      'u-ana',
      (value) => ownReads.push(value),
    )
    expect(ownReads.at(-1)).toBeNull()

    await container.messages.setTyping(
      DEMO_WORKSPACE_ID,
      'ch-general',
      { id: 'u-alex', displayName: 'Alex Rivera' },
      true,
    )
    expect(typing.at(-1)).toEqual(['u-alex'])
    await container.messages.setTyping(
      DEMO_WORKSPACE_ID,
      'ch-general',
      { id: 'u-alex', displayName: 'Alex Rivera' },
      false,
    )
    expect(typing.at(-1)).toEqual([])

    await container.messages.markRead(
      DEMO_WORKSPACE_ID,
      'ch-general',
      'u-ana',
      '2026-11-15T10:00:00.000Z',
    )
    expect(reads.at(-1)).toEqual({ 'u-ana': '2026-11-15T10:00:00.000Z' })
    await container.messages.markRead(
      DEMO_WORKSPACE_ID,
      'ch-general',
      'u-ana',
      '2026-11-15T09:00:00.000Z',
    )
    expect(ownReads.at(-1)).toBe('2026-11-15T10:00:00.000Z')

    // Otro canal no contamina las lecturas del primero.
    await container.messages.markRead(
      DEMO_WORKSPACE_ID,
      'ch-producto',
      'u-bruno',
      '2026-11-15T10:05:00.000Z',
    )
    expect(reads.at(-1)).toEqual({ 'u-ana': '2026-11-15T10:00:00.000Z' })

    stopTyping()
    stopReads()
    stopOwnReads()
    await expect(
      container.messages.setTyping(
        DEMO_WORKSPACE_ID,
        'no-existe',
        { id: 'u-alex', displayName: 'Alex' },
        true,
      ),
    ).rejects.toThrow('no existe')
  })
})

describe('demo tableros y tareas', () => {
  it('gestiona tareas, movimiento y comentarios', async () => {
    const user = await login(container)
    const board = await container.boards.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'Tablero de prueba',
      description: 'Demo',
      createdBy: user.id,
    })
    const first = await container.tasks.create({
      workspaceId: DEMO_WORKSPACE_ID,
      boardId: board.id,
      title: '  Primera tarea  ',
      columnId: 'todo',
      createdBy: user.id,
      priority: 'high',
      assigneeIds: ['u-ana'],
    })
    expect(first.title).toBe('Primera tarea')
    expect(first.order).toBe(0)
    const second = await container.tasks.create({
      workspaceId: DEMO_WORKSPACE_ID,
      boardId: board.id,
      title: 'Segunda',
      columnId: 'todo',
      createdBy: user.id,
    })
    expect(second.order).toBe(1)

    await container.tasks.update(DEMO_WORKSPACE_ID, board.id, first.id, {
      priority: 'urgent',
      labels: ['bug', 'BUG'],
      description: 'Detalle',
    })
    let tasks = await container.tasks.list(DEMO_WORKSPACE_ID, board.id)
    expect(tasks.find((task) => task.id === first.id)?.labels).toEqual(['bug'])

    await container.tasks.move(DEMO_WORKSPACE_ID, board.id, first.id, 'done', 0, board.columns)
    tasks = await container.tasks.list(DEMO_WORKSPACE_ID, board.id)
    expect(tasks.find((task) => task.id === first.id)?.columnId).toBe('done')
    expect(tasks.find((task) => task.id === first.id)?.completedAt).toBeTruthy()
    expect(tasks.find((task) => task.id === second.id)?.order).toBe(0)

    const commentSpy = vi.fn()
    const unsubscribe = container.tasks.subscribeComments(
      DEMO_WORKSPACE_ID,
      board.id,
      first.id,
      commentSpy,
    )
    const comment = await container.tasks.addComment(DEMO_WORKSPACE_ID, board.id, first.id, {
      authorId: user.id,
      authorName: user.displayName,
      authorPhotoURL: null,
      body: '  Listo para QA  ',
    })
    expect(comment.body).toBe('Listo para QA')
    expect(commentSpy).toHaveBeenCalled()
    unsubscribe()

    await container.boards.remove(DEMO_WORKSPACE_ID, board.id)
    expect(await container.tasks.list(DEMO_WORKSPACE_ID, board.id)).toEqual([])
  })

  it('guarda y restaura las etiquetas ocultas del tablero', async () => {
    const user = await login(container)
    const board = await container.boards.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'Tablero etiquetas',
      description: '',
      createdBy: user.id,
    })
    expect(board.hiddenLabels ?? []).toEqual([])

    await container.boards.update(DEMO_WORKSPACE_ID, board.id, {
      hiddenLabels: ['diseño', 'diseño', '  '],
    })
    const hidden = (await container.boards.list(DEMO_WORKSPACE_ID)).find(
      (item) => item.id === board.id,
    )
    expect(hidden?.hiddenLabels).toEqual(['diseño'])

    await container.boards.update(DEMO_WORKSPACE_ID, board.id, { hiddenLabels: [] })
    const restored = (await container.boards.list(DEMO_WORKSPACE_ID)).find(
      (item) => item.id === board.id,
    )
    expect(restored?.hiddenLabels).toEqual([])
  })

  it('migra una tarea a un tablero de otro espacio', async () => {
    const user = await login(container)
    const sourceBoard = await container.boards.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'Origen',
      description: '',
      createdBy: user.id,
    })
    const task = await container.tasks.create({
      workspaceId: DEMO_WORKSPACE_ID,
      boardId: sourceBoard.id,
      title: 'Tarea migrable',
      columnId: 'todo',
      createdBy: user.id,
      assigneeIds: ['u-ana', user.id],
      labels: ['producto'],
    })
    await container.tasks.addComment(DEMO_WORKSPACE_ID, sourceBoard.id, task.id, {
      authorId: user.id,
      authorName: user.displayName,
      authorPhotoURL: null,
      body: 'Comentario que no se migra',
    })

    const target = await container.workspaces.create({
      name: 'Qaly',
      icon: '🚀',
      description: '',
      owner: user,
    })
    const targetBoard = await container.boards.create({
      workspaceId: target.id,
      name: 'Destino',
      description: '',
      createdBy: user.id,
    })

    const moved = await container.tasks.transfer(
      DEMO_WORKSPACE_ID,
      sourceBoard.id,
      task.id,
      { workspaceId: target.id, boardId: targetBoard.id, columnId: 'doing' },
      user.id,
    )

    expect(moved.workspaceId).toBe(target.id)
    expect(moved.boardId).toBe(targetBoard.id)
    expect(moved.columnId).toBe('doing')
    expect(moved.createdBy).toBe(user.id)
    expect(moved.labels).toEqual(['producto'])
    expect(moved.assigneeIds).toEqual([user.id])
    expect(await container.tasks.list(DEMO_WORKSPACE_ID, sourceBoard.id)).toEqual([])
    expect(await container.tasks.list(target.id, targetBoard.id)).toHaveLength(1)
    const migratedComments = Object.values(context.store.getState().comments).filter(
      (comment) => comment.taskId === task.id,
    )
    expect(migratedComments).toHaveLength(1)
    expect(migratedComments[0].workspaceId).toBe(target.id)
    expect(migratedComments[0].boardId).toBe(targetBoard.id)
  })
})

describe('demo páginas', () => {
  it('crea jerarquías, autoguarda y archiva en cascada', async () => {
    const user = await login(container)
    const parent = await container.pages.create({
      workspaceId: DEMO_WORKSPACE_ID,
      title: 'Nueva sección',
      icon: '📚',
      createdBy: user.id,
    })
    const child = await container.pages.create({
      workspaceId: DEMO_WORKSPACE_ID,
      title: 'Subpágina',
      createdBy: user.id,
      parentId: parent.id,
    })
    expect(child.parentId).toBe(parent.id)
    await container.pages.update(DEMO_WORKSPACE_ID, child.id, {
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contenido' }] }] }),
      updatedBy: user.id,
    })
    const pages = await container.pages.list(DEMO_WORKSPACE_ID)
    expect(pages.find((page) => page.id === child.id)?.content).toContain('Contenido')

    await expect(
      container.pages.update(DEMO_WORKSPACE_ID, parent.id, {
        parentId: child.id,
        updatedBy: user.id,
      }),
    ).rejects.toThrow('subpáginas')

    await container.pages.remove(DEMO_WORKSPACE_ID, parent.id)
    const after = await container.pages.list(DEMO_WORKSPACE_ID)
    expect(after.find((page) => page.id === parent.id)?.archived).toBe(true)
    expect(after.find((page) => page.id === child.id)?.archived).toBe(false)
  })
})

describe('demo carpetas, papelera y edición', () => {
  it('crea carpetas, mueve archivos y respeta la jerarquía', async () => {
    const user = await login(container)
    const parent = await container.fileFolders.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'Proyecto',
      createdBy: user.id,
    })
    const child = await container.fileFolders.create({
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'Recursos',
      parentId: parent.id,
      createdBy: user.id,
    })
    expect((await container.fileFolders.list(DEMO_WORKSPACE_ID)).map((folder) => folder.name)).toContain(
      'Proyecto',
    )
    await expect(
      container.fileFolders.create({
        workspaceId: DEMO_WORKSPACE_ID,
        name: 'proyecto',
        parentId: null,
        createdBy: user.id,
      }),
    ).rejects.toThrow('Ya existe')
    await expect(
      container.fileFolders.update(DEMO_WORKSPACE_ID, parent.id, {
        name: 'Proyecto',
        parentId: child.id,
      }),
    ).rejects.toThrow('subcarpeta')

    const file = await container.files.upload(
      DEMO_WORKSPACE_ID,
      {
        name: 'notas.txt',
        size: 5,
        contentType: 'text/plain',
        data: new Blob(['hola'], { type: 'text/plain' }),
      },
      user.id,
      { folderId: child.id },
    )
    expect(file.folderId).toBe(child.id)

    await container.files.update(DEMO_WORKSPACE_ID, file.id, {
      name: 'notas-renombradas.txt',
      folderId: parent.id,
    })
    const moved = (await container.files.list(DEMO_WORKSPACE_ID)).find((item) => item.id === file.id)
    expect(moved?.name).toBe('notas-renombradas.txt')
    expect(moved?.folderId).toBe(parent.id)

    await expect(
      container.fileFolders.remove(DEMO_WORKSPACE_ID, parent.id),
    ).rejects.toThrow('contenido')

    await container.files.update(DEMO_WORKSPACE_ID, file.id, {
      trashedAt: new Date().toISOString(),
    })
    const trashed = (await container.files.list(DEMO_WORKSPACE_ID)).find((item) => item.id === file.id)
    expect(trashed?.trashedAt).toBeTruthy()
    // Una carpeta con archivos solo en la papelera sí puede eliminarse.
    await container.fileFolders.remove(DEMO_WORKSPACE_ID, child.id)
    await container.fileFolders.remove(DEMO_WORKSPACE_ID, parent.id)
    await container.files.update(DEMO_WORKSPACE_ID, file.id, { trashedAt: null })
    const restored = (await container.files.list(DEMO_WORKSPACE_ID)).find((item) => item.id === file.id)
    expect(restored?.trashedAt).toBeNull()

    await container.files.remove(DEMO_WORKSPACE_ID, file.id)
    const remaining = await container.fileFolders.list(DEMO_WORKSPACE_ID)
    expect(remaining.some((folder) => folder.id === parent.id || folder.id === child.id)).toBe(false)
  })
})

describe('demo archivos', () => {
  it('sube archivos con progreso, lista y elimina', async () => {
    const user = await login(container)
    const progress: number[] = []
    const file = await container.files.upload(
      DEMO_WORKSPACE_ID,
      {
        name: 'nota.txt',
        size: 5,
        contentType: 'text/plain',
        data: new Blob(['hola'], { type: 'text/plain' }),
      },
      user.id,
      { onProgress: (percent) => progress.push(percent) },
    )
    expect(file.size).toBe(5)
    expect(progress.at(-1)).toBe(100)
    const files = await container.files.list(DEMO_WORKSPACE_ID)
    expect(files.some((candidate) => candidate.id === file.id)).toBe(true)
    const blob = await container.files.downloadBlob(DEMO_WORKSPACE_ID, file)
    expect(await blob.text()).toBe('hola')
    await container.files.remove(DEMO_WORKSPACE_ID, file.id)
    expect((await container.files.list(DEMO_WORKSPACE_ID)).some((f) => f.id === file.id)).toBe(false)
  })

  it('rechaza ejecutables y archivos vacíos', async () => {
    await login(container)
    await expect(
      container.files.upload(
        DEMO_WORKSPACE_ID,
        {
          name: 'virus.exe',
          size: 10,
          contentType: 'application/octet-stream',
          data: new Blob(['x']),
        },
        'u-alex',
      ),
    ).rejects.toThrow('ejecutables')
    await expect(
      container.files.upload(
        DEMO_WORKSPACE_ID,
        { name: 'vacio.txt', size: 0, contentType: 'text/plain', data: new Blob([]) },
        'u-alex',
      ),
    ).rejects.toThrow('vacío')
  })
})

describe('demo tokens MCP', () => {
  it('guarda el secreto para poder mostrarlo y elimina el token', async () => {
    const user = await login(container)
    const created = await container.mcpTokens.create({
      uid: user.id,
      label: 'OpenCode',
      scopes: ['openqomu:read', 'openqomu:write'],
      tokenHash: 'hash-1',
      secret: 'openqomu_mcp_secreto',
    })
    expect(created.secret).toBe('openqomu_mcp_secreto')

    const list = await container.mcpTokens.list(user.id)
    expect(list.find((token) => token.id === 'hash-1')?.secret).toBe('openqomu_mcp_secreto')

    await container.mcpTokens.remove(user.id, 'hash-1')
    expect(await container.mcpTokens.list(user.id)).toEqual([])
  })
})

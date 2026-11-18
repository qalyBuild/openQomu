import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

let testEnv: RulesTestEnvironment
const RULES = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')

const ALICE = 'alice'
const BOB = 'bob'
const CHARLIE = 'charlie'
const WS = 'ws-test'
const NOW = Date.now()

function dbFor(uid?: string) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore()
}

async function seedWorkspace(owner = ALICE, workspaceId = WS) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'workspaces', workspaceId), {
      name: 'Test Space',
      icon: '🪐',
      description: '',
      ownerId: owner,
      memberIds: [owner],
      createdAt: new Date().toISOString(),
    })
    await setDoc(doc(db, 'workspaces', workspaceId, 'members', owner), {
      uid: owner,
      role: 'owner',
      displayName: 'Owner',
      email: `${owner}@example.com`,
      photoURL: null,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    await setDoc(doc(db, 'workspaces', workspaceId, 'channels', 'ch-public'), {
      name: 'general',
      description: '',
      type: 'public',
      memberIds: [],
      createdBy: owner,
      createdAt: new Date().toISOString(),
      archived: false,
    })
    await setDoc(doc(db, 'workspaces', workspaceId, 'channels', 'ch-private'), {
      name: 'secreto',
      description: '',
      type: 'private',
      memberIds: [owner],
      createdBy: owner,
      createdAt: new Date().toISOString(),
      archived: false,
    })
    await setDoc(doc(db, 'workspaces', workspaceId, 'boards', 'board-1'), {
      name: 'Board',
      description: '',
      columns: [{ id: 'todo', name: 'Por hacer', color: '#999', isDone: false }],
      createdBy: owner,
      createdAt: new Date().toISOString(),
    })
    await setDoc(doc(db, 'workspaces', workspaceId, 'boards', 'board-1', 'tasks', 'task-alice'), {
      title: 'Tarea de Alice',
      description: '',
      columnId: 'todo',
      order: 0,
      assigneeIds: [],
      priority: 'medium',
      dueDate: null,
      labels: [],
      attachmentIds: [],
      createdBy: owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    })
    await setDoc(doc(db, 'workspaces', workspaceId, 'members', BOB), {
      uid: BOB,
      role: 'member',
      displayName: 'Bob',
      email: 'bob@example.com',
      photoURL: null,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    await setDoc(doc(db, 'workspaces', workspaceId), {
      memberIds: [owner, BOB],
    }, { merge: true })
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-openqomu',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: RULES,
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('workspaces y membresías', () => {
  it('permite listar los workspaces propios y devuelve vacío a usuarios nuevos', async () => {
    await seedWorkspace()
    await assertSucceeds(
      getDocs(
        query(
          collection(dbFor(ALICE), 'workspaces'),
          where('memberIds', 'array-contains', ALICE),
        ),
      ),
    )
    await assertSucceeds(
      getDocs(
        query(
          collection(dbFor('nuevo'), 'workspaces'),
          where('memberIds', 'array-contains', 'nuevo'),
        ),
      ),
    )
    await assertFails(
      getDocs(
        query(
          collection(dbFor('intruso'), 'workspaces'),
          where('memberIds', 'array-contains', ALICE),
        ),
      ),
    )
  })

  it('permite listar subcolecciones vacías de un workspace recién creado', async () => {
    const EMPTY = 'ws-empty'
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'workspaces', EMPTY), {
        name: 'Vacío',
        icon: '🌱',
        description: '',
        ownerId: ALICE,
        memberIds: [ALICE],
        createdAt: new Date().toISOString(),
      })
      await setDoc(doc(db, 'workspaces', EMPTY, 'members', ALICE), {
        uid: ALICE,
        role: 'owner',
        displayName: 'Alice',
        email: 'alice@example.com',
        photoURL: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      })
      await setDoc(doc(db, 'workspaces', EMPTY, 'boards', 'empty-board'), {
        name: 'Vacío',
        description: '',
        columns: [{ id: 'todo', name: 'Por hacer', color: '#999', isDone: false }],
        createdBy: ALICE,
        createdAt: new Date().toISOString(),
      })
      await setDoc(doc(db, 'workspaces', EMPTY, 'channels', 'empty-channel'), {
        name: 'vacio',
        description: '',
        type: 'public',
        memberIds: [],
        createdBy: ALICE,
        createdAt: new Date().toISOString(),
        archived: false,
      })
    })
    const db = dbFor(ALICE)
    for (const ref of [
      collection(db, 'workspaces', EMPTY, 'members'),
      collection(db, 'workspaces', EMPTY, 'channels'),
      collection(db, 'workspaces', EMPTY, 'boards'),
      collection(db, 'workspaces', EMPTY, 'pages'),
      collection(db, 'workspaces', EMPTY, 'files'),
      collection(db, 'workspaces', EMPTY, 'boards', 'empty-board', 'tasks'),
      collection(db, 'workspaces', EMPTY, 'channels', 'empty-channel', 'messages'),
    ]) {
      await assertSucceeds(getDocs(ref))
    }
    await assertFails(getDocs(collection(dbFor('intruso'), 'workspaces', EMPTY, 'members')))
  })

  it('permite crear un workspace y su member owner, y aísla a los no miembros', async () => {
    const alice = dbFor(ALICE)
    await assertSucceeds(
      setDoc(doc(alice, 'workspaces', WS), {
        name: 'Nuevo',
        icon: '🚀',
        description: '',
        ownerId: ALICE,
        memberIds: [ALICE],
        createdAt: new Date().toISOString(),
      }),
    )
    await assertSucceeds(
      setDoc(doc(alice, 'workspaces', WS, 'members', ALICE), {
        uid: ALICE,
        role: 'owner',
        displayName: 'Alice',
        email: 'alice@example.com',
        photoURL: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      }),
    )
    await assertSucceeds(getDoc(doc(dbFor(ALICE), 'workspaces', WS)))
    await assertFails(getDoc(doc(dbFor(BOB), 'workspaces', WS)))
  })

  it('impide enumerar perfiles y conserva la lectura individual', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', BOB), { displayName: 'Bob' })
    })
    const alice = dbFor(ALICE)
    await assertSucceeds(getDoc(doc(alice, 'users', BOB)))
    await assertFails(getDocs(collection(alice, 'users')))
  })

  it('acepta invitaciones válidas, rechaza caducadas y lista solo con permiso', async () => {
    await seedWorkspace()
    const alice = dbFor(ALICE)
    const inviteCode = 'TESTCODE12'
    await assertSucceeds(
      setDoc(doc(alice, 'invites', inviteCode), {
        workspaceId: WS,
        createdBy: ALICE,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(NOW + 86_400_000).toISOString(),
        expiresAtMs: NOW + 86_400_000,
      }),
    )
    // El enlace puede comprobarse sin sesión.
    await assertSucceeds(getDoc(doc(dbFor(), 'invites', inviteCode)))
    await assertFails(getDocs(collection(dbFor(BOB), 'invites')))

    const invitesFor = (uid: string) =>
      query(collection(dbFor(uid), 'invites'), where('workspaceId', '==', WS))
    const ownedInvites = await assertSucceeds(getDocs(invitesFor(ALICE)))
    expect(ownedInvites.docs.map((invite) => invite.id)).toEqual([inviteCode])
    await assertFails(getDocs(invitesFor(BOB)))
    await assertFails(getDocs(collection(alice, 'invites')))
    const revokedRef = doc(alice, 'invites', 'REVOKEME12')
    await assertSucceeds(setDoc(revokedRef, {
      ...ownedInvites.docs[0].data(),
    }))
    await assertFails(deleteDoc(doc(dbFor(BOB), revokedRef.path)))
    await assertSucceeds(deleteDoc(revokedRef))
    expect((await getDoc(doc(dbFor(), revokedRef.path))).exists()).toBe(false)

    const bob = dbFor(BOB)
    await assertFails(
      setDoc(doc(bob, 'invites', 'BOBINVITE1'), {
        workspaceId: WS,
        createdBy: BOB,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(NOW + 86_400_000).toISOString(),
        expiresAtMs: NOW + 86_400_000,
      }),
    )
    await assertFails(
      setDoc(doc(bob, 'workspaces', WS, 'members', 'charlie'), {
        uid: CHARLIE,
        role: 'member',
        displayName: 'Charlie',
        email: 'charlie@example.com',
        photoURL: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        inviteCode,
      }),
    )
    const guest = dbFor('invitado')
    // Un no miembro puede consultar su propio member doc (no existe aún),
    // pero no el de otra persona ni el workspace.
    await assertSucceeds(getDoc(doc(guest, 'workspaces', WS, 'members', 'invitado')))
    await assertFails(getDoc(doc(guest, 'workspaces', WS, 'members', ALICE)))
    await assertFails(getDoc(doc(guest, 'workspaces', WS)))
    await assertSucceeds(
      setDoc(doc(guest, 'workspaces', WS, 'members', 'invitado'), {
        uid: 'invitado',
        role: 'member',
        displayName: 'Invitado',
        email: 'invitado@example.com',
        photoURL: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        inviteCode,
      }),
    )
    await assertSucceeds(
      updateDoc(doc(guest, 'workspaces', WS), { memberIds: arrayUnion('invitado') }),
    )
    await assertSucceeds(getDoc(doc(guest, 'workspaces', WS)))
    await assertFails(
      updateDoc(doc(bob, 'workspaces', WS), { memberIds: arrayUnion('intruso') }),
    )

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invites', 'EXPIRED123'), {
        workspaceId: WS,
        createdBy: ALICE,
        createdAt: new Date(NOW - 100_000).toISOString(),
        expiresAt: new Date(NOW - 1000).toISOString(),
        expiresAtMs: NOW - 1000,
      })
    })
    await assertFails(
      setDoc(doc(bob, 'workspaces', WS, 'members', 'tarde'), {
        uid: 'tarde',
        role: 'member',
        displayName: 'Tarde',
        email: 'tarde@example.com',
        photoURL: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        inviteCode: 'EXPIRED123',
      }),
    )
  })

  it('protege el workspace y los roles', async () => {
    await seedWorkspace()
    const bob = dbFor(BOB)
    await assertFails(updateDoc(doc(bob, 'workspaces', WS), { name: 'Hackeado' }))
    await assertFails(updateDoc(doc(bob, 'workspaces', WS), { memberIds: arrayUnion(CHARLIE) }))
    await assertFails(
      setDoc(doc(bob, 'workspaces', WS, 'members', CHARLIE), {
        uid: CHARLIE,
        role: 'admin',
        displayName: 'Charlie',
        email: 'charlie@example.com',
        photoURL: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      }),
    )
    await assertFails(updateDoc(doc(bob, 'workspaces', WS, 'members', BOB), { role: 'admin' }))
    const alice = dbFor(ALICE)
    await assertSucceeds(
      updateDoc(doc(alice, 'workspaces', WS, 'members', BOB), { role: 'admin' }),
    )
  })
})

describe('contenido y permisos', () => {
  it('permite colaborar a miembros y reserva borrados destructivos', async () => {
    await seedWorkspace()
    const bob = dbFor(BOB)
    const alice = dbFor(ALICE)

    await assertSucceeds(
      setDoc(doc(bob, 'workspaces', WS, 'channels', 'ch-nuevo'), {
        name: 'nuevo',
        description: '',
        type: 'public',
        memberIds: [],
        createdBy: BOB,
        createdAt: new Date().toISOString(),
        archived: false,
      }),
    )
    await assertSucceeds(
      setDoc(doc(bob, 'workspaces', WS, 'channels', 'ch-public', 'messages', 'm1'), {
        authorId: BOB,
        authorName: 'Bob',
        authorPhotoURL: null,
        body: 'Hola',
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        attachmentIds: [],
        reactions: {},
        replyToId: null,
      }),
    )
    await assertSucceeds(getDoc(doc(alice, 'workspaces', WS, 'channels', 'ch-public', 'messages', 'm1')))
    await assertSucceeds(
      updateDoc(doc(bob, 'workspaces', WS, 'channels', 'ch-public', 'messages', 'm1'), {
        body: 'Editado',
      }),
    )
    await assertFails(
      setDoc(doc(bob, 'workspaces', WS, 'channels', 'ch-public', 'messages', 'm2'), {
        authorId: ALICE,
        authorName: 'Suplantación',
        authorPhotoURL: null,
        body: 'No',
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        attachmentIds: [],
        reactions: {},
        replyToId: null,
      }),
    )

    await assertSucceeds(
      updateDoc(doc(bob, 'workspaces', WS, 'boards', 'board-1', 'tasks', 'task-alice'), {
        title: 'Editada por Bob',
      }),
    )
    await assertFails(
      updateDoc(doc(alice, 'workspaces', WS, 'boards', 'board-1', 'tasks', 'task-alice'), {
        createdBy: BOB,
      }),
    )
    await assertFails(
      setDoc(doc(bob, 'workspaces', WS, 'files', 'big'), {
        name: 'big.zip',
        path: 'workspaces/ws-test/big.zip',
        url: '',
        size: 30 * 1024 * 1024,
        contentType: 'application/zip',
        uploadedBy: BOB,
        createdAt: new Date().toISOString(),
      }),
    )
    await assertSucceeds(
      setDoc(doc(alice, 'workspaces', WS, 'files', 'free-mode'), {
        name: 'captura.png',
        path: 'firestore://free-mode',
        url: `data:image/png;base64,${'A'.repeat(900_000)}`,
        size: 700 * 1024,
        contentType: 'image/png',
        uploadedBy: ALICE,
        createdAt: new Date().toISOString(),
      }),
    )
    await assertFails(
      setDoc(doc(alice, 'workspaces', WS, 'files', 'too-big-url'), {
        name: 'grande.png',
        path: 'firestore://too-big-url',
        url: `data:image/png;base64,${'A'.repeat(1_000_001)}`,
        size: 900 * 1024,
        contentType: 'image/png',
        uploadedBy: ALICE,
        createdAt: new Date().toISOString(),
      }),
    )
  })

  it('permite reaccionar a mensajes ajenos sin editar su contenido', async () => {
    await seedWorkspace()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'workspaces', WS, 'channels', 'ch-public', 'messages', 'm-alice'),
        {
          authorId: ALICE,
          authorName: 'Alice',
          authorPhotoURL: null,
          body: 'Mensaje de Alice',
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
          attachmentIds: [],
          reactions: {},
          replyToId: null,
        },
      )
    })
    const bob = dbFor(BOB)
    await assertSucceeds(
      updateDoc(doc(bob, 'workspaces', WS, 'channels', 'ch-public', 'messages', 'm-alice'), {
        reactions: { '🚀': [BOB] },
      }),
    )
    await assertFails(
      updateDoc(doc(bob, 'workspaces', WS, 'channels', 'ch-public', 'messages', 'm-alice'), {
        body: 'Editado por Bob',
      }),
    )
  })

  it('reserva el estado del tablero al creador y a los administradores del espacio', async () => {
    await seedWorkspace()
    const aliceBoard = doc(dbFor(ALICE), 'workspaces', WS, 'boards', 'board-1')
    const bobView = doc(dbFor(BOB), 'workspaces', WS, 'boards', 'board-1')
    const bobBoard = doc(dbFor(BOB), 'workspaces', WS, 'boards', 'board-bob')
    await assertSucceeds(updateDoc(aliceBoard, { status: 'paused' }))
    await assertFails(updateDoc(bobView, { status: 'normal' }))
    await assertFails(updateDoc(aliceBoard, { status: 'unknown' }))
    await assertSucceeds(updateDoc(bobView, { description: 'Edición de metadatos existente' }))
    await assertSucceeds(setDoc(bobBoard, {
      name: 'Tablero de Bob',
      createdBy: BOB,
      createdAt: new Date().toISOString(),
    }))
    await assertSucceeds(updateDoc(bobBoard, { status: 'deprecated' }))
    await assertSucceeds(updateDoc(doc(dbFor(ALICE), bobBoard.path), { status: 'normal' }))
  })

  it('permite cascadas al creador del contenedor', async () => {
    await seedWorkspace()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'workspaces', WS, 'boards', 'board-bob'), {
        name: 'Board de Bob',
        description: '',
        columns: [{ id: 'todo', name: 'Por hacer', color: '#999', isDone: false }],
        createdBy: BOB,
        createdAt: new Date().toISOString(),
      })
      await setDoc(doc(db, 'workspaces', WS, 'boards', 'board-bob', 'tasks', 'task-alice'), {
        title: 'Tarea de Alice en board de Bob',
        description: '',
        columnId: 'todo',
        order: 0,
        assigneeIds: [],
        priority: 'medium',
        dueDate: null,
        labels: [],
        attachmentIds: [],
        createdBy: ALICE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      })
      await setDoc(
        doc(db, 'workspaces', WS, 'boards', 'board-bob', 'tasks', 'task-alice', 'comments', 'c1'),
        {
          authorId: ALICE,
          authorName: 'Alice',
          authorPhotoURL: null,
          body: 'Comentario de Alice',
          createdAt: new Date().toISOString(),
        },
      )
      await setDoc(doc(db, 'workspaces', WS, 'channels', 'ch-bob'), {
        name: 'canal-de-bob',
        description: '',
        type: 'public',
        memberIds: [],
        createdBy: BOB,
        createdAt: new Date().toISOString(),
        archived: false,
      })
      await setDoc(doc(db, 'workspaces', WS, 'channels', 'ch-bob', 'messages', 'm-alice'), {
        authorId: ALICE,
        authorName: 'Alice',
        authorPhotoURL: null,
        body: 'Mensaje de Alice',
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        attachmentIds: [],
        reactions: {},
        replyToId: null,
      })
    })
    const bob = dbFor(BOB)
    await assertSucceeds(
      deleteDoc(
        doc(bob, 'workspaces', WS, 'boards', 'board-bob', 'tasks', 'task-alice', 'comments', 'c1'),
      ),
    )
    await assertSucceeds(
      deleteDoc(doc(bob, 'workspaces', WS, 'boards', 'board-bob', 'tasks', 'task-alice')),
    )
    await assertSucceeds(
      deleteDoc(doc(bob, 'workspaces', WS, 'channels', 'ch-bob', 'messages', 'm-alice')),
    )
  })

  it('permite editar un comentario propio y rechaza a otros miembros', async () => {
    await seedWorkspace()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'workspaces', WS, 'members', BOB), {
        uid: BOB,
        role: 'member',
        displayName: 'Bob',
        email: 'bob@example.com',
        photoURL: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      })
      await setDoc(
        doc(db, 'workspaces', WS, 'boards', 'board-1', 'tasks', 'task-1', 'comments', 'c1'),
        {
          authorId: ALICE,
          authorName: 'Alice',
          authorPhotoURL: null,
          body: 'Comentario original',
          createdAt: new Date().toISOString(),
        },
      )
    })

    const alice = dbFor(ALICE)
    await assertSucceeds(
      updateDoc(
        doc(alice, 'workspaces', WS, 'boards', 'board-1', 'tasks', 'task-1', 'comments', 'c1'),
        { body: 'Comentario editado', editedAt: new Date().toISOString() },
      ),
    )

    const bob = dbFor(BOB)
    await assertFails(
      updateDoc(
        doc(bob, 'workspaces', WS, 'boards', 'board-1', 'tasks', 'task-1', 'comments', 'c1'),
        { body: 'Editado por Bob' },
      ),
    )
  })

  it('permite migrar comentarios conservando su autor original', async () => {
    await seedWorkspace()
    const TARGET = 'ws-target'
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'workspaces', TARGET), {
        name: 'Destino',
        icon: '🚀',
        description: '',
        ownerId: ALICE,
        memberIds: [ALICE, BOB],
        createdAt: new Date().toISOString(),
      })
      for (const uid of [ALICE, BOB]) {
        await setDoc(doc(db, 'workspaces', TARGET, 'members', uid), {
          uid,
          role: uid === ALICE ? 'owner' : 'member',
          displayName: uid,
          email: `${uid}@example.com`,
          photoURL: null,
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        })
      }
      await setDoc(doc(db, 'workspaces', TARGET, 'boards', 'board-target'), {
        name: 'Destino',
        description: '',
        columns: [{ id: 'todo', name: 'Por hacer', color: '#999', isDone: false }],
        createdBy: ALICE,
        createdAt: new Date().toISOString(),
      })
      await setDoc(
        doc(db, 'workspaces', WS, 'boards', 'board-1', 'tasks', 'task-alice', 'comments', 'c-alice'),
        {
          authorId: ALICE,
          authorName: 'Alice',
          authorPhotoURL: null,
          body: 'Comentario original de Alice',
          createdAt: new Date().toISOString(),
        },
      )
    })

    const bob = dbFor(BOB)
    const migrated = doc(
      bob,
      'workspaces',
      TARGET,
      'boards',
      'board-target',
      'tasks',
      'task-new',
      'comments',
      'c-alice',
    )
    await assertFails(
      setDoc(migrated, {
        authorId: ALICE,
        authorName: 'Alice',
        authorPhotoURL: null,
        body: 'Sin origen verificado',
        createdAt: new Date().toISOString(),
      }),
    )
    await assertFails(
      setDoc(migrated, {
        authorId: BOB,
        authorName: 'Bob',
        authorPhotoURL: null,
        body: 'Autor que no coincide',
        createdAt: new Date().toISOString(),
        migratedFrom: {
          workspaceId: WS,
          boardId: 'board-1',
          taskId: 'task-alice',
          commentId: 'c-alice',
        },
      }),
    )
    await assertSucceeds(
      setDoc(migrated, {
        authorId: ALICE,
        authorName: 'Alice',
        authorPhotoURL: null,
        body: 'Comentario original de Alice',
        createdAt: new Date().toISOString(),
        migratedFrom: {
          workspaceId: WS,
          boardId: 'board-1',
          taskId: 'task-alice',
          commentId: 'c-alice',
        },
      }),
    )
  })

  it('gestiona tokens MCP propios y bloquea los ajenos', async () => {
    const alice = dbFor(ALICE)
    const bob = dbFor(BOB)
    const tokenRef = doc(alice, 'mcpTokens', 'hash-alice')
    await assertSucceeds(
      setDoc(tokenRef, {
        uid: ALICE,
        label: 'OpenCode',
        scopes: ['openqomu:read', 'openqomu:write'],
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        revokedAt: null,
      }),
    )
    await assertFails(getDoc(doc(bob, 'mcpTokens', 'hash-alice')))
    await assertFails(
      setDoc(doc(bob, 'mcpTokens', 'hash-bob'), {
        uid: ALICE,
        label: 'Intento',
        scopes: ['openqomu:read'],
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        revokedAt: null,
      }),
    )
    await assertSucceeds(
      updateDoc(tokenRef, { revokedAt: new Date().toISOString() }),
    )
    await assertFails(updateDoc(tokenRef, { label: 'Renombrado' }))
  })

  it('gestiona carpetas y contenido de archivos bajo demanda', async () => {
    await seedWorkspace()
    const alice = dbFor(ALICE)
    const bob = dbFor(BOB)
    await assertSucceeds(
      setDoc(doc(alice, 'workspaces', WS, 'folders', 'folder-a'), {
        name: 'Diseño',
        parentId: null,
        createdBy: ALICE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    )
    await assertSucceeds(getDocs(collection(bob, 'workspaces', WS, 'folders')))
    await assertFails(
      setDoc(doc(bob, 'workspaces', WS, 'folders', 'folder-b'), {
        name: 'Intruso',
        parentId: null,
        createdBy: ALICE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    )
    await assertSucceeds(
      setDoc(doc(alice, 'workspaces', WS, 'files', 'free-file'), {
        name: 'nota.txt',
        path: 'firestore://free-file',
        url: '',
        size: 10,
        contentType: 'text/plain',
        uploadedBy: ALICE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        folderId: 'folder-a',
        trashedAt: null,
        backend: 'firestore',
      }),
    )
    await assertSucceeds(
      setDoc(doc(alice, 'workspaces', WS, 'files', 'free-file', 'data', 'main'), {
        data: 'data:text/plain;base64,aG9sYQ==',
        size: 10,
      }),
    )
    await assertSucceeds(
      getDoc(doc(bob, 'workspaces', WS, 'files', 'free-file', 'data', 'main')),
    )
    await assertFails(
      setDoc(doc(bob, 'workspaces', WS, 'files', 'free-file', 'data', 'main'), {
        data: 'data:text/plain;base64,aGFja2Vk',
        size: 10,
      }),
    )
    await assertSucceeds(
      setDoc(doc(alice, 'workspaces', WS, 'files', 'free-file', 'data', 'main'), {
        data: 'data:text/plain;base64,bnVldm8=',
        size: 10,
      }),
    )
    await assertSucceeds(
      updateDoc(doc(alice, 'workspaces', WS, 'files', 'free-file'), {
        name: 'nota-renombrada.txt',
        folderId: null,
        trashedAt: new Date().toISOString(),
      }),
    )
    await assertSucceeds(
      deleteDoc(doc(alice, 'workspaces', WS, 'folders', 'folder-a')),
    )
    await assertFails(
      deleteDoc(doc(bob, 'workspaces', WS, 'folders', 'folder-a')),
    )
  })

  it('respeta canales privados', async () => {
    await seedWorkspace()
    await assertFails(getDoc(doc(dbFor(BOB), 'workspaces', WS, 'channels', 'ch-private')))
    await assertFails(
      getDoc(doc(dbFor(BOB), 'workspaces', WS, 'channels', 'ch-private', 'messages', 'x')),
    )
    await assertSucceeds(getDoc(doc(dbFor(ALICE), 'workspaces', WS, 'channels', 'ch-private')))
    await assertSucceeds(
      updateDoc(doc(dbFor(ALICE), 'workspaces', WS, 'channels', 'ch-private'), {
        memberIds: [ALICE, BOB],
      }),
    )
    await assertSucceeds(getDoc(doc(dbFor(BOB), 'workspaces', WS, 'channels', 'ch-private')))
  })

  it('solo permite listar los canales visibles', async () => {
    await seedWorkspace()
    const snapshot = await getDocs(
      query(
        collection(dbFor(BOB), 'workspaces', WS, 'channels'),
        where('type', '==', 'public'),
      ),
    )
    expect(snapshot.docs.map((item) => item.id)).toEqual(['ch-public'])
  })

  it('comparte escritura y lectura por canal sin permitir suplantación', async () => {
    await seedWorkspace()
    const typing = (db: ReturnType<typeof dbFor>, uid: string) =>
      doc(db, 'workspaces', WS, 'channels', 'ch-public', 'typing', uid)
    const reads = (db: ReturnType<typeof dbFor>, uid: string) =>
      doc(db, 'workspaces', WS, 'channels', 'ch-public', 'reads', uid)

    // Cada miembro publica su propio estado.
    await assertSucceeds(
      setDoc(typing(dbFor(BOB), BOB), {
        uid: BOB,
        displayName: 'Bob',
        updatedAt: new Date().toISOString(),
      }),
    )
    await assertSucceeds(
      setDoc(reads(dbFor(BOB), BOB), { uid: BOB, lastReadAt: new Date().toISOString() }),
    )
    await assertFails(
      setDoc(typing(dbFor(BOB), ALICE), {
        uid: ALICE,
        displayName: 'Alice',
        updatedAt: new Date().toISOString(),
      }),
    )
    await assertFails(
      setDoc(reads(dbFor(BOB), ALICE), { uid: ALICE, lastReadAt: new Date().toISOString() }),
    )

    // Los demás miembros pueden ver el estado del canal.
    await assertSucceeds(getDoc(typing(dbFor(ALICE), BOB)))
    await assertSucceeds(getDocs(collection(dbFor(ALICE), 'workspaces', WS, 'channels', 'ch-public', 'typing')))
    await assertSucceeds(getDocs(collection(dbFor(ALICE), 'workspaces', WS, 'channels', 'ch-public', 'reads')))

    // Un intruso ajeno al espacio no accede.
    await assertFails(getDoc(typing(dbFor(CHARLIE), BOB)))
    await assertFails(
      setDoc(typing(dbFor(CHARLIE), CHARLIE), {
        uid: CHARLIE,
        displayName: 'Charlie',
        updatedAt: new Date().toISOString(),
      }),
    )

    // Retirar el indicador propio sí está permitido.
    await assertSucceeds(deleteDoc(typing(dbFor(BOB), BOB)))
  })
})

describe('push nativo', () => {
  it('solo el dueño gestiona sus dispositivos', async () => {
    const device = {
      token: 'fcm-token-de-prueba-1234567890',
      platform: 'android',
      appVersion: '1.0.0',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await assertSucceeds(
      setDoc(doc(dbFor(ALICE), 'users', ALICE, 'devices', 'device-1'), device),
    )
    await assertSucceeds(getDoc(doc(dbFor(ALICE), 'users', ALICE, 'devices', 'device-1')))
    await assertFails(getDoc(doc(dbFor(BOB), 'users', ALICE, 'devices', 'device-1')))
    await assertFails(
      setDoc(doc(dbFor(BOB), 'users', ALICE, 'devices', 'device-1'), device),
    )
    await assertFails(
      setDoc(doc(dbFor(ALICE), 'users', ALICE, 'devices', 'device-2'), {
        ...device,
        platform: 'windows',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(dbFor(ALICE), 'users', ALICE, 'devices', 'device-1'), { enabled: false }),
    )
  })

  it('crea eventos de outbox solo como miembro y sin procesar', async () => {
    await seedWorkspace()
    const event = {
      kind: 'message.created',
      workspaceId: WS,
      actorId: ALICE,
      createdBy: ALICE,
      channelId: 'ch-public',
      boardId: null,
      taskId: null,
      messageId: 'm1',
      commentId: null,
      changedFields: [],
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    }
    await assertSucceeds(setDoc(doc(dbFor(ALICE), 'pushOutbox', 'event-1'), event))
    await assertFails(setDoc(doc(dbFor(BOB), 'pushOutbox', 'event-2'), event))
    await assertFails(
      setDoc(doc(dbFor(ALICE), 'pushOutbox', 'event-3'), {
        ...event,
        status: 'processed',
      }),
    )
    await assertFails(
      setDoc(doc(dbFor(ALICE), 'pushOutbox', 'event-4'), {
        ...event,
        createdBy: BOB,
      }),
    )
    await assertFails(getDoc(doc(dbFor(ALICE), 'pushOutbox', 'event-1')))
  })
})

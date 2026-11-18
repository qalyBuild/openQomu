import { addDoc, collection, doc, getDocFromServer } from 'firebase/firestore'
import type { PushOutbox } from '@/domain/ports'
import type { PushEvent } from '@/domain/entities/push'
import { isBoardMuted } from '@/domain/entities/kanban'
import { createPushEvent } from '@/domain/services/push-service'
import { getFirebaseAuth, getFirebaseDb } from './client'
import { readPushUrl } from './config'
import { nowIso } from './firestore-utils'

/**
 * Outbox en Firestore + entrega inmediata best-effort al Worker.
 * Si la llamada falla, el cron del Worker procesa el evento igualmente.
 */
export class FirebasePushOutbox implements PushOutbox {
  async enqueue(event: PushEvent): Promise<string | null> {
    const normalized = createPushEvent({
      ...event,
      now: event.createdAt,
    })
    const database = getFirebaseDb()
    if (normalized.boardId) {
      const board = await getDocFromServer(doc(database, 'workspaces', normalized.workspaceId, 'boards', normalized.boardId))
      if (!board.exists() || isBoardMuted(board.data().status)) return null
    }
    const reference = await addDoc(collection(database, 'pushOutbox'), {
      kind: normalized.kind,
      workspaceId: normalized.workspaceId,
      actorId: normalized.actorId,
      createdBy: normalized.actorId,
      channelId: normalized.channelId ?? null,
      boardId: normalized.boardId ?? null,
      taskId: normalized.taskId ?? null,
      messageId: normalized.messageId ?? null,
      commentId: normalized.commentId ?? null,
      changedFields: normalized.changedFields ?? [],
      createdAt: normalized.createdAt || nowIso(),
      status: 'pending',
      attempts: 0,
    })
    return reference.id
  }

  async dispatch(outboxId: string): Promise<void> {
    const url = readPushUrl()
    if (!url) return
    const user = getFirebaseAuth().currentUser
    if (!user) return
    try {
      const token = await user.getIdToken()
      await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ outboxId }),
      })
    } catch (error) {
      console.warn('[openqomu] push dispatch diferido al cron', error)
    }
  }
}

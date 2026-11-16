import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { User } from '@/domain/entities/identity'
import type { SessionUser, Subscriber, Unsubscribe, UserRepository } from '@/domain/ports'
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'
import { mapUser } from './mappers'

function userRef(uid: string) {
  return doc(getFirebaseDb(), 'users', uid)
}

async function memberWorkspaces(uid: string) {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'workspaces'), where('memberIds', 'array-contains', uid)),
  )
  return snapshot.docs.map((workspace) => workspace.id)
}

function profileFields(user: SessionUser) {
  return {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  }
}

export class FirebaseUserRepository implements UserRepository {
  async getProfile(uid: string): Promise<User | null> {
    const snapshot = await getDoc(userRef(uid))
    return snapshot.exists() ? mapUser(snapshot.id, snapshot.data()) : null
  }

  async ensureProfile(user: SessionUser): Promise<User> {
    const reference = userRef(user.id)
    const existing = await getDoc(reference)
    const now = nowIso()
    if (!existing.exists()) {
      await setDoc(reference, {
        ...profileFields(user),
        createdAt: now,
        lastActiveAt: now,
      })
      return {
        id: user.id,
        ...profileFields(user),
        createdAt: now,
        lastActiveAt: now,
      }
    }
    const existingData = existing.data()
    // Respeta el nombre que el usuario haya elegido en openQomu.
    const displayName =
      typeof existingData.displayName === 'string' && existingData.displayName.trim()
        ? existingData.displayName
        : user.displayName
    await setDoc(
      reference,
      { ...profileFields(user), displayName, lastActiveAt: now },
      { merge: true },
    )
    return {
      ...mapUser(existing.id, { ...existingData, ...profileFields(user), displayName }),
      lastActiveAt: now,
    }
  }

  async updateProfile(uid: string, patch: Partial<Pick<User, 'displayName'>>): Promise<void> {
    if (!patch.displayName) return
    const displayName = patch.displayName.trim()
    if (!displayName) return
    await updateDoc(userRef(uid), { displayName })
    const workspaceIds = await memberWorkspaces(uid)
    if (workspaceIds.length === 0) return
    const batch = writeBatch(getFirebaseDb())
    for (const workspaceId of workspaceIds) {
      batch.update(doc(getFirebaseDb(), 'workspaces', workspaceId, 'members', uid), { displayName })
    }
    await batch.commit()
  }

  async touch(uid: string): Promise<void> {
    const now = nowIso()
    const workspaceIds = await memberWorkspaces(uid)
    const batch = writeBatch(getFirebaseDb())
    batch.update(userRef(uid), { lastActiveAt: now })
    for (const workspaceId of workspaceIds) {
      batch.update(doc(getFirebaseDb(), 'workspaces', workspaceId, 'members', uid), {
        lastActiveAt: now,
      })
    }
    await batch.commit()
  }

  subscribeProfile(uid: string, callback: Subscriber<User | null>): Unsubscribe {
    return onSnapshot(userRef(uid), (snapshot) => {
      callback(snapshot.exists() ? mapUser(snapshot.id, snapshot.data()) : null)
    })
  }
}

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import type { McpTokenRepository } from '@/domain/ports'
import type { McpScope, McpToken, McpTokenDraft } from '@/domain/entities/ai'
import { getFirebaseDb } from './client'
import { nowIso } from './firestore-utils'

function db() {
  return getFirebaseDb()
}

function tokensCol() {
  return collection(db(), 'mcpTokens')
}

function tokenRef(tokenId: string) {
  return doc(db(), 'mcpTokens', tokenId)
}

function mapToken(id: string, data: Record<string, unknown>): McpToken {
  const scopes = Array.isArray(data.scopes)
    ? data.scopes.filter(
        (scope): scope is McpScope => scope === 'openqomu:read' || scope === 'openqomu:write',
      )
    : []
  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    label: typeof data.label === 'string' ? data.label : 'Token',
    scopes,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : nowIso(),
    lastUsedAt: typeof data.lastUsedAt === 'string' ? data.lastUsedAt : null,
    revokedAt: typeof data.revokedAt === 'string' ? data.revokedAt : null,
    secret: typeof data.secret === 'string' ? data.secret : null,
  }
}

export class FirebaseMcpTokenRepository implements McpTokenRepository {
  async list(uid: string): Promise<McpToken[]> {
    const snapshot = await getDocs(query(tokensCol(), where('uid', '==', uid)))
    return snapshot.docs
      .map((document) => mapToken(document.id, document.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async create(input: McpTokenDraft): Promise<McpToken> {
    const createdAt = nowIso()
    const token: McpToken = {
      id: input.tokenHash,
      uid: input.uid,
      label: input.label,
      scopes: input.scopes,
      createdAt,
      lastUsedAt: null,
      revokedAt: null,
      secret: input.secret,
    }
    await setDoc(tokenRef(input.tokenHash), {
      uid: token.uid,
      label: token.label,
      scopes: token.scopes,
      createdAt: token.createdAt,
      lastUsedAt: null,
      revokedAt: null,
      secret: token.secret,
    })
    return token
  }

  async remove(_uid: string, tokenId: string): Promise<void> {
    await deleteDoc(tokenRef(tokenId))
  }
}

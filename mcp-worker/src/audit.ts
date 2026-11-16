import type { AuthProps } from './auth'
import type { Env } from './env'
import { createDocument } from './firestore'

export async function auditWrite(
  env: Env,
  auth: AuthProps,
  tool: string,
  workspaceId: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await createDocument(env, '', 'mcpAuditLogs', crypto.randomUUID(), {
      tool,
      uid: auth.uid,
      tokenId: auth.tokenId,
      workspaceId,
      detail,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.warn('[openqomu-mcp] no se pudo escribir la auditoría', error)
  }
}

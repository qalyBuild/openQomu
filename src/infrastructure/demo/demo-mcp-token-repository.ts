import type { McpTokenRepository } from '@/domain/ports'
import type { McpToken, McpTokenDraft } from '@/domain/entities/ai'

export class DemoMcpTokenRepository implements McpTokenRepository {
  private tokens: McpToken[] = []

  async list(uid: string): Promise<McpToken[]> {
    return this.tokens
      .filter((token) => token.uid === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async create(input: McpTokenDraft): Promise<McpToken> {
    const token: McpToken = {
      id: input.tokenHash,
      uid: input.uid,
      label: input.label,
      scopes: input.scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      secret: input.secret,
    }
    this.tokens = [token, ...this.tokens]
    return token
  }

  async remove(uid: string, tokenId: string): Promise<void> {
    this.tokens = this.tokens.filter(
      (token) => !(token.uid === uid && token.id === tokenId),
    )
  }
}

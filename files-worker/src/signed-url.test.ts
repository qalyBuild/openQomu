import { describe, expect, it } from 'vitest'
import { signFileUrl, verifyFileUrl } from './signed-url'

describe('signed-url', () => {
  const secret = 'test-secret'
  const workspace = 'ws_123'
  const file = 'file_456'

  it('acepta una firma válida y vigente', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60
    const signature = await signFileUrl(secret, workspace, file, expiresAt)
    expect(await verifyFileUrl(secret, workspace, file, expiresAt, signature)).toBe(true)
  })

  it('rechaza firmas manipuladas', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60
    const signature = await signFileUrl(secret, workspace, file, expiresAt)
    expect(await verifyFileUrl(secret, workspace, 'otro', expiresAt, signature)).toBe(false)
    expect(await verifyFileUrl(secret, workspace, file, expiresAt, `${signature}x`)).toBe(false)
    expect(await verifyFileUrl('otro-secreto', workspace, file, expiresAt, signature)).toBe(false)
  })

  it('rechaza URLs caducadas', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 1
    const signature = await signFileUrl(secret, workspace, file, expiresAt)
    expect(await verifyFileUrl(secret, workspace, file, expiresAt, signature)).toBe(false)
  })
})

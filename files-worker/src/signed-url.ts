function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toBase64Url(new Uint8Array(signature))
}

function equal(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

export async function signFileUrl(
  secret: string,
  workspaceId: string,
  fileId: string,
  expiresAt: number,
): Promise<string> {
  return hmac(secret, `${workspaceId}/${fileId}/${expiresAt}`)
}

export async function verifyFileUrl(
  secret: string,
  workspaceId: string,
  fileId: string,
  expiresAt: number,
  signature: string,
): Promise<boolean> {
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return false
  const expected = await signFileUrl(secret, workspaceId, fileId, expiresAt)
  return equal(expected, signature)
}

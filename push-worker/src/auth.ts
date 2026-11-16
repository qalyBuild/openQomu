import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export interface VerifiedUser {
  uid: string
  email: string | null
}

/** Verifica un Firebase ID token con las claves públicas de Google. */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
): Promise<VerifiedUser> {
  jwks ??= createRemoteJWKSet(new URL(JWKS_URL))
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  const uid =
    typeof payload.user_id === 'string'
      ? payload.user_id
      : typeof payload.sub === 'string'
        ? payload.sub
        : ''
  if (!uid) throw new Error('El token no contiene un usuario.')
  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : null,
  }
}

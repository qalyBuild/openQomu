import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import type { GoogleSignInPort } from '@/domain/ports'
import { readGoogleWebClientId } from '@/infrastructure/firebase/config'

/**
 * Google Sign-In nativo (Credential Manager). Evita el bloqueo de Google
 * a los flujos OAuth dentro de un WebView.
 */
export class CapacitorGoogleSignIn implements GoogleSignInPort {
  private initPromise: Promise<void> | null = null

  isAvailable(): boolean {
    return Capacitor.isNativePlatform()
  }

  private ensureInitialized(): Promise<void> {
    this.initPromise ??= this.initialize()
    return this.initPromise
  }

  private async initialize(): Promise<void> {
    const webClientId = readGoogleWebClientId()
    if (!webClientId) {
      throw new Error('Falta VITE_GOOGLE_WEB_CLIENT_ID para el login nativo.')
    }
    await SocialLogin.initialize({
      google: {
        webClientId,
        skipAuthOnlyAuthorizationAfterSignIn: true,
      },
    })
  }

  async signIn(): Promise<{ idToken: string }> {
    await this.ensureInitialized()
    const response = await SocialLogin.login({
      provider: 'google',
      options: {},
    })
    if (response.provider !== 'google' || response.result.responseType !== 'online') {
      throw new Error('Google no devolvió una sesión válida.')
    }
    const idToken = response.result.idToken
    if (!idToken) {
      throw new Error('Google no devolvió un idToken. Revisa la configuración de OAuth.')
    }
    return { idToken }
  }
}

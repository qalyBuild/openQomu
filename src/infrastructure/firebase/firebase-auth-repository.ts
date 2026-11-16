import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import type {
  AuthPort,
  GoogleSignInPort,
  SessionUser,
  Subscriber,
  Unsubscribe,
} from '@/domain/ports'
import { getFirebaseAuth } from './client'

function toSessionUser(user: FirebaseUser | null): SessionUser | null {
  if (!user) return null
  const fallbackName = user.email?.split('@')[0] ?? 'Usuario'
  return {
    id: user.uid,
    displayName: user.displayName?.trim() || fallbackName,
    email: user.email ?? '',
    photoURL: user.photoURL,
  }
}

export class FirebaseAuthRepository implements AuthPort {
  private readonly nativeGoogle?: GoogleSignInPort

  constructor(nativeGoogle?: GoogleSignInPort) {
    this.nativeGoogle = nativeGoogle
  }

  isDemo(): boolean {
    return false
  }

  getCurrentUser(): SessionUser | null {
    return toSessionUser(getFirebaseAuth().currentUser)
  }

  onAuthStateChanged(callback: Subscriber<SessionUser | null>): Unsubscribe {
    return onAuthStateChanged(getFirebaseAuth(), (user) => callback(toSessionUser(user)))
  }

  async signInWithGoogle(): Promise<SessionUser> {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    if (this.nativeGoogle?.isAvailable()) {
      const { idToken } = await this.nativeGoogle.signIn()
      const credential = await signInWithCredential(
        getFirebaseAuth(),
        GoogleAuthProvider.credential(idToken),
      )
      const session = toSessionUser(credential.user)
      if (!session) throw new Error('No se pudo iniciar sesión con Google.')
      return session
    }

    try {
      const credential = await signInWithPopup(getFirebaseAuth(), provider)
      const session = toSessionUser(credential.user)
      if (!session) throw new Error('No se pudo iniciar sesión con Google.')
      return session
    } catch (error) {
      const code = (error as { code?: string })?.code ?? ''
      // En navegadores móviles o con bloqueo de popups, usa redirect.
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(getFirebaseAuth(), provider)
        // La navegación recarga la app; onAuthStateChanged completará la sesión.
        return new Promise<SessionUser>(() => {})
      }
      throw error
    }
  }

  async signOut(): Promise<void> {
    await signOut(getFirebaseAuth())
  }
}

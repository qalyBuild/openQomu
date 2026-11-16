import type { AuthPort, SessionUser, Subscriber, Unsubscribe } from '@/domain/ports'
import type { DemoStore } from './store'
import { DEMO_USER_ID } from './seed'

const SESSION_KEY = 'openqomu.demo.session.v1'

const DEMO_PROFILE: SessionUser = {
  id: DEMO_USER_ID,
  displayName: 'Alex Rivera',
  email: 'alex@example.com',
  photoURL: null,
}

export interface DemoAuthOptions {
  sessionKey?: string
  profile?: SessionUser
  persistSession?: boolean
}

export class DemoAuthRepository implements AuthPort {
  private readonly store: DemoStore
  private readonly sessionKey: string
  private readonly profile: SessionUser
  private readonly persistSession: boolean
  private current: SessionUser | null
  private listeners = new Set<Subscriber<SessionUser | null>>()

  constructor(store: DemoStore, options: DemoAuthOptions = {}) {
    this.store = store
    this.sessionKey = options.sessionKey ?? SESSION_KEY
    this.profile = options.profile ?? DEMO_PROFILE
    this.persistSession = options.persistSession ?? true
    this.current = this.loadSession()
  }

  isDemo(): boolean {
    return true
  }

  getCurrentUser(): SessionUser | null {
    return this.current
  }

  onAuthStateChanged(callback: Subscriber<SessionUser | null>): Unsubscribe {
    this.listeners.add(callback)
    queueMicrotask(() => {
      if (this.listeners.has(callback)) callback(this.current)
    })
    return () => {
      this.listeners.delete(callback)
    }
  }

  async signInWithGoogle(): Promise<SessionUser> {
    const user = this.store.getState().users[this.profile.id]
    const session: SessionUser = user
      ? {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        }
      : this.profile
    this.current = session
    this.saveSession(session)
    this.emit()
    return session
  }

  async signOut(): Promise<void> {
    this.current = null
    this.clearSession()
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.current)
  }

  private loadSession(): SessionUser | null {
    if (!this.persistSession) return null
    try {
      const raw = localStorage.getItem(this.sessionKey)
      return raw ? (JSON.parse(raw) as SessionUser) : null
    } catch {
      return null
    }
  }

  private saveSession(user: SessionUser): void {
    if (!this.persistSession) return
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(user))
    } catch {
      // sesión solo en memoria
    }
  }

  private clearSession(): void {
    try {
      localStorage.removeItem(this.sessionKey)
    } catch {
      // noop
    }
  }
}

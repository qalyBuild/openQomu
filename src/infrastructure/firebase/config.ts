export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

interface EnvLike {
  [key: string]: string | boolean | undefined
  VITE_FIREBASE_API_KEY?: string
  VITE_FIREBASE_AUTH_DOMAIN?: string
  VITE_FIREBASE_PROJECT_ID?: string
  VITE_FIREBASE_STORAGE_BUCKET?: string
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  VITE_FIREBASE_APP_ID?: string
  VITE_DEMO_MODE?: string
  VITE_USE_FIREBASE_EMULATORS?: string
  VITE_PUSH_URL?: string
  VITE_GOOGLE_WEB_CLIENT_ID?: string
}

export function readFirebaseConfig(env: EnvLike = import.meta.env): FirebaseWebConfig | null {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
    appId: env.VITE_FIREBASE_APP_ID?.trim() ?? '',
  }
  const complete = Object.values(config).every((value) => value.length > 0)
  return complete ? config : null
}

export function shouldUseDemoMode(env: EnvLike = import.meta.env): boolean {
  return env.VITE_DEMO_MODE === 'true' || readFirebaseConfig(env) === null
}

export function firebaseEmulatorsEnabled(env: EnvLike = import.meta.env): boolean {
  return env.VITE_USE_FIREBASE_EMULATORS === 'true'
}

/** URL del Worker de push. Sin ella el outbox se entrega solo por cron. */
export function readPushUrl(env: EnvLike = import.meta.env): string | null {
  const value = env.VITE_PUSH_URL?.trim()
  return value ? value : null
}

/** Client ID web de Google, necesario para el login nativo en Android. */
export function readGoogleWebClientId(env: EnvLike = import.meta.env): string | null {
  const value = env.VITE_GOOGLE_WEB_CLIENT_ID?.trim()
  return value ? value : null
}

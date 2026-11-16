import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore'
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage'
import { firebaseEmulatorsEnabled, readFirebaseConfig } from './config'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let emulatorsConnected = false

function getApp(): FirebaseApp {
  if (app) return app
  const config = readFirebaseConfig()
  if (!config) {
    throw new Error('Firebase no está configurado. Añade las variables VITE_FIREBASE_*.')
  }
  app = getApps()[0] ?? initializeApp(config)
  return app
}

export function getFirebaseAuth(): Auth {
  auth ??= getAuth(getApp())
  return auth
}

export function getFirebaseDb(): Firestore {
  db ??= getFirestore(getApp())
  return db
}

export function getFirebaseStorage(): FirebaseStorage {
  storage ??= getStorage(getApp())
  return storage
}

export function connectFirebaseEmulators(): void {
  if (emulatorsConnected || !firebaseEmulatorsEnabled()) return
  emulatorsConnected = true
  connectAuthEmulator(getFirebaseAuth(), 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(getFirebaseDb(), '127.0.0.1', 8080)
  connectStorageEmulator(getFirebaseStorage(), '127.0.0.1', 9199)
}

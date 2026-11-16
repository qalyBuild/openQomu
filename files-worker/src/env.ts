export interface Env {
  FIREBASE_PROJECT_ID: string
  /** JSON del service account con permisos de Firestore. */
  FIREBASE_SERVICE_ACCOUNT: string
  /** Endpoint del almacenamiento compatible con S3. */
  S3_ENDPOINT: string
  S3_REGION: string
  S3_BUCKET: string
  S3_ACCESS_KEY_ID: string
  S3_SECRET_ACCESS_KEY: string
  /** Secreto para firmar las URLs temporales de descarga. */
  FILE_URL_SECRET: string
  FILES_ALLOWED_ORIGINS?: string
}

/** Vida de las URLs firmadas de descarga. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60
/** Tope por archivo aceptado por el Worker (igual que la app). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

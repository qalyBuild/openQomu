export interface Env {
  FIREBASE_PROJECT_ID: string
  FCM_PROJECT_ID?: string
  FIREBASE_SERVICE_ACCOUNT: string
  /** Bucket de Firebase Storage; si falta se deduce de la URL del archivo. */
  FIREBASE_STORAGE_BUCKET?: string
  /** Activa el backfill único de completedAt; apagado por defecto. */
  TASK_BACKFILL_ENABLED?: string
  PUSH_ALLOWED_ORIGINS?: string
}

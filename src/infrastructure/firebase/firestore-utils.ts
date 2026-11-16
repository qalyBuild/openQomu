import {
  getDocs,
  limit,
  query,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function asRecord<T>(value: unknown): Record<string, T> {
  return typeof value === 'object' && value !== null ? (value as Record<string, T>) : {}
}

export function asStringRecord(value: unknown): Record<string, string[]> {
  const record = asRecord<unknown>(value)
  const result: Record<string, string[]> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (Array.isArray(entry)) {
      result[key] = entry.filter((item): item is string => typeof item === 'string')
    }
  }
  return result
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function dataOf(snapshot: { data: () => DocumentData | undefined }): DocumentData {
  return snapshot.data() ?? {}
}

/** Borra todos los documentos de una colección en lotes de 400. */
export async function deleteCollectionDocs(
  db: Firestore,
  reference: CollectionReference,
): Promise<void> {
  for (;;) {
    const snapshot = await getDocs(query(reference, limit(400)))
    if (snapshot.empty) return
    const batch = writeBatch(db)
    for (const document of snapshot.docs) batch.delete(document.ref)
    await batch.commit()
  }
}

export function docPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/')
}

export type FirestoreDocument = DocumentReference

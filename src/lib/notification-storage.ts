import {
  DEFAULT_NOTIFICATION_SOUND_ID,
  isNotificationSoundId,
} from './notification-sound'

export interface NotificationState {
  version: 1
  soundEnabled: boolean
  /** Volumen del tono de aviso, entre 0 y 1. */
  soundVolume: number
  /** Id del sonido del catálogo de `notification-sound`. */
  soundId: string
  /** Última lectura por clave: `channel:<id>`, `pages`, `files`, `members`, `comments`. */
  lastReadAt: Record<string, string>
  fileReadThrough?: number
  /** Ids de avisos ya notificados; sirve para no repetir el sonido. */
  seenNotificationIds: string[]
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_PREFIX = 'openqomu:notifications:v1'
const BASELINE_WINDOW_MS = 24 * 60 * 60 * 1000
export const DEFAULT_SOUND_VOLUME = 0.7

export function notificationStorageKey(uid: string, workspaceId: string): string {
  return `${STORAGE_PREFIX}:${uid}:${workspaceId}`
}

export function defaultNotificationState(now: number = Date.now()): NotificationState {
  const baseline = new Date(now - BASELINE_WINDOW_MS).toISOString()
  return {
    version: 1,
    soundEnabled: true,
    soundVolume: DEFAULT_SOUND_VOLUME,
    soundId: DEFAULT_NOTIFICATION_SOUND_ID,
    lastReadAt: {
      pages: baseline,
      files: baseline,
      members: baseline,
      comments: baseline,
    },
    seenNotificationIds: [],
  }
}

function normalizeVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

function normalize(value: unknown, fallback: NotificationState): NotificationState {
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<NotificationState>
  const lastReadAt: Record<string, string> = {}
  if (candidate.lastReadAt && typeof candidate.lastReadAt === 'object') {
    for (const [key, entry] of Object.entries(candidate.lastReadAt)) {
      if (typeof entry === 'string') lastReadAt[key] = entry
    }
  }
  return {
    version: 1,
    soundEnabled:
      typeof candidate.soundEnabled === 'boolean'
        ? candidate.soundEnabled
        : fallback.soundEnabled,
    soundVolume: normalizeVolume(candidate.soundVolume, fallback.soundVolume),
    soundId: isNotificationSoundId(candidate.soundId)
      ? candidate.soundId
      : fallback.soundId,
    lastReadAt: { ...fallback.lastReadAt, ...lastReadAt },
    fileReadThrough: typeof candidate.fileReadThrough === 'number'
      && Number.isSafeInteger(candidate.fileReadThrough)
      && candidate.fileReadThrough > 0
      && candidate.fileReadThrough <= Date.now()
      ? candidate.fileReadThrough
      : undefined,
    seenNotificationIds: Array.isArray(candidate.seenNotificationIds)
      ? candidate.seenNotificationIds.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function loadNotificationState(
  uid: string,
  workspaceId: string,
  storage: StorageLike | null = browserStorage(),
): NotificationState {
  const fallback = defaultNotificationState()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(notificationStorageKey(uid, workspaceId))
    if (!raw) return fallback
    return normalize(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

export function saveNotificationState(
  uid: string,
  workspaceId: string,
  state: NotificationState,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(notificationStorageKey(uid, workspaceId), JSON.stringify(state))
  } catch {
    // El almacenamiento puede estar bloqueado (modo privado); la app sigue funcionando.
  }
}

function isSameOrOlder(value: string | undefined, next: string): boolean {
  if (!value) return false
  const previous = Date.parse(value)
  const candidate = Date.parse(next)
  if (Number.isNaN(previous) || Number.isNaN(candidate)) return value === next
  return previous >= candidate
}

/** Devuelve el mismo objeto si la marca no supone un avance. */
export function markNotificationRead(
  state: NotificationState,
  key: string,
  at: string = new Date().toISOString(),
): NotificationState {
  if (isSameOrOlder(state.lastReadAt[key], at)) return state
  return {
    ...state,
    lastReadAt: { ...state.lastReadAt, [key]: at },
  }
}

export function advanceFileRead(state: NotificationState, through: number): NotificationState {
  return through > (state.fileReadThrough ?? 0) ? { ...state, fileReadThrough: through } : state
}

/** Una marca distinta del valor inicial común indica una visita en el formato anterior. */
export function legacyFileVisit(state: NotificationState): number {
  const { files, pages, members, comments } = state.lastReadAt
  if ([pages, members, comments].includes(files)) return 0
  const time = Date.parse(files)
  return time > 0 && time <= Date.now() ? time : 0
}

export function setSoundEnabled(state: NotificationState, enabled: boolean): NotificationState {
  if (state.soundEnabled === enabled) return state
  return { ...state, soundEnabled: enabled }
}

/** Ajusta el volumen al rango 0..1; un valor inválido conserva el actual. */
export function setSoundVolume(state: NotificationState, volume: number): NotificationState {
  const next = normalizeVolume(volume, state.soundVolume)
  if (next === state.soundVolume) return state
  return { ...state, soundVolume: next }
}

/** Cambia el sonido; un id fuera del catálogo vuelve al sonido por defecto. */
export function setNotificationSound(
  state: NotificationState,
  soundId: string,
): NotificationState {
  const next = isNotificationSoundId(soundId) ? soundId : DEFAULT_NOTIFICATION_SOUND_ID
  if (next === state.soundId) return state
  return { ...state, soundId: next }
}

export function setSeenNotificationIds(
  state: NotificationState,
  ids: readonly string[],
): NotificationState {
  if (
    ids.length === state.seenNotificationIds.length &&
    ids.every((id, index) => id === state.seenNotificationIds[index])
  ) {
    return state
  }
  return { ...state, seenNotificationIds: [...ids] }
}

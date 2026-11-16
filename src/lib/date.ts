const DATE_LOCALE = 'es-ES'

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

export function startOfDay(value: string | Date): Date {
  const date = toDate(value)
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function dayKey(value: string | Date): string {
  const date = toDate(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const diff = startOfDay(a).getTime() - startOfDay(b).getTime()
  return Math.round(diff / 86_400_000)
}

export function formatRelative(value: string, now: Date = new Date()): string {
  const date = new Date(value)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'ayer'
  if (diffDays < 7) return `hace ${diffDays} d`
  return new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short' }).format(date)
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatShortDate(value: string): string {
  const date = new Date(value)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}

/** `dueDate` usa formato YYYY-MM-DD (sin hora). */
export function formatDueDate(dueDate: string | null, now: Date = new Date()): string {
  if (!dueDate) return 'Sin fecha'
  const diff = daysBetween(dueDate, now)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  const [year, month, day] = dueDate.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(year === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date)
}

/** Una tarea vence cuando el día límite es anterior a hoy. */
export function isOverdue(dueDate: string | null, now: Date = new Date()): boolean {
  if (!dueDate) return false
  return daysBetween(dueDate, now) < 0
}

export function isDueSoon(dueDate: string | null, now: Date = new Date(), days = 7): boolean {
  if (!dueDate) return false
  const diff = daysBetween(dueDate, now)
  return diff >= 0 && diff <= days
}

export function addDays(value: string | Date, amount: number): Date {
  const date = new Date(toDate(value))
  date.setDate(date.getDate() + amount)
  return date
}

export function timeAgoClock(now: Date = new Date()): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)
}

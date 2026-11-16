export function isRecentlyActive(lastActiveAt: string | null, minutes = 5): boolean {
  if (!lastActiveAt) return false
  const timestamp = new Date(lastActiveAt).getTime()
  if (Number.isNaN(timestamp)) return false
  return Date.now() - timestamp < minutes * 60_000
}

export function sortByPresence<T extends { lastActiveAt: string | null; displayName: string }>(
  people: T[],
): T[] {
  return [...people].sort((a, b) => {
    const onlineA = isRecentlyActive(a.lastActiveAt) ? 0 : 1
    const onlineB = isRecentlyActive(b.lastActiveAt) ? 0 : 1
    return onlineA - onlineB || a.displayName.localeCompare(b.displayName, 'es')
  })
}

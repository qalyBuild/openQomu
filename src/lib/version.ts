/** Comparación simple de versiones semánticas tipo 1.2.3. */
export function parseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => {
      const parsed = Number.parseInt(part, 10)
      return Number.isFinite(parsed) ? parsed : 0
    })
}

export function isVersionNewer(candidate: string, current: string): boolean {
  const next = parseVersion(candidate)
  const installed = parseVersion(current)
  const length = Math.max(next.length, installed.length)
  for (let index = 0; index < length; index += 1) {
    const a = next[index] ?? 0
    const b = installed[index] ?? 0
    if (a !== b) return a > b
  }
  return false
}

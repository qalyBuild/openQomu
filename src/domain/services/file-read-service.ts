import type { FileMeta } from '@/domain/entities/chat'

/** La marca corresponde a un archivo cargado, con la misma precisión que el contador. */
export function latestFileReadThrough(files: readonly FileMeta[], limit = Infinity): number {
  let through = 0
  for (const file of files) {
    const createdAt = Date.parse(file.createdAt)
    if (!file.trashedAt && createdAt > through && createdAt <= limit) through = createdAt
  }
  return through
}

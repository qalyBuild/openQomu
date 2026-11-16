import { TASK_LABELS, type Board } from '@/domain/entities/kanban'

/**
 * Etiquetas de la tarea que aún no pertenecen al tablero.
 * Se guardan en `customLabels` para que no desaparezcan al quedarse sin uso.
 */
export function missingBoardLabels(board: Board, labels: string[]): string[] {
  const defaults = new Set<string>(TASK_LABELS)
  const current = new Set(board.customLabels ?? [])
  return labels
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length > 0 && !defaults.has(label) && !current.has(label))
    .filter((label, index, list) => list.indexOf(label) === index)
}

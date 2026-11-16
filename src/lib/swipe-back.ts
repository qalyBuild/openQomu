/**
 * Detecta gestos horizontales de navegación en pantallas táctiles.
 *
 * - Derecha: abre el panel lateral (como Discord/Telegram Mobile).
 * - Izquierda: lo cierra si el gesto empieza dentro del panel.
 *
 * No se reservan los bordes: el gesto funciona desde cualquier punto de la
 * pantalla. Es una función pura para poder probarla sin DOM.
 */
export type SwipeDirection = 'left' | 'right'

export interface SwipeInput {
  startX: number
  startY: number
  endX: number
  endY: number
  /** Distancia horizontal mínima para considerarlo un swipe. */
  distanceThreshold?: number
  /** Desviación vertical máxima permitida. */
  verticalTolerance?: number
}

export const SWIPE_DISTANCE_PX = 56
export const SWIPE_VERTICAL_PX = 60

export function resolveSwipe({
  startX,
  startY,
  endX,
  endY,
  distanceThreshold = SWIPE_DISTANCE_PX,
  verticalTolerance = SWIPE_VERTICAL_PX,
}: SwipeInput): SwipeDirection | null {
  const dx = endX - startX
  const dy = endY - startY

  if (Math.abs(dx) < distanceThreshold) return null
  if (Math.abs(dx) <= Math.abs(dy)) return null
  if (Math.abs(dy) > verticalTolerance) return null

  return dx > 0 ? 'right' : 'left'
}

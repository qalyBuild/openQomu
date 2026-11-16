import { useEffect, useRef } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'
import {
  resolveSwipe,
  type SwipeDirection,
} from '@/lib/swipe-back'

function elementFrom(target: EventTarget | null): HTMLElement | null {
  if (typeof Element === 'undefined') return null
  return target instanceof Element ? (target as HTMLElement) : null
}

const BASE_IGNORE =
  'input, textarea, select, [contenteditable="true"], [data-no-swipe], .overflow-x-auto, .overflow-x-scroll'

/** En la ventana también ignoramos diálogos y popovers abiertos. */
const GLOBAL_IGNORE = `${BASE_IGNORE}, [role="dialog"], [data-radix-popper-content-wrapper], [data-sonner-toaster]`

function shouldIgnore(target: EventTarget | null, selector: string): boolean {
  return elementFrom(target)?.closest(selector) != null
}

function point(touch: { clientX: number; clientY: number } | undefined): { x: number; y: number } | null {
  return touch ? { x: touch.clientX, y: touch.clientY } : null
}

/**
 * Gesto global en pantallas táctiles. No depende de `pointer: coarse` porque
 * algunos WebView de Android no lo reportan aunque haya pantalla táctil.
 */
export function useSwipeNavigation(onSwipe: (direction: SwipeDirection) => void) {
  const callback = useRef(onSwipe)

  useEffect(() => {
    callback.current = onSwipe
  }, [onSwipe])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return

    let start: { x: number; y: number } | null = null

    const begin = (event: TouchEvent) => {
      if (event.touches.length !== 1 || shouldIgnore(event.target, GLOBAL_IGNORE)) {
        start = null
        return
      }
      start = point(event.touches[0])
    }

    const fire = (current: { x: number; y: number } | null) => {
      if (!start || !current) return
      const direction = resolveSwipe({
        startX: start.x,
        startY: start.y,
        endX: current.x,
        endY: current.y,
      })
      if (!direction) return
      start = null
      callback.current(direction)
    }

    const move = (event: TouchEvent) => fire(point(event.touches[0]))
    const end = (event: TouchEvent) => fire(point(event.changedTouches[0]))
    const reset = () => {
      start = null
    }

    const options: AddEventListenerOptions = { passive: true, capture: true }
    window.addEventListener('touchstart', begin, options)
    window.addEventListener('touchmove', move, options)
    window.addEventListener('touchend', end, options)
    window.addEventListener('touchcancel', reset, options)
    return () => {
      window.removeEventListener('touchstart', begin, options)
      window.removeEventListener('touchmove', move, options)
      window.removeEventListener('touchend', end, options)
      window.removeEventListener('touchcancel', reset, options)
    }
  }, [])
}

/**
 * Los mismos gestos, pero limitados a un elemento. Se usa en el panel lateral
 * para cerrarlo deslizando hacia la izquierda desde cualquier parte del panel.
 */
export function useSwipeHandlers(onSwipe: (direction: SwipeDirection) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)

  const fire = (touch: { clientX: number; clientY: number } | undefined) => {
    const current = point(touch)
    if (!start.current || !current) return
    const direction = resolveSwipe({
      startX: start.current.x,
      startY: start.current.y,
      endX: current.x,
      endY: current.y,
    })
    if (!direction) return
    start.current = null
    onSwipe(direction)
  }

  return {
    onTouchStart: (event: ReactTouchEvent) => {
      if (event.touches.length !== 1 || shouldIgnore(event.target, BASE_IGNORE)) {
        start.current = null
        return
      }
      start.current = point(event.touches[0])
    },
    onTouchMove: (event: ReactTouchEvent) => fire(event.touches[0]),
    onTouchEnd: (event: ReactTouchEvent) => fire(event.changedTouches[0]),
    onTouchCancel: () => {
      start.current = null
    },
  }
}

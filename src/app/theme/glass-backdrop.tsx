import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../theme-provider'
import { attachGlassRefraction, supportsBackdropRefraction, trackGlassHighlights } from './glass-refraction'
import { startGlassShader } from './glass-webgl'

export function GlassBackdrop() {
  const { theme } = useTheme()
  const glass = theme.options.glass
  const enabled = theme.options.effects.includes('glass') && Boolean(glass)
  const definitionsRef = useRef<SVGDefsElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [webgl, setWebgl] = useState(false)
  const renderer = glass?.renderer ?? 'auto'
  const quality = glass?.quality ?? 'auto'

  useEffect(() => {
    const definitions = definitionsRef.current
    if (!glass || !enabled || !definitions) return

    const opaque = window.matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let detach: (() => void) | undefined
    let stopHighlights: (() => void) | undefined
    const update = () => {
      detach?.()
      stopHighlights?.()
      detach = undefined
      stopHighlights = undefined
      if (opaque.matches) return
      if (glass.renderer === 'auto' && glass.svg && glass.lensing > 0 && supportsBackdropRefraction()) {
        detach = attachGlassRefraction(definitions, glass)
      }
      if (!motion.matches) stopHighlights = trackGlassHighlights()
    }
    update()
    opaque.addEventListener('change', update)
    motion.addEventListener('change', update)
    return () => {
      opaque.removeEventListener('change', update)
      motion.removeEventListener('change', update)
      detach?.()
      stopHighlights?.()
    }
  }, [enabled, glass])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!enabled || !canvas) return

    const cssOnly = window.matchMedia(
      '(max-width: 1023px), (pointer: coarse), (prefers-reduced-transparency: reduce), (forced-colors: active)',
    )
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let stop: (() => void) | undefined
    const update = () => {
      stop?.()
      stop = undefined
      setWebgl(false)
      if (renderer !== 'webgl' || cssOnly.matches) return

      stop = startGlassShader(canvas, {
        lightMode: theme.scheme === 'light',
        quality,
        reducedMotion: motion.matches,
        onDegrade: () => setWebgl(false),
      }) ?? undefined
      setWebgl(Boolean(stop))
    }
    update()
    cssOnly.addEventListener('change', update)
    motion.addEventListener('change', update)
    return () => {
      cssOnly.removeEventListener('change', update)
      motion.removeEventListener('change', update)
      stop?.()
    }
  }, [enabled, quality, renderer, theme.id, theme.scheme])

  if (!enabled) return null

  return createPortal(
    <div
      className="glass-backdrop"
      data-renderer={webgl ? 'webgl' : 'css'}
      aria-hidden="true"
    >
      {renderer === 'webgl' && <div className="glass-backdrop-mesh" />}
      <svg className="glass-backdrop-filter" focusable="false">
        <defs ref={definitionsRef} />
      </svg>
      <canvas
        ref={canvasRef}
        className="glass-backdrop-canvas"
        hidden={!webgl}
        aria-hidden="true"
      />
    </div>,
    document.body,
  )
}

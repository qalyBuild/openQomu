import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../theme-provider'
import { startGlassShader } from './glass-webgl'

export function GlassBackdrop() {
  const { theme } = useTheme()
  const glass = theme.options.glass
  const enabled = theme.options.effects.includes('glass') && Boolean(glass)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [webgl, setWebgl] = useState(false)
  const renderer = glass?.renderer ?? 'auto'
  const quality = glass?.quality ?? 'auto'

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
      if (renderer === 'css' || cssOnly.matches) return

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
      <div className="glass-backdrop-mesh" />
      <svg className="glass-backdrop-filter" focusable="false">
        <filter id="glass-refraction" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.014"
            numOctaves="2"
            seed="5"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.6" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
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

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
    if (!enabled || !canvasRef.current) return
    setWebgl(false)
    if (renderer === 'css') return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stop = startGlassShader(canvasRef.current, {
      lightMode: theme.scheme === 'light',
      quality,
      reducedMotion,
      onDegrade: () => setWebgl(false),
    })
    if (!stop) return
    setWebgl(true)
    return stop
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

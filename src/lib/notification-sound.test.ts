import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_NOTIFICATION_SOUND_ID,
  NOTIFICATION_SOUNDS,
  playNotificationSound,
  type AudioContextLike,
} from './notification-sound'

function fakeContext(state: string = 'running'): AudioContextLike & {
  createOscillator: ReturnType<typeof vi.fn>
  createGain: ReturnType<typeof vi.fn>
  gains: Array<{
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
    }
  }>
} {
  const gains: Array<{
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
    }
  }> = []
  const oscillator = {
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  return {
    state,
    currentTime: 1,
    destination: {},
    gains,
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
      gains.push(gain)
      return gain
    }),
  }
}

describe('playNotificationSound', () => {
  it('no hace nada si no hay contexto de audio', () => {
    expect(playNotificationSound(null)).toBe(false)
    expect(playNotificationSound(undefined)).toBe(false)
  })

  it('no suena si el contexto sigue suspendido', () => {
    const context = fakeContext('suspended')
    expect(playNotificationSound(context)).toBe(false)
    expect(context.createOscillator).not.toHaveBeenCalled()
  })

  it('programa dos tonos suaves cuando el audio está listo', () => {
    const context = fakeContext('running')
    expect(playNotificationSound(context)).toBe(true)
    expect(context.createOscillator).toHaveBeenCalledTimes(2)
    expect(context.createGain).toHaveBeenCalledTimes(2)
  })

  it('escala el volumen del tono y lo limita a 0..1', () => {
    const medium = fakeContext('running')
    playNotificationSound(medium, 0.5)
    expect(medium.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.16, 1.02)

    const loud = fakeContext('running')
    playNotificationSound(loud, 2)
    expect(loud.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.32, 1.02)
  })

  it('no suena con volumen cero', () => {
    const context = fakeContext('running')
    expect(playNotificationSound(context, 0)).toBe(false)
    expect(context.createOscillator).not.toHaveBeenCalled()
  })

  it('ofrece diez sonidos únicos con al menos un tono', () => {
    expect(NOTIFICATION_SOUNDS).toHaveLength(10)
    expect(new Set(NOTIFICATION_SOUNDS.map((sound) => sound.id)).size).toBe(10)
    expect(NOTIFICATION_SOUNDS.every((sound) => sound.tones.length > 0)).toBe(true)
    expect(NOTIFICATION_SOUNDS.some((sound) => sound.id === DEFAULT_NOTIFICATION_SOUND_ID)).toBe(
      true,
    )
  })

  it('reproduce la secuencia de tonos de cada sonido', () => {
    for (const sound of NOTIFICATION_SOUNDS) {
      const context = fakeContext('running')
      expect(playNotificationSound(context, 1, sound.id)).toBe(true)
      expect(context.createOscillator).toHaveBeenCalledTimes(sound.tones.length)
      expect(context.createGain).toHaveBeenCalledTimes(sound.tones.length)
    }
  })

  it('cae al sonido por defecto cuando el id no existe', () => {
    const unknown = fakeContext('running')
    const fallback = fakeContext('running')
    playNotificationSound(unknown, 1, 'no-existe' as never)
    playNotificationSound(fallback, 1, DEFAULT_NOTIFICATION_SOUND_ID)
    expect(unknown.createOscillator).toHaveBeenCalledTimes(
      fallback.createOscillator.mock.calls.length,
    )
  })
})

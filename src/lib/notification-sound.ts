interface AudioParamLike {
  setValueAtTime(value: number, startTime: number): void
  exponentialRampToValueAtTime(value: number, endTime: number): void
}

interface OscillatorLike {
  type: string
  frequency: AudioParamLike
  connect(node: unknown): void
  start(when?: number): void
  stop(when?: number): void
}

interface GainLike {
  gain: AudioParamLike
  connect(node: unknown): void
}

/** Lo mínimo que necesitamos de `AudioContext`, para poder probarlo. */
export interface AudioContextLike {
  state?: string
  currentTime: number
  destination: unknown
  createOscillator(): OscillatorLike
  createGain(): GainLike
}

export type NotificationSoundWave = 'sine' | 'triangle' | 'square' | 'sawtooth'

export interface NotificationTone {
  frequency: number
  /** Segundos desde el inicio del aviso. */
  delay: number
  /** Duración del tono en segundos. */
  duration: number
}

export interface NotificationSound {
  id: string
  name: string
  description: string
  wave: NotificationSoundWave
  tones: readonly NotificationTone[]
}

/**
 * Catálogo de sonidos de aviso. Todos se sintetizan con Web Audio: no hay
 * archivos que descargar y el volumen del usuario escala la ganancia global.
 */
export const NOTIFICATION_SOUNDS: readonly NotificationSound[] = [
  {
    id: 'soft',
    name: 'Suave',
    description: 'Dos notas ascendentes, discreto.',
    wave: 'sine',
    tones: [
      { frequency: 880, delay: 0, duration: 0.12 },
      { frequency: 1174.66, delay: 0.13, duration: 0.16 },
    ],
  },
  {
    id: 'chime',
    name: 'Campana',
    description: 'Una campana corta y luminosa.',
    wave: 'sine',
    tones: [
      { frequency: 1318.51, delay: 0, duration: 0.2 },
      { frequency: 1760, delay: 0.1, duration: 0.3 },
    ],
  },
  {
    id: 'ping',
    name: 'Ping',
    description: 'Un aviso rápido y seco.',
    wave: 'triangle',
    tones: [
      { frequency: 1046.5, delay: 0, duration: 0.1 },
      { frequency: 1567.98, delay: 0.1, duration: 0.12 },
    ],
  },
  {
    id: 'drop',
    name: 'Gota',
    description: 'Tres notas que caen.',
    wave: 'sine',
    tones: [
      { frequency: 1318.51, delay: 0, duration: 0.1 },
      { frequency: 987.77, delay: 0.1, duration: 0.14 },
      { frequency: 659.25, delay: 0.22, duration: 0.2 },
    ],
  },
  {
    id: 'marimba',
    name: 'Marimba',
    description: 'Arpegio cálido de tres notas.',
    wave: 'triangle',
    tones: [
      { frequency: 523.25, delay: 0, duration: 0.14 },
      { frequency: 659.25, delay: 0.1, duration: 0.14 },
      { frequency: 783.99, delay: 0.2, duration: 0.2 },
    ],
  },
  {
    id: 'pop',
    name: 'Pop',
    description: 'Un chasquido corto y alegre.',
    wave: 'sine',
    tones: [
      { frequency: 600, delay: 0, duration: 0.06 },
      { frequency: 900, delay: 0.06, duration: 0.08 },
    ],
  },
  {
    id: 'pulse',
    name: 'Pulso',
    description: 'Dos pulsos electrónicos.',
    wave: 'square',
    tones: [
      { frequency: 740, delay: 0, duration: 0.08 },
      { frequency: 740, delay: 0.14, duration: 0.08 },
    ],
  },
  {
    id: 'breeze',
    name: 'Brisa',
    description: 'Tres notas largas y aireadas.',
    wave: 'sine',
    tones: [
      { frequency: 987.77, delay: 0, duration: 0.16 },
      { frequency: 1318.51, delay: 0.1, duration: 0.18 },
      { frequency: 1567.98, delay: 0.2, duration: 0.24 },
    ],
  },
  {
    id: 'alert',
    name: 'Alerta',
    description: 'Tres pulsos firmes para lo urgente.',
    wave: 'triangle',
    tones: [
      { frequency: 880, delay: 0, duration: 0.09 },
      { frequency: 880, delay: 0.12, duration: 0.09 },
      { frequency: 1174.66, delay: 0.24, duration: 0.16 },
    ],
  },
  {
    id: 'bell',
    name: 'Campana doble',
    description: 'Dos campanadas superpuestas.',
    wave: 'sine',
    tones: [
      { frequency: 1567.98, delay: 0, duration: 0.18 },
      { frequency: 2093, delay: 0.16, duration: 0.24 },
    ],
  },
]

export const DEFAULT_NOTIFICATION_SOUND_ID = 'soft'

/** Sonido del catálogo, o el de por defecto si el id no existe. */
export function notificationSound(id: string | undefined): NotificationSound {
  return (
    NOTIFICATION_SOUNDS.find((sound) => sound.id === id) ??
    NOTIFICATION_SOUNDS.find((sound) => sound.id === DEFAULT_NOTIFICATION_SOUND_ID)!
  )
}

export function isNotificationSoundId(value: unknown): value is string {
  return typeof value === 'string' && NOTIFICATION_SOUNDS.some((sound) => sound.id === value)
}

/** Ganancia máxima del tono; el volumen del usuario la escala entre 0 y 1. */
const MAX_GAIN = 0.32

function clampVolume(volume: number | undefined): number {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) return 1
  return Math.min(1, Math.max(0, volume))
}

/**
 * Reproduce el sonido elegido. Devuelve `false` si el navegador no soporta Web
 * Audio, el contexto sigue suspendido (los navegadores exigen un gesto) o el
 * volumen es cero.
 */
export function playNotificationSound(
  context: AudioContextLike | null | undefined,
  volume = 1,
  soundId = DEFAULT_NOTIFICATION_SOUND_ID,
): boolean {
  if (!context) return false
  if (context.state && context.state !== 'running') return false
  const peak = MAX_GAIN * clampVolume(volume)
  if (peak <= 0) return false
  const sound = notificationSound(soundId)

  for (const tone of sound.tones) {
    const start = context.currentTime + tone.delay
    const end = start + tone.duration
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = sound.wave
    oscillator.frequency.setValueAtTime(tone.frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(end)
  }
  return true
}

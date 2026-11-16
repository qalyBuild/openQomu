import type { Invite } from '@/domain/entities/identity'
import { ValidationError } from '@/domain/errors'

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_CODE_LENGTH = 10
const INVITE_TTL_DAYS = 7

export type RandomSource = () => number

/** RNG con entropía criptográfica cuando está disponible. */
export function secureRandom(): number {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const buffer = new Uint32Array(1)
    cryptoApi.getRandomValues(buffer)
    return buffer[0] / 2 ** 32
  }
  return Math.random()
}

/**
 * Convierte un nombre en un identificador legible: minúsculas, sin símbolos y
 * con guiones en lugar de espacios. Conserva las letras Unicode (ñ, á, ü…)
 * para no mutilar nombres en español.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function validateWorkspaceName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 2) {
    throw new ValidationError('El nombre del espacio debe tener al menos 2 caracteres.')
  }
  if (trimmed.length > 60) {
    throw new ValidationError('El nombre del espacio no puede superar los 60 caracteres.')
  }
  return trimmed
}

export function normalizeChannelName(name: string): string {
  const normalized = slugify(name.replace(/^#/, ''))
  if (normalized.length < 2) {
    throw new ValidationError('El nombre del canal debe tener al menos 2 caracteres.')
  }
  if (normalized.length > 40) {
    throw new ValidationError('El nombre del canal no puede superar los 40 caracteres.')
  }
  return normalized
}

/**
 * Clave de unicidad de un canal: ignora acentos, mayúsculas y eñes para que
 * «Diseño» y «Diseno» no puedan convivir como canales distintos.
 */
export function channelNameKey(name: string): string {
  return slugify(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function buildWorkspaceId(name: string, suffix: string): string {
  return `${slugify(name) || 'openqomu'}-${suffix.toLowerCase()}`
}

export function createInviteCode(random: RandomSource = secureRandom): string {
  let code = ''
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    const position = Math.floor(random() * INVITE_ALPHABET.length) % INVITE_ALPHABET.length
    code += INVITE_ALPHABET[position]
  }
  return code
}

export function createInvite(
  workspaceId: string,
  createdBy: string,
  now: Date = new Date(),
  random: RandomSource = secureRandom,
): Invite {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS)
  return {
    code: createInviteCode(random),
    workspaceId,
    createdBy,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

export function isInviteExpired(invite: Invite, now: Date = new Date()): boolean {
  return new Date(invite.expiresAt).getTime() <= now.getTime()
}

export function buildInviteLink(code: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/join/${code}`
}

export function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function pickWorkspaceIcon(name: string): string {
  const icons = ['🪐', '🚀', '✨', '🧩', '🌊', '🔭', '🎯', '🛠️', '🌱', '⚡']
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return icons[sum % icons.length]
}

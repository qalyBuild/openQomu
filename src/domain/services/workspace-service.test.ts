import { describe, expect, it } from 'vitest'
import {
  buildInviteLink,
  buildWorkspaceId,
  channelNameKey,
  createInvite,
  createInviteCode,
  initials,
  isInviteExpired,
  normalizeChannelName,
  slugify,
  validateWorkspaceName,
} from './workspace-service'

describe('workspace-service', () => {
  it('genera slugs en minúsculas conservando acentos y eñes', () => {
    expect(slugify('Diseño & Producto ✨')).toBe('diseño-producto')
    expect(slugify('  openQomu  ')).toBe('openqomu')
    expect(slugify('***')).toBe('')
    expect(slugify('AÑO ÑANDÚ')).toBe('año-ñandú')
    expect(slugify('Canción   de   cuna')).toBe('canción-de-cuna')
  })

  it('valida nombres de workspace', () => {
    expect(validateWorkspaceName('  Espacio demo  ')).toBe('Espacio demo')
    expect(() => validateWorkspaceName('A')).toThrow('al menos 2')
    expect(() => validateWorkspaceName('x'.repeat(61))).toThrow('60')
  })

  it('normaliza nombres de canal', () => {
    expect(normalizeChannelName('#Producto & Diseño')).toBe('producto-diseño')
    expect(normalizeChannelName('  Diseño  ')).toBe('diseño')
    expect(() => normalizeChannelName('#a')).toThrow('al menos 2')
  })

  it('compara canales ignorando acentos y eñes', () => {
    expect(channelNameKey('Diseño')).toBe('diseno')
    expect(channelNameKey('diseno')).toBe('diseno')
    expect(channelNameKey('#Soporte Técnico')).toBe('soporte-tecnico')
    expect(channelNameKey('soporte tecnico')).toBe('soporte-tecnico')
  })

  it('construye un id estable con sufijo', () => {
    expect(buildWorkspaceId('Espacio demo', 'AB12')).toBe('espacio-demo-ab12')
    expect(buildWorkspaceId('✨', 'x')).toBe('openqomu-x')
    expect(buildWorkspaceId('Diseño', 'AB12')).toBe('diseño-ab12')
  })

  it('genera códigos de invitación legibles y deterministas con rng', () => {
    const code = createInviteCode(() => 0)
    expect(code).toHaveLength(10)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/)
    expect(createInviteCode(() => 0.999999)).toHaveLength(10)
  })

  it('crea invitaciones con caducidad de 7 días', () => {
    const now = new Date('2026-11-12T10:00:00.000Z')
    const invite = createInvite('ws-1', 'u-1', now, () => 0)
    expect(invite.workspaceId).toBe('ws-1')
    expect(invite.expiresAt).toBe('2026-11-19T10:00:00.000Z')
    expect(isInviteExpired(invite, now)).toBe(false)
    expect(isInviteExpired(invite, new Date('2026-11-20T10:00:00.000Z'))).toBe(true)
  })

  it('construye enlaces de invitación y avatares', () => {
    expect(buildInviteLink('ABC', 'https://app.example.com/')).toBe('https://app.example.com/join/ABC')
    expect(initials('Ana María López')).toBe('AL')
    expect(initials('Bruno')).toBe('BR')
    expect(initials('  ')).toBe('?')
  })
})

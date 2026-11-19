export const ROLE_VALUES = ['owner', 'admin', 'member'] as const
export type Role = (typeof ROLE_VALUES)[number]

export const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent', 'paused'] as const
export type Priority = (typeof PRIORITY_VALUES)[number]

export type ChannelType = 'public' | 'private'

export interface User {
  id: string
  displayName: string
  email: string
  photoURL: string | null
  createdAt: string
  lastActiveAt: string | null
  themeId?: string
}

export interface Workspace {
  id: string
  name: string
  icon: string
  description: string
  ownerId: string
  createdAt: string
  /** UIDs con acceso. Se mantiene en paralelo a la subcolección de miembros. */
  memberIds: string[]
}

export interface Member {
  id: string
  workspaceId: string
  uid: string
  role: Role
  displayName: string
  email: string
  photoURL: string | null
  joinedAt: string
  lastActiveAt: string | null
}

export interface Invite {
  code: string
  workspaceId: string
  createdBy: string
  createdAt: string
  expiresAt: string
}

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; badge: string }
> = {
  low: { label: 'Baja', color: '#38bdf8', badge: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  medium: {
    label: 'Media',
    color: '#a78bfa',
    badge: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  },
  high: {
    label: 'Alta',
    color: '#fbbf24',
    badge: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  },
  urgent: {
    label: 'Urgente',
    color: '#fb7185',
    badge: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  },
  paused: {
    label: 'En pausa',
    color: '#94a3b8',
    badge: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
  },
}

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  owner: { label: 'Propietario', description: 'Control total del espacio de trabajo.' },
  admin: { label: 'Administrador', description: 'Gestiona miembros y contenido.' },
  member: { label: 'Miembro', description: 'Crea contenido y colabora.' },
}

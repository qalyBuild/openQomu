export const MCP_SCOPE_VALUES = ['openqomu:read', 'openqomu:write'] as const
export type McpScope = (typeof MCP_SCOPE_VALUES)[number]

export const MCP_SCOPE_META: Record<McpScope, { label: string; description: string }> = {
  'openqomu:read': {
    label: 'Lectura',
    description: 'Consultar espacios, tableros, tareas, miembros y comentarios.',
  },
  'openqomu:write': {
    label: 'Escritura',
    description: 'Crear y modificar tareas, moverlas y añadir comentarios.',
  },
}

export interface McpToken {
  id: string
  uid: string
  label: string
  scopes: McpScope[]
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  /** Token en claro para poder volver a mostrarlo. Null en tokens antiguos. */
  secret: string | null
}

export interface McpTokenDraft {
  uid: string
  label: string
  scopes: McpScope[]
  tokenHash: string
  /** Token en claro; se guarda solo en el documento privado del propietario. */
  secret: string
}

/** Errores de dominio. La infraestructura los traduce a mensajes de UI. */

export type DomainErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'PERMISSION'
  | 'CONFLICT'
  | 'UNKNOWN'

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'No se encontró el recurso.') {
    super('NOT_FOUND', message)
    this.name = 'NotFoundError'
  }
}

export class PermissionError extends DomainError {
  constructor(message = 'No tienes permisos para realizar esta acción.') {
    super('PERMISSION', message)
    this.name = 'PermissionError'
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message)
    this.name = 'ConflictError'
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message
  if (error instanceof Error) return error.message
  return 'Ha ocurrido un error inesperado.'
}

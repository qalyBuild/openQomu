/**
 * Nombre visible del producto. Es el único punto que una distribución puede
 * cambiar para rebautizar la instancia sin tocar el resto del código.
 */
export const PRODUCT_NAME = import.meta.env.VITE_PRODUCT_NAME?.trim() || 'openQomu'
/** Identificador corto para claves de almacenamiento y nombres técnicos. */
export const PRODUCT_SLUG = 'openqomu'

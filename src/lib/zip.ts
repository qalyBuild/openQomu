import { zip } from 'fflate'

export interface ZipSource {
  /** Ruta dentro del ZIP, con `/` para anidar carpetas. */
  path: string
  data: Uint8Array
}

/** Evita copiar si el array ya viene del mismo entorno que fflate. */
function toPlainBytes(data: Uint8Array): Uint8Array {
  return data.constructor === Uint8Array ? data : new Uint8Array(data)
}

/** Comprime en segundo plano para no bloquear la interfaz. */
export function createZipBlob(entries: ZipSource[]): Promise<Blob> {
  const archive: Record<string, Uint8Array> = {}
  for (const entry of entries) archive[entry.path] = toPlainBytes(entry.data)

  return new Promise<Blob>((resolve, reject) => {
    zip(archive, { level: 6 }, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      resolve(new Blob([data.buffer as ArrayBuffer], { type: 'application/zip' }))
    })
  })
}

/** Descarga un Blob con el nombre indicado, también en la app móvil. */
export function downloadBlobFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

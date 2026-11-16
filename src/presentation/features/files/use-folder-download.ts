import { useState } from 'react'
import { toast } from 'sonner'
import type { FileFolder } from '@/domain/entities/chat'
import {
  MAX_ARCHIVE_BYTES,
  collectFolderArchive,
  folderArchiveName,
} from '@/domain/services/file-archive-service'
import { formatBytes } from '@/domain/services/file-service'
import { createZipBlob, downloadBlobFile, type ZipSource } from '@/lib/zip'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'

/** Descarga una carpeta completa como .zip desde el navegador. */
export function useFolderDownload() {
  const { workspace, folders, files } = useWorkspaceData()
  const container = useContainer()
  const [zippingFolderId, setZippingFolderId] = useState<string | null>(null)

  const downloadFolder = async (folder: FileFolder) => {
    if (zippingFolderId) return
    const entries = collectFolderArchive(folders, files, folder.id)
    if (entries.length === 0) {
      toast.info('La carpeta no tiene archivos para descargar.')
      return
    }
    const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0)
    if (totalBytes > MAX_ARCHIVE_BYTES) {
      toast.error(
        `La carpeta ocupa ${formatBytes(totalBytes)} y supera el límite de ${formatBytes(MAX_ARCHIVE_BYTES)} para comprimir en el navegador.`,
      )
      return
    }

    const archiveName = folderArchiveName(folder.name)
    const toastId = toast.loading(`Preparando ${archiveName}…`)
    setZippingFolderId(folder.id)
    try {
      const sources: ZipSource[] = []
      let skipped = 0
      for (const [index, entry] of entries.entries()) {
        try {
          const blob = await container.files.downloadBlob(workspace.id, entry.file)
          sources.push({ path: entry.path, data: new Uint8Array(await blob.arrayBuffer()) })
        } catch {
          skipped += 1
        }
        toast.loading(`Preparando ${archiveName}… ${index + 1}/${entries.length}`, {
          id: toastId,
        })
      }
      if (sources.length === 0) throw new Error('No se pudo leer ningún archivo de la carpeta.')
      const archive = await createZipBlob(sources)
      downloadBlobFile(archive, archiveName)
      toast.success(
        skipped > 0
          ? `${archiveName} descargado (${skipped} ${
              skipped === 1 ? 'archivo no se pudo leer' : 'archivos no se pudieron leer'
            }).`
          : `${archiveName} descargado.`,
        { id: toastId },
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo comprimir la carpeta.',
        { id: toastId },
      )
    } finally {
      setZippingFolderId(null)
    }
  }

  return { zippingFolderId, downloadFolder }
}

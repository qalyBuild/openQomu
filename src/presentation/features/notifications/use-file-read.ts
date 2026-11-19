import { useEffect, useState } from 'react'
import type { FileMeta } from '@/domain/entities/chat'
import type { FileReadRepository } from '@/domain/ports'
import { latestFileReadThrough } from '@/domain/services/file-read-service'

export function useFileRead({
  repository,
  workspaceId,
  uid,
  files,
  loading,
  viewingFiles,
  localThrough,
  legacyVisit,
  onAdvance,
}: {
  repository?: FileReadRepository
  workspaceId: string
  uid: string
  files: FileMeta[]
  loading: boolean
  viewingFiles: boolean
  localThrough: number
  legacyVisit: number
  onAdvance: (through: number) => void
}) {
  const [remote, setRemote] = useState<number>()
  useEffect(() => {
    if (!repository || !uid) return
    return repository.subscribe(
      workspaceId,
      uid,
      (through) => setRemote((previous) => Math.max(previous ?? 0, through)),
      () => setRemote((previous) => previous ?? 0),
    )
  }, [repository, workspaceId, uid])

  useEffect(() => {
    if (loading) return
    if (!localThrough && legacyVisit) onAdvance(latestFileReadThrough(files, legacyVisit))
    if (!viewingFiles) return
    const markVisibleList = () => {
      if (document.visibilityState === 'visible') onAdvance(latestFileReadThrough(files))
    }
    markVisibleList()
    document.addEventListener('visibilitychange', markVisibleList)
    return () => document.removeEventListener('visibilitychange', markVisibleList)
  }, [files, legacyVisit, loading, localThrough, onAdvance, viewingFiles])

  useEffect(() => {
    if (!repository || !uid || localThrough <= (remote ?? 0)) return
    let active = true
    let pending = false
    const publish = () => {
      if (pending || !navigator.onLine) return
      pending = true
      void repository.advance(workspaceId, uid, localThrough)
        .then(() => {
          if (active) setRemote((previous) => Math.max(previous ?? 0, localThrough))
        })
        .catch(() => {
          // El avance local queda guardado y se reintenta al volver a conectar o enfocar.
        })
        .finally(() => { pending = false })
    }
    publish()
    window.addEventListener('online', publish)
    window.addEventListener('focus', publish)
    return () => {
      active = false
      window.removeEventListener('online', publish)
      window.removeEventListener('focus', publish)
    }
  }, [localThrough, remote, repository, uid, workspaceId])

  return {
    ready: !repository || remote !== undefined || localThrough > 0,
    through: Math.max(remote ?? 0, localThrough),
  }
}

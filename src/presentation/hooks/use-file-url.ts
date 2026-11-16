import { useCallback, useEffect, useState } from 'react'
import type { FileMeta } from '@/domain/entities/chat'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

export function useResolvedFileUrl(
  file: FileMeta | null,
  options: { auto?: boolean } = {},
) {
  const container = useContainer()
  const { workspace } = useWorkspaceData()
  const key = file ? `${workspace.id}:${file.id}` : ''
  const [url, setUrl] = useState(() => (file ? file.url || cache.get(key) || '' : ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }
    const cached = file.url || cache.get(`${workspace.id}:${file.id}`) || ''
    setUrl(cached)
  }, [file, workspace.id])

  const resolve = useCallback(async (): Promise<string> => {
    if (!file) return ''
    if (file.url) {
      cache.set(`${workspace.id}:${file.id}`, file.url)
      return file.url
    }
    const cacheKey = `${workspace.id}:${file.id}`
    const cached = cache.get(cacheKey)
    if (cached) return cached
    setLoading(true)
    setError(null)
    try {
      let request = pending.get(cacheKey)
      if (!request) {
        request = container.files.getDownloadUrl(workspace.id, file)
        pending.set(cacheKey, request)
      }
      const resolved = await request
      if (resolved) {
        cache.set(cacheKey, resolved)
        setUrl(resolved)
      }
      return resolved
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el archivo.')
      return ''
    } finally {
      pending.delete(cacheKey)
      setLoading(false)
    }
  }, [container, file, workspace.id])

  useEffect(() => {
    if (options.auto && file && !url) void resolve()
  }, [file, options.auto, resolve, url])

  return { url, loading, error, resolve }
}

export function invalidateFileUrlCache(workspaceId: string, fileId: string): void {
  cache.delete(`${workspaceId}:${fileId}`)
}

export async function openResolvedFile(url: string, downloadName?: string): Promise<void> {
  if (!url) return
  let target = url
  let objectUrl = false
  let crossOrigin = false
  try {
    crossOrigin = new URL(url, window.location.href).origin !== window.location.origin
  } catch {
    crossOrigin = false
  }
  // `download` se ignora en enlaces cross-origin (S3/Storage): se descarga el blob.
  if (url.startsWith('data:') || (downloadName && crossOrigin)) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const blob = await response.blob()
        target = URL.createObjectURL(blob)
        objectUrl = true
      }
    } catch {
      // Si CORS lo impide se abre la URL original.
    }
  }
  if (downloadName) {
    const anchor = document.createElement('a')
    anchor.href = target
    anchor.download = downloadName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } else {
    window.open(target, '_blank', 'noopener,noreferrer')
  }
  if (objectUrl) {
    window.setTimeout(() => URL.revokeObjectURL(target), 60_000)
  }
}

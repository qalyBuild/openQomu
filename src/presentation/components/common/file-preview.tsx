import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { FileMeta } from '@/domain/entities/chat'
import { isImageFile } from '@/domain/services/file-service'
import { cn } from '@/lib/utils'
import { openResolvedFile, useResolvedFileUrl } from '@/presentation/hooks/use-file-url'
import { FileIcon } from './file-icon'

export function FileImage({
  file,
  className,
  alt,
  auto = true,
  onClick,
}: {
  file: FileMeta
  className?: string
  alt?: string
  auto?: boolean
  onClick?: () => void
}) {
  const { url, loading, resolve } = useResolvedFileUrl(file, { auto })
  const content = url ? (
    <img
      src={url}
      alt={alt ?? file.name}
      loading="lazy"
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      className={cn('object-cover', className)}
      onClick={onClick}
    />
  ) : (
    <div
      className={cn('grid place-items-center bg-muted/50', className)}
      onMouseEnter={() => void resolve()}
      onFocus={() => void resolve()}
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <FileIcon file={file} className="size-6" />
      )}
    </div>
  )
  return content
}

export function FileThumb({
  file,
  className,
  auto = false,
}: {
  file: FileMeta
  className?: string
  auto?: boolean
}) {
  if (isImageFile(file)) {
    return <FileImage file={file} className={className} auto={auto} />
  }
  return (
    <div className={cn('grid place-items-center bg-muted/50', className)}>
      <FileIcon file={file} className="size-7" />
    </div>
  )
}

export function FileOpenLink({
  file,
  children,
  className,
  download = false,
}: {
  file: FileMeta
  children: ReactNode
  className?: string
  download?: boolean
}) {
  const { resolve } = useResolvedFileUrl(file, { auto: false })
  return (
    <a
      href={file.url || '#'}
      draggable={false}
      className={className}
      onClick={async (event) => {
        event.preventDefault()
        const url = await resolve()
        await openResolvedFile(url, download ? file.name : undefined)
      }}
    >
      {children}
    </a>
  )
}

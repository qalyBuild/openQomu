import {
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as FileIconBase,
  type LucideIcon,
} from 'lucide-react'
import { extensionOf, isImageFile, isPdfFile } from '@/domain/services/file-service'
import { cn } from '@/lib/utils'

export function fileIconFor(file: { name: string; contentType?: string }): {
  icon: LucideIcon
  color: string
} {
  const extension = extensionOf(file.name)
  if (isImageFile(file)) return { icon: FileImage, color: 'text-violet-500' }
  if (isPdfFile(file)) return { icon: FileText, color: 'text-rose-500' }
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(extension)) {
    return { icon: FileText, color: 'text-sky-500' }
  }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) {
    return { icon: FileSpreadsheet, color: 'text-emerald-500' }
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return { icon: FileArchive, color: 'text-amber-500' }
  }
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension)) {
    return { icon: FileVideo, color: 'text-fuchsia-500' }
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)) {
    return { icon: FileAudio, color: 'text-orange-500' }
  }
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'go', 'rs', 'sh', 'sql'].includes(extension)) {
    return { icon: FileCode2, color: 'text-cyan-500' }
  }
  return { icon: FileIconBase, color: 'text-muted-foreground' }
}

export function FileIcon({
  file,
  className,
}: {
  file: { name: string; contentType?: string }
  className?: string
}) {
  const { icon: Icon, color } = fileIconFor(file)
  return <Icon className={cn('size-5', color, className)} />
}

export function FileThumbnail({
  file,
  className,
}: {
  file: { name: string; contentType: string; url: string }
  className: string
}) {
  if (isImageFile(file) && file.url) {
    return (
      <img
        src={file.url}
        alt={file.name}
        loading="lazy"
        className={cn('object-cover', className)}
      />
    )
  }
  return (
    <div className={cn('grid place-items-center bg-muted/60', className)}>
      <FileIcon file={file} className="size-7" />
    </div>
  )
}

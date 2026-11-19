import { useEffect, useMemo, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FilePenLine,
  FileUp,
  Folder,
  FolderPlus,
  FolderUp,
  Grid2x2,
  HardDrive,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FileFolder, FileMeta } from '@/domain/entities/chat'
import {
  FREE_FILE_SIZE_LIMIT,
  FREE_STORAGE_QUOTA,
  MAX_FILE_SIZE,
  estimateStoredBytes,
  fileKindLabel,
  formatBytes,
  isImageFile,
  isMarkdownFile,
  isPdfFile,
  isTextFile,
  sanitizeFileName,
} from '@/domain/services/file-service'
import {
  folderBreadcrumb,
  folderNameKey,
  splitUploadPath,
  validateFolderName,
} from '@/domain/services/file-folder-service'
import { MAX_ARCHIVE_BYTES } from '@/domain/services/file-archive-service'
import { canDeleteFile } from '@/domain/services/permission-service'
import { formatRelative } from '@/lib/date'
import { createZipBlob, downloadBlobFile, type ZipSource } from '@/lib/zip'
import { useAuth, useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { UserAvatar } from '@/presentation/components/common/user-avatar'
import { FileIcon } from '@/presentation/components/common/file-icon'
import { FileThumb } from '@/presentation/components/common/file-preview'
import { MarkdownView } from '@/presentation/components/common/markdown-view'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { NameDialog } from '@/presentation/features/files/name-dialog'
import { MoveFileDialog } from '@/presentation/features/files/move-file-dialog'
import { FileEditorDialog } from '@/presentation/features/files/file-editor-dialog'
import { useFolderDownload } from '@/presentation/features/files/use-folder-download'
import { useResolvedFileUrl, openResolvedFile } from '@/presentation/hooks/use-file-url'
import { cn } from '@/lib/utils'
import { publicAppOrigin } from '@/lib/app-url'

type Filter = 'all' | 'images' | 'documents' | 'text' | 'other'
type View = 'files' | 'trash'
type Sort = 'recent' | 'name' | 'size'

const PAGE_SIZE = 24
const FILTER_LABELS: Record<Filter, string> = {
  all: 'archivos',
  images: 'imágenes',
  documents: 'documentos',
  text: 'archivos de texto',
  other: 'archivos de otro tipo',
}

type StorageBackend = 'firestore' | 'storage' | 's3'
const STORAGE_BACKEND: StorageBackend =
  import.meta.env.VITE_FILE_STORAGE === 'storage'
    ? 'storage'
    : import.meta.env.VITE_FILE_STORAGE === 's3'
      ? 's3'
      : 'firestore'
const FREE_STORAGE = STORAGE_BACKEND === 'firestore'
const UPLOAD_LIMIT = FREE_STORAGE ? FREE_FILE_SIZE_LIMIT : MAX_FILE_SIZE
const STORAGE_LABEL =
  STORAGE_BACKEND === 'firestore'
    ? 'Firestore · gratis'
    : STORAGE_BACKEND === 's3'
      ? 'almacenamiento S3 · gratis'
      : 'Firebase Storage · Blaze'

function filterFor(file: FileMeta): Exclude<Filter, 'all'> {
  if (isImageFile(file)) return 'images'
  if (isTextFile(file)) return 'text'
  if (isPdfFile(file)) return 'documents'
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'csv', 'odt', 'ppt', 'pptx'].some((extension) =>
      file.name.toLowerCase().endsWith(`.${extension}`),
    )
  ) {
    return 'documents'
  }
  return 'other'
}

function folderPathNames(folders: FileFolder[], folderId: string | null): string {
  const trail = folderBreadcrumb(folders, folderId)
  return trail.map((folder) => folder.name).join(' / ')
}

/** Elemento pendiente de subida: un archivo o una carpeta vacía (ruta terminada en “/”). */
interface PendingUpload {
  path: string
  file?: File
}

function relativePathOf(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return relative && relative.trim() ? relative : file.name
}

function readDirectoryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function walkDroppedEntry(
  entry: FileSystemEntry,
  prefix: string,
  out: PendingUpload[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    )
    out.push({ path: `${prefix}${entry.name}`, file })
    return
  }
  if (!entry.isDirectory) return
  const dirPath = `${prefix}${entry.name}`
  // Las carpetas se registran aunque estén vacías para reproducir la estructura.
  out.push({ path: `${dirPath}/` })
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  let batch = await readDirectoryBatch(reader)
  while (batch.length > 0) {
    for (const child of batch) await walkDroppedEntry(child, `${dirPath}/`, out)
    batch = await readDirectoryBatch(reader)
  }
}

/** Traduce un arrastre del sistema en archivos y carpetas con su ruta relativa. */
async function collectDroppedEntries(items: DataTransferItemList): Promise<PendingUpload[]> {
  const roots: FileSystemEntry[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
    if (entry) roots.push(entry)
  }
  const result: PendingUpload[] = []
  for (const entry of roots) await walkDroppedEntry(entry, '', result)
  return result
}

/** Evita que un arrastre dentro de un diálogo acabe subiendo el archivo. */
function isInsideOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"], [data-slot="alert-dialog-content"]',
      ),
    )
  )
}

export function FilesPage() {
  const {
    workspace,
    files,
    trashedFiles,
    folders,
    members,
    uid,
    role,
    loading,
  } = useWorkspaceData()
  const { session } = useAuth()
  const container = useContainer()
  const { zippingFolderId, downloadFolder } = useFolderDownload()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'trash' ? 'trash' : 'files'
  const showAllFiles = params.get('scope') === 'all'
  const currentFolderId = params.get('folder')
  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkTrashOpen, setBulkTrashOpen] = useState(false)
  const [bulkPurgeOpen, setBulkPurgeOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState('')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<FileMeta | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [previewTextLoading, setPreviewTextLoading] = useState(false)
  const [editorFile, setEditorFile] = useState<FileMeta | null>(null)
  const [renameFile, setRenameFile] = useState<FileMeta | null>(null)
  const [moveFile, setMoveFile] = useState<FileMeta | null>(null)
  const [trashTarget, setTrashTarget] = useState<FileMeta | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<FileMeta | null>(null)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const [folderDialog, setFolderDialog] = useState<
    { mode: 'create'; parentId: string | null } | { mode: 'rename'; folder: FileFolder } | null
  >(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)
  const previewTriggerRef = useRef<HTMLElement | null>(null)
  // Un arrastre que empieza dentro de la app no debe tratarse como archivo nuevo.
  const internalDrag = useRef(false)
  const { url: previewUrl, loading: previewLoading, resolve: resolvePreview } =
    useResolvedFileUrl(preview, { auto: Boolean(preview && !isTextFile(preview)) })

  const allFiles = useMemo(
    () =>
      [...files, ...trashedFiles].sort((a, b) =>
        (b.trashedAt ?? b.updatedAt).localeCompare(a.trashedAt ?? a.updatedAt),
      ),
    [files, trashedFiles],
  )
  const breadcrumb = folderBreadcrumb(folders, currentFolder?.id ?? null)
  const canManageFile = (file: FileMeta) =>
    file.uploadedBy === uid || canDeleteFile(role, file, uid)
  const canEditText = (file: FileMeta) =>
    isTextFile(file) &&
    canManageFile(file) &&
    (FREE_STORAGE ? file.backend === 'firestore' : true)
  const emptyableTrash = useMemo(
    () => trashedFiles.filter((file) => canDeleteFile(role, file, uid)),
    [trashedFiles, role, uid],
  )
  const dialogOpen = Boolean(
    preview ||
      editorFile ||
      renameFile ||
      moveFile ||
      trashTarget ||
      purgeTarget ||
      emptyTrashOpen ||
      folderDialog ||
      bulkMoveOpen ||
      bulkTrashOpen ||
      bulkPurgeOpen,
  )

  useEffect(() => {
    if (dialogOpen) setDragging(false)
  }, [dialogOpen])

  useEffect(() => {
    const fileId = params.get('file')
    if (!fileId) {
      setPreview(null)
      return
    }
    const match = allFiles.find((file) => file.id === fileId)
    if (match) setPreview(match)
  }, [allFiles, params])

  useEffect(() => {
    if (!preview) {
      setPreviewText('')
      return
    }
    if (!isTextFile(preview)) {
      setPreviewText('')
      return
    }
    let cancelled = false
    setPreviewTextLoading(true)
    container.files
      .readText(workspace.id, preview)
      .then((text) => {
        if (!cancelled) setPreviewText(text)
      })
      .catch(() => {
        if (!cancelled) setPreviewText('')
      })
      .finally(() => {
        if (!cancelled) setPreviewTextLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [container, preview, workspace.id])

  // La lista visible depende de la carpeta actual; al buscar se amplía a todo el workspace.
  const baseFiles = useMemo(() => {
    if (view === 'trash') return trashedFiles
    if (query.trim()) return files
    if (showAllFiles) return files
    return files.filter((file) => file.folderId === (currentFolder?.id ?? null))
  }, [currentFolder?.id, files, query, showAllFiles, trashedFiles, view])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const result = baseFiles.filter((file) => {
      if (filter !== 'all' && filterFor(file) !== filter) return false
      return !normalized || file.name.toLowerCase().includes(normalized)
    })
    return result.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'es')
      if (sort === 'size') return b.size - a.size
      return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
    })
  }, [baseFiles, filter, query, sort])

  const visibleFiles = filtered.slice(0, visibleLimit)
  const remainingFiles = Math.max(0, filtered.length - visibleFiles.length)
  const matchingFolders = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized || view === 'trash') return []
    return folders.filter((folder) => {
      const path = folderPathNames(folders, folder.id)
      return (
        folder.name.toLowerCase().includes(normalized) ||
        path.toLowerCase().includes(normalized)
      )
    })
  }, [folders, query, view])

  const selectableFiles = view === 'trash' ? trashedFiles : files
  const selectedFiles = selectableFiles.filter((file) => selectedIds.has(file.id))
  const allVisibleSelected =
    visibleFiles.length > 0 && visibleFiles.every((file) => selectedIds.has(file.id))

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE)
    setSelectedIds(new Set())
  }, [currentFolderId, filter, query, showAllFiles, sort, view])

  const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0)
  const storedSize = allFiles.reduce(
    (sum, file) => sum + (file.backend === 'firestore' ? estimateStoredBytes(file.size) : file.size),
    0,
  )
  const quotaPercent = FREE_STORAGE
    ? Math.min(100, Math.round((storedSize / FREE_STORAGE_QUOTA) * 1000) / 10)
    : 0
  const imageCount = files.filter((file) => isImageFile(file)).length
  const folderFileCount = files.filter(
    (file) => file.folderId === (currentFolder?.id ?? null),
  ).length

  const mutateParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(window.location.search)
    mutate(next)
    setParams(next, { replace: true })
  }

  const setView = (nextView: View) => {
    setFilter('all')
    setQuery('')
    mutateParams((next) => {
      next.delete('scope')
      if (nextView === 'trash') {
        next.set('view', 'trash')
        next.delete('folder')
      } else {
        next.delete('view')
      }
    })
  }

  const selectFolder = (folderId: string | null) => {
    setQuery('')
    mutateParams((next) => {
      next.delete('view')
      next.delete('scope')
      if (folderId) next.set('folder', folderId)
      else next.delete('folder')
    })
  }

  const downloadFile = async (file: FileMeta) => {
    try {
      const url = await container.files.getDownloadUrl(workspace.id, file)
      await openResolvedFile(url, file.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar el archivo.')
    }
  }

  const copyFileLink = async (file: FileMeta) => {
    const link =
      file.url.startsWith('data:') || file.url.startsWith('blob:') || !file.url
        ? `${publicAppOrigin()}/w/${workspace.id}/files?file=${file.id}`
        : file.url
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Enlace copiado.')
    } catch {
      toast.error('No se pudo copiar el enlace.')
    }
  }

  const previewList = useMemo(() => {
    if (preview && filtered.some((file) => file.id === preview.id)) return filtered
    return allFiles
  }, [allFiles, filtered, preview])
  const previewIndex = preview
    ? previewList.findIndex((file) => file.id === preview.id)
    : -1

  const openPreview = (file: FileMeta) => {
    previewTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPreview(file)
    mutateParams((next) => next.set('file', file.id))
  }

  const closePreview = () => {
    const name = preview?.name
    setPreview(null)
    mutateParams((next) => next.delete('file'))
    requestAnimationFrame(() => {
      const stored = previewTriggerRef.current
      if (stored?.isConnected) {
        stored.focus()
        return
      }
      if (!name) return
      const trigger = [...document.querySelectorAll<HTMLElement>('[aria-label^="Previsualizar "]')].find(
        (element) => element.getAttribute('aria-label') === `Previsualizar ${name}`,
      )
      trigger?.focus()
    })
  }

  const goPreview = (delta: number) => {
    if (!preview) return
    const next = previewList[previewIndex + delta]
    if (!next) return
    setPreview(next)
    mutateParams((params) => params.set('file', next.id))
  }

  useEffect(() => {
    if (!preview) return
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goPreview(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPreview(-1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const uploadEntries = async (entries: PendingUpload[]) => {
    if (entries.length === 0 || !session || uploadingRef.current) return
    uploadingRef.current = true
    setUploading(true)
    setProgress(0)
    let uploaded = 0
    let createdFolders = 0
    const failed: Array<{ name: string; message: string }> = []
    // Carpetas ya resueltas en este lote: “parentId/nombre” → id.
    const folderCache = new Map<string, string>()
    const baseFolderId = view === 'files' ? (currentFolder?.id ?? null) : null

    // Reutiliza carpetas existentes con el mismo nombre y crea las que falten.
    const ensureFolders = async (names: string[]): Promise<string | null> => {
      let parentId = baseFolderId
      for (const rawName of names) {
        let name: string
        try {
          name = validateFolderName(rawName)
        } catch {
          name = sanitizeFileName(rawName).slice(0, 60) || 'carpeta'
        }
        const key = `${parentId ?? 'root'}/${folderNameKey(name)}`
        const cached = folderCache.get(key)
        if (cached) {
          parentId = cached
          continue
        }
        const existing = folders.find(
          (folder) =>
            folder.parentId === parentId && folderNameKey(folder.name) === folderNameKey(name),
        )
        if (existing) {
          folderCache.set(key, existing.id)
          parentId = existing.id
          continue
        }
        const created = await container.fileFolders.create({
          workspaceId: workspace.id,
          name,
          parentId,
          createdBy: uid,
        })
        folderCache.set(key, created.id)
        createdFolders += 1
        parentId = created.id
      }
      return parentId
    }

    try {
      for (const entry of entries) {
        const { folders: pathFolders, fileName } = splitUploadPath(entry.path)
        setUploadLabel(entry.file ? entry.path : `${entry.path.replace(/\/$/, '')} (carpeta)`)
        try {
          const folderId = await ensureFolders(pathFolders)
          if (!entry.file || !fileName) continue
          await container.files.upload(
            workspace.id,
            {
              name: fileName,
              size: entry.file.size,
              contentType: entry.file.type,
              data: entry.file,
            },
            uid,
            {
              folderId,
              onProgress: setProgress,
            },
          )
          uploaded += 1
        } catch (error) {
          failed.push({
            name: entry.path,
            message: error instanceof Error ? error.message : 'No se pudo subir.',
          })
        }
      }
      if (uploaded > 0) {
        toast.success(
          uploaded === 1 ? 'Archivo subido.' : `${uploaded} archivos subidos.`,
          createdFolders > 0
            ? {
                description: `${createdFolders} ${
                  createdFolders === 1 ? 'carpeta creada' : 'carpetas creadas'
                }.`,
              }
            : undefined,
        )
        if (view === 'trash') setView('files')
        if (query) setQuery('')
      } else if (createdFolders > 0 && failed.length === 0) {
        toast.success(
          createdFolders === 1 ? 'Carpeta creada.' : `${createdFolders} carpetas creadas.`,
        )
        if (query) setQuery('')
      }
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? `No se pudo subir “${failed[0].name}”.`
            : `No se pudieron subir ${failed.length} archivos.`,
          {
            description: failed
              .slice(0, 3)
              .map((item) => `${item.name}: ${item.message}`)
              .join(' · '),
          },
        )
      }
    } finally {
      uploadingRef.current = false
      setUploading(false)
      setUploadLabel('')
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  const upload = async (list: FileList | File[]) => {
    await uploadEntries(
      Array.from(list).map((file) => ({ path: relativePathOf(file), file })),
    )
  }

  const uploadDropped = async (items: DataTransferItemList, files: FileList) => {
    try {
      const entries = await collectDroppedEntries(items)
      if (entries.length > 0) {
        await uploadEntries(entries)
        return
      }
    } catch {
      // Si el navegador no expone las carpetas, se intenta con los archivos sueltos.
    }
    if (files.length > 0) await upload(files)
  }

  const toggleSelected = (fileId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      const allSelected = visibleFiles.every((file) => current.has(file.id))
      for (const file of visibleFiles) {
        if (allSelected) next.delete(file.id)
        else next.add(file.id)
      }
      return next
    })
  }

  const bulkTrash = async () => {
    const allowed = selectedFiles.filter(canManageFile)
    if (allowed.length === 0) {
      toast.error('No tienes permiso para mover esos archivos a la papelera.')
      return
    }
    const at = new Date().toISOString()
    let done = 0
    for (const file of allowed) {
      try {
        await container.files.update(workspace.id, file.id, { trashedAt: at })
        done += 1
      } catch {
        // Se informa al final.
      }
    }
    if (done > 0) {
      toast.success(
        done === 1 ? 'Archivo movido a la papelera.' : `${done} archivos movidos a la papelera.`,
      )
    }
    if (done < allowed.length) toast.error('Algunos archivos no se pudieron mover.')
    clearSelection()
  }

  const bulkRestore = async () => {
    let done = 0
    for (const file of selectedFiles) {
      try {
        await container.files.update(workspace.id, file.id, {
          trashedAt: null,
          folderId:
            file.folderId && folders.some((folder) => folder.id === file.folderId)
              ? file.folderId
              : null,
        })
        done += 1
      } catch {
        // Se informa al final.
      }
    }
    if (done > 0) {
      toast.success(done === 1 ? 'Archivo restaurado.' : `${done} archivos restaurados.`)
    }
    if (done < selectedFiles.length) toast.error('Algunos archivos no se pudieron restaurar.')
    clearSelection()
  }

  const bulkPurge = async () => {
    let done = 0
    for (const file of selectedFiles) {
      try {
        await container.files.remove(workspace.id, file.id)
        done += 1
      } catch {
        // Se informa al final.
      }
    }
    if (done > 0) {
      toast.success(
        done === 1
          ? 'Archivo eliminado definitivamente.'
          : `${done} archivos eliminados definitivamente.`,
      )
    }
    if (done < selectedFiles.length) toast.error('Algunos archivos no se pudieron eliminar.')
    clearSelection()
  }

  const moveSelectionTo = async (folderId: string | null) => {
    let done = 0
    for (const file of selectedFiles) {
      try {
        await container.files.update(workspace.id, file.id, { folderId })
        done += 1
      } catch {
        // Se informa al final.
      }
    }
    if (done > 0) {
      toast.success(
        done === 1 ? 'Archivo movido.' : `${done} archivos movidos.`,
      )
    }
    if (done < selectedFiles.length) toast.error('Algunos archivos no se pudieron mover.')
    clearSelection()
  }

  const downloadSelection = async () => {
    if (selectedFiles.length === 0) return
    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0)
    if (totalBytes > MAX_ARCHIVE_BYTES) {
      toast.error(
        `La selección ocupa ${formatBytes(totalBytes)} y supera el límite de ${formatBytes(MAX_ARCHIVE_BYTES)}.`,
      )
      return
    }
    const archiveName =
      selectedFiles.length === 1
        ? `${sanitizeFileName(selectedFiles[0].name)}.zip`
        : `Selección (${selectedFiles.length}).zip`
    const toastId = toast.loading(`Preparando ${archiveName}…`)
    try {
      const used = new Set<string>()
      const sources: ZipSource[] = []
      let skipped = 0
      for (const [index, file] of selectedFiles.entries()) {
        try {
          const blob = await container.files.downloadBlob(workspace.id, file)
          let path = sanitizeFileName(file.name)
          if (used.has(path)) {
            const dot = path.lastIndexOf('.')
            const base = dot > 0 ? path.slice(0, dot) : path
            const extension = dot > 0 ? path.slice(dot) : ''
            let counter = 2
            while (used.has(`${base} (${counter})${extension}`)) counter += 1
            path = `${base} (${counter})${extension}`
          }
          used.add(path)
          sources.push({ path, data: new Uint8Array(await blob.arrayBuffer()) })
        } catch {
          skipped += 1
        }
        toast.loading(`Preparando ${archiveName}… ${index + 1}/${selectedFiles.length}`, {
          id: toastId,
        })
      }
      if (sources.length === 0) {
        throw new Error('No se pudo leer ningún archivo de la selección.')
      }
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
        error instanceof Error ? error.message : 'No se pudo comprimir la selección.',
        { id: toastId },
      )
    }
  }

  const rename = async (name: string) => {
    if (!renameFile) return
    try {
      await container.files.update(workspace.id, renameFile.id, { name })
      toast.success('Archivo renombrado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo renombrar el archivo.')
      throw error
    }
  }

  const saveFolder = async (name: string) => {
    if (!folderDialog) return
    try {
      if (folderDialog.mode === 'create') {
        const folder = await container.fileFolders.create({
          workspaceId: workspace.id,
          name,
          parentId: folderDialog.parentId,
          createdBy: uid,
        })
        setQuery('')
        selectFolder(folder.id)
        toast.success('Carpeta creada.')
      } else {
        await container.fileFolders.update(workspace.id, folderDialog.folder.id, { name })
        toast.success('Carpeta renombrada.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la carpeta.')
      throw error
    }
  }

  const moveTo = async (folderId: string | null) => {
    if (!moveFile) return
    try {
      await container.files.update(workspace.id, moveFile.id, { folderId })
      toast.success(folderId ? 'Archivo movido.' : 'Archivo movido a la raíz.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo mover el archivo.')
      throw error
    }
  }

  const trashFile = async () => {
    if (!trashTarget) return
    try {
      await container.files.update(workspace.id, trashTarget.id, {
        trashedAt: new Date().toISOString(),
      })
      toast.success('Archivo movido a la papelera.')
      if (preview?.id === trashTarget.id) closePreview()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo mover a la papelera.')
    }
  }

  const restoreFile = async (file: FileMeta) => {
    try {
      await container.files.update(workspace.id, file.id, {
        trashedAt: null,
        folderId: file.folderId && folders.some((folder) => folder.id === file.folderId)
          ? file.folderId
          : null,
      })
      toast.success('Archivo restaurado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo restaurar el archivo.')
    }
  }

  const purgeFile = async () => {
    if (!purgeTarget) return
    try {
      await container.files.remove(workspace.id, purgeTarget.id)
      toast.success('Archivo eliminado definitivamente.')
      if (preview?.id === purgeTarget.id) closePreview()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el archivo.')
    }
  }

  const emptyTrash = async () => {
    if (emptyableTrash.length === 0) {
      toast.error('No tienes permiso para eliminar los archivos de la papelera.')
      return
    }
    let deleted = 0
    let failed = 0
    for (const file of emptyableTrash) {
      try {
        await container.files.remove(workspace.id, file.id)
        deleted += 1
        if (preview?.id === file.id) closePreview()
      } catch {
        failed += 1
      }
    }
    if (deleted > 0) {
      toast.success(
        deleted === 1
          ? 'Archivo eliminado definitivamente.'
          : `${deleted} archivos eliminados definitivamente.`,
      )
    }
    if (failed > 0) {
      toast.error(
        failed === 1
          ? 'No se pudo eliminar 1 archivo.'
          : `No se pudieron eliminar ${failed} archivos.`,
      )
    }
  }

  const renderSelection = (file: FileMeta, className?: string) => {
    const selected = selectedIds.has(file.id)
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          toggleSelected(file.id)
        }}
        aria-pressed={selected}
        aria-label={`${selected ? 'Deseleccionar' : 'Seleccionar'} ${file.name}`}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-md border bg-background/90 text-primary shadow-sm transition-colors',
          selected ? 'border-primary bg-primary/10 opacity-100' : 'hover-action border-border',
          className,
        )}
      >
        {selected && <Check className="size-3.5" />}
      </button>
    )
  }

  const renderFileMenu = (file: FileMeta, canManage: boolean) => (
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => openPreview(file)}>
        <Eye className="size-4" /> Previsualizar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void downloadFile(file)}>
        <Download className="size-4" /> Descargar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void copyFileLink(file)}>
        <Copy className="size-4" /> Copiar enlace
      </DropdownMenuItem>
      {canEditText(file) && (
        <DropdownMenuItem onClick={() => setEditorFile(file)}>
          <Code2 className="size-4" /> Abrir editor
        </DropdownMenuItem>
      )}
      {view === 'files' && canManage && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setRenameFile(file)}>
            <Pencil className="size-4" /> Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveFile(file)}>
            <FolderPlus className="size-4" /> Mover a…
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setTrashTarget(file)}>
            <Trash2 className="size-4" /> Mover a papelera
          </DropdownMenuItem>
        </>
      )}
      {view === 'trash' && canManage && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void restoreFile(file)}>
            <RotateCcw className="size-4" /> Restaurar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setPurgeTarget(file)}>
            <Trash2 className="size-4" /> Eliminar definitivamente
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  )

  return (
    <div
      className="relative h-full overflow-hidden"
      onDragStart={() => {
        internalDrag.current = true
      }}
      onDragEnd={() => {
        internalDrag.current = false
        setDragging(false)
      }}
      onDragOver={(event) => {
        if (internalDrag.current || dialogOpen || isInsideOverlay(event.target)) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (internalDrag.current || dialogOpen || isInsideOverlay(event.target)) return
        if (event.currentTarget === event.target) setDragging(false)
      }}
      onDrop={(event) => {
        if (internalDrag.current) {
          internalDrag.current = false
          setDragging(false)
          return
        }
        if (dialogOpen || isInsideOverlay(event.target)) {
          setDragging(false)
          return
        }
        event.preventDefault()
        setDragging(false)
        const items = event.dataTransfer.items
        if (items.length > 0) void uploadDropped(items, event.dataTransfer.files)
        else if (event.dataTransfer.files.length > 0) void upload(event.dataTransfer.files)
      }}
    >
      <div className="scrollbar-thin h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-5 p-5 pb-12 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                  Biblioteca
                </p>
                <Badge variant="outline" className="gap-1 text-[0.72rem] text-muted-foreground">
                  <HardDrive className="size-2.5" />
                  {STORAGE_LABEL}
                </Badge>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Archivos</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {files.length} {files.length === 1 ? 'archivo' : 'archivos'} en el workspace ·{' '}
                {formatBytes(totalSize)} · {imageCount}{' '}
                {imageCount === 1 ? 'imagen' : 'imágenes'} · {folders.length}{' '}
                {folders.length === 1 ? 'carpeta' : 'carpetas'}
              </p>
              {view === 'files' && currentFolder && (
                <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                  {folderFileCount} {folderFileCount === 1 ? 'archivo' : 'archivos'} en esta
                  carpeta
                </p>
              )}
              {view === 'files' && showAllFiles && (
                <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                  Mostrando los archivos de todas las carpetas
                </p>
              )}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <input
                ref={inputRef}
                type="file"
                multiple
                aria-label="Subir archivos"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) void upload(event.target.files)
                }}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                aria-label="Subir carpeta"
                className="hidden"
                {...({ webkitdirectory: '', directory: '' } as unknown as InputHTMLAttributes<HTMLInputElement>)}
                onChange={(event) => {
                  if (event.target.files) void upload(event.target.files)
                }}
              />
              {view === 'trash' && (
                <Button
                  variant="destructive"
                  className="h-9 gap-1.5 sm:h-8"
                  onClick={() => setEmptyTrashOpen(true)}
                  disabled={emptyableTrash.length === 0}
                >
                  <Trash2 className="size-4" /> Vaciar papelera
                </Button>
              )}
              {view === 'files' && (
                <>
                  <Button
                    variant="outline"
                    className="h-9 gap-1.5 sm:h-8"
                    onClick={() =>
                      setFolderDialog({ mode: 'create', parentId: currentFolder?.id ?? null })
                    }
                  >
                    <FolderPlus className="size-4" /> Nueva carpeta
                  </Button>
                  {currentFolder && (
                    <Button
                      variant="outline"
                      className="h-9 gap-1.5 sm:h-8"
                      onClick={() => void downloadFolder(currentFolder)}
                      disabled={zippingFolderId !== null}
                    >
                      {zippingFolderId === currentFolder.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <FileArchive className="size-4" />
                      )}
                      Descargar .zip
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-9 gap-1.5 sm:h-8"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FolderUp className="size-4" />
                    )}
                    Subir carpeta
                  </Button>
                  <Button
                    className="h-9 gap-1.5 sm:h-8"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileUp className="size-4" />
                    )}
                    Subir archivo
                  </Button>
                </>
              )}
            </div>
          </div>

          <div data-glass-surface="panel" className="rounded-xl border bg-card/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <HardDrive className="size-3.5 text-primary" />
                {FREE_STORAGE
                  ? 'Almacenamiento gratuito'
                  : STORAGE_BACKEND === 's3'
                    ? 'Almacenamiento almacenamiento S3'
                    : 'Almacenamiento Firebase'}
              </span>
              <span
                className="text-muted-foreground"
                title={
                  FREE_STORAGE
                    ? 'El uso se estima a partir del contenido codificado y los metadatos.'
                    : 'Espacio ocupado por los archivos.'
                }
              >
                {FREE_STORAGE
                  ? `≈ ${formatBytes(storedSize)} de ${formatBytes(FREE_STORAGE_QUOTA)} usados · ${quotaPercent}%`
                  : `≈ ${formatBytes(storedSize)} usados`}
              </span>
            </div>
            {FREE_STORAGE && <Progress value={quotaPercent} className="mt-2 h-1.5" />}
            <p className="mt-2 text-[0.72rem] text-muted-foreground">
              Límite por archivo: {formatBytes(UPLOAD_LIMIT)}
              {STORAGE_BACKEND === 's3' ? ' · almacenamiento S3 (10 GB gratis)' : ''} · El contenido se
              carga solo al abrirlo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              <Button
                variant={view === 'files' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setView('files')}
              >
                Archivos
              </Button>
              <Button
                variant={view === 'trash' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setView('trash')}
              >
                <Trash2 className="size-3" /> Papelera
                {trashedFiles.length > 0 && (
                  <span className="text-[0.7rem] text-muted-foreground">{trashedFiles.length}</span>
                )}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  view === 'trash' ? 'Buscar en papelera…' : 'Buscar archivos y carpetas…'
                }
                aria-label="Buscar archivos y carpetas"
                className="h-9 w-64 ps-8 pe-8 text-xs sm:h-8"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute end-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            {view === 'files' && (
              <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                <TabsList className="h-11 group-data-horizontal/tabs:h-11">
                  <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
                  <TabsTrigger value="images" className="text-xs">Imágenes</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Documentos</TabsTrigger>
                  <TabsTrigger value="text" className="text-xs">Texto</TabsTrigger>
                  <TabsTrigger value="other" className="text-xs">Otros</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <span className="text-[0.72rem] text-muted-foreground">
              {filtered.length} de {baseFiles.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={toggleSelectAllVisible}
              disabled={visibleFiles.length === 0}
            >
              {allVisibleSelected ? 'Quitar selección' : 'Seleccionar'}
            </Button>
            <div className="ms-auto flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                    <ArrowUpDown className="size-3.5" />
                    {sort === 'recent' ? 'Recientes' : sort === 'name' ? 'Nombre' : 'Tamaño'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSort('recent')}>
                    Más recientes
                    {sort === 'recent' && <Check className="ms-auto size-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort('name')}>
                    Nombre A–Z
                    {sort === 'name' && <Check className="ms-auto size-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort('size')}>
                    Tamaño (mayor primero)
                    {sort === 'size' && <Check className="ms-auto size-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
                <Button
                  variant={layout === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-7"
                  aria-label="Vista de cuadrícula"
                  aria-pressed={layout === 'grid'}
                  onClick={() => setLayout('grid')}
                >
                  <Grid2x2 className="size-3.5" />
                </Button>
                <Button
                  variant={layout === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-7"
                  aria-label="Vista de lista"
                  aria-pressed={layout === 'list'}
                  onClick={() => setLayout('list')}
                >
                  <List className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    selectFolder(null)
                    setView('files')
                  }}
                  className="min-h-6 py-1 transition-colors hover:text-foreground"
                >
                  Archivos
                </button>
                {view === 'trash' ? (
                  <>
                    <ChevronRight className="size-3" />
                    <span className="font-medium text-foreground">Papelera</span>
                  </>
                ) : showAllFiles ? (
                  <>
                    <ChevronRight className="size-3" />
                    <span className="font-medium text-foreground">Todos los archivos</span>
                  </>
                ) : (
                  breadcrumb.map((folder) => (
                    <span key={folder.id} className="flex items-center gap-1.5">
                      <ChevronRight className="size-3" />
                      <button
                        type="button"
                        onClick={() => selectFolder(folder.id)}
                        title={folder.name}
                        className="min-h-6 max-w-40 truncate py-1 transition-colors hover:text-foreground"
                      >
                        {folder.name}
                      </button>
                    </span>
                  ))
                )}
                {query && (
                  <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-[0.7rem]">
                    Búsqueda en todo el workspace
                  </span>
                )}
              </div>

              {view === 'files' && (
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors [@media(hover:none)]:hidden',
                    dragging ? 'border-primary bg-primary/5' : 'border-border/80 bg-card/30',
                  )}
                >
                  <UploadCloud className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">Arrastra archivos o carpetas aquí</p>
                    <p className="truncate text-[0.72rem] text-muted-foreground">
                      {currentFolder ? `Se subirán a “${currentFolder.name}”` : 'Se subirán a la raíz'} ·
                      máx. {formatBytes(UPLOAD_LIMIT)} por archivo
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <FolderUp className="size-3.5" /> Carpeta
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                  >
                    Seleccionar
                  </Button>
                </div>
              )}

              {uploading && (
                <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <UploadCloud className="size-4 text-primary" />
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="truncate">Subiendo {uploadLabel || 'archivo'}…</span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </div>
              )}

              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs shadow-sm">
                  <span className="font-medium">
                    {selectedFiles.length}{' '}
                    {selectedFiles.length === 1 ? 'seleccionado' : 'seleccionados'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={toggleSelectAllVisible}
                  >
                    {allVisibleSelected ? 'Quitar selección' : 'Seleccionar visibles'}
                  </Button>
                  <div className="ms-auto flex flex-wrap items-center gap-1.5">
                    {view === 'files' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => void downloadSelection()}
                        >
                          <FileArchive className="size-3.5" /> Descargar .zip
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setBulkMoveOpen(true)}
                        >
                          <FolderPlus className="size-3.5" /> Mover
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setBulkTrashOpen(true)}
                        >
                          <Trash2 className="size-3.5" /> Papelera
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => void bulkRestore()}
                        >
                          <RotateCcw className="size-3.5" /> Restaurar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setBulkPurgeOpen(true)}
                        >
                          <Trash2 className="size-3.5" /> Eliminar
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={clearSelection}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {matchingFolders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.72rem] font-medium text-muted-foreground">
                    Carpetas
                  </span>
                  {matchingFolders.slice(0, 6).map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => {
                        selectFolder(folder.id)
                        setQuery('')
                      }}
                      className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[0.72rem] transition-colors hover:border-primary/30 hover:bg-muted"
                      title={folderPathNames(folders, folder.id)}
                    >
                      <Folder className="size-3 text-amber-500" />
                      <span className="max-w-40 truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="h-48 animate-pulse rounded-2xl border bg-muted/30" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={view === 'trash' ? Trash2 : FolderPlus}
                  title={
                    query
                      ? matchingFolders.length > 0
                        ? 'Sin archivos coincidentes'
                        : 'Sin resultados'
                      : filter !== 'all'
                        ? `No hay ${FILTER_LABELS[filter]} aquí`
                        : view === 'trash'
                          ? 'La papelera está vacía'
                          : showAllFiles
                            ? 'La biblioteca está vacía'
                            : currentFolder
                              ? 'Esta carpeta está vacía'
                              : 'No hay archivos en la raíz'
                  }
                  description={
                    query
                      ? matchingFolders.length > 0
                        ? 'Hay carpetas que coinciden con la búsqueda. Ábrelas para ver su contenido.'
                        : 'Prueba otro término o cambia el filtro.'
                      : filter !== 'all'
                        ? 'Cambia el filtro para ver el resto del contenido.'
                        : view === 'trash'
                          ? 'Los archivos que envíes a la papelera aparecerán aquí.'
                          : showAllFiles
                            ? 'Sube archivos o crea carpetas para empezar a organizarlos.'
                            : currentFolder
                              ? 'Sube archivos o crea subcarpetas para organizarlos.'
                              : 'La biblioteca tiene archivos dentro de las carpetas. Explora el árbol o sube uno aquí.'
                  }
                  action={
                    filter !== 'all' ? (
                      <Button onClick={() => setFilter('all')}>Ver todos</Button>
                    ) : view === 'files' ? (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button onClick={() => inputRef.current?.click()}>
                          <UploadCloud className="size-4" /> Subir archivo
                        </Button>
                        <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
                          <FolderUp className="size-4" /> Subir carpeta
                        </Button>
                      </div>
                    ) : undefined
                  }
                />
              ) : layout === 'grid' ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleFiles.map((file) => {
                    const uploader = members.find((member) => member.uid === file.uploadedBy)
                    const canManage = canManageFile(file)
                    const folderName = folderPathNames(folders, file.folderId)
                    const selected = selectedIds.has(file.id)
                    return (
                      <div
                        key={file.id}
                        data-glass-surface="panel"
                        data-glass-selected={selected || undefined}
                        draggable={view === 'files' && canManage}
                        onDragStart={(event) => {
                          if (view !== 'files' || !canManage) return
                          event.dataTransfer.setData('application/x-openqomu-file', file.id)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        className={cn(
                          'group relative overflow-hidden rounded-2xl border bg-card/70 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5',
                          selected && 'border-primary/50 ring-1 ring-primary/20',
                        )}
                      >
                        <button
                          type="button"
                          className="relative block w-full"
                          onClick={() => openPreview(file)}
                          aria-label={`Previsualizar ${file.name}`}
                        >
                          <FileThumb file={file} className="h-28 w-full" auto={false} />
                          <span className="absolute end-2 top-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[0.7rem] font-medium backdrop-blur">
                            {fileKindLabel(file)}
                          </span>
                        </button>
                        {renderSelection(file, 'absolute start-2 top-2 z-10')}
                        <div className="p-3">
                          <div className="flex items-start gap-2">
                            <FileIcon file={file} className="mt-0.5 size-3.5 shrink-0" />
                            <button
                              type="button"
                              onClick={() => openPreview(file)}
                              className="min-w-0 flex-1 text-start"
                              title={file.name}
                            >
                              <p
                                className="truncate text-xs font-medium leading-snug"
                                title={file.name}
                              >
                                {file.name}
                              </p>
                              <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                                {formatBytes(file.size)} · {formatRelative(file.updatedAt)}
                              </p>
                              {(query || showAllFiles) && folderName && (
                                <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">
                                  {folderName}
                                </p>
                              )}
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hover-action size-7 shrink-0 text-muted-foreground"
                                  aria-label="Acciones del archivo"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {renderFileMenu(file, canManage)}
                            </DropdownMenu>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2 text-[0.7rem] text-muted-foreground">
                            {uploader ? (
                              <>
                                <UserAvatar
                                  name={uploader.displayName}
                                  photoURL={uploader.photoURL}
                                  size="xs"
                                  className="size-4 text-[0.5rem]"
                                />
                                <span className="truncate">{uploader.displayName}</span>
                              </>
                            ) : (
                              <span>Subido al espacio</span>
                            )}
                            {view === 'trash' && file.trashedAt && (
                              <span className="ms-auto text-[0.7rem] text-amber-600 dark:text-amber-400">
                                En papelera {formatRelative(file.trashedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div data-glass-surface="panel" className="overflow-hidden rounded-xl border bg-card/40">
                  {visibleFiles.map((file) => {
                    const canManage = canManageFile(file)
                    const folderName = folderPathNames(folders, file.folderId)
                    const selected = selectedIds.has(file.id)
                    return (
                      <div
                        key={file.id}
                        data-glass-surface="panel"
                        data-glass-selected={selected || undefined}
                        draggable={view === 'files' && canManage}
                        onDragStart={(event) => {
                          if (view !== 'files' || !canManage) return
                          event.dataTransfer.setData('application/x-openqomu-file', file.id)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        className={cn(
                          'group relative flex items-center gap-3 border-b border-border/60 px-3 py-2 transition-colors last:border-b-0 hover:bg-muted/40',
                          selected && 'bg-primary/5',
                        )}
                      >
                        {renderSelection(file)}
                        <button
                          type="button"
                          onClick={() => openPreview(file)}
                          aria-label={`Previsualizar ${file.name}`}
                          className="relative size-10 shrink-0 overflow-hidden rounded-lg border bg-muted/40"
                        >
                          <FileThumb file={file} className="size-10" auto={false} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openPreview(file)}
                          className="min-w-0 flex-1 text-start"
                          title={file.name}
                        >
                          <p className="truncate text-xs font-medium" title={file.name}>
                            {file.name}
                          </p>
                          <p className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">
                            {fileKindLabel(file)} · {formatBytes(file.size)} ·{' '}
                            {formatRelative(file.updatedAt)}
                            {folderName ? ` · ${folderName}` : ''}
                          </p>
                        </button>
                        {view === 'trash' && file.trashedAt && (
                          <span className="hidden shrink-0 text-[0.7rem] text-amber-600 dark:text-amber-400 sm:inline">
                            En papelera {formatRelative(file.trashedAt)}
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover-action size-7 shrink-0 text-muted-foreground"
                              aria-label="Acciones del archivo"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          {renderFileMenu(file, canManage)}
                        </DropdownMenu>
                      </div>
                    )
                  })}
                </div>
              )}

              {remainingFiles > 0 && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleLimit((value) => value + PAGE_SIZE)}
                  >
                    Cargar más ({remainingFiles})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-4 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-primary bg-background/80 backdrop-blur">
          <div className="text-center">
            <UploadCloud className="mx-auto size-10 text-primary" />
            <p className="mt-3 text-lg font-semibold">Suelta para subir</p>
            <p className="text-sm text-muted-foreground">
              {currentFolder ? `A la carpeta “${currentFolder.name}”` : 'A la raíz del workspace'}
            </p>
          </div>
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[85svh] overflow-hidden p-0 sm:max-w-4xl"
        >
          {preview && (
            <div className="flex max-h-[85svh] min-h-0 flex-col">
              <div className="border-b px-4 py-3">
                <div className="flex items-start gap-2">
                  <FileIcon file={preview} className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="truncate text-sm" title={preview.name}>
                      {preview.name}
                    </DialogTitle>
                    <p className="truncate text-[0.72rem] text-muted-foreground">
                      {fileKindLabel(preview)} · {formatBytes(preview.size)}
                      {preview.folderId ? ` · ${folderPathNames(folders, preview.folderId)}` : ''}
                      {(() => {
                        const uploader = members.find(
                          (member) => member.uid === preview.uploadedBy,
                        )
                        return uploader ? ` · ${uploader.displayName}` : ''
                      })()}
                      {' · '}
                      {formatRelative(preview.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() => goPreview(-1)}
                    disabled={previewIndex <= 0}
                    aria-label="Archivo anterior"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() => goPreview(1)}
                    disabled={previewIndex < 0 || previewIndex >= previewList.length - 1}
                    aria-label="Archivo siguiente"
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={closePreview}
                    aria-label="Cerrar documento"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {canEditText(preview) && (
                    <Button variant="outline" size="sm" onClick={() => setEditorFile(preview)}>
                      <FilePenLine className="size-3.5" /> Editar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const url = await resolvePreview()
                      await openResolvedFile(url, preview.name)
                    }}
                    disabled={previewLoading}
                  >
                    {previewLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    Descargar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const url = await resolvePreview()
                      await openResolvedFile(url)
                    }}
                    disabled={previewLoading}
                  >
                    <ExternalLink className="size-3.5" /> Abrir en pestaña
                  </Button>
                </div>
              </div>
              <div
                className={cn(
                  'min-h-0 w-full min-w-0 flex-1 overflow-auto break-words bg-muted/30 p-4',
                  isTextFile(preview) ? 'block' : 'grid place-items-center',
                )}
              >
                {previewLoading ? (
                  <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Cargando archivo…
                  </div>
                ) : isImageFile(preview) && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={preview.name}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className="max-h-[70svh] w-auto rounded-lg object-contain shadow-lg"
                  />
                ) : isPdfFile(preview) && previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title={preview.name}
                    className="h-[70svh] w-full rounded-lg border bg-background"
                  />
                ) : isMarkdownFile(preview) ? (
                  <div className="mx-auto w-full max-w-3xl">
                    {previewTextLoading ? (
                      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Cargando texto…
                      </div>
                    ) : previewText ? (
                      <MarkdownView content={previewText} />
                    ) : (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        Archivo vacío.
                      </p>
                    )}
                  </div>
                ) : isTextFile(preview) ? (
                  <div className="w-full">
                    {previewTextLoading ? (
                      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Cargando texto…
                      </div>
                    ) : (
                      <pre className="scrollbar-thin max-h-[65svh] overflow-auto rounded-lg border bg-background p-4 font-mono text-xs leading-relaxed">
                        {previewText || 'Archivo vacío.'}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="mx-auto grid size-16 place-items-center rounded-lg border bg-card">
                      <FileIcon file={preview} className="size-7" />
                    </div>
                    <p className="mt-4 text-sm font-medium">Vista previa no disponible</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Descarga el archivo para abrirlo con tu aplicación.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={async () => {
                        const url = await resolvePreview()
                        await openResolvedFile(url, preview.name)
                      }}
                    >
                      <Download className="size-4" /> Descargar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NameDialog
        open={folderDialog !== null}
        onOpenChange={(open) => !open && setFolderDialog(null)}
        title={folderDialog?.mode === 'rename' ? 'Renombrar carpeta' : 'Nueva carpeta'}
        description={
          folderDialog?.mode === 'create'
            ? folderDialog.parentId
              ? 'Se creará dentro de la carpeta seleccionada.'
              : 'Se creará en la raíz del workspace.'
            : undefined
        }
        initialValue={folderDialog?.mode === 'rename' ? folderDialog.folder.name : ''}
        placeholder="Ej. Diseño, Contratos, Beta…"
        submitLabel={folderDialog?.mode === 'rename' ? 'Renombrar' : 'Crear carpeta'}
        onSubmit={saveFolder}
      />

      <NameDialog
        open={Boolean(renameFile)}
        onOpenChange={(open) => !open && setRenameFile(null)}
        title="Renombrar archivo"
        initialValue={renameFile?.name ?? ''}
        submitLabel="Renombrar"
        onSubmit={rename}
      />

      <MoveFileDialog
        open={Boolean(moveFile)}
        onOpenChange={(open) => !open && setMoveFile(null)}
        folders={folders}
        currentFolderId={moveFile?.folderId ?? null}
        fileName={moveFile?.name ?? ''}
        onMove={moveTo}
      />

      <MoveFileDialog
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        folders={folders}
        currentFolderId={currentFolder?.id ?? null}
        fileName=""
        fileCount={selectedFiles.length}
        onMove={moveSelectionTo}
      />

      <FileEditorDialog
        file={editorFile}
        open={Boolean(editorFile)}
        onOpenChange={(open) => !open && setEditorFile(null)}
        canEdit={Boolean(editorFile && canEditText(editorFile))}
      />

      <ConfirmDialog
        open={Boolean(trashTarget)}
        onOpenChange={(open) => !open && setTrashTarget(null)}
        title="¿Mover a la papelera?"
        description="El archivo se ocultará de la biblioteca y de los adjuntos, pero podrás restaurarlo desde la papelera."
        confirmLabel="Mover a papelera"
        onConfirm={trashFile}
      />

      <ConfirmDialog
        open={Boolean(purgeTarget)}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
        title="¿Eliminar definitivamente?"
        description="Se borrará el archivo y su contenido. Esta acción no se puede deshacer."
        confirmLabel="Eliminar definitivamente"
        onConfirm={purgeFile}
      />

      <ConfirmDialog
        open={bulkTrashOpen}
        onOpenChange={setBulkTrashOpen}
        title="¿Mover a la papelera?"
        description={`Se moverán ${selectedFiles.length} ${
          selectedFiles.length === 1 ? 'archivo' : 'archivos'
        } a la papelera. Podrás restaurarlos después.`}
        confirmLabel="Mover a papelera"
        onConfirm={bulkTrash}
      />

      <ConfirmDialog
        open={bulkPurgeOpen}
        onOpenChange={setBulkPurgeOpen}
        title="¿Eliminar definitivamente?"
        description={`Se eliminarán ${selectedFiles.length} ${
          selectedFiles.length === 1 ? 'archivo' : 'archivos'
        } de forma permanente. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar definitivamente"
        onConfirm={bulkPurge}
      />

      <ConfirmDialog
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        title="¿Vaciar la papelera?"
        description={`Se eliminarán definitivamente ${
          emptyableTrash.length === 1 ? '1 archivo' : `${emptyableTrash.length} archivos`
        }. Esta acción no se puede deshacer.`}
        confirmLabel="Vaciar papelera"
        onConfirm={emptyTrash}
      />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Bold,
  Check,
  ChevronRight,
  Cloud,
  CloudOff,
  Code,
  Copy,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  MoreHorizontal,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Page } from '@/domain/entities/pages'
import {
  descendantIds,
  pageBreadcrumb,
} from '@/domain/services/page-service'
import { formatRelative } from '@/lib/date'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { EmptyState } from '@/presentation/components/common/empty-state'
import { ConfirmDialog } from '@/presentation/components/common/confirm-dialog'
import { EmojiPicker } from '@/presentation/components/common/emoji-picker'
import { CreatePageDialog } from '@/presentation/features/pages/create-page-dialog'
import { cn } from '@/lib/utils'

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

function parseContent(content: string) {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    if (parsed && typeof parsed === 'object') return parsed
    return EMPTY_DOC
  } catch {
    return EMPTY_DOC
  }
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'size-7 rounded-md text-muted-foreground',
            active && 'bg-primary/10 text-primary',
          )}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const applyLink = () => {
    const href = linkUrl.trim()
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkOpen(false)
      return
    }
    const normalized = /^https?:\/\//i.test(href) ? href : `https://${href}`
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
    setLinkOpen(false)
    setLinkUrl('')
  }

  return (
    <div data-glass-surface="chrome" className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-background/90 py-1.5 backdrop-blur-xl">
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Negrita (⌘B)"
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Cursiva (⌘I)"
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Subrayado"
      >
        <UnderlineIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Tachado"
      >
        <Strikethrough className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Código inline"
      >
        <Code className="size-3.5" />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      {([1, 2, 3] as const).map((level) => {
        const Icon = level === 1 ? Heading1 : level === 2 ? Heading2 : Heading3
        return (
          <ToolbarButton
            key={level}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            label={`Título ${level}`}
          >
            <Icon className="size-3.5" />
          </ToolbarButton>
        )
      })}
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Lista"
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Lista numerada"
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        label="Lista de tareas"
      >
        <ListChecks className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Cita"
      >
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        label="Bloque de código"
      >
        <Code className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('link')}
        onClick={() => {
          setLinkUrl(editor.getAttributes('link').href ?? '')
          setLinkOpen(true)
        }}
        label="Enlace"
      >
        <Link2 className="size-3.5" />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        label="Deshacer"
      >
        <Undo2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        label="Rehacer"
      >
        <Redo2 className="size-3.5" />
      </ToolbarButton>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir enlace</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://ejemplo.com"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              }
            }}
          />
          <DialogFooter>
            {editor.isActive('link') && (
              <Button
                variant="ghost"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run()
                  setLinkOpen(false)
                }}
              >
                <Unlink className="size-4" /> Quitar
              </Button>
            )}
            <Button onClick={applyLink}>Aplicar enlace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function PageEditorPage() {
  const { pageId } = useParams()
  const { workspace, pages, loading, can, uid } = useWorkspaceData()
  const page = pages.find((item) => item.id === pageId)

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon={FileText}
          title="Página no encontrada"
          description="Puede que se haya archivado o eliminado."
          action={
            can('page.create') ? (
              <CreatePageDialog
                trigger={
                  <Button>
                    <FileText className="size-4" /> Crear página
                  </Button>
                }
              />
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <PageEditor
      key={page.id}
      page={page}
      workspaceId={workspace.id}
      pages={pages}
      uid={uid}
      canManage={can('page.manage')}
    />
  )
}

function PageEditor({
  page,
  workspaceId,
  pages,
  uid,
  canManage,
}: {
  page: Page
  workspaceId: string
  pages: Page[]
  uid: string
  canManage: boolean
}) {
  const container = useContainer()
  const navigate = useNavigate()
  const [title, setTitle] = useState(page.title)
  const [icon, setIcon] = useState(page.icon)
  const [status, setStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved')
  const [words, setWords] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const contentRef = useRef(page.content)
  const dirtyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const content = useMemo(() => parseContent(page.content), [page.content])

  const saveContent = useCallback(async () => {
    if (!dirtyRef.current) return
    setStatus('saving')
    try {
      await container.pages.update(workspaceId, page.id, {
        content: contentRef.current,
        updatedBy: uid,
      })
      dirtyRef.current = false
      setStatus('saved')
    } catch (error) {
      setStatus('error')
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la página.')
    }
  }, [container, page.id, uid, workspaceId])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({
        placeholder: 'Empieza a escribir. Usa la barra superior para dar formato…',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
    onCreate: ({ editor: current }) => {
      setWords(current.getText().split(/\s+/).filter(Boolean).length)
    },
    onUpdate: ({ editor: current }) => {
      contentRef.current = JSON.stringify(current.getJSON())
      dirtyRef.current = true
      setWords(current.getText().split(/\s+/).filter(Boolean).length)
      setStatus('unsaved')
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => void saveContent(), 850)
    },
  })

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (dirtyRef.current) {
        void container.pages.update(workspaceId, page.id, {
          content: contentRef.current,
          updatedBy: uid,
        })
      }
    }
  }, [container, page.id, uid, workspaceId])

  const saveTitle = () => {
    const trimmed = title.trim() || 'Sin título'
    setTitle(trimmed)
    if (trimmed === page.title) return
    setStatus('saving')
    void container.pages
      .update(workspaceId, page.id, { title: trimmed, updatedBy: uid })
      .then(() => setStatus('saved'))
      .catch((error) => {
        setStatus('error')
        toast.error(error instanceof Error ? error.message : 'No se pudo guardar el título.')
      })
  }

  const changeIcon = (next: string) => {
    setIcon(next)
    void container.pages
      .update(workspaceId, page.id, { icon: next, updatedBy: uid })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el icono.'),
      )
  }

  const moveTo = async (parentId: string | null) => {
    try {
      await container.pages.update(workspaceId, page.id, { parentId, updatedBy: uid })
      toast.success(parentId ? 'Página movida.' : 'Página convertida en raíz.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo mover la página.')
    }
  }

  const breadcrumb = pageBreadcrumb(pages, page.id)
  const excluded = new Set([page.id, ...descendantIds(pages, page.id)])
  const moveTargets = pages.filter((candidate) => !excluded.has(candidate.id))
  const canDelete = canManage || page.createdBy === uid
  const statusLabel =
    status === 'saving'
      ? 'Guardando…'
      : status === 'unsaved'
        ? 'Cambios sin guardar'
        : status === 'error'
          ? 'Error al guardar'
          : 'Guardado'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border/70 px-3 text-xs text-muted-foreground sm:px-5">
        <Link to={`/w/${workspaceId}/pages`} className="transition-colors hover:text-foreground">
          Documentos
        </Link>
        {breadcrumb.slice(-2).map((item) => (
          <span key={item.id} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3 shrink-0" />
            <Link
              to={`/w/${workspaceId}/pages/${item.id}`}
              className={cn(
                'max-w-40 truncate transition-colors hover:text-foreground',
                item.id === page.id && 'font-medium text-foreground',
              )}
            >
              {item.title}
            </Link>
          </span>
        ))}
        <div className="ms-auto flex items-center gap-1">
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.62rem] sm:inline-flex',
              status === 'error'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'bg-muted/40',
            )}
          >
            {status === 'saving' ? (
              <Loader2 className="size-3 animate-spin" />
            ) : status === 'error' ? (
              <CloudOff className="size-3" />
            ) : (
              <Cloud className="size-3" />
            )}
            {statusLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Copiar enlace"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href)
              toast.success('Enlace de la página copiado.')
            }}
          >
            <Copy className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Opciones de la página">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Mover dentro de</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void moveTo(null)}>
                <FileText className="size-4" /> Nivel raíz
                {page.parentId === null && <Check className="ms-auto size-3.5" />}
              </DropdownMenuItem>
              {moveTargets.map((target) => (
                <DropdownMenuItem key={target.id} onClick={() => void moveTo(target.id)}>
                  <span>{target.icon}</span>
                  <span className="truncate">{target.title}</span>
                  {page.parentId === target.id && <Check className="ms-auto size-3.5" />}
                </DropdownMenuItem>
              ))}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" /> Eliminar página
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8">
          <EmojiPicker
            onPick={changeIcon}
            align="start"
            trigger={
              <button
                type="button"
                className="mb-3 grid size-12 place-items-center rounded-xl border bg-card text-2xl shadow-sm transition-transform hover:scale-105"
                aria-label="Cambiar icono"
              >
                {icon}
              </button>
            }
          />
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            placeholder="Sin título"
            maxLength={160}
            className="page-title-input"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {(() => {
              const ancestors = breadcrumb
                .slice(0, -1)
                .map((item) => item.title)
                .filter(Boolean)
              return `${ancestors.length ? `${ancestors.join(' / ')} · ` : ''}Editado ${formatRelative(page.updatedAt)}`
            })()}
          </p>

          <div className="openqomu-editor mt-6">
            {editor ? <EditorToolbar editor={editor} /> : <Skeleton className="h-9 w-full" />}
            <div data-glass-surface="panel" data-glass-document className="pt-5">
              {editor ? (
                <EditorContent editor={editor} />
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between border-t pt-3 text-[0.65rem] text-muted-foreground">
            <span>{words} palabras</span>
            <span>Se guarda automáticamente</span>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar esta página?"
        description="Sus subpáginas se moverán al nivel raíz para que no se pierda nada."
        confirmLabel="Eliminar página"
        onConfirm={async () => {
          try {
            await container.pages.remove(workspaceId, page.id)
            toast.success('Página eliminada.')
            navigate(`/w/${workspaceId}/pages`)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la página.')
          }
        }}
      />
    </div>
  )
}

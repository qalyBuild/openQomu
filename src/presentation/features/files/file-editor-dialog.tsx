import { useEffect, useState } from 'react'
import { Code2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { FileMeta } from '@/domain/entities/chat'
import { formatBytes } from '@/domain/services/file-service'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { invalidateFileUrlCache } from '@/presentation/hooks/use-file-url'

export function FileEditorDialog({
  file,
  open,
  onOpenChange,
  canEdit,
}: {
  file: FileMeta | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canEdit: boolean
}) {
  const container = useContainer()
  const { workspace } = useWorkspaceData()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !file) return
    let cancelled = false
    setLoading(true)
    setError(null)
    container.files
      .readText(workspace.id, file)
      .then((text) => {
        if (!cancelled) setValue(text)
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo leer el archivo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [container, file, open, workspace.id])

  const save = async () => {
    if (!file || !canEdit) return
    setSaving(true)
    setError(null)
    try {
      await container.files.updateText(workspace.id, file, value)
      invalidateFileUrlCache(workspace.id, file.id)
      toast.success('Archivo guardado.')
      onOpenChange(false)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar el archivo.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const bytes = new Blob([value]).size
  const lines = value ? value.split('\n').length : 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Code2 className="size-4 text-primary" />
            <span className="truncate">{file?.name ?? 'Editor'}</span>
          </DialogTitle>
          <DialogDescription>
            {formatBytes(bytes)} · {lines} líneas · {canEdit ? 'editable' : 'solo lectura'}
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando contenido…
            </div>
          ) : error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : (
            <Textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              readOnly={!canEdit}
              spellCheck={false}
              className="min-h-[60vh] resize-none border-0 bg-muted/30 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
            />
          )}
        </div>
        <DialogFooter className="border-t px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {canEdit && (
            <Button onClick={() => void save()} disabled={saving || loading || Boolean(error)}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar cambios
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

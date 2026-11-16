import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { PAGE_TEMPLATES } from '@/presentation/features/pages/page-templates'
import { cn } from '@/lib/utils'

export function CreatePageDialog({
  trigger,
  parentId = null,
}: {
  trigger: React.ReactNode
  parentId?: string | null
}) {
  const container = useContainer()
  const { workspace, uid, can } = useWorkspaceData()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState('blank')
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState(false)
  const template = PAGE_TEMPLATES.find((item) => item.id === templateId) ?? PAGE_TEMPLATES[0]

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!can('page.create')) {
      toast.error('No tienes permisos para crear páginas.')
      return
    }
    setPending(true)
    try {
      const page = await container.pages.create({
        workspaceId: workspace.id,
        title: title.trim() || template.title,
        icon: template.icon,
        content: template.content,
        parentId,
        createdBy: uid,
      })
      toast.success('Página creada.')
      setOpen(false)
      setTitle('')
      navigate(`/w/${workspace.id}/pages/${page.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la página.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Nueva página
          </DialogTitle>
          <DialogDescription>
            Documenta decisiones, procesos o ideas. Elige una plantilla para empezar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page-title">Título</Label>
            <Input
              id="page-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={template.title}
              maxLength={160}
            />
          </div>
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAGE_TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplateId(item.id)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                    templateId === item.id
                      ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span>
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Crear página
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

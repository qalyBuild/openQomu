import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, Loader2, Lock, Plus } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useContainer } from '@/app/auth-provider'
import { useWorkspaceData } from '@/app/workspace-data-provider'
import { cn } from '@/lib/utils'

export function CreateChannelDialog({ trigger }: { trigger: React.ReactNode }) {
  const container = useContainer()
  const { workspace, uid, can } = useWorkspaceData()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'public' | 'private'>('public')
  const [pending, setPending] = useState(false)

  const reset = () => {
    setName('')
    setDescription('')
    setType('public')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!can('channel.create')) {
      toast.error('No tienes permisos para crear canales.')
      return
    }
    setPending(true)
    try {
      const channel = await container.channels.create({
        workspaceId: workspace.id,
        name,
        description,
        type,
        createdBy: uid,
      })
      toast.success(`Canal #${channel.name} creado.`)
      setOpen(false)
      reset()
      navigate(`/w/${workspace.id}/c/${channel.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el canal.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear un canal</DialogTitle>
          <DialogDescription>
            Organiza las conversaciones por tema. Los canales públicos son visibles para todo el
            equipo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Nombre</Label>
            <div className="relative">
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                #
              </span>
              <Input
                id="channel-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="producto"
                className="ps-7"
                maxLength={40}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se normaliza a minúsculas y sin espacios. Conserva acentos y la ñ.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-description">Descripción</Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="¿De qué se habla en este canal?"
              rows={3}
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  value: 'public',
                  icon: Hash,
                  title: 'Público',
                  hint: 'Todo el workspace',
                },
                {
                  value: 'private',
                  icon: Lock,
                  title: 'Privado',
                  hint: 'Solo personas invitadas',
                },
              ] as const
            ).map((option) => {
              const Icon = option.icon
              const active = type === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                    active
                      ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                      : 'hover:border-border hover:bg-muted/40',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4" /> {option.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </button>
              )
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Crear canal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

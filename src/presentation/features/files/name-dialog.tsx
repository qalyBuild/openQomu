import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label = 'Nombre',
  initialValue = '',
  placeholder,
  submitLabel = 'Guardar',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label?: string
  initialValue?: string
  placeholder?: string
  submitLabel?: string
  onSubmit: (value: string) => Promise<void> | void
}) {
  const [value, setValue] = useState(initialValue)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [initialValue, open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    setPending(true)
    try {
      await onSubmit(value.trim())
      onOpenChange(false)
    } catch {
      // El llamador ya muestra el error; mantenemos el diálogo abierto.
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name-dialog-input">{label}</Label>
            <Input
              id="name-dialog-input"
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !value.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

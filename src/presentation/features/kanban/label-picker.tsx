import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TASK_LABELS } from '@/domain/entities/kanban'
import {
  MAX_TASK_LABEL_LENGTH,
  MAX_TASK_LABELS,
  normalizeLabels,
} from '@/domain/services/task-service'
import { cn } from '@/lib/utils'

export function LabelPicker({
  value,
  suggested,
  onToggle,
  disabled = false,
}: {
  value: string[]
  suggested?: string[]
  onToggle: (label: string) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [created, setCreated] = useState<string[]>([])

  const labels = useMemo(() => {
    const base = suggested ?? TASK_LABELS
    const baseSet = new Set<string>(base)
    const extras = [...new Set([...created, ...value])]
      .filter((label) => !baseSet.has(label))
      .sort((a, b) => a.localeCompare(b, 'es'))
    return [...base, ...extras]
  }, [created, suggested, value])

  const addLabel = () => {
    if (!draft.trim()) return
    let label: string
    try {
      label = normalizeLabels([draft])[0] ?? ''
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Etiqueta no válida.')
      return
    }
    if (!label) return
    if (!labels.includes(label)) setCreated((current) => [...current, label])
    if (!value.includes(label)) {
      if (value.length >= MAX_TASK_LABELS) {
        toast.error(`Puedes añadir como máximo ${MAX_TASK_LABELS} etiquetas.`)
        return
      }
      onToggle(label)
    }
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => {
          const selected = value.includes(label)
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(label)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[0.65rem] transition-colors disabled:opacity-60',
                selected
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addLabel()
            }
          }}
          placeholder="Nueva etiqueta personalizada…"
          maxLength={MAX_TASK_LABEL_LENGTH}
          disabled={disabled}
          className="h-7 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-xs"
          onClick={addLabel}
          disabled={disabled || !draft.trim()}
        >
          <Plus className="size-3" /> Añadir
        </Button>
      </div>
    </div>
  )
}
